# Asistente (`ai.assistant`)
Orden en español → plan `{ pasos:[{ herramienta, valores }] }` → validación contra el esquema (`../engine/esquema.js`, generado desde los manifiestos) → confirmación → aplicar.
Hoy interpreta con reglas (`../engine/interprete.js`); el modelo local (Qwen, F14.1) devolverá el mismo formato de plan y pasará por la misma validación. Sin modelo no hay nada que descargar.
