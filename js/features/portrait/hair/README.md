# Cabello · `ai.hair`

Cambia el color del pelo (tono y saturación en OKLab, conservando sombras y mechones), su luz y su brillo, y le da volumen suave. Capa nueva con «mezcla».

- **Zonas:** Máscara de pelo del modelo de partes refinada con filtro guiado.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Cabello»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
