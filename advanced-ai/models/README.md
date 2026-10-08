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

## Registro

El registro está en `registry.json` (`schema` 11). Cada entrada indica tarea, nombre, licencia y origen, y
los modelos con descarga directa incluyen además su `bytes` o `minBytes` y `sha256`.

| Id | Tarea | Modelo | Licencia |
|---|---|---|---|
| `realesrgan-x2plus` | upscale | Real-ESRGAN ×2 | BSD-3-Clause |
| `realesrgan-x4plus` | upscale | Real-ESRGAN ×4 | BSD-3-Clause |
| `nafnet-sidd-width64` | denoise | NAFNet SIDD width64 | MIT |
| `nafnet-gopro-width64` | deblur | NAFNet GoPro width64 | MIT |
| `qwen3-1.7b` | prompt | Qwen3 1.7B | Apache-2.0 |
| `sam2.1-hiera-large` | segment | SAM 2.1 Hiera Large | Apache-2.0 |
| `flux1-fill-dev-components` | generative-edit-base | FLUX.1 Fill dev · componentes base | FLUX dev, **no comercial** |
| `flux1-fill-dev-nf4` | generative-edit | FLUX.1 Fill dev · NF4 | FLUX dev, **no comercial** |
| `pulid-flux-v0.9.1` | identity | PuLID-FLUX v0.9.1 | Apache-2.0 (código) + licencias de los modelos de origen |
| `flux-ip-adapter` | reference | FLUX IP-Adapter | Ver el origen del modelo |
| `flux-controlnet-union-pro-2` | structural-control | FLUX ControlNet Union Pro 2.0 | FLUX dev, **no comercial** |
| `depth-anything-v2-large` | depth-preprocessor | Depth Anything V2 Large | Ver el origen del modelo |

Los pesos se descargan en el primer uso y permanecen en la carpeta de cada modelo (por ejemplo `upscale/`).
Los binarios grandes están ignorados por Git: deben vivir dentro del proyecto local, pero no formar parte del
historial del repositorio.

Cada modelo nuevo debe registrar origen, licencia, versión/URL y requisitos de hardware antes de activarse.
Los modelos con licencia no comercial no pueden usarse con fines comerciales aunque la aplicación web sea gratuita.
