# Editor de cara (`plugins/face-editor/`)

Editor a pantalla completa con zoom en la cara (4.7 del plan), montado sobre `js/ui/kit/ai-editor/` (que usa `fsshell`). Hoy lleva
el grupo **Piel**: Arrugas, Ojeras, Brillos, Textura e Imperfecciones y tono (Fase 3). Las fases 4 y 6 añaden ojos, boca, pelo, luz…

- `index.js` · puerta: `openFaceEditor({ group })`.
- `params.js` · grupos y mandos (cada función declara los suyos en `js/features/portrait/<función>/params.js`) y los valores de arranque.
- `render.js` · prepara cada cara (recorte, zonas, piel, planos en luz lineal) y pasa las cinco etapas de piel; sin cálculo de interfaz.
- `editor.js` · flujo: imagen visible → análisis de caras → editor → vista previa en vivo → capa nueva con «mezcla».
- Sólo es Premium 👑 (sin interruptor). Móvil: un mando cada vez; escritorio: panel lateral con todos.
- Pruebas: `tests/ia/retrato/piel-editor.mjs` (navegador) y `piel-motor.mjs` (Node).
