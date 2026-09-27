/* ═══════════════════════════════════════════════════════════════
   ESTILOS DE CARÁCTER Y DE PÁRRAFO
   Un conjunto de atributos con nombre, guardado para volver a
   aplicarlo con un clic —lo que cualquier maquetador serio llama
   «estilos»—, no un enlace en vivo que reescriba automáticamente cada
   texto que ya lo llevara puesto: aplicar un estilo es un «sello» que
   copia sus valores sobre la capa activa ahora mismo, editable después
   sin que se desligue de nada. Guardados en localStorage, igual que
   las fuentes cargadas por el usuario (ver editor/text.js).

   Carácter y párrafo se guardan aparte porque cubren atributos
   distintos —tipografía y color de la letra, frente a cómo se reparte
   el bloque entero— y así se pueden mezclar: un estilo de carácter
   «Título» con un estilo de párrafo «Centrado», por ejemplo. */

export const CHAR_ATTRS = ["font", "size", "weight", "italic", "color", "tracking",
  "strokeWidth", "strokeColor", "allCaps", "ligatures", "smallCaps"];
export const PARA_ATTRS = ["align", "lineHeight", "indentFirst", "indentLeft", "indentRight"];

const LS_CHAR = "realify.charStyles";
const LS_PARA = "realify.paraStyles";

function load(key){
  try{
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  }catch{ return []; }
}
function persist(key, list){
  try{ localStorage.setItem(key, JSON.stringify(list)); }catch{}
}

/* Arrays mutados EN EL SITIO (push/splice), nunca reasignados: así
   cualquiera que los haya importado sigue viendo la misma lista viva,
   sin depender de que ES module reexporte bien una reasignación. */
export const charStyles = load(LS_CHAR);
export const paraStyles = load(LS_PARA);

function pick(t, attrs){
  const out = {};
  for(const k of attrs) if(t[k] !== undefined) out[k] = t[k];
  return out;
}

function saveStyle(list, key, name, t, attrs){
  const entry = { name, attrs: pick(t, attrs) };
  const i = list.findIndex(s => s.name === name);
  if(i >= 0) list[i] = entry; else list.push(entry);
  persist(key, list);
}
export const saveCharStyle = (name, t) => saveStyle(charStyles, LS_CHAR, name, t, CHAR_ATTRS);
export const saveParaStyle = (name, t) => saveStyle(paraStyles, LS_PARA, name, t, PARA_ATTRS);

function deleteStyle(list, key, name){
  const i = list.findIndex(s => s.name === name);
  if(i >= 0){ list.splice(i, 1); persist(key, list); }
}
export const deleteCharStyle = name => deleteStyle(charStyles, LS_CHAR, name);
export const deleteParaStyle = name => deleteStyle(paraStyles, LS_PARA, name);

export const charStyleAttrs = name => charStyles.find(s => s.name === name)?.attrs || null;
export const paraStyleAttrs = name => paraStyles.find(s => s.name === name)?.attrs || null;
