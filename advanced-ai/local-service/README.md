# Realify AI Local

Servicio CUDA/PyTorch del proyecto `advanced-ai/`.

## Fase actual

**Fase 4:** Upscale + Denoise + Deblur + interpretación local de prompts.

## Motores

- Real-ESRGAN ×2 / ×4.
- NAFNet SIDD width64.
- NAFNet GoPro width64.
- Qwen2.5-1.5B-Instruct.

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

`Qwen/Qwen2.5-1.5B-Instruct`, descargado bajo demanda a:

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
