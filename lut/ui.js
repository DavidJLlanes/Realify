/* ═══════════════════════════════════════════════════════════════
   EFECTOS LUT · VENTANA A PANTALLA COMPLETA
   Mismo armazón que Cámaras, Estilos o el collage (js/ui/fsshell.js):

     · Escritorio: a la izquierda, buscador, desplegable «Ir a una familia»
       y las tablas por familias —cada miniatura es TU foto con esa tabla,
       calculada en la GPU—; en el centro la imagen con el resultado en
       directo; a la derecha, la intensidad.
     · Móvil: la imagen a pantalla completa y, debajo, una familia y una
       tabla (que abre una hoja con las mismas miniaturas) y la intensidad.
       El interruptor Premium 👑 va junto a ✕.

   Las tablas se descargan sólo cuando hacen falta: una miniatura cuando
   entra en pantalla (escritorio) o al abrir la hoja de su familia (móvil).
   ═══════════════════════════════════════════════════════════════ */

import { createShell, ensureShellStyles, stateHistory, thumbButton } from "../js/ui/fsshell.js";
import { premiumSwitch, premiumPref } from "../js/ui/premium.js";
import { LutGL, loadLut } from "./engine.js";
import { FAMILIES, ITEMS } from "./catalog.js";
import { toast } from "../js/ui/toast.js";

const MOBILE = "(max-width:900px)";
const isMobile = () => matchMedia(MOBILE).matches;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const THUMB = 160;

const BY_ID = new Map(ITEMS.map(([id, fam, name]) => [id, { id, fam, name }]));
export const lutItem = id => BY_ID.get(id) || null;
const famName = id => FAMILIES.find(f => f[0] === id)?.[1] || "";
const inFam = fam => ITEMS.filter(i => i[1] === fam).map(([id, f, name]) => ({ id, fam: f, name }));

/* Miniaturas: un recorte cuadrado y centrado de la foto con cada tabla aplicada en la GPU (con caché). */
function makeThumbs(source, getState){
  const base = document.createElement("canvas"); base.width = base.height = THUMB;
  const bx = base.getContext("2d"), side = Math.min(source.width, source.height);
  bx.imageSmoothingQuality = "high";
  bx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, THUMB, THUMB);
  const gl = new LutGL();
  gl.setImage(base);
  const cache = new Map();
  const key = id => `${id}|${getState().premium ? 1 : 0}`;
  return {
    original: base,
    /** La miniatura si ya está calculada; si no, null (y se pide con `ensure`). */
    cached: id => cache.get(key(id)) || null,
    async ensure(id){
      const k = key(id); if(cache.has(k)) return cache.get(k);
      const it = lutItem(id); if(!it) return base;
      const lut = await loadLut(it.fam, id);
      const k2 = key(id); if(cache.has(k2)) return cache.get(k2);       // por si Premium cambió mientras se descargaba
      gl.render(lut, { intensity: 100, premium: getState().premium, cw: THUMB, ch: THUMB });
      const c = document.createElement("canvas"); c.width = c.height = THUMB;
      c.getContext("2d").drawImage(gl.canvas, 0, 0);
      cache.set(k2, c); return c;
    },
    clear(){ cache.clear(); },
    dispose(){ cache.clear(); gl.dispose(); }
  };
}

/* Vista previa: la GPU redibuja una vez por fotograma como mucho, con el último estado pedido. */
class Preview {
  constructor(source, stage, onDraw, onError){
    this.source = source; this.stage = stage; this.onDraw = onDraw; this.onError = onError;
    this.gl = new LutGL();
    this.proxy = document.createElement("canvas");
    this.frame = 0; this.closed = false; this.dirty = true; this.state = null; this.lut = null; this.original = false;
  }
  size(){
    const box = this.stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = this.source.width, H = this.source.height, budget = isMobile() ? 900000 : 1800000;
    const k = Math.min(1, Math.max(1, box.width) * dpr / W, Math.max(1, box.height) * dpr / H, Math.sqrt(budget / (W * H)));
    return [Math.max(1, Math.round(W * k)), Math.max(1, Math.round(H * k))];
  }
  update(state, lut, original = false){ this.state = state; this.lut = lut; this.original = original; this.request(); }
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
        this.gl.setImage(this.proxy);
        this.dirty = false;
      }
      this.gl.render(this.lut, { intensity: this.state.intensity, premium: this.state.premium, cw: w, ch: h, original: this.original });
      this.onDraw(this.gl.canvas);
    }catch(error){ this.onError(error); }
  }
  dispose(){
    if(this.closed) return;
    this.closed = true; cancelAnimationFrame(this.frame);
    this.gl.dispose(); this.proxy.width = this.proxy.height = 1;
  }
}

/* Estado que se guarda en la capa: la tabla elegida, la intensidad y el modo. */
export function normalize(value){
  const s = { id: "", intensity: 100, premium: false, ...(value || {}) };
  s.id = lutItem(s.id) ? s.id : "";
  const i = +s.intensity; s.intensity = Number.isFinite(i) ? Math.max(0, Math.min(100, i)) : 100;
  s.premium = !!s.premium;
  return { id: s.id, intensity: s.intensity, premium: s.premium };
}

/** Abre la ventana. `onAccept(resultCanvas, params, item)` recibe el resultado a resolución completa. */
export async function openLutEditor({ source, initial = null, edit = false, onAccept }){
  await ensureShellStyles();
  const state = normalize(initial);
  if(!initial || initial.premium === undefined) state.premium = premiumPref.get("lut");
  let fam = lutItem(state.id)?.fam || FAMILIES[0][0], query = "", closed = false, accepting = false, curLut = null, token = 0;
  const cells = new Map();                 // id → botón
  let sh = null, preview = null, th = null, sw = null, observer = null;

  const finish = () => {
    if(closed) return;
    closed = true; token++;
    mq.removeEventListener?.("change", onMq);
    observer?.disconnect(); preview?.dispose(); th?.dispose();
    sh?.close();
  };

  /* Carga la tabla elegida y repinta; si mientras tanto se elige otra, lo viejo se descarta. */
  async function show(){
    const my = ++token, it = lutItem(state.id);
    if(!it){ curLut = null; preview?.update(state, null); return; }
    try{
      if(!curLut || curLut._id !== it.id){
        sh?.setBusy("Cargando…");
        const lut = await loadLut(it.fam, it.id);
        if(closed || my !== token) return;
        lut._id = it.id; curLut = lut;
      }
      sh?.setBusy(null); preview?.update(state, curLut);
    }catch(err){
      if(closed || my !== token) return;
      sh?.setBusy(null); console.warn("[lut]", err); toast(String(err.message || err), "err");
    }
  }

  const hist = stateHistory(state, () => { sw?.set(state.premium); th?.clear(); syncAll(); repaintThumbs(); show(); }, { setUndo: (u, r) => sh?.setUndo(u, r) });

  const pick = id => {
    state.id = id || ""; if(id) fam = lutItem(id).fam;
    hist.commit(); syncAll(); show();
  };
  const syncAll = () => {
    if(!sh) return;
    const it = lutItem(state.id);
    sh.setApplyEnabled(!!it);
    sh.setSubtitle(it ? it.name : `${ITEMS.length} efectos`);
    marks(); renderRight(); if(isMobile()) renderMobile();
  };

  /* ── Panel izquierdo (escritorio) ── */
  function renderLeft(){
    const L = sh.left; L.innerHTML = ""; cells.clear(); observer?.disconnect();
    const s = document.createElement("div"); s.className = "lkf-search";
    s.innerHTML = `<input type="search" placeholder="Buscar efecto…" aria-label="Buscar efecto" value="${esc(query)}">
      <select class="lut-jump" aria-label="Ir a una familia"><option value="">Ir a una familia…</option>${FAMILIES.map(([id, n]) => `<option value="${id}">${esc(n)} · ${inFam(id).length}</option>`).join("")}</select>`;
    s.querySelector("input").addEventListener("input", e => { query = e.target.value; applyFilter(); });
    const jump = s.querySelector(".lut-jump");
    jump.addEventListener("change", () => {
      const h = jump.value && L.querySelector(`h3[data-fam="${CSS.escape(jump.value)}"]`);
      if(h){ fam = jump.value; L.scrollTo({ top: h.offsetTop - s.offsetHeight, behavior: "smooth" }); }
      jump.value = "";
    });
    L.appendChild(s);
    const orig = document.createElement("div"); orig.className = "fsp-thumbs";
    const ob = thumbButton("", "Original", () => th.original, !state.id);
    ob.addEventListener("click", () => pick("")); orig.appendChild(ob); cells.set("", ob);
    L.appendChild(orig);
    // las miniaturas se calculan cuando se acercan a la pantalla: cada una descarga su tabla sólo entonces
    observer = new IntersectionObserver(entries => {
      for(const e of entries) if(e.isIntersecting){ observer.unobserve(e.target); paintCell(e.target.dataset.v); }
    }, { root: L, rootMargin: "300px 0px" });
    for(const [fid, fname] of FAMILIES){
      const list = inFam(fid);
      const h = document.createElement("h3"); h.textContent = `${fname} · ${list.length}`; h.dataset.fam = fid; L.appendChild(h);
      const grid = document.createElement("div"); grid.className = "fsp-thumbs"; grid.dataset.fam = fid;
      for(const p of list){
        const b = thumbButton(p.id, p.name, null, p.id === state.id);
        b.dataset.n = norm(p.name + " " + fname);
        b.addEventListener("click", () => pick(p.id)); grid.appendChild(b); cells.set(p.id, b); observer.observe(b);
      }
      L.appendChild(grid);
    }
    applyFilter();
  }
  function setThumbImage(b, canvas){
    const url = canvas.toDataURL("image/jpeg", .82), im = b.querySelector("img");
    if(im) im.src = url;
    else { const ph = b.querySelector(".ph"); if(!ph) return; const img = document.createElement("img"); img.alt = ""; img.src = url; ph.replaceWith(img); }
  }
  async function paintCell(id, root = null){
    const b = root || cells.get(id); if(!b || !th) return;
    try{ const c = await th.ensure(id); if(!closed) setThumbImage(b, c); }
    catch(err){ console.warn("[lut] miniatura", id, err); }
  }
  /* Miniaturas ya pintadas que hay que recalcular (cambia Premium o el historial). */
  function repaintThumbs(){
    if(!sh || !th) return;
    for(const [id, b] of cells) if(id && b.querySelector("img")) paintCell(id);
  }
  function applyFilter(){
    const q = norm(query), L = sh.left;
    for(const g of L.querySelectorAll(".fsp-thumbs[data-fam]")){
      let any = false;
      for(const b of g.children){ const ok = !q || b.dataset.n.includes(q); b.style.display = ok ? "" : "none"; if(ok) any = true; }
      g.style.display = any ? "" : "none";
      const h = L.querySelector(`h3[data-fam="${CSS.escape(g.dataset.fam)}"]`); if(h) h.style.display = any ? "" : "none";
    }
  }
  function marks(){ for(const [id, b] of cells) b.classList.toggle("on", id === state.id); }

  /* ── Mandos comunes ── */
  function intensityField(){
    const wrap = document.createElement("label"); wrap.className = "fsp-field";
    wrap.innerHTML = `<span>Intensidad<b>${Math.round(state.intensity)} %</b></span><input type="range" min="0" max="100" step="1" value="${Math.round(state.intensity)}" ${state.id ? "" : "disabled"}>`;
    const inp = wrap.querySelector("input"), out = wrap.querySelector("b");
    inp.addEventListener("input", () => { state.intensity = +inp.value; out.textContent = inp.value + " %"; preview?.update(state, curLut); });
    inp.addEventListener("change", () => hist.commit());
    inp.addEventListener("dblclick", () => { inp.value = 100; state.intensity = 100; out.textContent = "100 %"; hist.commit(); preview?.update(state, curLut); });
    return wrap;
  }

  /* ── Panel derecho (escritorio) ── */
  function renderRight(){
    if(!sh) return;
    const R = sh.right, top = R.scrollTop; R.innerHTML = "";
    const h = document.createElement("h3"); h.textContent = "Ajuste"; R.appendChild(h);
    R.appendChild(intensityField());
    const it = lutItem(state.id);
    const note = document.createElement("p"); note.className = "fsp-note";
    note.textContent = it ? `${famName(it.fam)}. Se añade como una capa nueva: el botón fx de la capa lo reabre para cambiar de efecto o de intensidad.` : "Elige un efecto de la izquierda.";
    R.appendChild(note); R.scrollTop = top;
  }

  /* ── Móvil: familia, efecto (hoja con miniaturas) e intensidad ── */
  function renderMobile(){
    const M = sh.mobile; M.innerHTML = "";
    const row = document.createElement("div"); row.className = "fsp-mrow";
    const cs = document.createElement("select"); cs.setAttribute("aria-label", "Familia");
    cs.innerHTML = FAMILIES.map(([id, n]) => `<option value="${id}"${id === fam ? " selected" : ""}>${esc(n)}</option>`).join("");
    cs.addEventListener("change", () => { fam = cs.value; renderMobile(); openList(); });
    row.appendChild(cs);
    const list = inFam(fam), cur = lutItem(state.id);
    const pk = document.createElement("div"); pk.className = "fsp-pick";
    pk.innerHTML = `<select aria-label="Efecto">${[`<option value=""${!state.id ? " selected" : ""}>Original</option>`, ...list.map(p => `<option value="${p.id}"${p.id === state.id ? " selected" : ""}>${esc(p.name)}</option>`)].join("")}${cur && cur.fam !== fam ? `<option value="${cur.id}" selected>${esc(cur.name)}</option>` : ""}</select><button type="button" class="fsp-pick-hit" aria-label="Elegir efecto con miniaturas"></button>`;
    pk.querySelector("select").addEventListener("change", e => pick(e.target.value));
    pk.querySelector(".fsp-pick-hit").addEventListener("click", openList);
    row.appendChild(pk); M.appendChild(row);
    M.appendChild(intensityField());
  }
  function openList(){
    const list = inFam(fam);
    sh.openSheet(famName(fam), [["", "Original"], ...list.map(p => [p.id, p.name])], state.id, id => id ? th.cached(id) : th.original, v => pick(v));
    // la hoja sale con huecos y se rellena con las tablas que vayan llegando
    for(const b of sh.root.querySelectorAll(".fsp-sheet-grid .fsp-thumb")) if(b.dataset.v && b.querySelector(".ph")) paintCell(b.dataset.v, b);
  }

  const mq = matchMedia(MOBILE);
  const onMq = () => { if(sh){ syncAll(); preview?.invalidate(); } };

  /* ── Aplicar: el resultado a resolución completa ── */
  async function accept(){
    const it = lutItem(state.id);
    if(accepting || closed || !it) return;
    accepting = true;
    sh.setBusy("Aplicando…"); sh.setApplyEnabled(false);
    const g = new LutGL();
    try{
      const lut = await loadLut(it.fam, it.id);
      const result = await g.renderFull(source, lut, state, p => sh.setBusy(`Aplicando… ${p} %`));
      await onAccept(result, { ...state }, it);
      finish();
    }catch(err){
      console.warn("[lut]", err);
      toast("No se pudo aplicar el efecto: " + (err.message || err), "err");
      accepting = false; sh?.setBusy(null); sh?.setApplyEnabled(true);
    }finally{ g.dispose(); }
  }

  try{ th = makeThumbs(source, () => state); }
  catch(err){ toast(String(err.message || err), "err"); return; }

  sh = createShell({
    title: "Efectos LUT", subtitle: `${ITEMS.length} efectos`, applyLabel: edit ? "Guardar" : "Aplicar", cls: "lkf lutf",
    onCancel: finish, onApply: accept, onUndo: () => hist.undo(), onRedo: () => hist.redo()
  });
  sw = premiumSwitch({ checked: state.premium, onChange: on => {
    state.premium = on; premiumPref.set("lut", on);
    hist.commit(); th.clear(); repaintThumbs(); preview?.update(state, curLut);
  } });
  sh.addAction(sw);
  sh.setOriginal(source);
  try{
    preview = new Preview(source, sh.stage, canvas => sh.setView(canvas, true), err => { console.warn("[lut]", err); toast("La vista previa falló: " + (err.message || err), "err"); });
  }catch(err){ toast(String(err.message || err), "err"); finish(); return; }
  sh.setView(source, false);
  renderLeft(); syncAll();
  mq.addEventListener?.("change", onMq);
  hist.reset();
  show();
}
