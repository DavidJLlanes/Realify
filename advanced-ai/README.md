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

Fase actual: **2 — Upscale CUDA ✅**.

Implementado:

- detección del servicio local, GPU, CUDA y VRAM;
- Real-ESRGAN oficial ×2 y ×4;
- descarga de modelos bajo demanda;
- comprobación de tamaño y SHA-256 antes de usar los pesos;
- tiling solapado según VRAM;
- progreso y cancelación entre bloques;
- transporte RGB16 cuando Realify puede recomponer a alta precisión;
- resultado RGB16 con previsualización en canvas;
- conservación de `hiSrc` de 16 bits al aplicar cuando entra en los límites de Realify;
- Aplicar abre el upscale como documento nuevo;
- pesos y temporales permanecen dentro de `advanced-ai/` y no se suben a Git.

Próxima fase: **3 — Denoise / Deblur**.
