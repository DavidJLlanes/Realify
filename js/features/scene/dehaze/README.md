# Quitar neblina con IA (`ai.dehaze`)

Quita la neblina usando la distancia de cada punto (mapa de profundidad) además del canal oscuro, sin halos en los bordes.

Interfaz simple (diálogo con pocos mandos), Premium 👑 sin interruptor. Resultado: una capa nueva con «mezcla».
Motor: `js/features/scene/engine/`; flujo común: `js/features/scene/shared/ejecutar.js`. Pruebas: `tests/ia/escena/`.
