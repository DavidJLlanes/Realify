# Modelos

Todos los modelos de IA avanzada de Realify se almacenan bajo esta carpeta.

Convención:

```text
models/
├─ upscale/
├─ denoise/
├─ deblur/
├─ segmentation/
├─ generative/
├─ prompt/
└─ identity/
```

## Fase 2

El registro está en `registry.json`.

Modelos actuales:
- `realesrgan-x2plus` → RealESRGAN_x2plus.
- `realesrgan-x4plus` → RealESRGAN_x4plus.

Los pesos se descargan en el primer uso y permanecen en `models/upscale/`. Los binarios grandes están ignorados por Git: deben vivir dentro del proyecto local, pero no formar parte del historial del repositorio.

Cada modelo futuro debe registrar origen, licencia, versión/URL y requisitos de hardware antes de activarse.
