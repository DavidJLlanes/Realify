# Ojeras y bolsas · `ai.darkCircles`

Iguala la luz y el tono de la zona bajo los ojos con el de la mejilla, sin borrar la textura de la piel. En el editor de cara, capa nueva con «mezcla».

- **Zonas:** Banda bajo el párpado inferior frente a la mejilla de referencia.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Ojeras»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/piel-motor.mjs`.
- **Común:** zonas y piel en `js/features/portrait/shared/`.
- **Modelos:** los de personas (puntos de la cara y partes, Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
