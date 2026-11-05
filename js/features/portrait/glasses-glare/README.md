# Reflejos en gafas · `ai.glassesGlare`

Atenúa los brillos y reflejos de los cristales de las gafas, sin tocar los ojos ni la montura. Capa nueva con «mezcla».

- **Zonas:** Máscara de gafas del modelo de partes; brillos especulares rellenos con el cristal de alrededor.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Reflejos gafas»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
