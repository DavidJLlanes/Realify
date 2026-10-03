# Realify AI Local

Servicio CUDA/PyTorch del proyecto `advanced-ai/`.

## Fase actual

**Fase 6:** upscale, restauración, prompts fotográficos, segmentación SAM2 y edición generativa localizada con FLUX Fill.

## Motores

- Real-ESRGAN ×2 / ×4.
- NAFNet SIDD width64.
- NAFNet GoPro width64.
- Qwen3-1.7B.
- SAM2.1 Hiera Large.
- FLUX.1 Fill [dev] NF4.

El criterio del proyecto es **calidad primero**: para cada función se usa el modelo de mayor calidad práctica que pueda ejecutarse razonablemente en una RTX 4070 SUPER de 12 GB. La cuantización se usa para hacer viable un modelo superior, no para sustituirlo por uno claramente peor.

## Edición generativa

Endpoint:

```text
POST /jobs/generative-edit
```

La imagen y una máscara de 8 bits se envían al servicio local. Los píxeles blancos de la máscara pueden modificarse y el resto queda protegido. La máscara puede proceder de SAM2 y refinarse antes de generar.

Motor principal:

```text
FLUX.1 Fill [dev] NF4
```

Configuración de calidad por defecto:

- 50 pasos.
- Guidance 30.
- BF16 para cálculo.
- Transformer + T5 XXL en NF4.
- Model CPU offload.
- VAE slicing + tiling.
- Región de trabajo de hasta 1024 px de lado para la GPU objetivo.
- Recomposición final a las dimensiones completas de la fotografía.

Los pesos viven exclusivamente bajo:

```text
advanced-ai/models/generative/
```

## Primera instalación de FLUX

Los componentes base oficiales de FLUX.1 Fill son gated en Hugging Face. Antes del primer uso hay que aceptar la licencia del modelo con la misma cuenta que se utilizará en el PC y autenticar Hugging Face, por ejemplo:

```text
hf auth login
```

También puede usarse la variable de entorno `HF_TOKEN`. El token no se envía al navegador ni se guarda dentro del repositorio.

La variante NF4 conserva la licencia del modelo original. Antes de usar FLUX en una función pública o de producción deben revisarse las condiciones vigentes de Black Forest Labs; que una web no cobre dinero no elimina por sí solo todas las restricciones de la licencia [dev].

## Prompt fotográfico

`POST /prompt/adjust` usa Qwen3-1.7B y devuelve únicamente un JSON dentro de una lista cerrada de ajustes. La respuesta del modelo nunca se ejecuta como código.

Modelo:

```text
advanced-ai/models/prompt/qwen3-1.7b/
```

## Segmentación

SAM2.1 Hiera Large genera máscaras mediante puntos positivos y negativos. Esas máscaras sirven tanto como máscaras de capa de Realify como entrada directa de FLUX Fill.

## Seguridad

- Servicio limitado a `127.0.0.1`.
- CORS limitado a Realify y localhost.
- Cabecera de cliente obligatoria.
- Prompts con longitud máxima.
- Ningún shell, `eval` ni ejecución arbitraria.
- Modelos cargados bajo demanda y liberados al cambiar de motor.
- Operaciones largas con progreso y cancelación.
- Pesos, temporales y runtime dentro de `advanced-ai/`.
