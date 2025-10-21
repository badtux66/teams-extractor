"""
Unit tests for the processor server
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
import os
import tempfile
import sqlite3
from pathlib import Path

# Set test environment variables before importing
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["N8N_WEBHOOK_URL"] = "http://test.example.com/webhook"
os.environ["PROCESSOR_DATA_DIR"] = tempfile.mkdtemp()

from processor.server import app, init_db, insert_message, update_message, fetch_message
from mcp.agent import TeamsResolution


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def test_db():
    """Create temporary test database"""
    test_dir = tempfile.mkdtemp()
    os.environ["PROCESSOR_DATA_DIR"] = test_dir
    init_db()
    yield test_dir
    # Cleanup
    import shutil
    shutil.rmtree(test_dir, ignore_errors=True)


@pytest.fixture
def sample_resolution():
    """Sample Teams resolution message"""
    return TeamsResolution(
        messageId="test-123",
        channel="Test Channel",
        author="Test User",
        timestamp="2025-10-21T14:30:00Z",
        classification={"type": "localized"},
        resolutionText="Güncellendi",
        quotedRequest={
            "text": "Please deploy v1.2.3",
            "author": "Requester",
            "timestamp": "2025-10-21T14:00:00Z"
        },
        permalink="https://teams.microsoft.com/l/message/test"
    )


class TestHealthEndpoint:
    """Tests for /health endpoint"""

    def test_health_check_success(self, client):
        """Test health check returns 200"""
        with patch('processor.server.app.state') as mock_state:
            mock_agent = Mock()
            mock_agent.model = "gpt-4.1-mini"
            mock_state.agent = mock_agent

            response = client.get("/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["model"] == "gpt-4.1-mini"
            assert data["n8n_connected"] is True


class TestIngestEndpoint:
    """Tests for /ingest endpoint"""

    def test_ingest_valid_message(self, client, sample_resolution):
        """Test ingesting a valid message"""
        with patch('processor.server.insert_message', return_value=1), \
             patch('processor.server.asyncio.create_task'):

            response = client.post(
                "/ingest",
                json=sample_resolution.model_dump(by_alias=True)
            )

            assert response.status_code == 202
            data = response.json()
            assert data["id"] == 1
            assert data["status"] == "queued"

    def test_ingest_missing_required_fields(self, client):
        """Test ingesting message with missing required fields"""
        response = client.post(
            "/ingest",
            json={"channel": "Test"}  # Missing author, classification, resolutionText
        )

        assert response.status_code == 422

    def test_ingest_with_api_key(self, client, sample_resolution):
        """Test API key validation"""
        os.environ["PROCESSOR_API_KEY"] = "secret-key"

        # Without API key - should fail
        response = client.post(
            "/ingest",
            json=sample_resolution.model_dump(by_alias=True)
        )
        assert response.status_code == 401

        # With correct API key - should succeed
        with patch('processor.server.insert_message', return_value=1), \
             patch('processor.server.asyncio.create_task'):

            response = client.post(
                "/ingest",
                headers={"X-API-Key": "secret-key"},
                json=sample_resolution.model_dump(by_alias=True)
            )
            assert response.status_code == 202

        # Cleanup
        del os.environ["PROCESSOR_API_KEY"]

    def test_correlation_id_in_response(self, client, sample_resolution):
        """Test that correlation ID is returned in headers"""
        with patch('processor.server.insert_message', return_value=1), \
             patch('processor.server.asyncio.create_task'):

            response = client.post(
                "/ingest",
                json=sample_resolution.model_dump(by_alias=True)
            )

            assert "x-correlation-id" in response.headers

    def test_custom_correlation_id(self, client, sample_resolution):
        """Test using custom correlation ID"""
        custom_id = "custom-correlation-123"

        with patch('processor.server.insert_message', return_value=1), \
             patch('processor.server.asyncio.create_task'):

            response = client.post(
                "/ingest",
                headers={"X-Correlation-ID": custom_id},
                json=sample_resolution.model_dump(by_alias=True)
            )

            assert response.headers["x-correlation-id"] == custom_id


class TestGetMessageEndpoint:
    """Tests for /messages/{id} endpoint"""

    def test_get_existing_message(self, client, test_db, sample_resolution):
        """Test retrieving an existing message"""
        # Insert a message
        record_id = insert_message(sample_resolution)

        # Retrieve it
        response = client.get(f"/messages/{record_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == record_id
        assert data["channel"] == "Test Channel"
        assert data["author"] == "Test User"
        assert data["status"] == "received"

    def test_get_nonexistent_message(self, client):
        """Test retrieving a message that doesn't exist"""
        response = client.get("/messages/99999")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestDatabaseOperations:
    """Tests for database operations"""

    def test_insert_message(self, test_db, sample_resolution):
        """Test inserting a message into database"""
        record_id = insert_message(sample_resolution)

        assert record_id > 0

        # Verify in database
        row = fetch_message(record_id)
        assert row["channel"] == "Test Channel"
        assert row["author"] == "Test User"
        assert row["status"] == "received"

    def test_update_message_status(self, test_db, sample_resolution):
        """Test updating message status"""
        record_id = insert_message(sample_resolution)

        # Update status
        update_message(record_id, status="processed")

        # Verify update
        row = fetch_message(record_id)
        assert row["status"] == "processed"

    def test_update_message_with_error(self, test_db, sample_resolution):
        """Test updating message with error"""
        record_id = insert_message(sample_resolution)

        # Update with error
        error_msg = "LLM request failed"
        update_message(record_id, status="agent_error", error=error_msg)

        # Verify update
        row = fetch_message(record_id)
        assert row["status"] == "agent_error"
        assert row["error"] == error_msg

    def test_fetch_nonexistent_message(self, test_db):
        """Test fetching a message that doesn't exist"""
        with pytest.raises(KeyError):
            fetch_message(99999)


class TestCORS:
    """Tests for CORS configuration"""

    def test_cors_headers_present(self, client):
        """Test that CORS headers are present"""
        response = client.options("/health")

        assert "access-control-allow-origin" in response.headers

    def test_allowed_origins_configuration(self):
        """Test CORS allowed origins configuration"""
        os.environ["ALLOWED_ORIGINS"] = "https://example.com,https://test.com"

        from processor.server import ALLOWED_ORIGINS

        assert "https://example.com" in ALLOWED_ORIGINS
        assert "https://test.com" in ALLOWED_ORIGINS


class TestMessageProcessing:
    """Tests for message processing logic"""

    @pytest.mark.asyncio
    async def test_process_message_success(self, test_db, sample_resolution):
        """Test successful message processing"""
        from processor.server import process_message, app
        from mcp.agent import JiraPayload

        # Mock the agent
        mock_agent = AsyncMock()
        mock_payload = JiraPayload(
            summary="Test deployment",
            description="Test description",
            issueType="Task",
            components=["Test"],
            labels=["deployment"]
        )
        mock_agent.infer.return_value = mock_payload

        # Mock HTTP client
        mock_http = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = '{"success": true}'
        mock_http.post.return_value = mock_response

        app.state.agent = mock_agent
        app.state.http = mock_http

        # Insert message
        record_id = insert_message(sample_resolution)

        # Process it
        await process_message(record_id, sample_resolution)

        # Verify status
        row = fetch_message(record_id)
        assert row["status"] == "forwarded"
        assert row["jira_payload_json"] is not None

    @pytest.mark.asyncio
    async def test_process_message_agent_error(self, test_db, sample_resolution):
        """Test message processing with agent error"""
        from processor.server import process_message, app
        from mcp.agent import AgentError

        # Mock the agent to raise error
        mock_agent = AsyncMock()
        mock_agent.infer.side_effect = AgentError("LLM failed")

        app.state.agent = mock_agent

        # Insert message
        record_id = insert_message(sample_resolution)

        # Process it
        await process_message(record_id, sample_resolution)

        # Verify error status
        row = fetch_message(record_id)
        assert row["status"] == "agent_error"
        assert "LLM failed" in row["error"]


def test_database_initialization():
    """Test database schema creation"""
    test_dir = tempfile.mkdtemp()
    os.environ["PROCESSOR_DATA_DIR"] = test_dir

    init_db()

    db_path = Path(test_dir) / "teams_messages.db"
    assert db_path.exists()

    # Verify schema
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'"
        )
        assert cursor.fetchone() is not None

    # Cleanup
    import shutil
    shutil.rmtree(test_dir, ignore_errors=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
