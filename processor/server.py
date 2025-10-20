import asyncio
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mcp.agent import AgentError, JiraPayload, TeamsJiraAgent, TeamsResolution

DATA_DIR = Path(os.environ.get("PROCESSOR_DATA_DIR", "data"))
DB_PATH = DATA_DIR / "teams_messages.db"
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL")
N8N_API_KEY = os.environ.get("N8N_API_KEY")


def utcnow() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
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
    init_db()
    try:
        app.state.agent = TeamsJiraAgent()
    except AgentError as exc:
        raise RuntimeError(str(exc)) from exc
    app.state.http = httpx.AsyncClient(timeout=30)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    http_client: httpx.AsyncClient = app.state.http
    await http_client.aclose()


async def forward_to_n8n(record_id: int, bundle: TeamsResolution, payload: JiraPayload) -> None:
    if not N8N_WEBHOOK_URL:
        return
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

    response = await http_client.post(N8N_WEBHOOK_URL, json=body, headers=headers)
    update_message(
        record_id,
        status="forwarded" if response.status_code < 400 else "n8n_error",
        n8n_code=response.status_code,
        n8n_body=response.text[:2000],
    )
    if response.status_code >= 400:
        raise RuntimeError(f"n8n responded with {response.status_code}: {response.text}")


async def process_message(record_id: int, bundle: TeamsResolution) -> None:
    agent: TeamsJiraAgent = app.state.agent
    try:
        payload = await agent.infer(bundle)
        update_message(record_id, status="processed", jira_payload=payload)
        await forward_to_n8n(record_id, bundle, payload)
    except AgentError as exc:
        update_message(record_id, status="agent_error", error=str(exc))
    except Exception as exc:  # noqa: BLE001
        update_message(record_id, status="failed", error=str(exc))


@app.post("/ingest", response_model=IngestResponse, status_code=202)
async def ingest(bundle: TeamsResolution) -> IngestResponse:
    record_id = insert_message(bundle)
    asyncio.create_task(process_message(record_id, bundle))
    return IngestResponse(id=record_id, status="queued")


@app.get("/messages/{record_id}", response_model=Message)
async def get_message(record_id: int) -> Message:
    try:
        row = fetch_message(record_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found") from exc
    return Message.from_row(row)


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model": app.state.agent.model,
        "db": str(DB_PATH.resolve()),
        "n8n_connected": bool(N8N_WEBHOOK_URL),
    }


def run() -> None:
    import uvicorn

    uvicorn.run(app, host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "8090")))


if __name__ == "__main__":
    run()
