# Brillos de la piel · `ai.skinShine`

Detecta las zonas brillantes de la piel (frente, nariz, mejillas) y las atenúa sin apagar el reflejo de los ojos. En el editor de cara, capa nueva con «mezcla».

- **Zonas:** Brillos de la piel frente al nivel de su entorno; ojos, cejas y labios quedan fuera.
- **Interfaz:** editor de cara a pantalla completa (`plugins/face-editor/`), grupo «Brillos»; móvil y escritorio.
- **Motor:** `engine.js`, puro (sin DOM), en luz lineal y coma flotante; se prueba en Node con `tests/ia/retrato/piel-motor.mjs`.
- **Común:** zonas y piel en `js/features/portrait/shared/`.
- **Modelos:** los de personas (puntos de la cara y partes, Fase 2); no hay modelo propio.
- **Premium 👑:** siempre (sin interruptor); resultado en capa nueva con «mezcla».
