# Arrugas · `ai.skinWrinkles`

Atenúa las arrugas de la frente, el entrecejo, las patas de gallo, los surcos y el cuello sin borrar la textura de la piel: detecta cada surco con un filtro de crestas y reinyecta los poros. En el editor de cara, capa nueva con «mezcla».

- **Zonas:** Frente, entrecejo, patas de gallo, surcos nasogenianos y comisuras, cuello. Las manos llegan más adelante (ver README).
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Arrugas»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/piel-motor.mjs`.
- **Común:** zonas y piel en `js/features/portrait/shared/`.
- **Modelos:** los de personas (puntos de la cara y partes, Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
