/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN CON UN TOQUE y BORRADOR MÁGICO (Premium 👑)
   Menú Inteligencia Artificial y su pestaña del cajón del móvil.

   Una ventana a pantalla completa con la foto: cada toque añade un
   punto y SAM (js/ai/sam.js) devuelve al momento la máscara del objeto;
   «Quitar» (o Alt/Mayús + clic) marca lo que NO es parte. Deshacer y
   rehacer van por puntos. Aplicar:
     · Selección con un toque → la máscara, refinada a la resolución de
       la foto, pasa a ser la selección activa.
     · Borrador mágico → LaMa rellena el objeto y el resultado va a una
       CAPA NUEVA encima de la activa (la foto original queda intacta).

   Procesado Premium («el bueno y el mejor»):
     · Máscara: logits de SAM ampliados con suavidad, limpieza de manchas
       y agujeros, borde guiado por la foto (ver sam.js).
     · Relleno: la zona se agranda un poco para llevarse el halo del
       objeto; LaMa trabaja con el mayor contexto posible a 512 px; la
       costura se funde en LUZ LINEAL y se devuelve al relleno el grano
       de la foto (un relleno ampliado sale liso y delata el retoque).
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { toast } from "../ui/toast.js";
import { createShell, ensureShellStyles } from "../ui/fsshell.js";
import { samPrepare, samPredict, previewMask, finalMask } from "../ai/sam.js";
import { commitSelection, boundsOf } from "../editor/selection.js";
import { boxBlurFloat } from "../editor/refineedge-math.js";

const MODES = {
  select: { title: "Selección con un toque", apply: "Seleccionar", tint: [30, 144, 255],
            hint: "Toca lo que quieras seleccionar. «Quitar» para excluir partes." },
  erase:  { title: "Borrador mágico", apply: "Borrar", tint: [255, 70, 60],
            hint: "Toca lo que quieras borrar. «Quitar» para respetar partes." }
};

let open = false;

export async function openSamTool(mode = "select"){
  if(open) return;
  const M = MODES[mode];
  const layer = activeLayer();
  if(!doc.open || !layer){ toast("Abre una imagen primero"); return; }
  if(layer.type === "adjust" || !layer.canvas){ toast("Selecciona una capa de imagen"); return; }
  if(mode === "erase" && layer.locked){ toast("La capa está bloqueada"); return; }
  open = true;
  await ensureShellStyles();

  const src = layer.canvas;
  const points = [], redo = [];
  let st = null, mask = null, maskCanvas = null, sign = true, busy = false, pending = false, closed = false;

  const sh = createShell({
    title: M.title, subtitle: "Premium 👑 · Analizando la foto…", applyLabel: M.apply,
    cls: "sam-tool",
    onCancel: () => close(),
    onApply: () => apply(),
    onUndo: () => { if(points.length){ redo.push(points.pop()); update(); } },
    onRedo: () => { if(redo.length){ points.push(redo.pop()); update(); } }
  });
  sh.setView(src, false);
  sh.setApplyEnabled(false);

  // Mandos mínimos: Añadir / Quitar (escritorio a la derecha, móvil abajo)
  const seg = () => {
    const el = document.createElement("div");
    el.className = "sam-seg";
    el.innerHTML = `<button type="button" data-s="1" class="on">＋ Añadir</button><button type="button" data-s="0">－ Quitar</button>`;
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if(!b) return;
      sign = b.dataset.s === "1";
      sh.root.querySelectorAll(".sam-seg button").forEach(x => x.classList.toggle("on", (x.dataset.s === "1") === sign));
    });
    return el;
  };
  sh.mobile.appendChild(seg());
  sh.right.appendChild(seg());
  const hint = document.createElement("p");
  hint.className = "sam-hint";
  hint.textContent = M.hint + " Alt o Mayús + clic también quita.";
  sh.right.appendChild(hint);

  // Vista previa: máscara teñida y los puntos
  sh.setOverlay((cx, t) => {
    if(maskCanvas) cx.drawImage(maskCanvas, t.ox, t.oy, src.width * t.k, src.height * t.k);
    for(const p of points){
      const x = t.ox + p.x * t.k, y = t.oy + p.y * t.k, r = 7 * t.dpr;
      cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
      cx.fillStyle = p.pos ? "#2ecc71" : "#e74c3c"; cx.fill();
      cx.lineWidth = 2 * t.dpr; cx.strokeStyle = "#fff"; cx.stroke();
      cx.fillStyle = "#fff"; cx.fillRect(x - r * 0.5, y - t.dpr, r, 2 * t.dpr);
      if(p.pos) cx.fillRect(x - t.dpr, y - r * 0.5, 2 * t.dpr, r);
    }
  });

  // Un toque (sin arrastrar) añade un punto; arrastrar no hace nada
  let down = null;
  sh.setInteract((type, p, e) => {
    if(!st || busy && type === "down") return type === "down";
    if(type === "down"){ down = { x: e.clientX, y: e.clientY, p }; return true; }
    if(type === "up" && down){
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const q = down.p; down = null;
      if(moved > 10 || !q || q.x < 0 || q.y < 0 || q.x >= src.width || q.y >= src.height) return false;
      points.push({ x: q.x, y: q.y, pos: sign && !e.altKey && !e.shiftKey });
      redo.length = 0;
      update();
    }
    if(type === "cancel") down = null;
    return false;
  });

  function paintMask(m){
    const c = document.createElement("canvas"); c.width = m.w; c.height = m.h;
    const x = c.getContext("2d"), img = x.createImageData(m.w, m.h), bin = previewMask(m);
    const [r, g, b] = M.tint;
    for(let i = 0; i < bin.length; i++) if(bin[i]){ const j = i * 4; img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b; img.data[j + 3] = 120; }
    x.putImageData(img, 0, 0);
    return c;
  }

  async function update(){
    sh.setUndo(points.length > 0, redo.length > 0);
    if(!points.length){ mask = null; maskCanvas = null; sh.setApplyEnabled(false); sh.redraw(); return; }
    if(busy){ pending = true; return; }
    busy = true;
    try{
      do{
        pending = false;
        st.low = null;                       // cada cambio de puntos parte de cero (deshacer coherente)
        mask = await samPredict(st, points);
        if(closed) return;
        maskCanvas = paintMask(mask);
        sh.setApplyEnabled(points.some(p => p.pos));
        sh.redraw();
      }while(pending && !closed);
    }catch(err){ toast("No se pudo calcular la máscara: " + err.message, "err"); }
    finally{ busy = false; }
  }

  function close(){ closed = true; open = false; sh.close(); }

  async function apply(){
    if(!mask || busy) return;
    sh.setApplyEnabled(false);
    sh.setBusy(mode === "select" ? "Afinando el borde…" : "Borrando con IA…");
    await new Promise(r => setTimeout(r, 30));
    try{
      const rgba = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data;
      const fm = finalMask(mask, points, st, rgba);
      if(mode === "select"){
        close();
        commitSelection(fm, "new");
        toast("Selección creada con IA", "ok");
      } else {
        const ok = await eraseToLayer(layer, fm, rgba);
        if(ok){ close(); toast("Borrado en una capa nueva", "ok"); }
        else { sh.setBusy(null); sh.setApplyEnabled(true); }
      }
    }catch(err){
      sh.setBusy(null); sh.setApplyEnabled(true);
      if(!err.cancelled) toast("No se pudo completar: " + err.message, "err");
    }
  }

  // Analizar la foto (descarga los modelos la primera vez, con aviso)
  try{
    st = await samPrepare(src);
    if(closed) return;
    sh.setSubtitle("Premium 👑 · " + M.hint.split(".")[0]);
  }catch(err){
    close();
    if(!err.cancelled && !/cancelad/.test(err.message)) toast("No se pudo analizar la foto: " + err.message, "err");
  }
}

/* ── Borrado con LaMa en una capa nueva ─────────────────────────── */
const DEC = new Float32Array(256);
for(let i = 0; i < 256; i++){ const v = i / 255; DEC[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const enc = v => { v = v < 0 ? 0 : v > 1 ? 1 : v; return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };

function lamaRegion(b, W, H){
  let side = Math.round(Math.max(b.w, b.h) * 2.5);
  side = Math.max(side, Math.min(512, Math.max(W, H)));
  const sw = Math.min(side, W), shh = Math.min(side, H);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return { x: Math.max(0, Math.min(W - sw, Math.round(cx - sw / 2))), y: Math.max(0, Math.min(H - shh, Math.round(cy - shh / 2))), w: sw, h: shh };
}

/* Ruido determinista (gaussiano aproximado) para el grano */
const hash = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const gauss = i => (hash(i) + hash(i + 7919) + hash(i + 104729) - 1.5) * 2;

/* `inpaint` se puede sustituir (pruebas sin descargar LaMa). */
export async function eraseToLayer(layer, fm, rgba, inpaint = null){
  const W = layer.canvas.width, H = layer.canvas.height, N = 512;
  const b0 = boundsOf(fm.map(v => v > 127 ? 255 : 0), W, H);
  if(!b0){ toast("No hay nada que borrar"); return false; }
  // Zona a rellenar: la máscara algo agrandada (se lleva el halo del objeto)
  const grow = Math.max(3, Math.round(Math.max(W, H) / 400));
  const hard = new Float32Array(W * H);
  for(let i = 0; i < hard.length; i++) hard[i] = fm[i] > 110 ? 1 : 0;
  const grown = boxBlurFloat(hard, W, H, grow);
  const bounds = { x: Math.max(0, b0.x - grow), y: Math.max(0, b0.y - grow), w: Math.min(W, b0.w + 2 * grow), h: Math.min(H, b0.h + 2 * grow) };
  const region = lamaRegion(bounds, W, H);

  // LaMa a 512×512 sobre el recorte
  const inC = document.createElement("canvas"); inC.width = inC.height = N;
  const ix = inC.getContext("2d", { willReadFrequently: true });
  ix.imageSmoothingQuality = "high";
  ix.drawImage(layer.canvas, region.x, region.y, region.w, region.h, 0, 0, N, N);
  const inRgba = ix.getImageData(0, 0, N, N).data;
  const hole = new Uint8Array(N * N), sx = region.w / N, sy = region.h / N;
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
    // Máximo de la zona agrandada dentro del píxel de 512 (no se escapa nada)
    const X0 = region.x + Math.floor(x * sx), Y0 = region.y + Math.floor(y * sy);
    const X1 = Math.min(W - 1, region.x + Math.floor((x + 1) * sx)), Y1 = Math.min(H - 1, region.y + Math.floor((y + 1) * sy));
    let on = 0;
    for(let yy = Y0; yy <= Y1 && !on; yy++) for(let xx = X0; xx <= X1; xx++) if(grown[yy * W + xx] > 0.01){ on = 1; break; }
    hole[y * N + x] = on;
  }
  let res;
  try{
    if(inpaint) res = await inpaint(inRgba, hole, N);
    else {
      const { runModel } = await import("../ai/runtime.js");
      res = await runModel("inpaint", "lama", { rgba: inRgba, hole, size: N }, [inRgba.buffer, hole.buffer], { title: "Borrando con IA" });
    }
  }
  catch(err){ if(!err.cancelled) toast("No se pudo borrar con LaMa: " + err.message, "err"); return false; }

  // Relleno de vuelta al tamaño del recorte
  const outC = document.createElement("canvas"); outC.width = outC.height = N;
  outC.getContext("2d").putImageData(new ImageData(res.rgba, N, N), 0, 0);
  const upC = document.createElement("canvas"); upC.width = region.w; upC.height = region.h;
  const ux = upC.getContext("2d", { willReadFrequently: true });
  ux.imageSmoothingQuality = "high";
  ux.drawImage(outC, 0, 0, region.w, region.h);
  const fill = ux.getImageData(0, 0, region.w, region.h).data;

  // Mezcla: alfa = zona agrandada con un borde suave corto
  const soft = boxBlurFloat(grown.map(v => v > 0.01 ? 1 : 0), W, H, Math.max(1, Math.round(grow / 2)));

  // Grano: ruido de alta frecuencia de la foto alrededor del hueco (por
  // canal), que se devuelve al relleno si éste sale más liso
  const up = region.w / N;
  let s2 = [0, 0, 0], cnt = 0;
  for(let y = region.y + 1; y < region.y + region.h - 1; y += 2) for(let x = region.x + 1; x < region.x + region.w - 1; x += 2){
    const p = y * W + x; if(soft[p] > 0) continue;
    const i = p * 4;
    for(let c = 0; c < 3; c++){
      const hp = rgba[i + c] - (rgba[i - 4 + c] + rgba[i + 4 + c] + rgba[i - W * 4 + c] + rgba[i + W * 4 + c]) / 4;
      s2[c] += hp * hp;
    }
    cnt++;
  }
  const sigma = s2.map(v => cnt ? Math.sqrt(v / cnt) * 0.8 : 0);
  // Cuanto más se amplió el relleno, más grano le falta
  const grainK = Math.min(1, Math.max(0, (up - 0.8) / 1.5));

  const outLayer = document.createElement("canvas"); outLayer.width = W; outLayer.height = H;
  const ox = outLayer.getContext("2d");
  const img = ox.createImageData(region.w, region.h), d = img.data;
  for(let y = 0; y < region.h; y++) for(let x = 0; x < region.w; x++){
    const p = (region.y + y) * W + region.x + x, a = soft[p];
    if(a <= 0.003) continue;
    const i = p * 4, j = (y * region.w + x) * 4;
    for(let c = 0; c < 3; c++){
      const f = fill[j + c] + sigma[c] * grainK * gauss(p * 3 + c);
      // Costura en luz lineal
      const lin = DEC[rgba[i + c]] * (1 - a) + DEC[Math.max(0, Math.min(255, Math.round(f)))] * a;
      d[j + c] = Math.round(enc(lin));
    }
    d[j + 3] = 255;
  }
  ox.putImageData(img, region.x, region.y);

  // Capa nueva encima de la activa, un solo paso de deshacer
  const [{ addLayer }, { record }, { emit }] = await Promise.all([import("../core/doc.js"), import("../core/history.js"), import("../core/bus.js")]);
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const l = addLayer({ name: "Borrador mágico" });
  l.ctx.drawImage(outLayer, 0, 0);
  l.thumbDirty = true;
  // Porcentaje de aplicación (mezcla con la capa de debajo)
  (await import("../editor/filterlayer.js")).markMixLayer(l, "Borrador mágico");
  const nextLayers = doc.layers.slice(), nextActive = l.id;
  const put = (layers, active) => { doc.layers = layers.slice(); doc.activeId = active; emit("doc:structure"); emit("doc:change"); };
  record("Borrador mágico", () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
  emit("doc:structure"); emit("doc:change");
  return true;
}
