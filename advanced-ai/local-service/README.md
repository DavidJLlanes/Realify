# Realify AI Local

Servicio CUDA/PyTorch del proyecto `advanced-ai/`.

## Fase actual

**Fase 2:** detección de GPU + upscale Real-ESRGAN ×2/×4 con tiling, progreso y cancelación.

## Instalación de desarrollo

Se recomienda Python 3.11 o 3.12 en Windows.

1. Crear y activar un entorno virtual.
2. Instalar **PyTorch + torchvision con CUDA** usando el selector oficial de PyTorch para la versión recomendada en ese momento.
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
GET    /jobs/{id}
DELETE /jobs/{id}
GET    /jobs/{id}/result
```

## Modelos

Los pesos no se incluyen en el arranque de Realify. Se descargan bajo demanda desde las releases oficiales y se guardan en:

```text
advanced-ai/models/upscale/
```

Modelos de Fase 2:

- RealESRGAN_x2plus
- RealESRGAN_x4plus

## Seguridad

- Solo loopback (`127.0.0.1`).
- CORS limitado a Realify y desarrollo local.
- Los endpoints de trabajos exigen la cabecera del cliente Realify.
- Límite de tamaño de subida.
- Sin ejecución arbitraria de comandos.
