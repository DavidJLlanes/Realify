/* ═══════════════════════════════════════════════════════════════
   DESLIZADORES COMPACTOS EN EL MÓVIL
   En una hoja de ajuste del móvil, varios deslizadores apilados (cada
   uno con su etiqueta encima) ocupan casi toda la pantalla y tapan la
   imagen. Aquí se agrupan como ya hace `pickerGroup` (adjust.js) en
   Tono y saturación: un desplegable para elegir cuál y un solo
   deslizador a la vista. Son los mismos nodos, con su estado y sus
   listeners; sólo se ocultan con `hidden`.

   Actúa sobre cualquier cuerpo de diálogo ya montado: agrupa las filas
   `.field` con deslizador que comparten padre (al menos dos). Si ese
   padre tenía rótulos de sección («Entrada», «Salida»), se añaden al
   nombre de cada ajuste del desplegable y se ocultan. Si los
   deslizadores se vuelven a crear (una pestaña de color, un canal), se
   reagrupa y se conserva el ajuste que estaba elegido.
   ═══════════════════════════════════════════════════════════════ */

const isMobile = () => matchMedia("(max-width:900px)").matches;
const RANGE = 'input[type="range"]';
const labelOf = f => (f.querySelector("label")?.textContent || "").replace(/\s+/g, " ").trim();

function group(parent, rows, memo){
  /* Rótulo de sección de cada fila: el último `.section-label` que la
     precede en el mismo padre. */
  const section = new Map();
  let current = "";
  for(const el of parent.children){
    if(el.classList.contains("section-label")) current = el.textContent.replace(/\s+/g, " ").trim();
    else if(rows.includes(el)) section.set(el, current);
  }
  const hasSections = new Set(section.values()).size > 1;
  const entries = rows.map(r => {
    const base = labelOf(r) || "Ajuste", sec = section.get(r);
    return hasSections && sec ? `${base} · ${sec.charAt(0) + sec.slice(1).toLowerCase()}` : base;
  });

  const wrap = document.createElement("div");
  wrap.dataset.picker = "1";
  const select = document.createElement("select");
  select.className = "grow";
  select.setAttribute("aria-label", "Ajuste");
  select.style.cssText = "width:100%;min-height:38px;margin-bottom:8px";
  entries.forEach((t, i) => { const o = document.createElement("option"); o.value = i; o.textContent = t; select.appendChild(o); });
  rows[0].before(wrap);
  wrap.appendChild(select);
  rows.forEach(r => {
    r.dataset.picked = "1";
    const l = r.querySelector("label"); if(l) l.style.display = "none";
    wrap.appendChild(r);
  });
  if(hasSections) parent.querySelectorAll(":scope > .section-label").forEach(s => { s.hidden = true; });

  const show = i => { rows.forEach((r, k) => { r.hidden = k !== i; }); memo.label = entries[i]; };
  const start = Math.max(0, entries.indexOf(memo.label));
  select.value = String(start); show(start);
  select.addEventListener("change", () => show(+select.value));
}

/* Secciones con rótulo, cada una con su propio bloque de deslizadores
   (Niveles: «Entrada» y «Salida»): se sacan sus filas al padre, junto a
   su rótulo, para que todo quede en UN desplegable («Negro · Entrada»,
   «Negro · Salida»…) en vez de uno por sección. Sólo si hay al menos
   dos secciones así en el mismo padre. */
function flattenSections(root){
  const parents = new Set([...root.querySelectorAll(".section-label")].map(l => l.parentElement));
  for(const parent of parents){
    const boxes = [...parent.querySelectorAll(":scope > .section-label")].map(l => l.nextElementSibling)
      .filter(b => b && !b.classList.contains("field") && !b.dataset.picker && b.children.length &&
                   [...b.children].every(k => k.classList.contains("field") && k.querySelector(RANGE)));
    if(boxes.length < 2) continue;
    for(const b of boxes){ b.before(...b.children); b.hidden = true; }
  }
}

/** Agrupa los deslizadores apilados dentro de `root` (sólo en el móvil). */
export function compactSliders(root, memo = {}){
  if(!root || !isMobile()) return;
  flattenSections(root);
  const byParent = new Map();
  root.querySelectorAll(".field").forEach(f => {
    if(f.dataset.picked || f.hidden || !f.querySelector(RANGE)) return;
    const parent = f.parentElement;
    if(!parent || parent.dataset.picker) return;          // ya dentro de un desplegable (pickerGroup)
    if(f.querySelectorAll(RANGE).length > 1) return;     // filas con dos deslizadores: se dejan
    (byParent.get(parent) || byParent.set(parent, []).get(parent)).push(f);
  });
  for(const [parent, rows] of byParent) if(rows.length >= 2) group(parent, rows, memo);
}

/** Como `compactSliders`, y vuelve a agrupar si el cuerpo cambia
    (p.ej. al cambiar de pestaña se crean deslizadores nuevos). */
export function autoCompact(root){
  if(!root || !isMobile()) return;
  const memo = {};
  compactSliders(root, memo);
  let queued = false;
  const mo = new MutationObserver(() => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if(root.isConnected) compactSliders(root, memo); else mo.disconnect(); });
  });
  mo.observe(root, { childList: true, subtree: true });
}
