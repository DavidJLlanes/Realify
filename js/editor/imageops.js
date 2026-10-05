/* Operaciones sobre el documento entero: girar, voltear, redimensionar.
   Todas pasan por el historial como un solo paso. */

import { doc, resizeDoc, addLayer, makeLayer } from "../core/doc.js";
import { flatten } from "./layertree.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { toast, status, progress } from "../ui/toast.js";
import { fit } from "./view.js";
import { resampleCanvas, resampleHi, RESAMPLE_METHODS } from "./resample.js";
import { remapHi, hiCoversCanvas } from "../core/hisrc.js";

/* Último método de remuestreo elegido: preferencia de este navegador. */
const RESAMPLE_KEY = "realify.resample";
function savedMethod(){
  try{ const v = localStorage.getItem(RESAMPLE_KEY); if(RESAMPLE_METHODS.some(([k]) => k === v)) return v; }catch{}
  return "lanczos3";
}

function copyCanvas(src){
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}

/* Copia de una capa para el historial: sus píxeles y, si la tiene, su
   máscara. La máscara es un lienzo aparte del mismo tamaño que la capa
   (ver editor/masks.js), así que tiene que girar, voltear y cambiar de
   tamaño con ella: si no, tras «Tamaño de imagen» quedaba con las
   medidas viejas y ya no casaba con lo que tapa. */
function snapLayer(l, keepHi = false){
  return { id: l.id, c: copyCanvas(l.canvas), m: l.mask ? copyCanvas(l.mask.canvas) : null, hi: keepHi ? l.hiSrc : undefined };
}

/* Origen de 16 bits (core/hisrc.js): las operaciones que sólo MUEVEN píxeles (girar, voltear, ampliar el lienzo)
   llevan `hiOp` = { fwd, back }, las funciones índice-de-origen de `remapHi` hacia delante y de vuelta: así los 16 bits
   se mueven con el lienzo y deshacer/rehacer los recolocan sin guardar copias (de 6 bytes por píxel) en el historial.
   Las que cambian los píxeles (redimensionar, escala según contenido) o pierden parte (reducir el lienzo) los
   sueltan, y el historial guarda el origen para devolverlo al deshacer. */
const readPixels = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;

/* `fn(x, src, isMask)` dibuja `src` transformado en el contexto `x`,
   que ya mide `newW`×`newH`. Se llama una vez para los píxeles de cada
   capa y otra para su máscara (`isMask = true`), por si la operación
   tiene que tratarla distinto —p. ej. el color de relleno de «Tamaño
   de lienzo» no pinta máscaras—. */
function transformAll(fn, newW, newH, label, hiOp = null, hiNew = null){
  const snaps = doc.layers.map(l => snapLayer(l, !hiOp));
  const oldW = doc.w, oldH = doc.h;

  const transformed = (src, isMask) => {
    const t = document.createElement("canvas");
    t.width = newW; t.height = newH;
    const x = t.getContext("2d", { willReadFrequently: true });
    x.save(); fn(x, src, isMask); x.restore();
    return { canvas: t, ctx: x };
  };
  for(const l of doc.layers){
    const px = transformed(l.canvas, false);
    l.canvas = px.canvas;
    l.ctx = px.ctx;
    if(l.mask) l.mask = transformed(l.mask.canvas, true);
    l.thumbDirty = true;
  }
  doc.w = newW; doc.h = newH;

  // 16 bits: se mueven con el lienzo (o se sueltan si la operación cambia los píxeles)
  doc.layers.forEach((l, i) => {
    if(!l.hiSrc) return;
    if(hiNew?.has(l.id)){ l.hiSrc = hiNew.get(l.id); return; }       // ya remuestreado en 16 bits (el lienzo ya es su redondeo)
    let moved = null;
    if(hiOp && hiCoversCanvas({ hiSrc: l.hiSrc, canvas: { width: oldW, height: oldH } })) moved = remapHi(l, readPixels(snaps[i].c), oldW, oldH, hiOp.fwd);
    if(moved) l.hiSrc = moved; else delete l.hiSrc;
  });

  const after = doc.layers.map(l => snapLayer(l, false));

  const restore = (snapList, w, h, forward) => () => {
    doc.w = w; doc.h = h;
    for(const s of snapList){
      const l = doc.layers.find(x => x.id === s.id);
      if(!l) continue;
      const t = document.createElement("canvas");
      t.width = w; t.height = h;
      // La opción en el primer getContext: en uno posterior se ignora.
      l.ctx = t.getContext("2d", { willReadFrequently: true });
      l.ctx.drawImage(s.c, 0, 0);
      l.canvas = t;
      // Sólo si la capa sigue teniendo máscara: si se quitó después,
      // ese paso tiene su propia entrada de historial.
      if(s.m && l.mask){
        const mc = copyCanvas(s.m);
        l.mask = { canvas: mc, ctx: mc.getContext("2d", { willReadFrequently: true }) };
      }
      l.thumbDirty = true;
      // 16 bits: deshacer/rehacer los recoloca (operaciones de movimiento) o los devuelve (las que los soltaron)
      if(hiOp){
        if(l.hiSrc){
          const from = forward ? snaps : after, fromW = forward ? oldW : newW, fromH = forward ? oldH : newH;
          const src = from.find(x => x.id === s.id);
          const moved = src ? remapHi(l, readPixels(src.c), fromW, fromH, forward ? hiOp.fwd : hiOp.back) : null;
          if(moved) l.hiSrc = moved; else delete l.hiSrc;
        }
      } else if(!forward && s.hi) l.hiSrc = s.hi;
      else if(forward){ if(hiNew?.has(l.id)) l.hiSrc = hiNew.get(l.id); else delete l.hiSrc; }
    }
    emit("doc:resize"); emit("doc:structure"); emit("doc:change");
  };

  record(label, restore(snaps, oldW, oldH, false), restore(after, newW, newH, true));
  emit("doc:resize"); emit("doc:structure"); emit("doc:change");
  fit();
}

/* Índices de origen de cada giro/volteo (ver `hiOp`): `fwd(nx, ny)` = píxel del lienzo anterior que cae en (nx, ny) del
   nuevo; `back(x, y)` = píxel del lienzo nuevo al que fue a parar el (x, y) anterior (para deshacer). W×H = medidas antiguas. */
export const rotateLeft = () => { const W = doc.w, H = doc.h; transformAll((x, src) => {
  x.translate(0, doc.w); x.rotate(-Math.PI / 2); x.drawImage(src, 0, 0);
}, doc.h, doc.w, "Girar 90° izquierda", { fwd: (nx, ny) => nx * W + (W - 1 - ny), back: (x, y) => (W - 1 - x) * H + y }); };

export const rotateRight = () => { const W = doc.w, H = doc.h; transformAll((x, src) => {
  x.translate(doc.h, 0); x.rotate(Math.PI / 2); x.drawImage(src, 0, 0);
}, doc.h, doc.w, "Girar 90° derecha", { fwd: (nx, ny) => (H - 1 - nx) * W + ny, back: (x, y) => x * H + (H - 1 - y) }); };

export const rotate180 = () => { const W = doc.w, H = doc.h; transformAll((x, src) => {
  x.translate(doc.w, doc.h); x.rotate(Math.PI); x.drawImage(src, 0, 0);
}, doc.w, doc.h, "Girar 180°", { fwd: (nx, ny) => (H - 1 - ny) * W + (W - 1 - nx), back: (x, y) => (H - 1 - y) * W + (W - 1 - x) }); };

export const flipH = () => { const W = doc.w, H = doc.h; transformAll((x, src) => {
  x.translate(doc.w, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
}, doc.w, doc.h, "Voltear horizontal", { fwd: (nx, ny) => ny * W + (W - 1 - nx), back: (x, y) => y * W + (W - 1 - x) }); };

export const flipV = () => { const W = doc.w, H = doc.h; transformAll((x, src) => {
  x.translate(0, doc.h); x.scale(1, -1); x.drawImage(src, 0, 0);
}, doc.w, doc.h, "Voltear vertical", { fwd: (nx, ny) => (H - 1 - ny) * W + nx, back: (x, y) => (H - 1 - y) * W + x }); };

export async function resizeDialog(){
  if(!doc.open) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="field"><label>Unidad</label>
      <div class="seg grow">
        <button id="uPx" class="on">Píxeles</button>
        <button id="uPct">Porcentaje</button>
      </div></div>

    <div id="pxBox">
      <div class="field"><label>Ancho</label>
        <input type="number" id="rw" class="grow" min="1" max="16384" value="${doc.w}">
        <span class="unit">px</span></div>
      <div class="field"><label>Alto</label>
        <input type="number" id="rh" class="grow" min="1" max="16384" value="${doc.h}">
        <span class="unit">px</span></div>
    </div>

    <div id="pctBox" hidden>
      <div class="field"><label>Escala</label>
        <input type="number" id="rp" class="grow" min="1" max="800" step="1" value="100">
        <span class="unit">%</span></div>
      <div class="seg" style="margin-bottom:8px">
        <button data-p="200">200 %</button>
        <button data-p="100">100 %</button>
        <button data-p="50">50 %</button>
        <button data-p="25">25 %</button>
      </div>
    </div>

    <div class="field"><label>Remuestreo</label>
      <select id="rMethod" class="grow">${RESAMPLE_METHODS.map(([k, label]) =>
        `<option value="${k}"${k === savedMethod() ? " selected" : ""}>${label}</option>`).join("")}</select></div>

    <label class="chk"><input type="checkbox" id="rlink" checked>
      Mantener proporción</label>
    <p class="hint" style="margin-top:11px">Actual: ${doc.w} × ${doc.h}.
      <span id="rOut"></span></p>
    <p class="hint">Ampliar no añade detalle: sólo interpola lo que ya hay.</p>`;

  const r = await dialog({
    title:"Tamaño de imagen",
    body: wrap,
    buttons:[{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }],
    onOpen(body){
      const W = body.querySelector("#rw"), H = body.querySelector("#rh");
      const P = body.querySelector("#rp");
      const link = body.querySelector("#rlink");
      const out = body.querySelector("#rOut");
      const pxBox = body.querySelector("#pxBox"), pctBox = body.querySelector("#pctBox");
      const uPx = body.querySelector("#uPx"), uPct = body.querySelector("#uPct");
      const ar = doc.w / doc.h;

      const preview = () => {
        const [w, h] = readSize(body);
        out.textContent = `Quedará en ${w} × ${h}` +
          (w * h > doc.w * doc.h ? " (ampliando)" : "");
      };

      const setUnit = pct => {
        pxBox.hidden = pct; pctBox.hidden = !pct;
        uPx.classList.toggle("on", !pct);
        uPct.classList.toggle("on", pct);
        // Al cambiar de unidad se traduce el valor, para que el
        // diálogo nunca diga una cosa y aplique otra.
        if(pct) P.value = Math.round(+W.value / doc.w * 100);
        else {
          const f = (+P.value || 100) / 100;
          W.value = Math.max(1, Math.round(doc.w * f));
          H.value = Math.max(1, Math.round(doc.h * f));
        }
        preview();
      };
      uPx.addEventListener("click", () => setUnit(false));
      uPct.addEventListener("click", () => setUnit(true));

      W.addEventListener("input", () => {
        if(link.checked && +W.value >= 1) H.value = Math.max(1, Math.round(+W.value / ar));
        preview();
      });
      H.addEventListener("input", () => {
        if(link.checked && +H.value >= 1) W.value = Math.max(1, Math.round(+H.value * ar));
        preview();
      });
      P.addEventListener("input", preview);
      body.querySelectorAll("[data-p]").forEach(b =>
        b.addEventListener("click", () => { P.value = b.dataset.p; preview(); }));
      preview();
    }
  });
  if(r !== "go") return;

  const [w, h] = readSize(wrap);
  // Aplicar sin cambiar nada no debe cerrarse en silencio: parecía
  // que la herramienta no funcionaba.
  if(w === doc.w && h === doc.h){ toast("El tamaño no ha cambiado: escribe otras medidas"); return; }
  const method = wrap.querySelector("#rMethod").value;
  try{ localStorage.setItem(RESAMPLE_KEY, method); }catch{}

  /* Cada capa se remuestrea antes (en el worker, capa a capa para no
     duplicar la memoria de todas a la vez) y `transformAll` sólo
     coloca el resultado: así el historial sigue siendo un solo paso. */
  const done = new Map();
  status("Redimensionando…");
  // Píxeles y máscaras, con el mismo método: una máscara remuestreada
  // de otra forma que su capa dejaría un halo en el borde.
  const sources = doc.layers.flatMap(l => l.mask ? [l.canvas, l.mask.canvas] : [l.canvas]);
  const hiNew = new Map();         // capas con origen de 16 bits que cubre el lienzo: se remuestrean también en 16 bits (coma flotante)
  for(let i = 0; i < sources.length; i++){
    const src = sources[i], owner = doc.layers.find(l => l.canvas === src);
    const prog = f => progress((i + f) / sources.length);
    const hr = owner && hiCoversCanvas(owner) ? await resampleHi(owner, w, h, method, prog) : null;
    if(hr){ done.set(src, hr.canvas); hiNew.set(owner.id, hr.hiSrc); }
    else done.set(src, await resampleCanvas(src, w, h, method, prog));
    progress((i + 1) / sources.length);
  }
  progress(null); status("");
  transformAll((x, src) => {
    const r = done.get(src);
    if(r){ x.drawImage(r, 0, 0); return; }
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, w, h);
  }, w, h, "Redimensionar", null, hiNew);
  toast(`Redimensionado a ${w} × ${h}`);
}

/* Lee el tamaño pedido, esté el diálogo en píxeles o en porcentaje. */
function readSize(body){
  const pct = !body.querySelector("#pctBox").hidden;
  if(pct){
    const f = Math.max(0.01, (+body.querySelector("#rp").value || 100) / 100);
    return [Math.max(1, Math.round(doc.w * f)), Math.max(1, Math.round(doc.h * f))];
  }
  return [
    Math.max(1, +body.querySelector("#rw").value || doc.w),
    Math.max(1, +body.querySelector("#rh").value || doc.h)
  ];
}

export async function canvasSizeDialog(){
  if(!doc.open) return;
  const wrap=document.createElement("div");
  wrap.innerHTML=`
    <label class="chk"><input type="checkbox" id="csRelative"> Relativo</label>
    <div class="field"><label>Ancho</label><input id="csW" type="number" class="grow" value="${doc.w}" min="1" max="32768"><span class="unit">px</span></div>
    <div class="field"><label>Alto</label><input id="csH" type="number" class="grow" value="${doc.h}" min="1" max="32768"><span class="unit">px</span></div>
    <div class="field"><label>Anclaje</label><select id="csAnchor" class="grow">
      <option value="tl">Arriba izquierda</option><option value="tc">Arriba centro</option><option value="tr">Arriba derecha</option>
      <option value="ml">Centro izquierda</option><option value="mc" selected>Centro</option><option value="mr">Centro derecha</option>
      <option value="bl">Abajo izquierda</option><option value="bc">Abajo centro</option><option value="br">Abajo derecha</option>
    </select></div>
    <div class="field"><label>Extensión</label><input id="csColor" type="color" value="#ffffff"><label class="chk grow"><input id="csTransparent" type="checkbox" checked> Transparente</label></div>
    <p class="hint">Cambia el lienzo sin escalar las capas. El modo relativo suma o resta píxeles al tamaño actual.</p>`;
  const result=await dialog({title:"Tamaño de lienzo",body:wrap,buttons:[{label:"Cancelar",value:null},{label:"Aplicar",primary:true,value:"go"}],onOpen(body){const rel=body.querySelector("#csRelative"),W=body.querySelector("#csW"),H=body.querySelector("#csH");rel.onchange=()=>{W.value=rel.checked?0:doc.w;H.value=rel.checked?0:doc.h;W.min=H.min=rel.checked?-32767:1;};}});
  if(result!=="go") return;
  const relative=wrap.querySelector("#csRelative").checked;
  const nw=Math.max(1,relative?doc.w+(+wrap.querySelector("#csW").value||0):(+wrap.querySelector("#csW").value||doc.w));
  const nh=Math.max(1,relative?doc.h+(+wrap.querySelector("#csH").value||0):(+wrap.querySelector("#csH").value||doc.h));
  if(nw===doc.w&&nh===doc.h){toast("El tamaño del lienzo no ha cambiado: escribe otras medidas");return;}
  const anchor=wrap.querySelector("#csAnchor").value,ax=anchor[1]==="l"?0:anchor[1]==="r"?1:.5,ay=anchor[0]==="t"?0:anchor[0]==="b"?1:.5;
  const ox=Math.round((nw-doc.w)*ax),oy=Math.round((nh-doc.h)*ay),transparent=wrap.querySelector("#csTransparent").checked,color=wrap.querySelector("#csColor").value;
  /* En una máscara, el lienzo nuevo queda «revelado» (blanco opaco,
     ver editor/masks.js): la extensión se ve según su propio relleno,
     no escondida por una máscara que nunca la cubrió. */
  // Sólo si el lienzo crece (o se desplaza sin perder nada) los 16 bits viajan con él; si recorta, se sueltan
  const W0=doc.w,H0=doc.h,lossless=ox>=0&&oy>=0&&ox+W0<=nw&&oy+H0<=nh;
  transformAll((x,src,isMask)=>{if(isMask){x.fillStyle="#fff";x.fillRect(0,0,nw,nh);x.clearRect(ox,oy,src.width,src.height);}else if(!transparent){x.fillStyle=color;x.fillRect(0,0,nw,nh);}x.drawImage(src,ox,oy);},nw,nh,"Tamaño de lienzo",
    lossless?{fwd:(nx,ny)=>{const X=nx-ox,Y=ny-oy;return X>=0&&Y>=0&&X<W0&&Y<H0?Y*W0+X:-1;},back:(x,y)=>(y+oy)*nw+(x+ox)}:null);
  toast(`Lienzo ${nw} × ${nh}`,"ok");
}

export async function contentAwareScaleDialog(){
  if(!doc.open) return;
  const wrap=document.createElement("div");
  wrap.innerHTML=`<div class="field"><label>Nuevo ancho</label><input id="caW" type="number" class="grow" min="32" max="32768" value="${doc.w}"><span class="unit">px</span></div>
    <div class="field"><label>Protección</label><input id="caProtect" type="range" class="grow" min="0" max="100" value="75"><span class="unit">75%</span></div>
    <p class="hint">Redistribuye el ancho dando más espacio a columnas con bordes y detalle. Es una escala según contenido no destructiva para las capas.</p>`;
  const res=await dialog({title:"Escala según contenido",body:wrap,buttons:[{label:"Cancelar",value:null},{label:"Aplicar",primary:true,value:"go"}],onOpen(body){const s=body.querySelector("#caProtect"),u=s.nextElementSibling;s.oninput=()=>u.textContent=s.value+"%";}});
  if(res!=="go")return;
  const nw=Math.max(32,+wrap.querySelector("#caW").value||doc.w),protect=(+wrap.querySelector("#caProtect").value||0)/100;
  if(nw===doc.w){toast("El ancho no ha cambiado: escribe un ancho nuevo");return;}
  const flat=flatten(),sampleW=Math.min(900,doc.w),sampleH=Math.min(500,doc.h),small=document.createElement("canvas");small.width=sampleW;small.height=sampleH;small.getContext("2d").drawImage(flat,0,0,sampleW,sampleH);const d=small.getContext("2d",{willReadFrequently:true}).getImageData(0,0,sampleW,sampleH).data,energy=new Float64Array(sampleW);let total=0;
  for(let x=0;x<sampleW;x++){let e=1;for(let y=1;y<sampleH-1;y++){const i=(y*sampleW+x)*4,l=x?i-4:i,r=x<sampleW-1?i+4:i;e+=Math.abs(d[r]-d[l])+Math.abs(d[r+1]-d[l+1])+Math.abs(d[r+2]-d[l+2]);}energy[x]=1+protect*Math.sqrt(e/sampleH);total+=energy[x];}
  const cum=new Float64Array(sampleW+1);for(let x=0;x<sampleW;x++)cum[x+1]=cum[x]+energy[x];
  const sourceX=t=>{const goal=t*total;let lo=0,hi=sampleW;while(lo+1<hi){const m=(lo+hi)>>1;if(cum[m]<goal)lo=m;else hi=m;}return (lo+(goal-cum[lo])/Math.max(1e-6,energy[lo]))/sampleW*doc.w;};
  transformAll((x,src)=>{for(let ox=0;ox<nw;ox++){const a=sourceX(ox/nw),b=sourceX((ox+1)/nw);x.drawImage(src,a,0,Math.max(.5,b-a),doc.h,ox,0,1,doc.h);}},nw,doc.h,"Escala según contenido");
  toast(`Escala según contenido: ${nw} × ${doc.h}`,"ok");
}

export function flattenImage(){
  if(!doc.open || doc.layers.length < 2) return;
  /* El resultado va a una capa NUEVA en vez de reescribir la de abajo:
     así las capas originales no se tocan en absoluto y deshacer sólo
     tiene que volver a poner la lista de antes, con cada capa tal cual
     era —máscara, tipo (texto, ajuste, relleno, forma), grupo,
     estilos, bloqueo, objeto inteligente…—. Antes se reutilizaba la
     capa inferior y, al deshacer, las demás se reconstruían desde un
     objeto casi vacío, con lo que todo eso se perdía. */
  const flat = flatten();
  const base = makeLayer({ name: "Fondo" });
  base.ctx.drawImage(flat, 0, 0);
  base.thumbDirty = true;

  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const nextLayers = [base];
  const put = (layers, active) => {
    doc.layers = layers.slice(); doc.activeId = active;
    emit("doc:structure"); emit("doc:change");
  };
  put(nextLayers, base.id);
  record("Acoplar imagen",
    () => put(prevLayers, prevActive),
    () => put(nextLayers, base.id));

  toast("Imagen acoplada");
}

/* Combina sólo las capas VISIBLES en una nueva, dejando las ocultas
   exactamente donde estaban. Distinto de acoplar (que aplana todo) y
   de combinar con la de abajo (que sólo junta dos): es el equivalente
   de «Combinar visibles» de Photoshop, útil para congelar un grupo de
   ajustes o pinceladas sin perder las capas que se han apagado a
   propósito para compararlas después.

   Como el resultado es una capa NUEVA y no una reutilizada, las capas
   originales no se tocan para nada: deshacer sólo necesita devolver
   la lista de capas a como estaba, sin clonar ni un solo lienzo. */
export function mergeVisible(){
  if(!doc.open) return;
  // Sólo cuentan las capas y grupos de NIVEL SUPERIOR: un miembro
  // suelto no se puede fundir ni preservar sin romper su grupo, así
  // que esto trabaja grupo a grupo, no capa a capa dentro de uno. Un
  // grupo es "visible" si él mismo lo es, igual que en la
  // composición normal —sus miembros no cuentan por separado—.
  const topLevel = doc.layers.filter(l => l.groupId == null);
  const visible = topLevel.filter(l => l.visible && l.opacity > 0);
  if(visible.length < 2){
    toast("Hacen falta al menos dos capas o grupos visibles, de nivel superior, para combinar");
    return;
  }

  const prevLayers = doc.layers.slice();
  const prevActive = doc.activeId;

  // Cada capa/grupo visible de nivel superior, más TODO su contenido
  // anidado (la visibilidad de cada miembro por separado la resuelve
  // igualmente compositeTree al recorrerlo).
  const included = new Set();
  const includeSubtree = id => {
    included.add(id);
    for(const l of doc.layers) if(l.groupId === id) includeSubtree(l.id);
  };
  visible.forEach(l => includeSubtree(l.id));
  const merged = flatten(null, doc.layers.filter(l => included.has(l.id)), doc.w, doc.h);

  const newLayer = makeLayer({ name: "Visibles combinadas" });
  newLayer.ctx.drawImage(merged, 0, 0);

  let lastVisibleIdx = -1;
  doc.layers.forEach((l, i) => { if(l.groupId == null && visible.includes(l)) lastVisibleIdx = i; });

  const nextLayers = [];
  doc.layers.forEach((l, i) => {
    if(!included.has(l.id)){ nextLayers.push(l); return; }
    if(i === lastVisibleIdx) nextLayers.push(newLayer);
    // el resto (fundidas y sus miembros) se omite: ya quedó en newLayer
  });

  doc.layers = nextLayers;
  doc.activeId = newLayer.id;

  record("Combinar visibles",
    () => { doc.layers = prevLayers; doc.activeId = prevActive;
            emit("doc:structure"); emit("doc:change"); },
    () => { doc.layers = nextLayers; doc.activeId = newLayer.id;
            emit("doc:structure"); emit("doc:change"); });

  emit("doc:structure"); emit("doc:change");
  toast(`${visible.length} capas visibles combinadas en una`);
}
