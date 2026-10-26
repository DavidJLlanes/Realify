/* ═══════════════════════════════════════════════════════════════
   ORDENAR ARRASTRANDO
   Lista (vertical u horizontal) cuyos elementos se cambian de sitio
   arrastrándolos:
     · Ratón o lápiz: basta con arrastrar unos píxeles.
     · Dedo: mantener pulsado un momento y arrastrar; un deslizamiento
       rápido sigue desplazando la lista, como siempre.
   Una línea azul marca dónde caerá. Los botones de dentro del elemento
   (quitar, − / +…) no inician el arrastre, y el clic que sigue a un
   arrastre no cuenta como toque.
   ═══════════════════════════════════════════════════════════════ */

const HOLD_MS = 280;

/** onMove(desde, hasta): posiciones dentro de los elementos que casan con `items`. */
export function sortable(list, { axis = "y", items = "[data-sort]", ignore = "button, input, select", onMove }){
  let drag = null, suppressClick = false;

  const els = () => [...list.querySelectorAll(items)];
  const clearMarks = () => list.querySelectorAll(".sort-before, .sort-after").forEach(el => el.classList.remove("sort-before", "sort-after"));

  function targetIndex(ev){
    const pos = axis === "x" ? ev.clientX : ev.clientY;
    const others = els().filter(el => el !== drag.el);
    let to = 0;
    for(const el of others){
      const r = el.getBoundingClientRect();
      if(pos > (axis === "x" ? r.left + r.width / 2 : r.top + r.height / 2)) to++;
    }
    clearMarks();
    if(others.length){
      if(to < others.length) others[to].classList.add("sort-before");
      else others[others.length - 1].classList.add("sort-after");
    }
    return to;
  }

  function begin(){
    drag.active = true;
    drag.el.classList.add("sorting");
    list.classList.add("is-sorting");
    try{ navigator.vibrate?.(12); }catch{}
  }
  function end(commit){
    if(!drag) return;
    clearTimeout(drag.timer);
    removeEventListener("pointermove", onPointerMove, true);
    removeEventListener("pointerup", onPointerUp, true);
    removeEventListener("pointercancel", onPointerCancel, true);
    const d = drag; drag = null;
    clearMarks();
    list.classList.remove("is-sorting");
    d.el.classList.remove("sorting");
    d.el.style.transform = "";
    if(d.active){
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 350);
      if(commit && d.to !== null && d.to !== d.from) onMove(d.from, d.to);
    }
  }
  function onPointerMove(ev){
    if(!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if(!drag.active){
      if(drag.touch){ if(Math.hypot(dx, dy) > 10) end(false); return; }   // era un deslizamiento: que desplace
      if(Math.hypot(dx, dy) < 6) return;
      begin();
    }
    ev.preventDefault();
    drag.el.style.transform = axis === "x" ? `translateX(${dx}px)` : `translateY(${dy}px)`;
    drag.to = targetIndex(ev);
  }
  const onPointerUp = ev => { if(drag && ev.pointerId === drag.id) end(true); };
  const onPointerCancel = ev => { if(drag && ev.pointerId === drag.id) end(false); };

  list.addEventListener("pointerdown", e => {
    if(drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.target.closest(items);
    if(!el || !list.contains(el) || e.target.closest(ignore)) return;
    drag = { el, id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch",
             from: els().indexOf(el), to: null, active: false, timer: 0 };
    if(drag.touch) drag.timer = setTimeout(() => { if(drag && !drag.active) begin(); }, HOLD_MS);
    addEventListener("pointermove", onPointerMove, true);
    addEventListener("pointerup", onPointerUp, true);
    addEventListener("pointercancel", onPointerCancel, true);
  });
  // Con el dedo, una vez «cogido» el elemento, la lista no debe desplazarse.
  list.addEventListener("touchmove", e => { if(drag?.active) e.preventDefault(); }, { passive: false });
  // Tras mantener pulsado, el navegador puede abrir su menú contextual.
  list.addEventListener("contextmenu", e => { if(drag) e.preventDefault(); });
  list.addEventListener("click", e => { if(suppressClick){ e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
}
