from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    from mcp.server.fastapi import FastAPIMCP, ToolContext
except ImportError as exc:
    raise RuntimeError(
        "Install the Model Context Protocol dependencies: pip install mcp[fastapi]"
    ) from exc

from mcp.agent import AgentError, JiraPayload, TeamsJiraAgent, TeamsResolution


class HealthStatus(BaseModel):
    status: str
    model: str


app = FastAPI(title="Teams Güncelleme MCP Agent")
mcp = FastAPIMCP(app)

try:
    agent = TeamsJiraAgent()
except AgentError as exc:
    raise RuntimeError(str(exc)) from exc


@app.get("/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    return HealthStatus(status="ok", model=agent.model)


@mcp.tool(description="Transform Teams resolution bundle into Jira payload", name="prepare_jira_payload")
async def prepare_jira_payload(_ctx: ToolContext, bundle: TeamsResolution) -> JiraPayload:
    try:
        return await agent.infer(bundle)
    except AgentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/transform", response_model=JiraPayload)
async def transform(bundle: TeamsResolution) -> JiraPayload:
    try:
        return await agent.infer(bundle)
    except AgentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def run() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))


if __name__ == "__main__":
    run()
