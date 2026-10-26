/* ═══════════════════════════════════════════════════════════════
   BOTONES − / + PARA CAMPOS NUMÉRICOS
   Escribir «37» en un campo de 62 px con el teclado del móvil es
   incómodo; en escritorio las flechitas nativas son minúsculas y
   además se ocultan en base.css. Aquí cada input[type=number] se
   envuelve con dos botones grandes que suman o restan `step` (o 1),
   respetan min/max, se aceleran si se mantienen pulsados y disparan
   los mismos eventos `input`/`change` que escribir a mano, así que
   quien escuche al campo no nota la diferencia.

   Se aplica de dos formas: explícita (`stepper(input)`, la barra de
   opciones) y automática (un MutationObserver envuelve cualquier
   campo numérico que aparezca en un diálogo). `data-nostep` lo evita.
   ═══════════════════════════════════════════════════════════════ */

const decimals = step => {
  const s = String(step);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
};

function fire(input){
  input.dispatchEvent(new Event("input",  { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function nudge(input, dir, mult = 1){
  const step = (parseFloat(input.step) || 1) * mult;
  const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
  const max = input.max !== "" ? parseFloat(input.max) : Infinity;
  const cur = parseFloat(input.value);
  const base = Number.isFinite(cur) ? cur : (Number.isFinite(min) && min > 0 ? min : 0);
  let v = base + dir * step;
  v = Math.max(min, Math.min(max, v));
  const d = decimals(input.step || "1");
  v = +v.toFixed(d);
  if(String(v) === input.value) return;
  input.value = v;
  fire(input);
}

function makeBtn(sign, input){
  const b = document.createElement("button");
  b.type = "button";
  b.className = "step-btn";
  b.tabIndex = -1;
  b.textContent = sign > 0 ? "+" : "−";
  b.setAttribute("aria-label", sign > 0 ? "Aumentar" : "Reducir");

  let timer = null, held = 0;
  const stop = () => { clearTimeout(timer); timer = null; held = 0; };
  const tick = () => {
    held++;
    // Tras ~1 s a ritmo normal, pasa a saltos de ×10; con Mayús siempre ×10
    nudge(input, sign, held > 12 ? 10 : 1);
    timer = setTimeout(tick, held < 4 ? 260 : 70);
  };
  b.addEventListener("pointerdown", e => {
    if(input.disabled) return;
    e.preventDefault();
    nudge(input, sign, e.shiftKey ? 10 : 1);
    try{ b.setPointerCapture(e.pointerId); }catch{}
    stop();
    timer = setTimeout(tick, 420);
  });
  ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach(ev => b.addEventListener(ev, stop));
  // Un clic sintetizado (teclado sobre el botón) también debe funcionar
  b.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); nudge(input, sign, e.shiftKey ? 10 : 1); }
  });
  return b;
}

/** Envuelve `input` en un stepper y devuelve el envoltorio. */
export function stepper(input){
  if(input.closest?.(".stepper")) return input.parentElement;
  const wrap = document.createElement("div");
  wrap.className = "stepper";
  // La clase de crecimiento pasa al envoltorio para no romper el layout de .field
  if(input.classList.contains("grow")){ input.classList.remove("grow"); wrap.classList.add("grow"); }
  // El ancho declarado era para los dígitos; los dos botones van aparte
  if(input.style.width){ wrap.style.width = (parseFloat(input.style.width) + 48) + "px"; input.style.width = ""; }
  const parent = input.parentNode;
  if(parent) parent.insertBefore(wrap, input);
  wrap.appendChild(makeBtn(-1, input));
  wrap.appendChild(input);
  wrap.appendChild(makeBtn(1, input));
  // Rueda del ratón sobre el campo: también suma y resta
  input.addEventListener("wheel", e => {
    if(document.activeElement !== input) return;
    e.preventDefault();
    nudge(input, e.deltaY < 0 ? 1 : -1, e.shiftKey ? 10 : 1);
  }, { passive: false });
  return wrap;
}

export function upgradeSteppers(root = document){
  root.querySelectorAll?.('input[type="number"]:not([data-nostep])').forEach(inp => {
    if(!inp.closest(".stepper")) stepper(inp);
  });
}

const mo = new MutationObserver(muts => {
  for(const m of muts){
    for(const n of m.addedNodes){
      if(n.nodeType !== 1) continue;
      if(n.matches?.('input[type="number"]') && !n.dataset.nostep && !n.closest(".stepper")) stepper(n);
      else upgradeSteppers(n);
    }
  }
});
mo.observe(document.body, { childList: true, subtree: true });
upgradeSteppers(document);
