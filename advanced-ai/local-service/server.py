"""Realify AI Local · Fase 1.

Sólo expone estado del motor y hardware. Los endpoints de inferencia se
añadirán por fases. Escucha exclusivamente en 127.0.0.1.
"""

from __future__ import annotations

from typing import Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

HOST = "127.0.0.1"
PORT = 17834
SERVICE_VERSION = "0.1.0"

ALLOWED_ORIGINS = [
    "https://realify.es",
    "https://www.realify.es",
    "http://localhost",
    "http://127.0.0.1",
]

app = FastAPI(title="Realify AI Local", version=SERVICE_VERSION, docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["X-Realify-Client", "Content-Type"],
)


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    response = await call_next(request)
    # Chrome puede enviar preflight PNA al acceder a loopback desde HTTPS.
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def hardware_status() -> dict[str, Any]:
    try:
        import torch
    except Exception as exc:
        return {
            "ready": False,
            "torchAvailable": False,
            "cuda": False,
            "reason": f"PyTorch no disponible: {type(exc).__name__}",
        }

    cuda = bool(torch.cuda.is_available())
    base: dict[str, Any] = {
        "torchAvailable": True,
        "torch": getattr(torch, "__version__", None),
        "cuda": cuda,
        "cudaVersion": getattr(getattr(torch, "version", None), "cuda", None),
    }
    if not cuda:
        base.update(ready=False, reason="CUDA no está disponible.")
        return base

    try:
        props = torch.cuda.get_device_properties(0)
        major, minor = torch.cuda.get_device_capability(0)
        base.update(
            ready=True,
            gpu=torch.cuda.get_device_name(0),
            vramGB=round(props.total_memory / (1024 ** 3), 2),
            computeCapability=f"{major}.{minor}",
        )
    except Exception as exc:
        base.update(ready=False, reason=f"No se pudo consultar la GPU: {type(exc).__name__}")
    return base


@app.get("/status")
def status():
    return {
        "service": "realify-ai-local",
        "serviceVersion": SERVICE_VERSION,
        **hardware_status(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
