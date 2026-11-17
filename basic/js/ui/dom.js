/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · AYUDA DE DOM
   Crear elementos con atributos y hijos en una línea. Lo usan todas las piezas de ui/.
   Entradas: h(etiqueta, atributos, ...hijos). Salidas: el elemento. Límites: sin plantillas ni estado.
   ═══════════════════════════════════════════════════════════════ */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...hijos.flat().filter(x => x != null && x !== false));
  return el;
}
