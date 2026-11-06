# Editor de vídeo de Realify (módulo aislado)
**Esqueleto vacío (F15.0).** La arquitectura está en `docs/VIDEO.md` y espera la aprobación del titular antes de escribir código del editor.
- Puerta de entrada: `index.js` (sólo con `import()` desde `js/app/commands/video.js`, que aún no existe).
- Único contacto con el resto de Realify: `bridge/`.
- Comprobación: `node tools/verify/aislamiento.mjs`.
