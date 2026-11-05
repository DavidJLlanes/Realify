# Luz en la cara · `ai.faceRelight`

Cambia la luz de la cara: dirección, altura, intensidad y suavidad, sobre la forma real de la cara (profundidad + elipsoide), en luz lineal y respetando el color de la piel. Capa nueva con «mezcla».

- **Zonas:** Luz direccional de Lambert sobre las normales sacadas del mapa de profundidad; la exposición media de la cara se conserva.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Luz»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2), más el de profundidad (Depth Anything V2 Small); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
