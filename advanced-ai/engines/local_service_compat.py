"""Puente mínimo para que engines/ no dependa de imports frágiles del directorio local-service."""


def cancelled_guard(job) -> None:
    if getattr(job, "cancelled", False):
        raise RuntimeError("Cancelado")
