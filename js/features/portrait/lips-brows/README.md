# Labios y cejas · `ai.lipsBrows`

Labios: más o menos color y definición. Cejas: oscurecer, dar color y rellenar los huecos. Capa nueva con «mezcla».

- **Zonas:** Labios (contorno menos interior de la boca) y cejas, en OKLab.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Labios y cejas»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
