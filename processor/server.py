import asyncio
import json
import logging
import os
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mcp.agent import AgentError, JiraPayload, TeamsJiraAgent, TeamsResolution

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/processor.log') if Path('logs').exists() or Path('logs').mkdir(exist_ok=True) else logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

DATA_DIR = Path(os.environ.get("PROCESSOR_DATA_DIR", "data"))
DB_PATH = DATA_DIR / "teams_messages.db"
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL")
N8N_API_KEY = os.environ.get("N8N_API_KEY")


def utcnow() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Initializing database at {DB_PATH}")
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT,
                    channel TEXT NOT NULL,
                    author TEXT NOT NULL,
                    timestamp TEXT,
                    classification_json TEXT NOT NULL,
                    resolution_text TEXT NOT NULL,
                    quoted_request_json TEXT,
                    permalink TEXT,
                    status TEXT NOT NULL,
                    jira_payload_json TEXT,
                    n8n_response_code INTEGER,
                    n8n_response_body TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_message_id
                ON messages(message_id)
                WHERE message_id IS NOT NULL
                """
            )
            conn.commit()
            logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def insert_message(bundle: TeamsResolution) -> int:
    quoted = bundle.quotedRequest.dict() if bundle.quotedRequest else None
    now = utcnow()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO messages (
                message_id,
                channel,
                author,
                timestamp,
                classification_json,
                resolution_text,
                quoted_request_json,
                permalink,
                status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                bundle.messageId,
                bundle.channel,
                bundle.author,
                bundle.timestamp,
                json.dumps(bundle.classification, ensure_ascii=False),
                bundle.resolutionText,
                json.dumps(quoted, ensure_ascii=False) if quoted else None,
                bundle.permalink,
                "received",
                now,
                now,
            ),
        )
        conn.commit()
        return int(cursor.lastrowid)


def update_message(
    record_id: int,
    *,
    status: Optional[str] = None,
    jira_payload: Optional[JiraPayload] = None,
    n8n_code: Optional[int] = None,
    n8n_body: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    fields = ["updated_at = ?"]
    values: list[Any] = [utcnow()]

    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if jira_payload is not None:
        fields.append("jira_payload_json = ?")
        values.append(jira_payload.model_dump_json(ensure_ascii=False))
    if n8n_code is not None:
        fields.append("n8n_response_code = ?")
        values.append(n8n_code)
    if n8n_body is not None:
        fields.append("n8n_response_body = ?")
        values.append(n8n_body)
    if error is not None:
        fields.append("error = ?")
        values.append(error)

    values.append(record_id)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            f"UPDATE messages SET {', '.join(fields)} WHERE id = ?", values
        )
        conn.commit()


def fetch_message(record_id: int) -> Dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM messages WHERE id = ?", (record_id,)
        ).fetchone()
        if row is None:
            raise KeyError(record_id)
        return dict(row)


def fetch_all_messages(
    status: Optional[str] = None,
    author: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        query = "SELECT * FROM messages WHERE 1=1"
        params: List[Any] = []

        if status:
            query += " AND status = ?"
            params.append(status)
        if author:
            query += " AND author LIKE ?"
            params.append(f"%{author}%")
        if channel:
            query += " AND channel LIKE ?"
            params.append(f"%{channel}%")

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def delete_message_db(record_id: int) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("DELETE FROM messages WHERE id = ?", (record_id,))
        if cursor.rowcount == 0:
            raise KeyError(record_id)
        conn.commit()


def get_stats_data() -> Dict[str, int]:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("SELECT COUNT(*) FROM messages")
        total = cursor.fetchone()[0]

        cursor = conn.execute("SELECT COUNT(*) FROM messages WHERE status = 'forwarded'")
        processed = cursor.fetchone()[0]

        cursor = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE status IN ('received', 'queued')"
        )
        pending = cursor.fetchone()[0]

        cursor = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE status IN ('failed', 'agent_error', 'n8n_error')"
        )
        failed = cursor.fetchone()[0]

        today = datetime.utcnow().date().isoformat()
        cursor = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE DATE(created_at) = ?", (today,)
        )
        today_count = cursor.fetchone()[0]

        week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        cursor = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE created_at >= ?", (week_ago,)
        )
        week_count = cursor.fetchone()[0]

        return {
            "total_messages": total,
            "processed": processed,
            "pending": pending,
            "failed": failed,
            "today": today_count,
            "this_week": week_count,
        }


class IngestResponse(BaseModel):
    id: int
    status: str


class Message(BaseModel):
    id: int
    message_id: Optional[str]
    channel: str
    author: str
    timestamp: Optional[str]
    classification: Dict[str, Any]
    resolution_text: str
    quoted_request: Optional[Dict[str, Any]]
    permalink: Optional[str]
    status: str
    jira_payload: Optional[Dict[str, Any]]
    n8n_response_code: Optional[int]
    n8n_response_body: Optional[str]
    error: Optional[str]
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "Message":
        return cls(
            id=row["id"],
            message_id=row["message_id"],
            channel=row["channel"],
            author=row["author"],
            timestamp=row["timestamp"],
            classification=json.loads(row["classification_json"]),
            resolution_text=row["resolution_text"],
            quoted_request=json.loads(row["quoted_request_json"])
            if row["quoted_request_json"]
            else None,
            permalink=row["permalink"],
            status=row["status"],
            jira_payload=json.loads(row["jira_payload_json"])
            if row["jira_payload_json"]
            else None,
            n8n_response_code=row["n8n_response_code"],
            n8n_response_body=row["n8n_response_body"],
            error=row["error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


app = FastAPI(title="Teams Resolution Processor")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    logger.info("Starting Teams Message Extractor Processor")
    init_db()
    try:
        logger.info("Initializing TeamsJiraAgent")
        app.state.agent = TeamsJiraAgent()
        logger.info(f"Agent initialized with model: {app.state.agent.model}")
    except AgentError as exc:
        logger.error(f"Failed to initialize agent: {exc}")
        raise RuntimeError(str(exc)) from exc
    app.state.http = httpx.AsyncClient(timeout=30)
    logger.info(f"Processor started successfully on port {os.environ.get('PORT', '8090')}")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    logger.info("Shutting down processor")
    http_client: httpx.AsyncClient = app.state.http
    await http_client.aclose()
    logger.info("Processor shutdown complete")


async def forward_to_n8n(record_id: int, bundle: TeamsResolution, payload: JiraPayload) -> None:
    if not N8N_WEBHOOK_URL:
        logger.warning(f"Message {record_id}: n8n webhook URL not configured, skipping forward")
        return

    logger.info(f"Message {record_id}: Forwarding to n8n")
    http_client: httpx.AsyncClient = app.state.http
    body = {
        "processor": {
            "id": record_id,
            "status": "processed",
            "db_path": str(DB_PATH.resolve()),
        },
        "resolution": bundle.model_dump(by_alias=True),
        "jira_payload": payload.model_dump(),
    }
    headers = {"Content-Type": "application/json"}
    if N8N_API_KEY:
        headers["X-API-Key"] = N8N_API_KEY

    try:
        response = await http_client.post(N8N_WEBHOOK_URL, json=body, headers=headers)
        logger.info(f"Message {record_id}: n8n responded with status {response.status_code}")

        update_message(
            record_id,
            status="forwarded" if response.status_code < 400 else "n8n_error",
            n8n_code=response.status_code,
            n8n_body=response.text[:2000],
        )

        if response.status_code >= 400:
            logger.error(f"Message {record_id}: n8n error {response.status_code}: {response.text[:500]}")
            raise RuntimeError(f"n8n responded with {response.status_code}: {response.text}")
        else:
            logger.info(f"Message {record_id}: Successfully forwarded to n8n")
    except Exception as e:
        logger.error(f"Message {record_id}: Failed to forward to n8n: {e}")
        raise


async def process_message(record_id: int, bundle: TeamsResolution) -> None:
    logger.info(f"Message {record_id}: Starting processing for author={bundle.author}, channel={bundle.channel}")
    agent: TeamsJiraAgent = app.state.agent
    try:
        logger.debug(f"Message {record_id}: Calling AI agent for inference")
        payload = await agent.infer(bundle)
        logger.info(f"Message {record_id}: AI processing completed, issue_type={payload.issue_type}")

        update_message(record_id, status="processed", jira_payload=payload)
        await forward_to_n8n(record_id, bundle, payload)

    except AgentError as exc:
        logger.error(f"Message {record_id}: Agent error: {exc}")
        update_message(record_id, status="agent_error", error=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Message {record_id}: Processing failed: {exc}", exc_info=True)
        update_message(record_id, status="failed", error=str(exc))


@app.post("/ingest", response_model=IngestResponse, status_code=202)
async def ingest(bundle: TeamsResolution) -> IngestResponse:
    logger.info(f"Ingesting message from {bundle.author} in {bundle.channel}")
    record_id = insert_message(bundle)
    logger.info(f"Message {record_id}: Queued for processing")
    asyncio.create_task(process_message(record_id, bundle))
    return IngestResponse(id=record_id, status="queued")


@app.get("/messages", response_model=List[Message])
async def list_messages(
    status: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
) -> List[Message]:
    logger.debug(f"Fetching messages: status={status}, author={author}, channel={channel}, limit={limit}")
    rows = fetch_all_messages(status=status, author=author, channel=channel, limit=limit)
    logger.debug(f"Returning {len(rows)} messages")
    return [Message.from_row(row) for row in rows]


@app.get("/messages/{record_id}", response_model=Message)
async def get_message(record_id: int) -> Message:
    try:
        row = fetch_message(record_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found") from exc
    return Message.from_row(row)


@app.delete("/messages/{record_id}")
async def delete_message(record_id: int) -> Dict[str, str]:
    logger.info(f"Deleting message {record_id}")
    try:
        delete_message_db(record_id)
        logger.info(f"Message {record_id} deleted successfully")
    except KeyError as exc:
        logger.warning(f"Attempt to delete non-existent message {record_id}")
        raise HTTPException(status_code=404, detail="Record not found") from exc
    return {"status": "deleted"}


@app.post("/messages/{record_id}/retry")
async def retry_message(record_id: int) -> Dict[str, str]:
    logger.info(f"Retrying message {record_id}")
    try:
        row = fetch_message(record_id)
    except KeyError as exc:
        logger.warning(f"Attempt to retry non-existent message {record_id}")
        raise HTTPException(status_code=404, detail="Record not found") from exc

    # Reconstruct the TeamsResolution object
    bundle = TeamsResolution(
        channel=row["channel"],
        messageId=row["message_id"],
        timestamp=row["timestamp"],
        author=row["author"],
        resolutionText=row["resolution_text"],
        classification=json.loads(row["classification_json"]),
        quotedRequest=json.loads(row["quoted_request_json"]) if row["quoted_request_json"] else None,
        permalink=row["permalink"],
    )

    # Reset status and retry processing
    update_message(record_id, status="queued", error=None)
    logger.info(f"Message {record_id}: Queued for retry")
    asyncio.create_task(process_message(record_id, bundle))

    return {"status": "retrying"}


@app.get("/stats")
async def get_stats() -> Dict[str, int]:
    return get_stats_data()


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model": app.state.agent.model,
        "db": str(DB_PATH.resolve()),
        "n8n_connected": bool(N8N_WEBHOOK_URL),
    }


class Config(BaseModel):
    openai_api_key: str = ""
    n8n_webhook_url: str = ""
    n8n_api_key: str = ""
    processor_host: str = "0.0.0.0"
    processor_port: int = 8090
    auto_retry: bool = True
    max_retries: int = 3


CONFIG_PATH = DATA_DIR / "config.json"


@app.get("/config")
async def get_config() -> Config:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r") as f:
            data = json.load(f)
            return Config(**data)
    return Config(
        openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
        n8n_webhook_url=os.environ.get("N8N_WEBHOOK_URL", ""),
        n8n_api_key=os.environ.get("N8N_API_KEY", ""),
    )


@app.put("/config")
async def update_config(config: Config) -> Dict[str, str]:
    logger.info("Updating configuration")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config.model_dump(), f, indent=2)
    logger.info("Configuration updated successfully")
    return {"status": "updated"}


def run() -> None:
    import uvicorn

    uvicorn.run(app, host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "8090")))


if __name__ == "__main__":
    run()
