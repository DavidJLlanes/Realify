# Imperfecciones y tono · `ai.skinEven`

Rellena granos y manchas pequeñas con la piel de alrededor y uniforma las rojeces por zonas, sin tocar la luz ni la textura. En el editor de cara, capa nueva con «mezcla».

- **Zonas:** Acné, manchas pequeñas y rojeces.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Imperfecciones»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/piel-motor.mjs`.
- **Común:** zonas y piel en `js/features/portrait/shared/`.
- **Modelos:** los de personas (puntos de la cara y partes, Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
