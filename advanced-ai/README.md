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

Fase actual: **3 — Denoise / Deblur ✅**.

Implementado:

- detección del servicio local, GPU, CUDA y VRAM;
- Real-ESRGAN oficial ×2 y ×4;
- NAFNet-SIDD-width64 para reducción de ruido;
- NAFNet-GoPro-width64 para deblur;
- descarga de modelos bajo demanda;
- verificación SHA-256 para Real-ESRGAN;
- validación y carga estricta de checkpoints NAFNet;
- tiling adaptado a VRAM;
- progreso y cancelación;
- RGB16 de entrada/salida cuando está disponible;
- previsualización del resultado;
- intensidad 0–100 % para Denoise/Deblur;
- resultado de restauración como capa nueva y reversible;
- conservación de `hiSrc` de 16 bits cuando entra en los límites de Realify;
- liberación de VRAM al cambiar de motor;
- pesos y temporales permanecen dentro de `advanced-ai/` y no se suben a Git.

Próxima fase: **4 — Prompt → ajustes de Realify**.
