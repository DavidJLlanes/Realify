# Dientes · `ai.teeth`

Blanquea los dientes por zonas, conservando el brillo: no toca encías, lengua ni labios. Capa nueva con «mezcla».

- **Zonas:** Interior de la boca (landmarks): sólo lo claro y poco rojo; quita el amarillo en OKLab.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Dientes»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
