# Seleccionar partes · `ai.partsSelect`

Selecciona (o pone como máscara de la capa activa) una parte de una persona: pelo, cara, piel, ropa, brazos, piernas, zapatos, gafas…

- **Modelos:** RTMPose-m (pose, para la caja de cada persona) y SegFormer-B2 «clothes» (18 clases), vía `js/ai/people/analyze.js`.
- **Interfaz:** simple (4 mandos: parte, persona, suavidad del borde, resultado). Sólo Premium 👑: usa siempre el análisis «mejor».
- **Archivos:** `engine.js` (puro, compone la máscara a tamaño del documento), `analysis.js`, `controller.js`, `ui.js`, `params.js`.
- **Límites:** las clases son las del modelo (no separa cuello ni orejas: para eso está «Seleccionar por texto»). Personas muy pequeñas
  o cortadas por el borde salen con menos precisión.
- **Cómo probarla:** `node tests/ia/personas-parts.mjs` (motor, Node) y `node tests/calidad-herramienta.mjs ai.partsSelect`.
