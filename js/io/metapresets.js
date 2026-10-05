/* Qué metadatos del original se vuelven a escribir al exportar (ver io/metadata.js). Módulo aparte y mínimo porque el
   diálogo de exportar lo necesita al abrirse y metadata.js sólo cuando se exporta con metadatos. */
export const META_NONE = { author: false, date: false, camera: false, gps: false, text: false, ids: false };
export const META_PRESETS = {
  none:   { ...META_NONE },
  author: { ...META_NONE, author: true },
  nogps:  { author: true, date: true, camera: true, gps: false, text: true, ids: false },
  all:    { author: true, date: true, camera: true, gps: true, text: true, ids: true }
};
export const metaActive = p => !!p && !!(p.author || p.date || p.camera || p.gps || p.text || p.ids);
