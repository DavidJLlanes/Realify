# Editor de vídeo · estudio de viabilidad (F15.1)

Cómo se mide: `plugins/video/estudio/medir.html` (página autónoma) codifica y decodifica 30 fotogramas sintéticos por combinación de códec (H.264, VP9, AV1),
tamaño (720p, 1080p, 4K) y aceleración (hardware / software). `tools/video/medir.mjs` la ejecuta en el navegador de desarrollo y guarda `docs/video-medidas/<etiqueta>.json`.

## Medición de desarrollo (6 nov 2026) · Chrome 153 sin ventana, 2 núcleos, **sólo software**
Es un equipo flojo y sin GPU: sirve de **suelo** (un móvil de gama media con codec por hardware irá mejor en H.264 y quizá peor en el resto).

| Tamaño | Códec | Codificar (ms/fotograma) | Decodificar (ms/fotograma) |
|---|---|---|---|
| 720p | H.264 | 11 | 1,6 |
| 720p | VP9 | 15 | 2,8 |
| 720p | AV1 | 17 | 2,8 |
| 1080p | H.264 | 26 | 2,9 |
| 1080p | VP9 | 28 | 4,7 |
| 1080p | AV1 | 42 | 5,0 |
| 4K | H.264 | no disponible por software en este navegador | — |
| 4K | VP9 | 104 | 17,8 |
| 4K | AV1 | 148 | 19,9 |

Lecturas:
- **WebCodecs funciona** con los tres códecs; decodificar es 5-8 veces más barato que codificar. Un clip de 1080p a 30 fps se **decodifica mucho más rápido que en tiempo real** incluso sin GPU.
- **Codificar 1080p** en este equipo sin GPU ronda 26-42 ms/fotograma (24-38 fps): exportar tarda aproximadamente lo que dura el vídeo con H.264, **sin contar los efectos**. Los efectos de Realify (grano, óptica…) serán el coste dominante; hay que medirlos aparte en F15.4/F15.5.
- **4K** sólo es razonable para decodificar; codificar 4K en software (100-150 ms/fotograma, 7-10 fps) es lento. Propuesta: aceptar entrada 4K, **exportar como máximo a 1080p** hasta medir lo contrario.
- El montón de JavaScript se mantuvo en ~8 MB: los fotogramas viven fuera del montón (memoria nativa), así que **hay que medir memoria real del proceso en móvil** y cerrar siempre cada `VideoFrame`.

## Límites propuestos (PROVISIONALES: se confirman con móviles reales)
| Qué | Propuesta | Por qué |
|---|---|---|
| Entrada | hasta 4K, hasta 10 min por clip | decodificar es barato; la duración la limita la memoria al importar |
| Salida | hasta 1080p, 30 fps (60 fps sólo si el móvil lo da) | codificar es el cuello de botella |
| Previsualización | 480 px de lado largo | efectos en tiempo casi real |
| Duración del proyecto | 10 min en escritorio, 3 min en móvil, hasta medir | a ajustar con datos |
| Sin códec | aviso claro y alternativa | nunca falla en silencio |

## Rendimiento del editor (F15.9, 6 nov 2026)
Medido con `tools/video/rendimiento.mjs` en el equipo de desarrollo (Chromium sin ventana, **sin GPU: WebGL por software**), datos en `docs/video-medidas/rendimiento-desarrollo.json`. Es orientativo: un móvil con GPU irá más rápido en los efectos de WebGL y más lento en los de CPU.

| Efecto (ms por fotograma) | Vista previa 270×480 | Salida 1080×1920 | Motor |
|---|---|---|---|
| Color | 27 | 343 | CPU |
| Sensor de Realify | 266 | 4161 | WebGL (software aquí) |
| Estilo de cámara | 876 | 3451 | WebGL (software aquí) |
| Estabilizar | 2 | 6 | CPU (miniatura) |
| Fondo con IA (sin modelo) | 10 | 147 | CPU (el modelo se suma) |

- **Exportar** 3 s a 720×1280 con H.264 sin efectos: 1,5 s (17 ms/fotograma); con Color: 1,8 s. Memoria de JavaScript estable (~10 MB).
- **Arranque:** la web no pide nada de `plugins/video` ni de mediabunny al cargar (el módulo sólo se carga al abrir el editor).
- **Consecuencias:** en la vista previa los efectos pesados (Sensor, Estilo de cámara, Fondo con IA) pueden no llegar a tiempo real; el reproductor salta fotogramas en vez de retrasarse (por diseño). En la exportación, Color a 1080×1920 en CPU es lo más lento de lo medido sin GPU: queda como **mejora candidata** pasarlo a WebGL. Falta medir todo en móviles reales (tarea del titular).

## Qué falta (lo hace el titular)
Abrir en cada móvil (tras desplegar) `https://realify.es/plugins/video/estudio/medir.html`, pulsar **Medir**, esperar unos minutos y pegarme el texto que sale. Con eso fijo los límites definitivos de D5 en el plan. Ver `docs/PENDIENTE_TITULAR.md`.
