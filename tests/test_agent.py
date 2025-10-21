"""
Unit tests for the LLM agent
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
import os

os.environ["OPENAI_API_KEY"] = "test-key"

from mcp.agent import (
    TeamsJiraAgent,
    TeamsResolution,
    JiraPayload,
    AgentError,
    MessageClassification
)


@pytest.fixture
def sample_resolution():
    """Sample Teams resolution for testing"""
    return TeamsResolution(
        messageId="test-123",
        channel="Test Channel",
        author="Test User",
        timestamp="2025-10-21T14:30:00Z",
        classification=MessageClassification(type="localized"),
        resolutionText="Updated to version 2.5.1",
        quotedRequest={
            "text": "Please update the authentication service to v2.5.1",
            "author": "Product Manager",
            "timestamp": "2025-10-21T14:00:00Z"
        }
    )


class TestTeamsResolution:
    """Tests for TeamsResolution model"""

    def test_valid_resolution(self):
        """Test creating a valid resolution"""
        resolution = TeamsResolution(
            channel="Test",
            author="User",
            classification={"type": "localized"},
            resolutionText="Done"
        )

        assert resolution.channel == "Test"
        assert resolution.author == "User"
        assert resolution.classification.type == "localized"
        assert resolution.resolutionText == "Done"

    def test_resolution_with_quoted_request(self):
        """Test resolution with quoted request"""
        resolution = TeamsResolution(
            channel="Test",
            author="User",
            classification={"type": "global"},
            resolutionText="Deployed",
            quotedRequest={
                "text": "Deploy to prod",
                "author": "Manager"
            }
        )

        assert resolution.quotedRequest is not None
        assert resolution.quotedRequest.text == "Deploy to prod"
        assert resolution.quotedRequest.author == "Manager"

    def test_resolution_serialization(self, sample_resolution):
        """Test serializing resolution to JSON"""
        data = sample_resolution.model_dump(by_alias=True)

        assert data["channel"] == "Test Channel"
        assert data["author"] == "Test User"
        assert data["classification"]["type"] == "localized"


class TestJiraPayload:
    """Tests for JiraPayload model"""

    def test_valid_payload(self):
        """Test creating a valid Jira payload"""
        payload = JiraPayload(
            summary="Test issue",
            description="Test description",
            issueType="Task",
            components=["Component1"],
            labels=["test", "automated"]
        )

        assert payload.summary == "Test issue"
        assert payload.issueType == "Task"
        assert len(payload.components) == 1
        assert len(payload.labels) == 2

    def test_payload_with_custom_fields(self):
        """Test payload with custom fields"""
        payload = JiraPayload(
            summary="Deploy v1.2.3",
            description="Deployment",
            issueType="Deployment",
            customFields={
                "version": "v1.2.3",
                "environment": "production"
            }
        )

        assert payload.customFields["version"] == "v1.2.3"
        assert payload.customFields["environment"] == "production"


class TestTeamsJiraAgent:
    """Tests for TeamsJiraAgent"""

    def test_agent_initialization(self):
        """Test agent initializes successfully"""
        agent = TeamsJiraAgent()

        assert agent.model is not None
        assert agent.client is not None

    def test_agent_missing_api_key(self):
        """Test agent fails without API key"""
        # Temporarily remove API key
        original = os.environ.get("OPENAI_API_KEY")
        if original:
            del os.environ["OPENAI_API_KEY"]

        with pytest.raises(AgentError, match="OPENAI_API_KEY"):
            TeamsJiraAgent()

        # Restore
        if original:
            os.environ["OPENAI_API_KEY"] = original

    @pytest.mark.asyncio
    async def test_agent_inference_success(self, sample_resolution):
        """Test successful LLM inference"""
        agent = TeamsJiraAgent()

        # Mock OpenAI client response
        mock_response = Mock()
        mock_message = Mock()
        mock_message.content = """{
            "summary": "Update authentication service to v2.5.1",
            "description": "Deployment confirmed by Test User",
            "issueType": "Task",
            "components": ["Authentication Service"],
            "labels": ["deployment", "localized"],
            "customFields": {"version": "v2.5.1"}
        }"""

        mock_choice = Mock()
        mock_choice.message = mock_message
        mock_response.choices = [mock_choice]

        with patch.object(agent.client.chat.completions, 'create', new=AsyncMock(return_value=mock_response)):
            payload = await agent.infer(sample_resolution)

            assert isinstance(payload, JiraPayload)
            assert "authentication service" in payload.summary.lower()
            assert payload.issueType == "Task"
            assert "deployment" in payload.labels

    @pytest.mark.asyncio
    async def test_agent_inference_invalid_json(self, sample_resolution):
        """Test handling of invalid JSON response"""
        agent = TeamsJiraAgent()

        # Mock OpenAI client with invalid JSON
        mock_response = Mock()
        mock_message = Mock()
        mock_message.content = "Not valid JSON"

        mock_choice = Mock()
        mock_choice.message = mock_message
        mock_response.choices = [mock_choice]

        with patch.object(agent.client.chat.completions, 'create', new=AsyncMock(return_value=mock_response)):
            with pytest.raises(AgentError, match="JSON"):
                await agent.infer(sample_resolution)

    @pytest.mark.asyncio
    async def test_agent_handles_openai_error(self, sample_resolution):
        """Test handling of OpenAI API errors"""
        agent = TeamsJiraAgent()

        # Mock OpenAI client to raise error
        with patch.object(agent.client.chat.completions, 'create', new=AsyncMock(side_effect=Exception("API Error"))):
            with pytest.raises(AgentError):
                await agent.infer(sample_resolution)


class TestMessageClassification:
    """Tests for MessageClassification"""

    def test_localized_classification(self):
        """Test localized classification"""
        classification = MessageClassification(type="localized")
        assert classification.type == "localized"

    def test_global_classification(self):
        """Test global classification"""
        classification = MessageClassification(type="global")
        assert classification.type == "global"

    def test_invalid_classification(self):
        """Test invalid classification type"""
        with pytest.raises(ValueError):
            MessageClassification(type="invalid")


class TestPromptGeneration:
    """Tests for prompt generation"""

    @pytest.mark.asyncio
    async def test_prompt_includes_context(self, sample_resolution):
        """Test that prompt includes all context"""
        agent = TeamsJiraAgent()

        # Mock to capture the prompt
        captured_messages = None

        async def capture_prompt(*args, **kwargs):
            nonlocal captured_messages
            captured_messages = kwargs.get('messages', [])

            # Return valid response
            mock_response = Mock()
            mock_message = Mock()
            mock_message.content = """{
                "summary": "Test",
                "description": "Test",
                "issueType": "Task",
                "components": [],
                "labels": []
            }"""
            mock_choice = Mock()
            mock_choice.message = mock_message
            mock_response.choices = [mock_choice]
            return mock_response

        with patch.object(agent.client.chat.completions, 'create', new=capture_prompt):
            await agent.infer(sample_resolution)

            # Verify prompt contains key information
            prompt_text = str(captured_messages)
            assert "Test User" in prompt_text
            assert "Test Channel" in prompt_text
            assert sample_resolution.resolutionText in prompt_text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
