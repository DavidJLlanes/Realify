/* ═══════════════════════════════════════════════════════════════
   CAPAS DE RELLENO Y DE FORMA
   Dos tipos de capa que, a diferencia de una capa de ajuste, SÍ tienen
   lienzo propio —el compositor (editor/layertree.js) las trata exactamente
   como una capa raster, sin ningún caso aparte— sólo que ese lienzo nunca
   se pinta a mano: se REGENERA entero desde `layer.fill` / `layer.shape`
   cada vez que cambian sus parámetros. Es la misma idea que una capa de
   ajuste (parámetros, no píxeles, son la fuente de verdad) aplicada a
   contenido que sí ocupa espacio en el lienzo.

   El panel de Propiedades (ui/properties.js) monta los mandos en vivo con
   el mismo esqueleto que ya usan las capas de ajuste (adjustlayers.js):
   una copia de trabajo que se previsualiza en cada cambio y se confirma
   como UN solo paso de historial al dejar de estar esta capa activa.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../core/doc.js";
import { record, recordLayers } from "../core/history.js";
import { emit } from "../core/bus.js";
import { drawGradient } from "./paint.js";
import { toast } from "../ui/toast.js";
import { slider } from "./adjust.js";

/* ═══ relleno ═══ */

export const isFillLayer = l => !!(l && l.type === "fill");

const FILL_KIND_NAME = { color:"Color sólido", gradient:"Degradado", pattern:"Motivo" };
export const fillKindName = kind => FILL_KIND_NAME[kind] || "Relleno";

function defaultFill(kind){
  if(kind === "gradient") return { kind, gradient:{ type:"linear", angle:90, colorA:"#1c1c1c", colorB:"#e8a33d" } };
  if(kind === "pattern")  return { kind, pattern:{ scale:1, rotation:0, offsetX:0, offsetY:0 }, patternImg:null };
  return { kind:"color", color:"#3388ff" };
}

/* Ángulo → dos puntos que cruzan el documento por el centro, para
   reutilizar el mismo `drawGradient` de la herramienta Degradado (que
   trabaja con dos puntos arrastrados) sin tener que dragear nada: una
   capa de relleno no se crea arrastrando, así que el ángulo hace ese
   papel. */
function pointsForAngle(w, h, angleDeg){
  const rad = angleDeg * Math.PI / 180;
  const cx = w / 2, cy = h / 2;
  const len = Math.hypot(w, h) / 2 || 1;
  const dx = Math.cos(rad) * len, dy = Math.sin(rad) * len;
  return { from:{ x:cx - dx, y:cy - dy }, to:{ x:cx + dx, y:cy + dy } };
}

export function renderFillLayer(layer){
  if(!isFillLayer(layer) || !layer.fill || !doc.open) return;
  const { canvas, ctx } = layer;
  if(canvas.width !== doc.w || canvas.height !== doc.h){
    canvas.width = doc.w; canvas.height = doc.h;
  }
  ctx.clearRect(0, 0, doc.w, doc.h);
  const f = layer.fill;

  if(f.kind === "color"){
    ctx.fillStyle = f.color;
    ctx.fillRect(0, 0, doc.w, doc.h);
  } else if(f.kind === "gradient"){
    const g = f.gradient;
    if(g.type === "radial"){
      const cx = doc.w / 2, cy = doc.h / 2, r = Math.hypot(doc.w, doc.h) / 2 || 1;
      drawGradient(ctx, "radial", { x:cx, y:cy }, { x:cx + r, y:cy }, g.colorA, g.colorB, 1);
    } else {
      const { from, to } = pointsForAngle(doc.w, doc.h, g.angle || 0);
      drawGradient(ctx, "linear", from, to, g.colorA, g.colorB, 1);
    }
  } else if(f.kind === "pattern" && f.patternImg){
    const p = f.pattern || {};
    const pat = ctx.createPattern(f.patternImg, "repeat");
    const cx = doc.w / 2, cy = doc.h / 2;
    const m = new DOMMatrix()
      .translate(cx, cy)
      .rotate(p.rotation || 0)
      .scale(p.scale || 1, p.scale || 1)
      .translate(-cx, -cy)
      .translate(p.offsetX || 0, p.offsetY || 0);
    pat.setTransform(m);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, doc.w, doc.h);
  }
  layer.thumbDirty = true;
}

export function addFillLayer(kind, patternImg){
  if(!doc.open) return null;
  return recordLayers("Nueva capa de relleno", () => {
    const l = addLayer({ type:"fill", name: fillKindName(kind) });
    l.fill = defaultFill(kind);
    if(kind === "pattern" && patternImg) l.fill.patternImg = patternImg;
    renderFillLayer(l);
    emit("doc:change");
    return l;
  });
}

/* Compara dos `fill` incluyendo `patternImg` por referencia —una
   imagen cargada nunca se muta en el sitio, sólo se sustituye entera,
   así que la referencia sola basta para saber si cambió—; el resto,
   por valor. `JSON.stringify` de plano se comería `patternImg` en
   silencio (un <canvas> no serializa a nada útil). */
function fillEqual(a, b){
  if(a === b) return true;
  if(!a || !b || a.kind !== b.kind || a.patternImg !== b.patternImg) return false;
  const { patternImg:pa, ...ra } = a;
  const { patternImg:pb, ...rb } = b;
  return JSON.stringify(ra) === JSON.stringify(rb);
}

function cloneFill(f){
  if(!f) return f;
  const { patternImg, ...rest } = f;
  const clone = JSON.parse(JSON.stringify(rest));
  if(patternImg) clone.patternImg = patternImg;
  return clone;
}

/* `before` es SIEMPRE explícito, nunca `layer.fill` leído aquí dentro:
   quien llama ya ha estado usando `previewFillParams` fotograma a
   fotograma mientras se arrastraba un deslizador, así que para cuando
   esto se invoca `layer.fill` ya vale lo mismo que `params` —leerlo
   como «antes» dejaría Deshacer volviendo al mismo sitio en el que ya
   estaba, no al de antes de tocar nada—. */
export function setFillParams(layer, before, params){
  if(!isFillLayer(layer)) return;
  const after = cloneFill(params);
  if(fillEqual(before, after)) return;
  layer.fill = after;
  renderFillLayer(layer);
  record("Relleno: " + fillKindName(after.kind),
    () => { layer.fill = before; renderFillLayer(layer); emit("doc:change"); },
    () => { layer.fill = after;  renderFillLayer(layer); emit("doc:change"); });
  emit("doc:change");
}

export function previewFillParams(layer, params){
  if(!isFillLayer(layer)) return;
  layer.fill = cloneFill(params);
  renderFillLayer(layer);
  emit("doc:change");
}

/* Selector de archivo de imagen para el motivo: mismo patrón que
   pickFontFile() en ui/optionsbar.js, pero devolviendo un <canvas> ya
   dibujado —lo que createPattern()/CanvasPattern.setTransform() esperan—
   en vez de una familia tipográfica. */
export function pickPatternImage(){
  return new Promise(resolve => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";
    document.body.appendChild(inp);
    const done = v => { inp.remove(); resolve(v); };
    inp.addEventListener("change", () => {
      const f = inp.files?.[0];
      if(!f) return done(null);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        c.getContext("2d").drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);
        done(c);
      };
      img.onerror = () => { toast("No se pudo leer la imagen", "err"); done(null); };
      img.src = URL.createObjectURL(f);
    });
    inp.addEventListener("cancel", () => done(null));
    inp.click();
  });
}

function colorField(label, value, onChange){
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.innerHTML = `<label>${label}</label>`;
  const btn = document.createElement("button");
  btn.style.cssText = "width:34px;height:24px;padding:0;border-radius:3px;position:relative;overflow:hidden";
  const sw = document.createElement("span");
  sw.style.cssText = "position:absolute;inset:2px;border-radius:2px;background:" + value;
  btn.appendChild(sw);
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.style.cssText = "position:absolute;inset:0;opacity:0;cursor:pointer;padding:0;border:0";
  input.addEventListener("input", () => { sw.style.background = input.value; onChange(input.value); });
  btn.appendChild(input);
  wrap.appendChild(btn);
  return wrap;
}

function fillBody(p, preview){
  const box = document.createElement("div");
  const seg = document.createElement("div");
  seg.className = "seg";
  seg.style.marginBottom = "10px";
  const kinds = [["color","Color"],["gradient","Degradado"],["pattern","Motivo"]];
  const sub = document.createElement("div");

  const renderSub = () => {
    sub.innerHTML = "";
    if(p.kind === "color"){
      sub.appendChild(colorField("Color", p.color, v => { p.color = v; preview(); }));
    } else if(p.kind === "gradient"){
      const typeSeg = document.createElement("div");
      typeSeg.className = "seg";
      typeSeg.style.marginBottom = "8px";
      for(const [val, label] of [["linear","Lineal"],["radial","Radial"]]){
        const b = document.createElement("button");
        b.textContent = label;
        b.className = p.gradient.type === val ? "on" : "";
        b.addEventListener("click", () => {
          p.gradient.type = val;
          typeSeg.querySelectorAll("button").forEach(x => x.classList.remove("on"));
          b.classList.add("on");
          preview();
        });
        typeSeg.appendChild(b);
      }
      sub.appendChild(typeSeg);
      sub.appendChild(colorField("Desde", p.gradient.colorA, v => { p.gradient.colorA = v; preview(); }));
      sub.appendChild(colorField("Hasta", p.gradient.colorB, v => { p.gradient.colorB = v; preview(); }));
      const angleRow = slider("Ángulo", 0, 359, p.gradient.angle,
        v => { p.gradient.angle = v; preview(); }, "°");
      angleRow.hidden = p.gradient.type === "radial";
      sub.appendChild(angleRow);
    } else if(p.kind === "pattern"){
      const pick = document.createElement("button");
      pick.className = "wide";
      pick.textContent = p.patternImg ? "Cambiar imagen…" : "Elegir imagen…";
      pick.style.marginBottom = "8px";
      pick.addEventListener("click", async () => {
        const img = await pickPatternImage();
        if(!img) return;
        p.patternImg = img;
        preview();
        renderSub();
      });
      sub.appendChild(pick);
      if(!p.patternImg){
        const hint = document.createElement("p");
        hint.className = "hint";
        hint.style.margin = "0 0 8px";
        hint.textContent = "Sin imagen todavía: esta capa queda transparente hasta que elijas una.";
        sub.appendChild(hint);
      }
      sub.appendChild(slider("Escala", 5, 400, Math.round((p.pattern.scale || 1) * 100),
        v => { p.pattern.scale = v / 100; preview(); }, "%"));
      sub.appendChild(slider("Rotación", 0, 359, p.pattern.rotation || 0,
        v => { p.pattern.rotation = v; preview(); }, "°"));
      sub.appendChild(slider("Desplaz. X", -2000, 2000, p.pattern.offsetX || 0,
        v => { p.pattern.offsetX = v; preview(); }, "px"));
      sub.appendChild(slider("Desplaz. Y", -2000, 2000, p.pattern.offsetY || 0,
        v => { p.pattern.offsetY = v; preview(); }, "px"));
    }
  };

  for(const [val, label] of kinds){
    const b = document.createElement("button");
    b.textContent = label;
    b.className = p.kind === val ? "on" : "";
    b.addEventListener("click", () => {
      if(p.kind === val) return;
      const fresh = defaultFill(val);
      for(const k in fresh) p[k] = fresh[k];
      seg.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      preview();
      renderSub();
    });
    seg.appendChild(b);
  }
  box.append(seg, sub);
  renderSub();
  return box;
}

export function mountFillProperties(layer, container){
  if(!isFillLayer(layer)) return null;
  const original = layer.fill;
  const p = cloneFill(original);
  const preview = () => previewFillParams(layer, p);
  container.appendChild(fillBody(p, preview));
  return {
    commit(){ setFillParams(layer, original, p); }
  };
}

/* ═══ formas (rectángulo / elipse) ═══ */

export const isShapeLayer = l => !!(l && l.type === "shape");
export const SHAPE_KIND_NAME = { rect:"Rectángulo", ellipse:"Elipse", polygon:"Polígono", star:"Estrella" };

export function renderShapeLayer(layer){
  if(!isShapeLayer(layer) || !layer.shape || !doc.open) return;
  const { canvas, ctx } = layer;
  if(canvas.width !== doc.w || canvas.height !== doc.h){
    canvas.width = doc.w; canvas.height = doc.h;
  }
  ctx.clearRect(0, 0, doc.w, doc.h);
  const s = layer.shape;
  const x = s.x, y = s.y, w = Math.max(0.01, s.w), h = Math.max(0.01, s.h);
  ctx.save();
  ctx.beginPath();
  if(s.kind === "rect"){
    const r = Math.max(0, Math.min(s.radius || 0, Math.min(w, h) / 2));
    ctx.roundRect(x, y, w, h, r);
  } else if(s.kind === "ellipse"){
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    const sides=Math.max(3,Math.round(s.sides||5)),star=s.kind==="star",count=star?sides*2:sides,cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2,inner=clampShape(s.inner??50,5,95)/100;
    for(let i=0;i<count;i++){const a=-Math.PI/2+i*Math.PI*2/count,m=star&&i%2?inner:1,px=cx+Math.cos(a)*rx*m,py=cy+Math.sin(a)*ry*m;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();
  }
  if(s.shadow?.on){ctx.shadowColor=s.shadow.color||"#000000";ctx.shadowBlur=s.shadow.blur||0;ctx.shadowOffsetX=s.shadow.x||0;ctx.shadowOffsetY=s.shadow.y||0;}
  if(s.fill && s.fill.on){ ctx.fillStyle = s.fill.color; ctx.fill(); }
  if(s.stroke && s.stroke.on && s.stroke.width > 0){
    ctx.lineWidth = s.stroke.width;
    ctx.strokeStyle = s.stroke.color;
    ctx.stroke();
  }
  ctx.restore();
  layer.thumbDirty = true;
}

export function addShapeLayer(kind, box){
  if(!doc.open) return null;
  return recordLayers("Nueva forma", () => {
    const l = addLayer({ type:"shape", name: SHAPE_KIND_NAME[kind] || "Forma" });
    l.shape = {
      kind, x: box.x, y: box.y, w: Math.max(1, box.w), h: Math.max(1, box.h),
      radius: 0, sides: 5, inner: 50,
      fill:   { on:true,  color: box.fillColor || "#3388ff" },
      stroke: { on:false, color: box.strokeColor || "#111111", width: 4 },
      shadow: { on:false, color:"#000000", x:4, y:6, blur:12 }
    };
    renderShapeLayer(l);
    emit("doc:change");
    return l;
  });
}

function shapeEqual(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
const clampShape=(v,a,b)=>Math.max(a,Math.min(b,v));

/* `before` explícito por el mismo motivo que en setFillParams(): para
   cuando esto se llama, `layer.shape` ya vale lo mismo que `params`
   —lo dejó así la última vista previa en vivo del arrastre—. */
export function setShapeParams(layer, before, params){
  if(!isShapeLayer(layer)) return;
  const after = JSON.parse(JSON.stringify(params));
  if(shapeEqual(before, after)) return;
  layer.shape = after;
  renderShapeLayer(layer);
  record("Forma: " + (SHAPE_KIND_NAME[after.kind] || "editar"),
    () => { layer.shape = before; renderShapeLayer(layer); emit("doc:change"); },
    () => { layer.shape = after;  renderShapeLayer(layer); emit("doc:change"); });
  emit("doc:change");
}

export function previewShapeParams(layer, params){
  if(!isShapeLayer(layer)) return;
  layer.shape = JSON.parse(JSON.stringify(params));
  renderShapeLayer(layer);
  emit("doc:change");
}

function shapeBody(p, preview){
  const box = document.createElement("div");
  box.appendChild(colorField("Relleno", p.fill.color, v => { p.fill.color = v; preview(); }));
  const fillToggle = document.createElement("label");
  fillToggle.className = "chk";
  fillToggle.innerHTML = `<input type="checkbox"${p.fill.on ? " checked" : ""}> Rellenar`;
  fillToggle.querySelector("input").addEventListener("change", e => { p.fill.on = e.target.checked; preview(); });
  box.appendChild(fillToggle);

  box.appendChild(colorField("Borde", p.stroke.color, v => { p.stroke.color = v; preview(); }));
  const strokeToggle = document.createElement("label");
  strokeToggle.className = "chk";
  strokeToggle.innerHTML = `<input type="checkbox"${p.stroke.on ? " checked" : ""}> Trazar el borde`;
  strokeToggle.querySelector("input").addEventListener("change", e => { p.stroke.on = e.target.checked; preview(); });
  box.appendChild(strokeToggle);
  box.appendChild(slider("Grosor del borde", 1, 200, p.stroke.width, v => { p.stroke.width = v; preview(); }, "px"));

  if(p.kind === "polygon" || p.kind === "star"){
    box.appendChild(slider("Lados",3,20,p.sides||5,v=>{p.sides=v;preview();}));
    if(p.kind === "star")box.appendChild(slider("Radio interior",5,95,p.inner||50,v=>{p.inner=v;preview();},"%"));
  }

  if(p.kind === "rect"){
    box.appendChild(slider("Radio de esquina", 0, Math.round(Math.min(p.w, p.h) / 2), Math.round(p.radius || 0),
      v => { p.radius = v; preview(); }, "px"));
  }
  p.shadow ||= {on:false,color:"#000000",x:4,y:6,blur:12};
  const shadowToggle=document.createElement("label");shadowToggle.className="chk";shadowToggle.innerHTML=`<input type="checkbox"${p.shadow.on?" checked":""}> Sombra`;shadowToggle.querySelector("input").onchange=e=>{p.shadow.on=e.target.checked;preview();};box.appendChild(shadowToggle);
  box.appendChild(colorField("Color de sombra",p.shadow.color,v=>{p.shadow.color=v;preview();}));
  box.appendChild(slider("Desplazamiento X",-100,100,p.shadow.x,v=>{p.shadow.x=v;preview();},"px"));
  box.appendChild(slider("Desplazamiento Y",-100,100,p.shadow.y,v=>{p.shadow.y=v;preview();},"px"));
  box.appendChild(slider("Desenfoque de sombra",0,100,p.shadow.blur,v=>{p.shadow.blur=v;preview();},"px"));
  return box;
}

export function mountShapeProperties(layer, container){
  if(!isShapeLayer(layer)) return null;
  const original = layer.shape;
  const p = JSON.parse(JSON.stringify(original));
  const preview = () => previewShapeParams(layer, p);
  container.appendChild(shapeBody(p, preview));
  return {
    commit(){ setShapeParams(layer, original, p); }
  };
}

/* ═══ rasterizar ═══
   Convierte una capa de relleno o de forma en una capa raster normal,
   con los píxeles que tuviera en ese momento y sin `fill`/`shape` —el
   mismo trato que «Rasterizar texto» y «Rasterizar objeto
   inteligente» dan a sus propias capas no destructivas—: es la vía
   para poder pintar encima a mano cuando de verdad hace falta. */
export function canRasterize(l){ return isFillLayer(l) || isShapeLayer(l); }

export function rasterizeLayer(layer){
  if(!canRasterize(layer)) return;
  const beforeType = layer.type, beforeFill = layer.fill, beforeShape = layer.shape;
  layer.type = "raster"; layer.fill = null; layer.shape = null;
  record("Rasterizar capa",
    () => { layer.type = beforeType; layer.fill = beforeFill; layer.shape = beforeShape; emit("doc:change"); },
    () => { layer.type = "raster"; layer.fill = null; layer.shape = null; emit("doc:change"); });
  emit("doc:structure"); emit("doc:change");
}
