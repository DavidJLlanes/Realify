# `tools/models/` · herramientas de modelos de IA

| Herramienta | Para qué |
|---|---|
| `sha256.mjs` | Huella de un archivo (o de varios trozos con `--unir`) para `docs/MODELOS.md` y el campo `sha256` del catálogo |
| `check-catalog.mjs` | Comprueba sin red que el catálogo (`js/ai/models/`), los archivos de `assets/models` y `docs/MODELOS.md` cuadran: tamaños, huellas y marcas de «no comercial» |

## Incorporar un modelo nuevo

1. **Elegir** el de más calidad que pueda ejecutar un móvil de gama media (cualquier licencia; si es no comercial, `noncommercial: true`).
2. **Convertir** a ONNX si no lo está (PyTorch: `torch.onnx.export(..., opset_version=17)`), simplificar (`onnxsim`) y, si hace falta
   para el móvil, pasar a float16 (`onnxconverter_common.float16.convert_float_to_float16(modelo, keep_io_types=True)`) o cuantizar a INT8
   (`onnxruntime.quantization.quantize_dynamic`). El formato `.ort` se obtiene con `python -m onnxruntime.tools.convert_onnx_models_to_ort`.
   Comprobar la salida contra el original (diferencia de píxeles) antes de seguir.
3. **Medir** en un móvil de gama media: memoria, tiempo y backend (WebGPU o WebAssembly). Anotarlo en el README de la función.
4. **Alojar**: hasta ~30 MB en `assets/models/<modelo>/` con su `LICENSE.txt`; más grande, en Hugging Face. En ese caso se fija la revisión:
   `git ls-remote https://huggingface.co/<usuario>/<repositorio> main` da el commit; se pone en `HF_REV` (`js/ai/models/base.js`) y
   la URL queda `…/resolve/<commit>/…`. Cambiar la revisión vuelve a descargar los modelos (la caché se indexa por URL).
5. **Registrar**: `node tools/models/sha256.mjs <archivo>`; una línea en `docs/MODELOS.md`; la entrada en el archivo de su familia en
   `js/ai/models/`, con `sha256`; su atribución en `js/vendor/ATTRIBUTIONS.md`.
6. **Comprobar**: `node tools/models/check-catalog.mjs`.
