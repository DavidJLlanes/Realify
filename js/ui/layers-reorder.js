/* ═══════════════════════════════════════════════════════════════
   Reordenar capas arrastrando el asa «⠿» de cada fila del panel.
   Entradas: la lista de capas (#layerList). Salida: una llamada a
   moveLayerOrGroup con los puestos recorridos (un solo paso de
   historial). Usa eventos de puntero: vale con ratón y con dedo.
   Límites: una capa sólo cambia de puesto entre hermanas del mismo
   nivel (la regla de moveLayerOrGroup).
   ═══════════════════════════════════════════════════════════════ */
import { doc } from "../core/doc.js";
import { moveLayerOrGroup } from "../editor/layers/groups.js";

export function initReorder(list){
  let drag = null;

  list.addEventListener("pointerdown", e => {
    const grip = e.target.closest("[data-grip]");
    if(!grip) return;
    const row = grip.closest(".layer");
    if(!row) return;
    e.preventDefault(); e.stopPropagation();
    grip.setPointerCapture?.(e.pointerId);
    drag = { id: row.dataset.id, row, grip, pid: e.pointerId };
    row.classList.add("dragging");
  });

  // La fila es «draggable» (copiar a otra pestaña): mientras se arrastra el asa, no.
  list.addEventListener("dragstart", e => { if(drag) e.preventDefault(); });

  list.addEventListener("pointermove", e => {
    if(!drag || e.pointerId !== drag.pid) return;
    for(const r of list.querySelectorAll(".drop-before,.drop-after")) r.classList.remove("drop-before", "drop-after");
    const t = destino(e.clientY);
    if(t) t.row.classList.add(t.antes ? "drop-before" : "drop-after");
  });

  const fin = (e, cancelar) => {
    if(!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    d.row.classList.remove("dragging");
    for(const r of list.querySelectorAll(".drop-before,.drop-after")) r.classList.remove("drop-before", "drop-after");
    if(cancelar) return;
    const t = destino(e.clientY, d);
    if(!t) return;
    const pasos = pasosHasta(d.id, t);
    if(pasos) moveLayerOrGroup(doc.layers.find(l => String(l.id) === d.id).id, pasos);
  };
  list.addEventListener("pointerup", e => fin(e, false));
  list.addEventListener("pointercancel", e => fin(e, true));

  /* Fila sobre la que está el puntero y si cae en su mitad superior. */
  function destino(y, d = drag){
    const rows = [...list.querySelectorAll(".layer")];
    let r = rows.find(x => { const b = x.getBoundingClientRect(); return y >= b.top && y <= b.bottom; });
    if(!r) r = y < rows[0]?.getBoundingClientRect().top ? rows[0] : rows[rows.length - 1];
    if(!r || r === d.row) return null;
    const b = r.getBoundingClientRect();
    return { row: r, antes: y < b.top + b.height / 2 };
  }

  /* Puestos entre hermanas (arriba = positivo) hasta el hueco señalado. */
  function pasosHasta(id, t){
    const me = doc.layers.find(l => String(l.id) === String(id));
    if(!me) return 0;
    let obj = doc.layers.find(l => String(l.id) === t.row.dataset.id);
    if(!obj) return 0;
    // Subir hasta la hermana del mismo nivel (si se suelta dentro de un grupo ajeno).
    while(obj && obj.groupId !== me.groupId) obj = doc.layers.find(l => l.id === obj.groupId);
    if(!obj || obj === me) return 0;
    const sib = doc.layers.filter(l => l.groupId === me.groupId);
    const i = sib.indexOf(me);
    let j = sib.indexOf(obj);
    // La lista se pinta de arriba abajo: «antes» = encima del objetivo.
    j += t.antes ? 1 : 0;
    j -= j > i ? 1 : 0;
    return j - i;
  }
}
