/* ═══════════════════════════════════════════════════════════════
   IA · AMPLIAR, COLOREAR Y EXPANDIR
   Modelos de ImageToolbox (js/ai/models.js), ejecutados en el equipo
   con el mismo worker que el resto de la IA (js/ai/worker.js).

   · Ampliar ×2 / ×4: la imagen visible, por teselas; el resultado mide
     más que el documento, así que va a una pestaña nueva como capa.
   · Colorear: el modelo decide el color a baja resolución y se aplica
     a la luminancia ORIGINAL a tamaño completo → capa nueva.
   · Expandir: se agranda el lienzo y LaMa rellena los bordes nuevos,
     por teselas que se van apoyando en lo ya rellenado → pestaña nueva.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { isMobile, COARSE } from "../core/device.js";

const MAX_OUT = COARSE || isMobile() ? 2400 : 8192;   // lado máximo del resultado (como un documento)
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const dataOf = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
function scaled(src, w, h){ const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, h); return c; }

async function modelOptions(ids){
  const [{ MODELS, mb }, { sizeNote, crashedBefore }] = await Promise.all([import("../ai/models.js"), import("../ai/runtime.js")]);
  return Promise.all(ids.map(async ([id, desc]) => [id, `${MODELS[id].label} · ${desc} (${await sizeNote(id)}${crashedBefore(id) ? ", falló por memoria aquí" : ""})`]));
}
async function ask(title, html, onOpen){
  const body = document.createElement("div"); body.innerHTML = html;
  const r = await dialog({ title, body, cls: isMobile() ? "dlg-compact" : "", onOpen: onOpen ? b => onOpen(b) : undefined,
    buttons: [{ label: "Cancelar", value: null }, { label: "Aplicar", primary: true, value: "go" }] });
  return r === "go" ? body : null;
}
const failed = (what, err) => { if(err?.cancelled) toast(`${what}: cancelado`); else toast(`${what}: ${err.message}`, "err"); };

/* ── Ampliar ── */
const UPSCALERS = [["esrgan_x4", "fotos, rápido"], ["span_x2", "×2, el más ligero"], ["sharp_x4", "máximo detalle"], ["anime_x4", "dibujos e ilustraciones"]];
export async function aiUpscale(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const opts = await modelOptions(UPSCALERS);
  const { MODELS } = await import("../ai/models.js");
  let saved = "esrgan_x4"; try{ saved = localStorage.getItem("realify.upscaler") || saved; }catch{}
  const body = await ask("Ampliar con IA", `
    <div class="field"><label>Modelo</label><select id="upM" class="grow">${opts.map(([v, l]) => `<option value="${v}"${v === saved ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    <p class="hint" id="upInfo" style="margin:4px 0 0"></p>`, b => {
      const sync = () => {
        const S = MODELS[b.querySelector("#upM").value].scale, w = doc.w * S, h = doc.h * S, k = Math.min(1, MAX_OUT / Math.max(w, h));
        b.querySelector("#upInfo").textContent = `Resultado: ${Math.round(w * k)} × ${Math.round(h * k)} px${k < 1 ? ` (limitado a ${MAX_OUT} px en este dispositivo)` : ""}, en una pestaña nueva. Se procesa en tu equipo.`;
      };
      b.querySelector("#upM").addEventListener("change", sync); sync();
    });
  if(!body) return;
  const id = body.querySelector("#upM").value, S = MODELS[id].scale;
  try{ localStorage.setItem("realify.upscaler", id); }catch{}
  // Si el resultado pasaría del límite, se reduce antes la entrada.
  let src = flatten();
  const k = Math.min(1, MAX_OUT / (Math.max(src.width, src.height) * S));
  if(k < 1) src = scaled(src, Math.max(8, Math.round(src.width * k)), Math.max(8, Math.round(src.height * k)));
  const rgba = dataOf(src);
  try{
    const { runModel } = await import("../ai/runtime.js");
    const r = await runModel("upscale", id, { rgba, w: src.width, h: src.height }, [rgba.buffer]);
    const c = document.createElement("canvas"); c.width = r.w; c.height = r.h;
    c.getContext("2d").putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0);
    const { resultToLayer } = await import("../ui/fsshell.js");
    await resultToLayer(c, { name: `Ampliada ×${r.scale} · ${MODELS[id].label}`, docName: `${doc.name || "Imagen"} ×${r.scale}`, newDocument: true });
    toast(`Ampliada ×${r.scale} · ${r.w} × ${r.h} en una pestaña nueva`, "ok");
  }catch(err){ failed("Ampliar con IA", err); }
}

/* ── Colorear ── */
const COLORIZERS = [["sponge", "ligero, recomendado"], ["colorizer", "más saturado"], ["ddcolor", "máxima calidad, pesado"]];
export async function aiColorize(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const opts = await modelOptions(COLORIZERS);
  let saved = "sponge"; try{ saved = localStorage.getItem("realify.colorizer") || saved; }catch{}
  const body = await ask("Colorear con IA", `
    <div class="field"><label>Modelo</label><select id="coM" class="grow">${opts.map(([v, l]) => `<option value="${v}"${v === saved ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    <div class="field"><label>Intensidad del color</label><input type="range" id="coS" class="grow" min="0" max="200" value="100"><span class="unit mono" id="coSV">100 %</span></div>
    <p class="hint" style="margin:4px 0 0">Para fotos en blanco y negro o viradas. El color va a una capa nueva; la nitidez es la de tu foto.</p>`,
    b => b.querySelector("#coS").addEventListener("input", e => { b.querySelector("#coSV").textContent = e.target.value + " %"; }));
  if(!body) return;
  const id = body.querySelector("#coM").value, strength = +body.querySelector("#coS").value / 100;
  try{ localStorage.setItem("realify.colorizer", id); }catch{}
  const { MODELS } = await import("../ai/models.js");
  const full = flatten(), W = full.width, H = full.height;
  const { activeTab, switchTo } = await import("../core/documents.js"), tabId = activeTab()?.tabId;
  const side = MODELS[id].work || 1024, k = Math.min(1, side / Math.max(W, H));
  const work = scaled(full, Math.max(8, Math.round(W * k)), Math.max(8, Math.round(H * k)));
  const rgba = dataOf(work);
  try{
    const [{ runModel }, { rgbToLab, labToRgb }] = await Promise.all([import("../ai/runtime.js"), import("../ai/lab.js")]);
    const r = await runModel("colorize", id, { rgba, w: work.width, h: work.height }, [rgba.buffer]);
    // Color (a, b) ampliado bilinealmente sobre la luminancia original.
    const src = dataOf(full), out = new ImageData(W, H), d = out.data, ab = r.ab, w = r.w, h = r.h;
    for(let y = 0; y < H; y++){
      const fy = Math.min(h - 1, Math.max(0, (y + .5) * h / H - .5)), y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
      for(let x = 0; x < W; x++){
        const fx = Math.min(w - 1, Math.max(0, (x + .5) * w / W - .5)), x0 = fx | 0, x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
        const q = (i, j) => (j * w + i) * 2;
        const A = ((ab[q(x0, y0)] * (1 - tx) + ab[q(x1, y0)] * tx) * (1 - ty) + (ab[q(x0, y1)] * (1 - tx) + ab[q(x1, y1)] * tx) * ty) * strength;
        const B = ((ab[q(x0, y0) + 1] * (1 - tx) + ab[q(x1, y0) + 1] * tx) * (1 - ty) + (ab[q(x0, y1) + 1] * (1 - tx) + ab[q(x1, y1) + 1] * tx) * ty) * strength;
        const i = (y * W + x) * 4, L = rgbToLab(src[i], src[i + 1], src[i + 2])[0], [R, G, Bl] = labToRgb(L, A, B);
        d[i] = R; d[i + 1] = G; d[i + 2] = Bl; d[i + 3] = src[i + 3];
      }
    }
    const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(out, 0, 0);
    const { resultToLayer } = await import("../ui/fsshell.js");
    if(tabId != null) switchTo(tabId, { force: true });   // el documento donde se empezó
    await resultToLayer(c, { name: `Coloreada · ${MODELS[id].label}`, mix: true });
    toast("Foto coloreada en una capa nueva", "ok");
  }catch(err){ failed("Colorear con IA", err); }
}

/* ── Expandir ── */
const RATIOS = [["", "Márgenes a mano"], ["1:1", "Cuadrada 1:1"], ["4:5", "Vertical 4:5"], ["9:16", "Historia 9:16"], ["2:3", "Vertical 2:3"], ["16:9", "Horizontal 16:9"], ["3:2", "Horizontal 3:2"], ["21:9", "Panorámica 21:9"]];
export async function aiExpand(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const body = await ask("Expandir con IA", `
    <div class="field"><label>Nuevo formato</label><select id="exR" class="grow">${RATIOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
    <div id="exM">
      <div class="field"><label>Arriba</label><input type="range" id="exT" class="grow" min="0" max="100" value="0"><span class="unit mono">0 %</span></div>
      <div class="field"><label>Abajo</label><input type="range" id="exB" class="grow" min="0" max="100" value="0"><span class="unit mono">0 %</span></div>
      <div class="field"><label>Izquierda</label><input type="range" id="exL" class="grow" min="0" max="100" value="25"><span class="unit mono">25 %</span></div>
      <div class="field"><label>Derecha</label><input type="range" id="exRt" class="grow" min="0" max="100" value="25"><span class="unit mono">25 %</span></div>
    </div>
    <p class="hint" id="exInfo" style="margin:4px 0 0"></p>`, b => {
      const sync = () => {
        b.querySelectorAll("#exM input").forEach(i => { i.nextElementSibling.textContent = i.value + " %"; });
        b.querySelector("#exM").hidden = !!b.querySelector("#exR").value;
        const g = geometry(b);
        b.querySelector("#exInfo").textContent = `Resultado: ${g.W} × ${g.H} px en una pestaña nueva. Funciona mejor con fondos (cielo, mar, paredes, césped) que con objetos cortados en el borde.`;
      };
      b.addEventListener("input", sync); b.addEventListener("change", sync); sync();
    });
  if(!body) return;
  const g = geometry(body);
  if(g.W === doc.w && g.H === doc.h){ toast("No hay nada que expandir: la imagen ya tiene ese formato", "err"); return; }
  const full = flatten();
  try{
    const out = await outpaint(full, g);
    const { resultToLayer } = await import("../ui/fsshell.js");
    await resultToLayer(out, { name: "Expandida", docName: `${doc.name || "Imagen"} · expandida`, newDocument: true });
    toast(`Imagen expandida a ${out.width} × ${out.height} en una pestaña nueva`, "ok");
  }catch(err){ failed("Expandir con IA", err); }
}
function geometry(b){
  const r = b.querySelector("#exR").value, w = doc.w, h = doc.h;
  let W = w, H = h, x = 0, y = 0;
  if(r){
    const [a, c] = r.split(":").map(Number), t = a / c;
    if(w / h < t){ W = Math.round(h * t); x = Math.round((W - w) / 2); } else { H = Math.round(w / t); y = Math.round((H - h) / 2); }
  } else {
    const T = +b.querySelector("#exT").value / 100, B = +b.querySelector("#exB").value / 100, L = +b.querySelector("#exL").value / 100, R = +b.querySelector("#exRt").value / 100;
    x = Math.round(w * L); y = Math.round(h * T); W = w + x + Math.round(w * R); H = h + y + Math.round(h * B);
  }
  // Que el resultado quepa en el límite del dispositivo
  const k = Math.min(1, MAX_OUT / Math.max(W, H));
  return { W: Math.round(W * k), H: Math.round(H * k), x: Math.round(x * k), y: Math.round(y * k), w: Math.round(w * k), h: Math.round(h * k) };
}

/* LaMa trabaja a 512 × 512. Se rellena a una resolución de trabajo
   (≤ 1536 px) con recortes de 512 que avanzan desde la foto hacia
   fuera: cada uno ve lo ya rellenado por los anteriores, así que la
   continuación es coherente. Después se amplía a tamaño final y la foto
   original se pone encima, intacta. */
async function outpaint(full, g){
  const { runModel, withHeavyGuard } = await import("../ai/runtime.js");
  const N = 512, WS = Math.min(1, (COARSE ? 1024 : 1536) / Math.max(g.W, g.H));
  const w = Math.max(N, Math.round(g.W * WS)), h = Math.max(N, Math.round(g.H * WS)), s = w / g.W;
  const work = document.createElement("canvas"); work.width = w; work.height = h;
  const wx = work.getContext("2d", { willReadFrequently: true }); wx.imageSmoothingQuality = "high";
  const ox = Math.round(g.x * s), oy = Math.round(g.y * s), ow = Math.round(g.w * s), oh = Math.round(g.h * s);
  wx.drawImage(full, ox, oy, ow, oh);
  const known = new Uint8Array(w * h);
  for(let y = oy; y < oy + oh && y < h; y++) for(let x = ox; x < ox + ow && x < w; x++) known[y * w + x] = 1;
  // Recortes que tocan zona por rellenar, del más cercano a la foto al más lejano
  const stride = 384, crops = [];
  for(let y = 0; y < h; y += stride) for(let x = 0; x < w; x += stride){
    const cx = Math.min(x, w - N), cy = Math.min(y, h - N);
    if(crops.some(c => c.x === cx && c.y === cy)) continue;
    let hole = false; for(let j = cy; j < cy + N && !hole; j += 8) for(let i = cx; i < cx + N; i += 8) if(!known[j * w + i]){ hole = true; break; }
    if(hole) crops.push({ x: cx, y: cy, d: Math.hypot(cx + N / 2 - (ox + ow / 2), cy + N / 2 - (oy + oh / 2)) });
  }
  crops.sort((a, b) => a.d - b.d);
  await withHeavyGuard("lama", "Expandiendo con IA", async () => {
    for(let k = 0; k < crops.length; k++){
      const c = crops[k];
      const rgba = wx.getImageData(c.x, c.y, N, N).data, hole = new Uint8Array(N * N);
      let any = false;
      for(let j = 0; j < N; j++) for(let i = 0; i < N; i++) if(!known[(c.y + j) * w + c.x + i]){ hole[j * N + i] = 1; any = true; }
      if(!any) continue;
      const r = await runModel("inpaint", "lama", { rgba, hole, size: N }, [rgba.buffer, hole.buffer], { noGuard: true, title: `Expandiendo con IA · ${k + 1} de ${crops.length}` });
      const img = wx.getImageData(c.x, c.y, N, N), d = img.data;
      for(let p = 0; p < N * N; p++){
        const gi = (c.y + ((p / N) | 0)) * w + c.x + (p % N);
        if(known[gi]) continue;
        d[p * 4] = r.rgba[p * 4]; d[p * 4 + 1] = r.rgba[p * 4 + 1]; d[p * 4 + 2] = r.rgba[p * 4 + 2]; d[p * 4 + 3] = 255;
        known[gi] = 1;
      }
      wx.putImageData(img, c.x, c.y);
    }
  });
  // Tamaño final y la foto original encima, con una costura suave
  const out = document.createElement("canvas"); out.width = g.W; out.height = g.H;
  const x = out.getContext("2d"); x.imageSmoothingQuality = "high";
  x.drawImage(work, 0, 0, g.W, g.H);
  const f = Math.max(2, Math.round(Math.min(g.w, g.h) * .015));
  const photo = document.createElement("canvas"); photo.width = g.w; photo.height = g.h;
  const px = photo.getContext("2d"); px.drawImage(full, 0, 0, g.w, g.h);
  // Degradado de alfa sólo en los lados que se han expandido
  px.globalCompositeOperation = "destination-in";
  const edges = [[g.x > 0, "l"], [g.x + g.w < g.W, "r"], [g.y > 0, "t"], [g.y + g.h < g.H, "b"]];
  for(const [on, side] of edges){
    if(!on) continue;
    const gr = side === "l" ? px.createLinearGradient(0, 0, f, 0) : side === "r" ? px.createLinearGradient(g.w, 0, g.w - f, 0) : side === "t" ? px.createLinearGradient(0, 0, 0, f) : px.createLinearGradient(0, g.h, 0, g.h - f);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
    px.fillStyle = gr; px.fillRect(0, 0, g.w, g.h);
  }
  x.drawImage(photo, g.x, g.y);
  return out;
}
