# Biblioteca de cielos

«Reemplazar cielo» incluye 101 fondos locales de 1920 × 1080 píxeles y sus
miniaturas de 240 × 135. La app no consulta Poly Haven ni ningún otro servicio
al abrir la biblioteca o al aplicar un cielo.

## Procedencia

- **82 fotografías** adaptadas de los HDRI de [Poly Haven](https://polyhaven.com/hdris).
  Cada entrada `ph-*` del catálogo incluye la URL de su recurso original.
  Los archivos de Poly Haven están publicados bajo [CC0 1.0](https://polyhaven.com/license).
  Son recortes de la parte superior de las panorámicas JPG con mapeo tonal:
  los 59 recursos «Pure Sky» conservan todo el hemisferio superior y los otros
  23 usan una franja superior más pequeña para excluir el suelo. Se redujeron
  a 1920 × 1080 en JPEG para mantener ligera la descarga de cada opción.
- **16 cielos originales de Realify** creados con `generate.py` y
  `presets.json`, dedicados a CC0 1.0 como antes.
- **3 cielos nuevos generados para Realify**: aurora boreal, tormenta con
  rayos y crepúsculo con luna. Están señalados como «Generado» en la interfaz;
  no se presentan como fotografías de Poly Haven.

El repositorio `assetfs/polyhaven-hdri` que se revisó contiene solamente tres
archivos HDRI de escenas completas. Para cubrir todas las horas y condiciones
se usaron los recursos originales de Poly Haven, con la referencia de cada uno
en `catalog.json`.

## Formato

- `catalog.json`: id, nombre, archivo, miniatura, hora, tiempo, tipo y fuente.
- `<id>.jpg`: fondo de 1920 × 1080, con el borde inferior listo para el horizonte.
- `<id>-t.jpg`: miniatura de 240 × 135.

Para añadir un cielo procedural, usa `python3 generate.py presets.json <id>`
y añade su entrada al catálogo. Para una fotografía propia, prepara una imagen
16:9 sin elementos de suelo y su miniatura, y registra su procedencia y licencia.
