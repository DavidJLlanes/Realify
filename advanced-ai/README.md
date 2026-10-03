# IA avanzada de Realify

Proyecto aislado para la IA local CUDA/PyTorch y, más adelante, el fallback cloud.

La hoja de ruta obligatoria está en [ROADMAP.md](./ROADMAP.md).

## Carpetas

- `ui/`: interfaz fullscreen.
- `client/`: comunicación de Realify con el servicio local.
- `local-service/`: servicio Python/PyTorch/CUDA.
- `engines/`: adaptadores de inferencia por función/modelo.
- `models/`: pesos y manifiestos de modelos.
- `workers/`: trabajo auxiliar del lado navegador.
- `cloud/`: reservado para la Fase 8.

## Estado

Fase actual: **1 — Base del módulo y motor local**.

No hay modelos de producción activados todavía.
