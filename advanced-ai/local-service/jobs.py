from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

Worker = Callable[["Job"], Path]


@dataclass
class Job:
    id: str
    kind: str
    created: float = field(default_factory=time.time)
    status: str = "queued"
    progress: float = 0.0
    stage: str = "En cola"
    error: str | None = None
    result: Path | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)

    def set_progress(self, value: float, stage: str) -> None:
        self.progress = max(0.0, min(1.0, float(value)))
        self.stage = stage

    @property
    def cancelled(self) -> bool:
        return self.cancel_event.is_set()

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "progress": round(self.progress, 4),
            "stage": self.stage,
            "error": self.error,
        }


class JobManager:
    def __init__(self, max_workers: int = 1) -> None:
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="realify-ai")

    def create(self, kind: str, worker: Worker) -> Job:
        job = Job(id=uuid.uuid4().hex, kind=kind)
        with self.lock:
            self.jobs[job.id] = job
        self.pool.submit(self._run, job, worker)
        return job

    def _run(self, job: Job, worker: Worker) -> None:
        if job.cancelled:
            job.status = "cancelled"
            return
        job.status = "running"
        try:
            result = worker(job)
            if job.cancelled:
                job.status = "cancelled"
                if result:
                    result.unlink(missing_ok=True)
                return
            job.result = result
            job.progress = 1.0
            job.stage = "Terminado"
            job.status = "completed"
        except Exception as exc:
            if job.cancelled:
                job.status = "cancelled"
                job.stage = "Cancelado"
            else:
                job.status = "failed"
                job.error = str(exc)
                job.stage = "Error"

    def get(self, job_id: str) -> Job | None:
        with self.lock:
            return self.jobs.get(job_id)

    def cancel(self, job_id: str) -> Job | None:
        job = self.get(job_id)
        if job:
            job.cancel_event.set()
            if job.status == "queued":
                job.status = "cancelled"
                job.stage = "Cancelado"
        return job
