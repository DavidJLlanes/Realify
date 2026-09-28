/* ═══════════════════════════════════════════════════════════════
   MEMES · VENTANA
   Misma estructura que Stickers, el Filtro Vintage y el revelador RAW:
   ventana a pantalla completa con Cancelar / deshacer / rehacer /
   Aplicar.

     · Escritorio: a la izquierda diseño, marco, efecto de imagen y la
       lista de textos; en el centro el meme en vivo; a la derecha todas
       las propiedades del texto elegido, por secciones.
     · Móvil: el meme a pantalla completa; abajo, un desplegable de
       diseño con «+ Texto», un desplegable de ajuste (del meme o del
       texto elegido) y su control, y una fila de acciones.

   En el meme: tocar un texto lo elige, arrastrarlo lo mueve, el
   tirador de la esquina lo escala y gira, dos dedos pellizcan y giran,
   y doble clic / doble toque lleva a escribir el texto.
   ═══════════════════════════════════════════════════════════════ */

import { DESIGNS, design } from "./designs.js";
import { PROPS, PROP_GROUPS, prop, TEXT_PRESETS, newText, applyPreset } from "./model.js";
import { EFFECTS, applyEffect } from "./effects.js";
import { coverCanvas } from "./designs-more.js";
import { renderText, drawText } from "./text.js";
import { linkFonts, loadFont } from "./fonts.js";
import { toast } from "../js/ui/toast.js";

const MOBILE = "(max-width:900px)";
const MAX_SIDE = 6000;

/* Decodifica una imagen (archivo o portapapeles) a un lienzo, con el
   lado mayor limitado para no disparar la memoria con fotos enormes. */
async function decodeImage(blob){
  let bmp;
  try{ bmp = await createImageBitmap(blob); }
  catch{ throw new Error("No se pudo leer esa imagen. Prueba con JPEG, PNG o WebP."); }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/* Ajustes del meme entero (no de un texto), para el desplegable móvil */
const MEME_PROPS = [
  { key: "frameColor", label: "Color del marco", type: "color" },
  { key: "frameSize", label: "Tamaño del marco", type: "range", min: 0, max: 100, unit: "" },
  { key: "effect", label: "Efecto de imagen", type: "select", options: EFFECTS },
  { key: "effectAmount", label: "Intensidad del efecto", type: "range", min: 0, max: 100, unit: " %" }
];

export function openMemeEditor({ photo, onAccept, onClose = null }){
  linkFonts();
  const IW = photo.width, IH = photo.height;
  const d0 = DESIGNS[0];
  const state = { design: d0.id, frameColor: d0.frameColor, frameSize: d0.frameSize, effect: "none", effectAmount: 70, texts: [] };
  let selected = null, closed = false, accepting = false, activeProp = "text";
  /* Segunda foto (diseños con `second`, como «Expectativa vs.
     realidad»). Va aparte del estado porque un lienzo no se puede
     clonar; el historial guarda la referencia. */
  let photo2 = null, photo2Id = 0;
  const history = [], future = [];
  const snapshot = () => ({ state: structuredClone(state), selected, photo2 });
  const remember = () => { history.push(snapshot()); if(history.length > 80) history.shift(); future.length = 0; syncActions(); };
  const sel = () => state.texts.find(t => t.uid === selected) || null;
  const layout = () => design(state.design).layout(IW, IH, { color: state.frameColor, size: state.frameSize }, photo, photo2);
  const hasSecond = () => !!design(state.design).second;
  /* Ajustes del meme del diseño actual: los comunes y, si el diseño
     admite segunda foto, esa entrada. */
  const memeProps = () => hasSecond() ? [{ key: "photo2", label: "Segunda foto", type: "photo2" }, ...MEME_PROPS] : MEME_PROPS;

  const opt = (list, value) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(l)}</option>`).join("");
  const root = document.createElement("section");
  root.className = "mm-editor";
  root.innerHTML = `
    <header class="mm-topbar">
      <button class="mm-cancel" type="button">Cancelar</button>
      <button class="mm-close" type="button" aria-label="Cancelar">✕</button>
      <div class="mm-title"><b>Creador de memes</b><span class="mm-size"></span></div>
      <div class="mm-actions">
        <button type="button" data-action="undo" aria-label="Deshacer">↶</button>
        <button type="button" data-action="redo" aria-label="Rehacer">↷</button>
        <button class="primary" type="button" data-action="accept">Aplicar</button>
      </div>
    </header>
    <main class="mm-workspace">
      <aside class="mm-left">
        <section><h3>Diseño</h3><div class="mm-designs">${DESIGNS.map(d => `<button type="button" data-design="${d.id}" title="${esc(d.hint)}"><b>${esc(d.label)}</b><span>${esc(d.hint)}</span></button>`).join("")}</div></section>
        <section class="mm-second" hidden></section>
        <section class="mm-meme-props"></section>
        <section><h3>Textos</h3><div class="mm-textlist"></div><button type="button" class="mm-addtext">＋ Añadir texto</button></section>
      </aside>
      <div class="mm-stage"><canvas></canvas></div>
      <aside class="mm-props">
        <div class="mm-props-empty"><b>Sin selección</b><span>Toca un texto del meme para editarlo, o añade uno nuevo.</span></div>
        <div class="mm-props-body" hidden></div>
      </aside>
    </main>
    <footer class="mm-mobile">
      <div class="mm-row"><select class="mm-design-select" aria-label="Diseño">${opt(DESIGNS.map(d => [d.id, d.label]), state.design)}</select><button type="button" class="mm-add primary">＋ Texto</button></div>
      <select class="mm-prop-select" aria-label="Ajuste"></select>
      <div class="mm-mobile-control"></div>
      <div class="mm-row mm-acts">
        <button type="button" data-do="dup">⧉ Duplicar</button>
        <button type="button" data-do="front">▲ Delante</button>
        <button type="button" data-do="del" class="danger">✕ Eliminar</button>
      </div>
    </footer>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const stage = $(".mm-stage"), canvas = $(".mm-stage canvas"), ctx = canvas.getContext("2d");

  /* ── Vista ── */
  let view = { k: 1, ox: 0, oy: 0, dpr: 1 }, L = layout(), frame = 0;
  let base = null, baseKey = "", baseBusy = false;       // fondo + foto con efecto + capa superior, ya a la escala de vista
  const textCache = new Map();                             // uid → { key, r }
  const fit = () => {
    const box = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr)); canvas.height = Math.max(1, Math.round(box.height * dpr));
    const pad = (matchMedia(MOBILE).matches ? 8 : 24) * dpr;
    const k = Math.min((canvas.width - pad * 2) / L.W, (canvas.height - pad * 2) / L.H);
    view = { k, ox: (canvas.width - L.W * k) / 2, oy: (canvas.height - L.H * k) / 2, dpr };
    baseKey = ""; textCache.clear(); request();
  };
  const request = () => { if(!frame && !closed) frame = requestAnimationFrame(draw); };

  async function buildBase(){
    const keyNow = () => `${state.design}|${state.frameColor}|${state.frameSize}|${state.effect}|${state.effectAmount}|${view.k}|${photo2Id}`;
    const key = keyNow();
    if(key === baseKey || baseBusy) return;
    baseBusy = true;
    const k = view.k, lay = L;
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(lay.W * k)); c.height = Math.max(1, Math.round(lay.H * k));
    const x = c.getContext("2d");
    x.save(); x.scale(k, k); lay.under?.(x); x.restore();
    if(lay.slot2 && photo2){
      const r = lay.slot2, sw = Math.max(1, Math.round(r.w * k)), sh = Math.max(1, Math.round(r.h * k));
      x.drawImage(await applyEffect(coverCanvas(photo2, sw, sh), sw, sh, state.effect, state.effectAmount, k), r.x * k, r.y * k, r.w * k, r.h * k);
    }
    const iw = lay.img.w * k, ih = lay.img.h * k;
    const img = await applyEffect(photo, Math.max(1, Math.round(iw)), Math.max(1, Math.round(ih)), state.effect, state.effectAmount, k);
    x.drawImage(img, lay.img.x * k, lay.img.y * k, iw, ih);
    x.save(); x.scale(k, k); x.translate(lay.img.x, lay.img.y); lay.over?.(x); x.restore();
    baseBusy = false;
    if(closed) return;
    base = c; baseKey = key;
    // Si algo cambió mientras se calculaba, otra vuelta.
    if(key !== keyNow()) buildBase();
    request();
  }
  const rendered = t => {
    const key = JSON.stringify(t) + view.k + L.W + L.H;
    const hit = textCache.get(t.uid);
    if(hit && hit.key === key) return hit.r;
    const r = renderText(t, L.W, L.H, view.k);
    textCache.set(t.uid, { key, r });
    return r;
  };
  const HANDLE = 14;
  const corners = r => {
    const a = r.rot, c = Math.cos(a), s = Math.sin(a), hw = r.w / 2, hh = r.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [r.cx + u * c - v * s, r.cy + u * s + v * c]);
  };
  function draw(){
    frame = 0; if(closed) return;
    buildBase();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(base) ctx.drawImage(base, view.ox, view.oy);
    ctx.save(); ctx.translate(view.ox, view.oy);
    ctx.beginPath(); ctx.rect(0, 0, L.W * view.k, L.H * view.k); ctx.clip();
    for(const t of state.texts) drawText(ctx, t, rendered(t));
    ctx.restore();
    const t = sel(), r = t && rendered(t);
    if(r){
      const pts = corners({ cx: r.cx + view.ox, cy: r.cy + view.oy, w: r.w, h: r.h, rot: t.rot * Math.PI / 180 }), d = view.dpr;
      ctx.save(); ctx.lineWidth = 1.5 * d; ctx.strokeStyle = "#fff"; ctx.setLineDash([6 * d, 4 * d]); ctx.shadowColor = "#000a"; ctx.shadowBlur = 3 * d;
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]); const [hx, hy] = pts[2];
      ctx.fillStyle = "#6794ff"; ctx.beginPath(); ctx.arc(hx, hy, HANDLE * d * .75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.shadowBlur = 0; ctx.font = `${12 * d}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⤡", hx, hy + .5);
      ctx.restore();
    }
    $(".mm-size").textContent = `${L.W} × ${L.H}${L.W !== IW || L.H !== IH ? " · amplía el lienzo" : ""}`;
  }
  /* Cuando llega una tipografía (de /fonts/), se vuelve a medir todo. */
  const ensureFonts = () => {
    for(const t of state.texts) loadFont(t.font, t.bold ? 700 : 400, t.italic).then(() => { textCache.clear(); request(); });
  };

  /* ── Controles genéricos ── */
  const valueText = (p, v) => p.type === "range" ? `${Math.round(v)}${p.unit || ""}` : "";
  function control(p, value, onChange, mobile = false){
    const wrap = document.createElement("div");
    wrap.className = `mm-field mm-${p.type}`;
    const label = mobile ? "" : `<span>${esc(p.label)}${p.type === "range" ? `<b>${valueText(p, value)}</b>` : ""}</span>`;
    if(p.type === "range"){
      wrap.innerHTML = `${label}${mobile ? `<span><b>${valueText(p, value)}</b></span>` : ""}<div class="mm-slider-row"><button type="button" class="mm-step" data-step="-1" aria-label="Disminuir">−</button><input type="range" min="${p.min}" max="${p.max}" step="1" value="${value}" aria-label="${esc(p.label)}"><button type="button" class="mm-step" data-step="1" aria-label="Aumentar">+</button></div>`;
      const input = wrap.querySelector("input"), out = wrap.querySelector("b");
      let started = false;
      const set = (v, final) => { v = Math.max(p.min, Math.min(p.max, Math.round(+v))); input.value = v; out.textContent = valueText(p, v); onChange(v, final, started); };
      input.addEventListener("input", () => { set(input.value, false); started = true; });
      input.addEventListener("change", () => { set(input.value, true); started = false; });
      wrap.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => set(+input.value + +b.dataset.step, true)));
    } else if(p.type === "color"){
      wrap.innerHTML = `${label}<input type="color" value="${value}" aria-label="${esc(p.label)}">`;
      const input = wrap.querySelector("input");
      let started = false;
      input.addEventListener("input", () => { onChange(input.value, false, started); started = true; });
      input.addEventListener("change", () => { onChange(input.value, true, true); started = false; });
    } else if(p.type === "select" || p.type === "preset"){
      const list = p.type === "preset" ? [["", "Elegir un estilo…"], ...TEXT_PRESETS.map(x => [x[0], x[1]])] : p.options;
      wrap.innerHTML = `${label}<select aria-label="${esc(p.label)}">${opt(list, p.type === "preset" ? "" : value)}</select>`;
      const s = wrap.querySelector("select");
      s.addEventListener("change", () => { onChange(s.value, true); if(p.type === "preset") s.value = ""; });
    } else if(p.type === "toggle"){
      wrap.innerHTML = `<label class="mm-toggle"><input type="checkbox"${value ? " checked" : ""}><span>${esc(p.label)}</span></label>`;
      const c = wrap.querySelector("input");
      c.addEventListener("change", () => onChange(c.checked, true));
    } else if(p.type === "photo2"){
      wrap.innerHTML = `${mobile ? "" : `<span>${esc(design(state.design).second || p.label)}</span>`}
        <div class="mm-photo2">
          <button type="button" data-p2="open">📂 Abrir foto…</button>
          <button type="button" data-p2="paste">📋 Pegar</button>
          <button type="button" data-p2="clear" class="danger"${photo2 ? "" : " disabled"}>Quitar</button>
        </div>
        <p class="mm-note">${photo2 ? `Segunda foto: ${photo2.width} × ${photo2.height}. ` : "Sin segunda foto: se usa la misma en blanco y negro. "}También puedes pegarla con Ctrl+V.</p>`;
      wrap.querySelector("[data-p2=open]").addEventListener("click", openPhoto2);
      wrap.querySelector("[data-p2=paste]").addEventListener("click", pastePhoto2);
      wrap.querySelector("[data-p2=clear]").addEventListener("click", () => setPhoto2(null));
    } else if(p.type === "text"){
      wrap.innerHTML = `${label}<textarea rows="${mobile ? 1 : 3}" aria-label="${esc(p.label)}" placeholder="Escribe el texto…">${esc(value)}</textarea>`;
      const a = wrap.querySelector("textarea");
      let started = false;
      a.addEventListener("input", () => { onChange(a.value, false, started); started = true; });
      a.addEventListener("change", () => { started = false; });
    }
    return wrap;
  }

  /* Cambio de una propiedad del texto elegido. `started` = ya se
     guardó el paso de historial de este gesto. */
  const setTextProp = (key, value, final, started) => {
    const t = sel(); if(!t || accepting) return;
    if(key === "preset"){ if(!value) return; remember(); applyPreset(t, value); ensureFonts(); syncProps(); request(); return; }
    if(t[key] === value) return;
    if(!started) remember();     // un paso de historial por gesto
    t[key] = value;
    if(key === "font" || key === "bold" || key === "italic") ensureFonts();
    if(key === "text") syncTextList();
    if(["font", "bold", "italic", "caps", "fill"].includes(key)) syncProps(); else refreshValues();
    request();
  };
  const setMemeProp = (key, value, final, started) => {
    if(accepting || state[key] === value) return;
    if(!started) remember();
    state[key] = value;
    if(key === "frameSize" || key === "frameColor"){ L = layout(); if(key === "frameSize") fit(); }
    request();
  };

  /* ── Panel izquierdo (escritorio) y listas ── */
  const syncMemeProps = () => {
    const second = $(".mm-second");
    second.hidden = !hasSecond(); second.innerHTML = "";
    if(hasSecond()){ second.innerHTML = "<h3>Segunda foto</h3>"; second.appendChild(control(memeProps()[0], null, () => {})); }
    const host = $(".mm-meme-props"); host.innerHTML = "<h3>Marco e imagen</h3>";
    for(const p of MEME_PROPS) host.appendChild(control(p, state[p.key], (v, f, s) => setMemeProp(p.key, v, f, s)));
    root.querySelectorAll("[data-design]").forEach(b => b.classList.toggle("on", b.dataset.design === state.design));
    $(".mm-design-select").value = state.design;
  };
  const syncTextList = () => {
    const list = $(".mm-textlist");
    list.innerHTML = state.texts.length ? "" : `<p class="mm-note">Sin textos.</p>`;
    state.texts.slice().reverse().forEach(t => {
      const b = document.createElement("button");
      b.type = "button"; b.className = t.uid === selected ? "on" : "";
      b.textContent = String(t.text).replace(/\s+/g, " ").trim() || "(vacío)";
      b.addEventListener("click", () => { selected = t.uid; syncProps(); request(); });
      list.appendChild(b);
    });
  };
  /* ── Segunda foto: abrir, pegar, quitar ── */
  function setPhoto2(img){
    if(accepting || img === photo2) return;
    remember();
    const oldL = L, d = design(state.design);
    photo2 = img; photo2Id++;
    L = layout();
    if(oldL.W !== L.W || oldL.H !== L.H) relayoutTexts(d, oldL, L);
    textCache.clear(); fit(); syncMemeProps(); syncProps(); request();
    if(img) toast("Segunda foto añadida", "ok");
  }
  /* La segunda foto puede cambiar la forma del lienzo (apilar, poner
     al lado): los textos se recolocan sin perder lo escrito ni el
     estilo. Los del diseño siguen a su posición de fábrica conservando
     lo que el usuario los haya movido o escalado; los añadidos a mano
     se quedan en el mismo sitio en píxeles. */
  function relayoutTexts(d, oldL, newL){
    const before = d.texts(oldL), after = d.texts(newL);
    state.texts.forEach((t, i) => {
      const a = before[i], b = after[i];
      if(a && b){
        t.x += b.x - a.x; t.y += b.y - a.y;
        t.w = Math.max(10, Math.min(100, t.w * b.w / a.w));
        t.size = Math.max(10, Math.min(300, t.size * b.size / a.size));
      } else {
        t.x = t.x * oldL.W / newL.W; t.y = t.y * oldL.H / newL.H;
        t.w = Math.min(100, t.w * oldL.W / newL.W); t.size = t.size * oldL.W / newL.W;
      }
    });
  }
  async function useBlob(blob){
    if(!hasSecond()){ toast("Este diseño no usa una segunda foto: elige, por ejemplo, «Expectativa vs. realidad»."); return; }
    try{ setPhoto2(await decodeImage(blob)); }catch(e){ toast(e.message, "err"); }
  }
  function openPhoto2(){
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.addEventListener("change", () => { if(input.files?.[0]) useBlob(input.files[0]); });
    input.click();
  }
  /* El botón «Pegar» lee el portapapeles con la API asíncrona (en
     móvil no hay Ctrl+V); el navegador puede pedir permiso. */
  async function pastePhoto2(){
    try{
      const items = await navigator.clipboard.read();
      for(const item of items){
        const type = item.types.find(t => t.startsWith("image/"));
        if(type){ await useBlob(await item.getType(type)); return; }
      }
      toast("No hay ninguna imagen en el portapapeles");
    }catch{ toast("El navegador no ha dejado leer el portapapeles. Prueba con Ctrl+V o con «Abrir foto».", "err"); }
  }
  /* Ctrl+V en cualquier parte de la ventana: sólo se intercepta si lo
     pegado es una imagen, para no estorbar al pegar texto en un campo.
     Se para la propagación porque la app tiene su propio pegado
     (js/io/open.js), que pondría la imagen como capa del documento,
     detrás de esta ventana. */
  const onPaste = e => {
    if(closed) return;
    const file = [...(e.clipboardData?.items || [])].find(i => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
    if(!file) return;
    e.preventDefault(); e.stopPropagation();
    if(!accepting) useBlob(file);
  };

  const chooseDesign = id => {
    if(accepting) return;
    remember();
    const d = design(id);
    state.design = d.id; state.frameColor = d.frameColor; state.frameSize = d.frameSize;
    L = layout();
    state.texts = d.texts(L);
    selected = state.texts[0]?.uid ?? null;
    ensureFonts(); fit(); syncMemeProps(); syncProps();
  };
  root.querySelectorAll("[data-design]").forEach(b => b.addEventListener("click", () => chooseDesign(b.dataset.design)));
  $(".mm-design-select").addEventListener("change", e => chooseDesign(e.target.value));
  const addText = () => {
    if(accepting) return;
    remember();
    const t = newText({ text: "TU TEXTO", y: 50 });
    applyPreset(t, "classic"); state.texts.push(t); selected = t.uid; activeProp = "text";
    ensureFonts(); syncProps(); request();
    focusText();
  };
  $(".mm-addtext").addEventListener("click", addText);
  $(".mm-add").addEventListener("click", addText);

  /* ── Propiedades del texto (escritorio) y desplegable (móvil) ── */
  const syncProps = () => {
    const t = sel();
    $(".mm-props-empty").hidden = !!t; $(".mm-props-body").hidden = !t;
    root.classList.toggle("has-selection", !!t);
    const body = $(".mm-props-body"); body.innerHTML = "";
    if(t){
      for(const [g, label] of PROP_GROUPS){
        const sec = document.createElement("details");
        sec.open = openGroups.has(g);
        sec.addEventListener("toggle", () => { if(sec.open) openGroups.add(g); else openGroups.delete(g); });
        sec.innerHTML = `<summary>${label}</summary>`;
        for(const p of PROPS.filter(p => p.group === g)){
          if(p.key === "color2" || p.key === "gradAngle"){ if(t.fill !== "gradient") continue; }
          sec.appendChild(control(p, t[p.key], (v, f, s) => setTextProp(p.key, v, f, s)));
        }
        body.appendChild(sec);
      }
      const acts = document.createElement("div"); acts.className = "mm-buttons";
      acts.innerHTML = `<button type="button" data-do="dup">⧉ Duplicar</button><button type="button" data-do="front">▲ Delante</button><button type="button" data-do="back">▼ Detrás</button><button type="button" data-do="del" class="danger">✕ Eliminar</button>`;
      acts.querySelectorAll("[data-do]").forEach(b => b.addEventListener("click", () => act(b.dataset.do)));
      body.appendChild(acts);
    }
    // Desplegable móvil: ajustes del meme + los del texto elegido
    const ps = $(".mm-prop-select");
    ps.innerHTML = `<optgroup label="Meme">${memeProps().map(p => `<option value="m:${p.key}">${esc(p.label)}</option>`).join("")}</optgroup>` +
      (t ? PROP_GROUPS.map(([g, label]) => `<optgroup label="${esc(label)}">${PROPS.filter(p => p.group === g).map(p => `<option value="${p.key}">${esc(p.label)}</option>`).join("")}</optgroup>`).join("") : "");
    if(!t && !activeProp.startsWith("m:")) activeProp = hasSecond() ? "m:photo2" : "m:effect";
    if(activeProp === "m:photo2" && !hasSecond()) activeProp = "m:effect";
    ps.value = activeProp;
    mobileControl();
    root.querySelectorAll(".mm-acts [data-do]").forEach(b => { b.disabled = !t || accepting; });
    syncTextList(); syncActions();
  };
  const mobileControl = () => {
    const host = $(".mm-mobile-control"); host.innerHTML = "";
    if(activeProp.startsWith("m:")){
      const p = memeProps().find(p => p.key === activeProp.slice(2));
      if(p) host.appendChild(control(p, state[p.key], (v, f, s) => setMemeProp(p.key, v, f, s), true));
    } else {
      const t = sel(), p = prop(activeProp);
      if(t && p) host.appendChild(control(p, t[p.key], (v, f, s) => setTextProp(p.key, v, f, s), true));
    }
  };
  /* Durante un arrastre el propio control ya muestra su valor: no
     hace falta reconstruir el panel. */
  const refreshValues = () => {};
  const openGroups = new Set(["texto", "tipo", "relleno", "contorno"]);
  $(".mm-prop-select").addEventListener("change", e => { activeProp = e.target.value; mobileControl(); });
  const focusText = () => {
    if(matchMedia(MOBILE).matches){ activeProp = "text"; $(".mm-prop-select").value = "text"; mobileControl(); }
    const a = root.querySelector(matchMedia(MOBILE).matches ? ".mm-mobile-control textarea" : ".mm-props-body textarea");
    if(a){ a.focus(); a.select(); }
  };

  const act = what => {
    const t = sel(); if(!t || accepting) return;
    const i = state.texts.indexOf(t);
    remember();
    if(what === "dup"){ const c = { ...structuredClone(t), uid: newText().uid, x: Math.min(95, t.x + 4), y: Math.min(95, t.y + 4) }; state.texts.splice(i + 1, 0, c); selected = c.uid; }
    else if(what === "front"){ state.texts.splice(i, 1); state.texts.push(t); }
    else if(what === "back"){ state.texts.splice(i, 1); state.texts.unshift(t); }
    else if(what === "del"){ state.texts.splice(i, 1); selected = null; textCache.delete(t.uid); }
    syncProps(); request();
  };
  root.querySelectorAll(".mm-acts [data-do]").forEach(b => b.addEventListener("click", () => act(b.dataset.do)));

  const syncActions = () => {
    $("[data-action=undo]").disabled = !history.length || accepting;
    $("[data-action=redo]").disabled = !future.length || accepting;
    $("[data-action=accept]").disabled = accepting;
  };

  /* ── Gestos en el meme ── */
  const toLocal = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [(cx - r.left) * view.dpr - view.ox, (cy - r.top) * view.dpr - view.oy]; };
  const hitTest = (x, y) => {
    for(let i = state.texts.length - 1; i >= 0; i--){
      const t = state.texts[i], r = rendered(t); if(!r) continue;
      const a = -t.rot * Math.PI / 180, dx = x - r.cx, dy = y - r.cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if(Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return t;
    }
    return null;
  };
  const onHandle = (x, y) => {
    const t = sel(), r = t && rendered(t); if(!r) return false;
    const [hx, hy] = corners({ ...r, rot: t.rot * Math.PI / 180 })[2];
    return Math.hypot(x - hx, y - hy) <= HANDLE * view.dpr * 1.6;
  };
  const pointers = new Map();
  let gesture = null, lastTap = { t: 0, uid: null };
  canvas.addEventListener("pointerdown", e => {
    if(accepting) return;
    const [x, y] = toLocal(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x, y });
    try{ canvas.setPointerCapture(e.pointerId); }catch{}
    const t = sel();
    if(pointers.size === 2 && t){
      const [a, b] = [...pointers.values()];
      gesture = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
                  size: t.size, w: t.w, rot: t.rot, tx: t.x, ty: t.y, saved: gesture?.saved || snapshot() };
      return;
    }
    if(pointers.size > 1) return;
    if(onHandle(x, y)){
      const r = rendered(t);
      gesture = { type: "handle", saved: snapshot(), d0: Math.hypot(x - r.cx, y - r.cy) || 1, a0: Math.atan2(y - r.cy, x - r.cx), size: t.size, w: t.w, rot: t.rot, cx: r.cx, cy: r.cy };
      return;
    }
    const hit = hitTest(x, y);
    if(hit){
      const now = performance.now();
      if(lastTap.uid === hit.uid && now - lastTap.t < 350){ focusText(); lastTap = { t: 0, uid: null }; return; }
      lastTap = { t: now, uid: hit.uid };
      if(selected !== hit.uid){ selected = hit.uid; syncProps(); }
      gesture = { type: "move", saved: snapshot(), x0: x, y0: y, tx: hit.x, ty: hit.y };
    } else if(selected){ selected = null; syncProps(); gesture = null; }
    request();
  });
  canvas.addEventListener("pointermove", e => {
    if(!pointers.has(e.pointerId) || !gesture) return;
    const [x, y] = toLocal(e.clientX, e.clientY);
    pointers.set(e.pointerId, { x, y });
    const t = sel(); if(!t) return;
    const sx = 100 / (L.W * view.k), sy = 100 / (L.H * view.k);
    if(gesture.type === "move" && pointers.size === 1){ t.x = gesture.tx + (x - gesture.x0) * sx; t.y = gesture.ty + (y - gesture.y0) * sy; gesture.moved = true; }
    else if(gesture.type === "handle"){
      const f = Math.hypot(x - gesture.cx, y - gesture.cy) / gesture.d0;
      t.size = Math.max(10, Math.min(300, gesture.size * f)); t.w = Math.max(10, Math.min(100, gesture.w * f));
      t.rot = Math.round(((gesture.rot + (Math.atan2(y - gesture.cy, x - gesture.cx) - gesture.a0) * 180 / Math.PI + 540) % 360) - 180);
      gesture.moved = true;
    } else if(gesture.type === "pinch" && pointers.size === 2){
      const [a, b] = [...pointers.values()], f = (Math.hypot(a.x - b.x, a.y - b.y) || 1) / gesture.d;
      t.size = Math.max(10, Math.min(300, gesture.size * f)); t.w = Math.max(10, Math.min(100, gesture.w * f));
      t.rot = Math.round(((gesture.rot + (Math.atan2(b.y - a.y, b.x - a.x) - gesture.ang) * 180 / Math.PI + 540) % 360) - 180);
      t.x = gesture.tx + ((a.x + b.x) / 2 - gesture.mx) * sx; t.y = gesture.ty + ((a.y + b.y) / 2 - gesture.my) * sy;
      gesture.moved = true;
    }
    request();
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if(!gesture) return;
    if(!pointers.size){
      if(gesture.moved && gesture.saved){ history.push(gesture.saved); if(history.length > 80) history.shift(); future.length = 0; syncProps(); }
      gesture = null;
    } else if(gesture.type === "pinch"){
      const [p] = [...pointers.values()], t = sel();
      gesture = t ? { type: "move", saved: gesture.saved, moved: gesture.moved, x0: p.x, y0: p.y, tx: t.x, ty: t.y } : null;
    }
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("dblclick", e => { const [x, y] = toLocal(e.clientX, e.clientY); const hit = hitTest(x, y); if(hit){ selected = hit.uid; syncProps(); focusText(); } });

  /* ── Barra superior ── */
  const restore = s => { Object.assign(state, structuredClone(s.state)); selected = s.selected; if(s.photo2 !== photo2){ photo2 = s.photo2; photo2Id++; } L = layout(); textCache.clear(); ensureFonts(); fit(); syncMemeProps(); syncProps(); };
  $("[data-action=undo]").addEventListener("click", () => { const p = history.pop(); if(!p) return; future.push(snapshot()); restore(p); });
  $("[data-action=redo]").addEventListener("click", () => { const n = future.pop(); if(!n) return; history.push(snapshot()); restore(n); });
  $(".mm-cancel").addEventListener("click", () => close());
  $(".mm-close").addEventListener("click", () => close());
  $("[data-action=accept]").addEventListener("click", async () => {
    if(accepting || closed) return;
    accepting = true; syncActions();
    const button = $("[data-action=accept]"); button.textContent = "Aplicando…";
    try{
      await Promise.all(state.texts.map(t => loadFont(t.font, t.bold ? 700 : 400, t.italic)));
      await onAccept(structuredClone(state), layout(), photo2);
      close();
    }catch(error){
      toast(error?.message || "No se pudo crear el meme", "err");
      accepting = false; button.textContent = "Aplicar"; syncActions();
    }
  });
  const onKey = e => {
    if(closed) return;
    const typing = e.target.matches?.("input, textarea, select");
    if(e.key === "Escape"){ e.preventDefault(); if(typing) e.target.blur(); else if(!accepting) close(); return; }
    if(typing) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); $(e.shiftKey ? "[data-action=redo]" : "[data-action=undo]").click(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d"){ e.preventDefault(); act("dup"); return; }
    if(e.key === "Delete" || e.key === "Backspace"){ if(sel()){ e.preventDefault(); act("del"); } return; }
    const t = sel();
    if(t && e.key.startsWith("Arrow")){
      e.preventDefault(); remember();
      const step = e.shiftKey ? 2 : .25;
      if(e.key === "ArrowLeft") t.x -= step; if(e.key === "ArrowRight") t.x += step;
      if(e.key === "ArrowUp") t.y -= step; if(e.key === "ArrowDown") t.y += step;
      request();
    }
  };
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  const close = () => {
    if(closed) return;
    closed = true; cancelAnimationFrame(frame); observer.disconnect();
    document.removeEventListener("keydown", onKey, true); document.removeEventListener("paste", onPaste, true);
    textCache.clear(); root.remove(); onClose?.();
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("paste", onPaste, true);

  // Arranque con el diseño clásico y sus textos
  state.texts = d0.texts(L); selected = state.texts[0]?.uid ?? null;
  ensureFonts(); syncMemeProps(); fit(); syncProps();
  return { close };
}
