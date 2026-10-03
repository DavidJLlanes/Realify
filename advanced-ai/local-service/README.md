# Realify AI Local

Servicio CUDA/PyTorch del proyecto `advanced-ai/`.

## Fase actual

**Fase 3:** Upscale + Denoise + Deblur con CUDA, tiling, progreso, cancelación y transporte RGB16.

## Instalación de desarrollo

Se recomienda Python 3.11 o 3.12 en Windows.

1. Crear y activar un entorno virtual.
2. Instalar **PyTorch + torchvision con CUDA** usando el selector oficial de PyTorch.
3. Instalar el resto:

```bash
pip install -r requirements.txt
```

4. Arrancar:

```bash
python server.py
```

El servicio escucha exclusivamente en:

```text
http://127.0.0.1:17834
```

## Endpoints

```text
GET    /status
POST   /jobs/upscale
POST   /jobs/restore
GET    /jobs/{id}
DELETE /jobs/{id}
GET    /jobs/{id}/result
```

## Modelos

Todos los pesos están bajo `advanced-ai/models/` y se descargan sólo al primer uso.

### Upscale

- RealESRGAN_x2plus
- RealESRGAN_x4plus

### Restauración

- NAFNet-SIDD-width64 — reducción de ruido.
- NAFNet-GoPro-width64 — deblur.

Los pesos NAFNet se descargan desde los enlaces oficiales publicados por el repositorio de NAFNet. Al cargarlos se comprueba que el checkpoint contiene un state_dict compatible con la arquitectura exacta configurada; la carga es estricta.

## Precisión

Cuando Realify puede recomponer el documento en alta precisión:

```text
capas / hiSrc
    ↓
RGB16 sRGB
    ↓
Realify AI Local
    ↓
PyTorch + CUDA
    ↓
RGB16
    ↓
preview canvas + hiSrc 16-bit
```

NAFNet procesa internamente con CUDA/autocast FP16 y devuelve un resultado RGB16. La entrada original de 16 bits se conserva hasta la normalización del tensor.

## Gestión de VRAM

Sólo se mantiene un motor pesado activo a la vez. Al cambiar entre Real-ESRGAN, NAFNet Denoise y NAFNet Deblur, el servicio descarta el anterior y ejecuta `torch.cuda.empty_cache()`.

## Seguridad

- Solo loopback (`127.0.0.1`).
- CORS limitado a Realify y desarrollo local.
- Los endpoints de trabajos exigen la cabecera del cliente Realify.
- Límite de tamaño de subida.
- Sin ejecución arbitraria de comandos.
- Temporales dentro de `advanced-ai/local-service/runtime/`.
- Pesos y temporales excluidos de Git.
