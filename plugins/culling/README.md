# Selección rápida (`ai.culling`)

Elige las mejores fotos de una tanda. Añades fotos de la galería y cada una se analiza en el equipo: **nitidez**, **exposición** (luces quemadas, sombras
tapadas), **ojos cerrados** (puntos de la cara, opcional) y **composición** (sujeto cerca de un tercio, opcional), más un **hash perceptual** para
encontrar **duplicados y ráfagas** (la mejor de cada grupo queda marcada). Cada foto recibe una nota de 0 a 100 y los motivos.

- Tocar una foto la **descarta o la recupera** (un gesto). «Marcar descartes» descarta las de nota baja y las peores de cada grupo.
- Vistas: Todas · Duplicados · **Comparar** (2 a 4 fotos a tamaño grande).
- «Abrir las elegidas» las abre en pestañas.

| Archivo | Qué hace |
|---|---|
| `engine.js` | Motor puro: dHash, grupos, ojos cerrados, puntuación, composición. |
| `analisis.js` | Análisis de una foto (usa el motor y los modelos de personas y de recorte). |
| `ui.js` | Ventana a pantalla completa sobre `js/ui/kit/fsshell.js`. |
