# Pendiente del titular

Lo que **solo puede hacer David** (o decidir él). Se va completando fase a fase y se entrega al terminar todas las fases del plan
(`docs/PLAN_EDITOR_IA_LOCAL.md`). Lo que puede hacer Claude no está aquí: se hace y se anota en el CHANGELOG.

## Decisiones
- F11.7 · **Mejoras de Unmark**: decidido (5 nov 2026): todas las marcas (logos en mosaico, textos, esquinas de stock, sellos de fecha) y todas las mejoras (detección automática, mejor relleno, lote con la misma marca). Falta fijar la medición (ver propuesta en la conversación) y hacerlo tras la fase 16.
- Si algún día se cobra Premium: sustituir los modelos marcados `noncommercial: true` (BiSeNet, Zero-DCE++, UltraSharp V2 Lite…).

## Decisiones tuyas
- **F15.1:** iPhone medido (6 nov 2026). Falta un Android: abrir `https://realify.es/plugins/video/estudio/medir.html`, pulsar «Medir» y pasarme el texto.

## Modelos que Claude no puede descargar
- **F15.9 · rendimiento en móvil:** ejecutar el editor en un móvil de gama media y anotar si la vista previa con Sensor / Estilo de cámara / Fondo con IA es fluida y cuánto tarda exportar 1 min a 1080p. Los números de desarrollo (sin GPU) están en `docs/VIDEO_ESTUDIO.md`.
- **F15.7 · sonido en móviles:** comprobar en tus móviles que el vídeo exportado con sonido se oye en WhatsApp, Instagram y TikTok. Si el dispositivo no codifica AAC, el MP4 lleva Opus, que algún reproductor antiguo (iOS viejo) puede no reproducir; en ese caso habría que exportar WebM o decidir si añadir un codificador AAC propio.
- **F15.6 · MODNet en vídeo:** probar «Fondo con IA» con un vídeo real de una persona en un móvil de gama media (velocidad por fotograma y calidad del borde); aquí sólo se probó con un alfa simulado.
*(Reintentado el 5 nov 2026: `huggingface.co`, `hf-mirror.com`, `modelscope.cn` y las descargas de GitHub Releases devuelven 403 desde el entorno de desarrollo.)*
- *(Hecho en la v325 con los pesos que subió David: Qwen2.5 1,5B, Whisper tiny, CLIP, Florence-2, Depth Anything Base, MI-GAN y NAFNet.)*
- **Qwen 1,5B no se ha podido probar de punta a punta** (los pesos de 1,2 GB no están en el entorno): sólo el tokenizador, la plantilla, el aviso y la lectura del plan. Probarlo en tu equipo con WebGPU: Asistente › Motor «IA · Qwen».
- **nginx**: cambiar `microphone=()` por `microphone=(self)` en `Permissions-Policy` para que el dictado por voz pueda usar el micrófono.

## Dispositivos y navegadores que Claude no tiene
- Mediciones en un **móvil de gama media** (WebGPU, memoria, tiempos) de las funciones con modelos.
- `node tests/calidad-herramienta.mjs <comando>` en **Edge** (móvil y escritorio) antes de publicar.
- Despliegue manual con `git` en el VPS (el flujo de GitHub Actions está desactivado).

## Fotos reales (no se suben al repositorio)
Basta con una carpeta y `REALIFY_FOTOS=carpeta node tests/ia/reales/<prueba>.mjs`:
- Cuerpo entero (hombre, mujer, niño, niña) para el editor de cuerpo; manos de cerca (en las fotos de prueba solo había manos a distancia).
- Telas muy estampadas, prendas con pliegues.
- Fotos con polvo de sensor, moiré, desenfoque de movimiento.
- Imágenes generadas con manos o dientes raros (avisos de la Fase 11) y fotos reales sin esos fallos, para ajustar umbrales.

## Revisión que no puede hacer Claude
- Licencia de los **datos de entrenamiento** de cada modelo (`docs/MODELOS.md`) y confirmar el uso no comercial.
- Juicio visual: si el recoloreado, el grano, la colocación del texto y los estilos «se ven bien».
- **Despliegue 2.0.0 (v317):** hacer `git pull` en el VPS y probar en móvil y escritorio, incluida la web sin conexión tras la primera visita.
- **F11.7 · revisión visual de Unmark:** ejecuta `npm run test:unmark -- --guardar` o mira `tests/unmark/salida/` (original · con marca · resultado) y dime si el resultado te convence.
- **v319 · vídeo:** probar en el móvil que el proyecto se recupera al reabrir el editor y medir si «Color» en WebGL va más fluido que antes (aquí no hay GPU).
