# Biblioteca de cielos

Cielos de «Reemplazar cielo» (Inteligencia Artificial › Borrar y rellenar ›
Reemplazar cielo › Biblioteca). Generados para Realify con `generate.py` a partir
de `presets.json`: un modelo de cielo (degradado del horizonte al cénit en luz
lineal, halo y disco del sol, estrellas y luna) y nubes en un plano a altura fija
—ruido fractal con distorsión, iluminadas desde el sol—, que se hacen pequeñas
hacia el horizonte como en una foto. Sin fotos de terceros.

Licencia: **CC0 1.0** (dominio público).

- `catalog.json`: lista (id, nombre, archivo, miniatura, tono).
- `<id>.jpg`: 1920×1080, horizonte en el borde inferior.
- `<id>-t.jpg`: miniatura 192×108.

Para añadir un cielo: una entrada en `presets.json` y `python3 generate.py
presets.json <id>`, o una foto propia de 1920×1080 con el horizonte abajo (y su
miniatura), más su línea en `catalog.json`.
