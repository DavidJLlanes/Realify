# Pelos sueltos · `ai.flyawayHair`

Quita los pelos sueltos que cruzan el fondo junto a la cabeza: los detecta como líneas finas y los rellena con el fondo. No toca el peinado. Capa nueva con «mezcla».

- **Zonas:** Líneas finas (filtro de crestas) fuera de la persona; relleno con el fondo de alrededor.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Pelos sueltos»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/rasgos-motor.mjs`.
- **Común:** zonas, piel y máscaras en `js/features/portrait/shared/`; OKLab en `js/features/ai-kit/oklab.js`.
- **Modelos:** los de personas (Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
