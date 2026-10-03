# Realify AI Local

Servicio CUDA/PyTorch del proyecto `advanced-ai/`.

## Fase actual

**Fase 2:** detección de GPU + upscale Real-ESRGAN ×2/×4 con tiling, progreso, cancelación y transporte RGB16.

## Instalación de desarrollo

Se recomienda Python 3.11 o 3.12 en Windows.

1. Crear y activar un entorno virtual.
2. Instalar **PyTorch + torchvision con CUDA** usando el selector oficial de PyTorch para la versión CUDA recomendada en ese momento.
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

Los pesos no se cargan al arrancar Realify. Se descargan en el primer uso y permanecen dentro de:

```text
advanced-ai/models/upscale/
```

Modelos de Fase 2:

- RealESRGAN_x2plus — ×2.
- RealESRGAN_x4plus — ×4.

Cada descarga se valida con el tamaño esperado y **SHA-256** antes de ser usada. Si falla la comprobación, el peso no se carga.

## Precisión

Cuando Realify puede recomponer el documento mediante su pila de alta precisión:

```text
capas / hiSrc
    ↓
RGB16 sRGB
    ↓
Realify AI Local
    ↓
Real-ESRGAN CUDA FP16
    ↓
RGB16
    ↓
canvas de previsualización + hiSrc de 16 bits
```

Si una construcción del documento no admite esa ruta, el cliente puede recurrir al canvas compatible. El resultado del motor se entrega igualmente en un contenedor RGB16, aunque una entrada de 8 bits no recupera información que ya no existía.

## Tiling

El cliente elige un tile inicial según la VRAM detectada. En una GPU de ~12 GB se usa un bloque amplio y el motor añade solape para evitar costuras. La cancelación se comprueba entre bloques.

## Seguridad

- Solo loopback (`127.0.0.1`).
- CORS limitado a Realify y desarrollo local.
- Los endpoints de trabajos exigen la cabecera del cliente Realify.
- Límite de tamaño de subida.
- Sin ejecución arbitraria de comandos.
- Temporales dentro de `advanced-ai/local-service/runtime/`.
- Pesos y temporales excluidos de Git mediante `advanced-ai/.gitignore`.
