from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict:
    metrics = request.app.state.container.resolve("metrics")
    return {"status": "ok", "metrics": metrics.snapshot()}
