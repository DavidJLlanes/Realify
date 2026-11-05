# Balance de blancos por zonas (`ai.zonedWhiteBalance`)

Estima el iluminante de cada zona de la foto y lo corrige por separado: sirve con luz mezclada (ventana fría y lámpara cálida).

Interfaz simple (diálogo con pocos mandos), Premium 👑 sin interruptor. Resultado: una capa nueva con «mezcla».
Motor: `js/features/scene/engine/`; flujo común: `js/features/scene/shared/ejecutar.js`. Pruebas: `tests/ia/escena/`.
