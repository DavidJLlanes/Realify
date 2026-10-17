/* ═══════════════════════════════════════════════════════════════
   CÁMARAS · VENTANA A PANTALLA COMPLETA
   Mismo armazón que el collage, Estilos, HDR o Unir (js/ui/fsshell.js):

     · Escritorio: a la izquierda, buscador, atajos de categoría y las
       cámaras por familias —cada miniatura es TU foto con esa cámara,
       calculada en la GPU—; en el centro la imagen con el resultado en
       directo; a la derecha, intensidad y variación.
     · Móvil: la imagen a pantalla completa y, debajo, una categoría y
       una cámara (que abre una hoja con las mismas miniaturas) y la
       intensidad. El interruptor Premium 👑 va junto a ✕.

   La vista previa y las miniaturas usan el mismo motor que el resultado
   (engine.js); al aplicar se recalcula la foto entera desde el original,
   así que lo que se ve nunca empeora al exportar.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, ensureShellStyles, stateHistory, thumbButton } from "../js/ui/fsshell.js";
import { premiumSwitch, premiumPref } from "../js/ui/premium.js";
import { CamarasGL } from "./engine.js";
import { PRESETS, activeCats, inCat, preset } from "./presets.js";
import { normalize } from "./state.js";
import { toast } from "../js/ui/toast.js";

const MOBILE = "(max-width:900px)";
const isMobile = () => matchMedia(MOBILE).matches;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const THUMB = 160;

/* Miniaturas: un recorte cuadrado y centrado de la foto, con cada cámara aplicada en la GPU (con caché). */
function makeThumbs(source, getState){
  const base = document.createElement("canvas"); base.width = base.height = THUMB;
  const bx = base.getContext("2d"), side = Math.min(source.width, source.height);
  bx.imageSmoothingQuality = "high";
  bx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, THUMB, THUMB);
  const gl = new CamarasGL();
  gl.setImage(base, THUMB, THUMB); gl.setTexture(base);
  const cache = new Map();
  return {
    original: base,
    canvas(id){
      const s = getState(), key = `${id}|${s.seed}|${s.premium ? 1 : 0}`;
      if(cache.has(key)) return cache.get(key);
      const p = preset(id); if(!p) return base;
      gl.render(normalize({ values: p.values, seed: s.seed, premium: s.premium, date: s.date }), { cw: THUMB, ch: THUMB });
      const c = document.createElement("canvas"); c.width = c.height = THUMB;
      c.getContext("2d").drawImage(gl.canvas, 0, 0);
      cache.set(key, c); return c;
    },
    clear(){ cache.clear(); },
    dispose(){ cache.clear(); gl.dispose(); }
  };
}

/* Vista previa: la GPU redibuja una vez por fotograma como mucho, con el último estado pedido. */
class Preview {
  constructor(source, stage, onDraw, onError){
    this.source = source; this.stage = stage; this.onDraw = onDraw; this.onError = onError;
    this.gl = new CamarasGL();
    this.gl.setImage(source, source.width, source.height);
    this.proxy = document.createElement("canvas");
    this.frame = 0; this.closed = false; this.dirty = true; this.state = null; this.original = false;
  }
  size(){
    const box = this.stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = this.source.width, H = this.source.height, budget = isMobile() ? 900000 : 1800000;
    const k = Math.min(1, Math.max(1, box.width) * dpr / W, Math.max(1, box.height) * dpr / H, Math.sqrt(budget / (W * H)));
    return [Math.max(1, Math.round(W * k)), Math.max(1, Math.round(H * k))];
  }
  update(state, original = false){ this.state = state; this.original = original; this.request(); }
  request(){ if(!this.closed && !this.frame && this.state) this.frame = requestAnimationFrame(() => this.draw()); }
  invalidate(){ this.dirty = true; this.request(); }
  draw(){
    this.frame = 0;
    if(this.closed) return;
    try{
      const [w, h] = this.size();
      if(this.dirty || this.proxy.width !== w || this.proxy.height !== h){
        this.proxy.width = w; this.proxy.height = h;
        const x = this.proxy.getContext("2d");
        x.imageSmoothingQuality = "high"; x.drawImage(this.source, 0, 0, w, h);
        // la textura es la foto reducida, pero los efectos se expresan en coordenadas de la foto COMPLETA (setImage): su tamaño es el real
        this.gl.setTexture(this.proxy);
        this.dirty = false;
      }
      this.gl.render(this.state, { cw: w, ch: h, original: this.original });
      this.onDraw(this.gl.canvas);
    }catch(error){ this.onError(error); }
  }
  dispose(){
    if(this.closed) return;
    this.closed = true; cancelAnimationFrame(this.frame);
    this.gl.dispose(); this.proxy.width = this.proxy.height = 1;
  }
}

/** Abre la ventana. `onAccept(resultCanvas, params)` recibe el resultado a resolución completa. */
export async function openCamarasEditor({ source, initial = null, edit = false, onAccept }){
  await ensureShellStyles();
  const state = normalize(initial);
  if(!initial || initial.premium === undefined) state.premium = premiumPref.get("camaras");
  const cats = activeCats();
  let cat = preset(state.preset)?.cat || cats[0], query = "", closed = false, accepting = false;
  const cells = new Map();                 // id → botón
  let sh = null, preview = null, th = null, sw = null;

  const finish = () => {
    if(closed) return;
    closed = true;
    mq.removeEventListener?.("change", onMq);
    preview?.dispose(); th?.dispose();
    sh?.close();
  };
  const hist = stateHistory(state, () => { sw?.set(state.premium); th?.clear(); syncAll(); repaintThumbs(); preview?.update(state); }, { setUndo: (u, r) => sh?.setUndo(u, r) });

  const pick = id => {
    if(!id){ state.preset = ""; state.values = {}; }
    else { const p = preset(id); if(!p) return; state.preset = id; state.values = { ...p.values }; cat = p.cat; }
    hist.commit(); syncAll(); preview?.update(state);
  };
  const syncAll = () => {
    if(!sh) return;
    const p = preset(state.preset);
    sh.setApplyEnabled(!!p);
    sh.setSubtitle(p ? p.name : `${PRESETS.length} cámaras`);
    marks(); renderRight(); if(isMobile()) renderMobile();
  };

  /* ── Panel izquierdo (escritorio) ── */
  function renderLeft(){
    const L = sh.left; L.innerHTML = ""; cells.clear();
    const s = document.createElement("div"); s.className = "lkf-search";
    s.innerHTML = `<input type="search" placeholder="Buscar cámara…" aria-label="Buscar cámara" value="${esc(query)}">
      <select class="cm-jump" aria-label="Ir a una familia"><option value="">Ir a una familia…</option>${cats.map(c => `<option value="${esc(c)}">${esc(c)} · ${inCat(c).length}</option>`).join("")}</select>`;
    s.querySelector("input").addEventListener("input", e => { query = e.target.value; applyFilter(); });
    const jump = s.querySelector(".cm-jump");
    jump.addEventListener("change", () => {
      const h = jump.value && L.querySelector(`h3[data-cat="${CSS.escape(jump.value)}"]`);
      if(h){ cat = jump.value; L.scrollTo({ top: h.offsetTop - s.offsetHeight, behavior: "smooth" }); }
      jump.value = "";
    });
    L.appendChild(s);
    const orig = document.createElement("div"); orig.className = "fsp-thumbs";
    const ob = thumbButton("", "Original", () => th.original, !state.preset);
    ob.addEventListener("click", () => pick("")); orig.appendChild(ob); cells.set("", ob);
    L.appendChild(orig);
    const pending = [];
    for(const c of cats){
      const list = inCat(c);
      const h = document.createElement("h3"); h.textContent = `${c} · ${list.length}`; h.dataset.cat = c; L.appendChild(h);
      const grid = document.createElement("div"); grid.className = "fsp-thumbs"; grid.dataset.cat = c;
      for(const p of list){
        const b = thumbButton(p.id, p.name, null, p.id === state.preset);
        b.dataset.n = norm(p.name + " " + p.cat);
        b.addEventListener("click", () => pick(p.id)); grid.appendChild(b); cells.set(p.id, b); pending.push(p.id);
      }
      L.appendChild(grid);
    }
    // las miniaturas se calculan por tandas para que la ventana abra al momento
    (function paint(){
      if(closed || !sh) return;
      for(const id of pending.splice(0, 6)) paintCell(id);
      if(pending.length) requestAnimationFrame(paint);
    })();
    applyFilter();
  }
  function paintCell(id){
    const b = cells.get(id); if(!b) return;
    const url = th.canvas(id).toDataURL("image/jpeg", .82);
    const im = b.querySelector("img");
    if(im) im.src = url;
    else { const ph = b.querySelector(".ph"); if(!ph) return; const img = document.createElement("img"); img.alt = ""; img.src = url; ph.replaceWith(img); }
  }
  /* Miniaturas ya pintadas que hay que recalcular (cambia Premium, la variación o el historial). */
  function repaintThumbs(){
    if(!sh || !th) return;
    const ids = [...cells.keys()].filter(id => id);
    (function again(){
      if(closed) return;
      for(const id of ids.splice(0, 6)) paintCell(id);
      if(ids.length) requestAnimationFrame(again);
    })();
  }
  function applyFilter(){
    const q = norm(query), L = sh.left;
    for(const g of L.querySelectorAll(".fsp-thumbs[data-cat]")){
      let any = false;
      for(const b of g.children){ const ok = !q || b.dataset.n.includes(q); b.style.display = ok ? "" : "none"; if(ok) any = true; }
      g.style.display = any ? "" : "none";
      const h = L.querySelector(`h3[data-cat="${CSS.escape(g.dataset.cat)}"]`); if(h) h.style.display = any ? "" : "none";
    }
  }
  function marks(){ for(const [id, b] of cells) b.classList.toggle("on", id === state.preset); }

  /* ── Mandos comunes ── */
  function intensityField(){
    const wrap = document.createElement("label"); wrap.className = "fsp-field";
    wrap.innerHTML = `<span>Intensidad<b>${Math.round(state.intensity)} %</b></span><input type="range" min="0" max="100" step="1" value="${Math.round(state.intensity)}" ${state.preset ? "" : "disabled"}>`;
    const inp = wrap.querySelector("input"), out = wrap.querySelector("b");
    inp.addEventListener("input", () => { state.intensity = +inp.value; out.textContent = inp.value + " %"; preview?.update(state); });
    inp.addEventListener("change", () => hist.commit());
    inp.addEventListener("dblclick", () => { inp.value = 100; state.intensity = 100; out.textContent = "100 %"; hist.commit(); preview?.update(state); });
    return wrap;
  }
  const variation = () => {
    state.seed = 1 + Math.floor(Math.random() * 9998);
    hist.commit(); th.clear(); repaintThumbs(); preview?.update(state);
  };
  const variationButton = cls => {
    const b = document.createElement("button"); b.type = "button"; b.className = cls;
    b.textContent = "⚄ Nueva variación"; b.title = "Cambia dónde caen el polvo, los arañazos, las fugas de luz y el ruido de cinta";
    b.addEventListener("click", variation); return b;
  };

  /* ── Panel derecho (escritorio) ── */
  function renderRight(){
    if(!sh) return;
    const R = sh.right, top = R.scrollTop; R.innerHTML = "";
    const h = document.createElement("h3"); h.textContent = "Ajuste"; R.appendChild(h);
    R.appendChild(intensityField());
    const vb = variationButton("cm-var"); vb.disabled = !state.preset; R.appendChild(vb);
    const p = preset(state.preset);
    if(p && (p.values.stamp || 0) > 0){
      const f = document.createElement("label"); f.className = "fsp-field";
      f.innerHTML = `<span>Fecha del sello</span><input type="text" maxlength="16" value="${esc(state.date)}" placeholder="'05 7 14">`;
      const inp = f.querySelector("input");
      inp.addEventListener("input", () => { state.date = inp.value; th.clear(); preview?.update(state); });
      inp.addEventListener("change", () => { hist.commit(); repaintThumbs(); });
      R.appendChild(f);
    }
    const note = document.createElement("p"); note.className = "fsp-note";
    note.textContent = p ? `${p.cat}. Se añade como una capa nueva: el botón fx de la capa lo reabre para cambiar de cámara o de intensidad.` : "Elige una cámara de la izquierda.";
    R.appendChild(note); R.scrollTop = top;
  }

  /* ── Móvil: familia, cámara (hoja con miniaturas) e intensidad ── */
  function renderMobile(){
    const M = sh.mobile; M.innerHTML = "";
    const row = document.createElement("div"); row.className = "fsp-mrow";
    const cs = document.createElement("select"); cs.setAttribute("aria-label", "Familia");
    cs.innerHTML = cats.map(c => `<option value="${esc(c)}"${c === cat ? " selected" : ""}>${esc(c)}</option>`).join("");
    cs.addEventListener("change", () => { cat = cs.value; renderMobile(); openList(); });
    row.appendChild(cs);
    const list = inCat(cat);
    const pk = document.createElement("div"); pk.className = "fsp-pick";
    pk.innerHTML = `<select aria-label="Cámara">${[`<option value=""${!state.preset ? " selected" : ""}>Original</option>`, ...list.map(p => `<option value="${p.id}"${p.id === state.preset ? " selected" : ""}>${esc(p.name)}</option>`)].join("")}${state.preset && !list.some(p => p.id === state.preset) ? `<option value="${esc(state.preset)}" selected>${esc(preset(state.preset)?.name || "")}</option>` : ""}</select><button type="button" class="fsp-pick-hit" aria-label="Elegir cámara con miniaturas"></button>`;
    pk.querySelector("select").addEventListener("change", e => pick(e.target.value));
    pk.querySelector(".fsp-pick-hit").addEventListener("click", openList);
    row.appendChild(pk); M.appendChild(row);
    const r2 = document.createElement("div"); r2.className = "cm-mrow2";
    r2.appendChild(intensityField());
    const vb = document.createElement("button"); vb.type = "button"; vb.className = "cm-vardice"; vb.textContent = "⚄";
    vb.setAttribute("aria-label", "Nueva variación"); vb.title = "Nueva variación"; vb.disabled = !state.preset;
    vb.addEventListener("click", variation); r2.appendChild(vb);
    M.appendChild(r2);
  }
  function openList(){
    sh.openSheet(cat, [["", "Original"], ...inCat(cat).map(p => [p.id, p.name])], state.preset, id => id ? th.canvas(id) : th.original, v => pick(v));
  }

  const mq = matchMedia(MOBILE);
  const onMq = () => { if(sh) { syncAll(); preview?.invalidate(); } };

  /* ── Aplicar: el resultado a resolución completa ── */
  async function accept(){
    if(accepting || closed || !state.preset) return;
    accepting = true;
    sh.setBusy("Aplicando…"); sh.setApplyEnabled(false);
    const g = new CamarasGL();
    try{
      const result = await g.renderFull(source, state, p => sh.setBusy(`Aplicando… ${p} %`));
      const params = JSON.parse(JSON.stringify(state));
      await onAccept(result, params, preset(state.preset));
      finish();
    }catch(err){
      console.warn("[cámaras]", err);
      toast("No se pudo aplicar la cámara: " + (err.message || err), "err");
      accepting = false; sh?.setBusy(null); sh?.setApplyEnabled(true);
    }finally{ g.dispose(); }
  }

  try{
    th = makeThumbs(source, () => state);
  }catch(err){ toast(String(err.message || err), "err"); return; }

  sh = createShell({
    title: "Cámaras", subtitle: `${PRESETS.length} cámaras`, applyLabel: edit ? "Guardar" : "Aplicar", cls: "lkf cmf",
    onCancel: finish, onApply: accept, onUndo: () => hist.undo(), onRedo: () => hist.redo()
  });
  sw = premiumSwitch({ checked: state.premium, onChange: on => {
    state.premium = on; premiumPref.set("camaras", on);
    hist.commit(); th.clear(); repaintThumbs(); preview?.update(state);
  } });
  sh.addAction(sw);
  sh.setOriginal(source);
  try{
    preview = new Preview(source, sh.stage, canvas => sh.setView(canvas, true), err => { console.warn("[cámaras]", err); toast("La vista previa falló: " + (err.message || err), "err"); });
  }catch(err){ toast(String(err.message || err), "err"); finish(); return; }
  sh.setView(source, false);
  renderLeft(); syncAll();
  mq.addEventListener?.("change", onMq);
  hist.reset();
  preview.update(state);
}
