# IA avanzada de Realify

Proyecto aislado para IA local CUDA/PyTorch. La hoja de ruta obligatoria está en [ROADMAP.md](./ROADMAP.md).

## Estado

Fase actual: **7 — Identidad y control avanzado ✅**.

## Arquitectura

Realify tiene dos piezas:

1. **realify.es**: interfaz web, capas, máscaras, ajustes y previsualización.
2. **Realify AI Local**: servicio Windows en `127.0.0.1:17834` que ejecuta los modelos CUDA en la GPU NVIDIA del usuario.

Publicar la web en el VPS no instala el motor CUDA en el PC. En Windows se instala una sola vez desde:

```text
advanced-ai/install/windows/instalar-realify-ai-local.cmd
```

El instalador:

- instala/localiza Python 3.11;
- crea un entorno virtual bajo `%LOCALAPPDATA%\RealifyAI`;
- instala PyTorch CUDA 12.8;
- instala las dependencias del servicio;
- copia la versión actual de `advanced-ai/`;
- configura el arranque automático con Windows;
- inicia el servicio y comprueba `http://127.0.0.1:17834/status`.

La interfaz ofrece el instalador automáticamente cuando no detecta el motor.

## Navegadores actuales

El acceso desde `https://realify.es` a `127.0.0.1` requiere permiso de acceso local/loopback en navegadores modernos. El cliente usa `targetAddressSpace: "loopback"` cuando el navegador lo soporta y diferencia entre:

- motor no instalado/no iniciado;
- permiso de loopback bloqueado;
- motor activo sin CUDA;
- motor CUDA listo.

## Funciones CUDA

- Real-ESRGAN ×2/×4.
- NAFNet Denoise/Deblur.
- Qwen3-1.7B para prompts fotográficos.
- SAM2.1 Hiera Large.
- FLUX.1 Fill [dev] NF4.
- PuLID-FLUX v0.9.1.
- FLUX IP-Adapter.
- FLUX ControlNet Union Pro 2.0.
- Depth Anything V2 Large.

Todos los pesos, runtimes y temporales del proyecto permanecen bajo `advanced-ai/` en la copia local.
