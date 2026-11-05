# Texto en zona libre con IA (`ai.textPlacement`)

Busca el rectángulo de la foto con menos importancia (sujeto y caras de «Recorte inteligente»), menos textura y lejos del borde, y escribe ahí el texto en una capa nueva; el color (claro u oscuro) sale de la luminancia de esa zona.

Interfaz simple (texto, tamaño, color, opacidad), Premium 👑 sin interruptor. Motor puro: `js/features/compose/engine/zona-texto.js`. Pruebas: `tests/ia/composicion/`.
