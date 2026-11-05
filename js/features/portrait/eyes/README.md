# Ojos · `ai.eyes`

Da luz y detalle al iris sin quemar el reflejo, cambia el color del iris sin teñir la pupila y aclara el blanco del ojo. Capa nueva con «mezcla».

- **Zonas:** Iris y esclera de cada ojo (landmarks), en OKLab. El tamaño del ojo llegará con el motor de deformación (Fase 5).
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Ojos»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
