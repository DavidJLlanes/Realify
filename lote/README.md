# Editar en lote

Copia la edición de una foto a otras.

- **Inicio › Editar en lote** (o Archivo › Editar en lote…): abre varias fotos,
  cada una en su pestaña.
- **Archivo › Aplicar esta edición a otras fotos…**: la foto abierta es la
  referencia. Ventana a pantalla completa con la edición capa a capa (casillas),
  vista previa de todas las fotos (tocar una la quita del lote), fotos de las
  pestañas abiertas o de la galería, **igualar exposición** y resultado en sus
  pestañas (capas reeditables, un paso de deshacer por foto) o en un ZIP.

Se copian capas de ajuste, capas de filtro (su receta se recalcula sobre cada
foto), textos (en proporción) e imágenes añadidas (marcas de agua, logos), con
visibilidad, opacidad, modo de fusión, «fusionar si», recorte y estilos. No se
copian máscaras, pinceladas ni recortes, giros o cambios de tamaño.

| Archivo | Qué hace |
|---|---|
| `index.js` | Entradas y aplicación a cada foto. |
| `ui.js` | Ventana (sobre `js/ui/fsshell.js`). |
| `edit.js` | Capturar la edición, aplicarla, vista previa e igualado de exposición. |
