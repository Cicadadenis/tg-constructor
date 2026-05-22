from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class ExecuteRequest(BaseModel):
    graph: dict
    event: dict = Field(default_factory=dict)


@router.post("/execute")
async def execute_ir(body: ExecuteRequest) -> dict:
    """Deprecated: prefer POST /v1/constructor/graph/execute (external engine boundary)."""
    from cicada_platform.api.routes.constructor import execute_graph_external, ExecuteGraphRequest

    return await execute_graph_external(
        ExecuteGraphRequest(graph=body.graph, event=body.event)
    )
