# Realify AI Local

Servicio CUDA/PyTorch del proyecto `advanced-ai/`.

## Fase actual

**Fase 4:** Upscale + Denoise + Deblur + interpretación local de prompts.

## Motores

- Real-ESRGAN ×2 / ×4.
- NAFNet SIDD width64.
- NAFNet GoPro width64.
- Qwen3-1.7B.

## Prompt

Endpoint:

```text
POST /prompt/adjust
```

Entrada:

```json
{"prompt":"aclara la foto, recupera sombras y haz el color algo más cálido"}
```

Salida conceptual:

```json
{
  "adjustments": {
    "exposure": 0.25,
    "shadows": 20,
    "temperature": 8
  },
  "summary": "Aclara y calienta ligeramente la fotografía",
  "unsupported": []
}
```

La respuesta del modelo no se ejecuta directamente. El servicio descarta claves desconocidas, convierte valores a números y los limita a rangos definidos. El navegador vuelve a validarlos antes de usarlos.

Las instrucciones generativas —por ejemplo cambiar el pelo, sustituir un fondo o añadir objetos— se devuelven en `unsupported` hasta la Fase 6.

## Modelo de lenguaje

`Qwen/Qwen3-1.7B`, descargado bajo demanda a:

```text
advanced-ai/models/prompt/qwen2.5-1.5b-instruct/
```

El snapshot queda ignorado por Git.

## Seguridad

- Solo `127.0.0.1`.
- CORS limitado.
- Cabecera de cliente obligatoria.
- Prompt máximo 2000 caracteres.
- Ningún shell, eval o ejecución de código.
- Esquema de acciones cerrado.
- Los pesos y runtime permanecen dentro de `advanced-ai/`.


## Fase 4 · Prompt → ajustes

El intérprete local usa **Qwen3-1.7B** y se descarga en:

```text
advanced-ai/models/prompt/qwen3-1.7b/
```

El modelo no modifica imágenes directamente. Sólo devuelve un JSON que pasa por una lista cerrada de ajustes y rangos; cualquier campo no permitido se descarta. Las peticiones generativas se devuelven como `unsupported` hasta la Fase 6.

El servicio libera previamente el motor pesado que estuviera en VRAM antes de cargar Qwen3.
