import json
import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

try:
    from mcp.server.fastapi import FastAPIMCP, ToolContext
except ImportError as exc:
    raise RuntimeError(
        "Install the Model Context Protocol dependencies: pip install mcp[fastapi]"
    ) from exc


class QuotedRequest(BaseModel):
    author: Optional[str] = Field(default=None)
    text: Optional[str] = Field(default=None)


class TeamsResolution(BaseModel):
    channel: str
    messageId: Optional[str] = Field(default=None, alias="message_id")
    author: str
    timestamp: Optional[str] = None
    classification: Dict[str, Any]
    resolutionText: str = Field(alias="resolution_text")
    quotedRequest: Optional[QuotedRequest] = Field(default=None, alias="quoted_request")
    permalink: Optional[str] = None

    class Config:
        allow_population_by_field_name = True


class JiraPayload(BaseModel):
    issue_type: str = Field(description="Either Güncelleştirme or Yaygınlaştırma")
    summary: str
    description: str
    labels: List[str] = Field(default_factory=list)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    comment: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthStatus(BaseModel):
    status: str
    model: str


def build_prompt(bundle: TeamsResolution) -> str:
    base = [
        "Aşağıdaki Microsoft Teams mesajından Jira için yapılandırılmış bir kayıt çıkar.",
        "Tür eşleme:",
        "- classification.type == 'localized' -> Issue Type: Güncelleştirme",
        "- classification.type == 'global' -> Issue Type: Yaygınlaştırma",
        "Öncelikle modül adı, sürümler, ortam ve talep eden kişiyi çıkarmaya çalış.",
        "Sabit alanlar:",
        "- description alanına markdown kullan.",
        "- labels alanını küçük harf ve köşeli harf olmayan karakterlerle oluştur.",
        "- Eğer ortam belirtilmemişse 'unknown-environment' etiketi ekle.",
        "- metadata içinde original_message (resolutionText) ve requester bilgilerini sakla."
    ]
    body = {
        "resolution": bundle.resolutionText,
        "classification": bundle.classification,
        "quoted_request": bundle.quotedRequest.dict() if bundle.quotedRequest else None,
        "author": bundle.author,
        "timestamp": bundle.timestamp,
        "permalink": bundle.permalink,
    }
    formatted = "\n".join(base) + "\n\n" + json.dumps(body, ensure_ascii=False, indent=2)
    return formatted


class TeamsJiraAgent:
    def __init__(self) -> None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable required")
        self.model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        self.client = AsyncOpenAI(api_key=api_key)

    async def infer(self, bundle: TeamsResolution) -> JiraPayload:
        prompt = build_prompt(bundle)
        response = await self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You convert Teams deployment confirmations into structured Jira issue payloads. Respond with JSON following the required schema."
                },
                {
                    "role": "user",
                    "content": prompt
                },
            ],
        )
        try:
            raw = response.choices[0].message.content
            if isinstance(raw, list):
                raw = "".join(part["text"] for part in raw if "text" in part)
            payload = json.loads(raw)
            return JiraPayload(**payload)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Invalid LLM response: {exc}") from exc


app = FastAPI(title="Teams Güncelleme MCP Agent")
mcp = FastAPIMCP(app)
agent = TeamsJiraAgent()


@app.get("/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    return HealthStatus(status="ok", model=agent.model)


@mcp.tool(description="Transform Teams resolution bundle into Jira payload", name="prepare_jira_payload")
async def prepare_jira_payload(_ctx: ToolContext, bundle: TeamsResolution) -> JiraPayload:
    return await agent.infer(bundle)


@app.post("/transform", response_model=JiraPayload)
async def transform(bundle: TeamsResolution) -> JiraPayload:
    return await agent.infer(bundle)


def run() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))


if __name__ == "__main__":
    run()
