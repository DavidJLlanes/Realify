# Polvo y motas del sensor (`ai.dustSpots`)

Detecta las motas del sensor (manchas pequeñas y oscuras sobre zonas lisas) y las rellena con el color de su alrededor, sin tocar la textura.

Interfaz simple (diálogo con pocos mandos), Premium 👑 sin interruptor, sin modelos de IA (algoritmo propio en luz lineal). Resultado: una capa nueva con «mezcla».
Motor: `js/features/restore/engine/`; flujo común: `js/features/scene/shared/ejecutar.js`. Pruebas: `tests/ia/restaurar/`.
