from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

from cicada_platform.sandbox.queue import SandboxJob, SandboxJobQueue
from cicada_platform.sandbox.worker import SandboxWorkerPool

router = APIRouter()
_queue = SandboxJobQueue()
_pool = SandboxWorkerPool(_queue)
_started = False


class SandboxEnqueueRequest(BaseModel):
    user_id: str
    ir: dict
    event: dict


@router.on_event("startup")
async def _start_pool() -> None:
    global _started
    if not _started:
        _pool.start()
        _started = True


@router.post("/sandbox/enqueue")
async def enqueue(body: SandboxEnqueueRequest) -> dict:
    job_id = uuid4().hex
    job = SandboxJob(
        job_id=job_id,
        user_id=body.user_id,
        ir_payload=body.ir,
        event_payload=body.event,
    )
    await _queue.enqueue(job)
    return {"job_id": job_id}


@router.get("/sandbox/result/{job_id}")
async def result(job_id: str) -> dict:
    res = _pool.get_result(job_id)
    if not res:
        return {"status": "pending"}
    return {"status": "done", "result": res.__dict__}
