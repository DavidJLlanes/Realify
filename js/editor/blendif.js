/* ═══════════════════════════════════════════════════════════════
   FUSIONAR SI (Blend If)
   La vía más rápida para mezclar dos capas por luminosidad sin pintar
   ninguna máscara a mano: cada capa lleva dos deslizadores —«Esta
   capa» y «Capa subyacente», cada uno con un punto negro y uno
   blanco— que deciden, píxel a píxel, si esa capa se ve ahí según lo
   oscuro o claro que sea SU PROPIO valor (el deslizador de «esta
   capa») o lo oscuro o claro que sea lo que tiene DEBAJO en ese mismo
   punto (el de «capa subyacente»). Mantener pulsado Alt mientras se
   arrastra un punto lo PARTE en dos mitades independientes: en vez de
   un corte duro, la visibilidad pasa de golpe a en rampa entre las dos
   mitades —la manera de que un recorte por brillo no deje un borde
   serrado donde el tono cruza justo el umbral—.

   No aplica a un grupo (compone sus miembros aparte, no tiene un
   lienzo propio con el que medir «esta capa» sin componerlos antes) ni
   a una capa de ajuste (no tiene contenido propio: ver
   editor/adjustlayers.js). Sí aplica a cualquier otra —raster, texto,
   relleno, forma—, exactamente donde `layertree.js` ya tiene el
   lienzo propio de la capa a mano.
   ═══════════════════════════════════════════════════════════════ */

import { record } from "../core/history.js";
import { emit } from "../core/bus.js";

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export const blendIfSideDefault = () => ({ blackMin:0, blackMax:0, whiteMin:255, whiteMax:255 });
export const blendIfDefault = () => ({ thisLayer: blendIfSideDefault(), underlying: blendIfSideDefault() });

const isDefaultSide = s => !s || (s.blackMin === 0 && s.blackMax === 0 && s.whiteMin === 255 && s.whiteMax === 255);

/* Canales sueltos (v256, «Fusionar si» por canal de Photoshop): `blendIf.channels = { r, g, b }`, cada uno { thisLayer, underlying }; lo que falte va sin efecto. */
export const CHANNELS = ["r", "g", "b"];
export const channelSides = (blendIf, c) => { const ch = blendIf && blendIf.channels && blendIf.channels[c]; return ch ? [ch.thisLayer || blendIfSideDefault(), ch.underlying || blendIfSideDefault()] : [blendIfSideDefault(), blendIfSideDefault()]; };
export const channelActive = (blendIf, c) => { const [t, u] = channelSides(blendIf, c); return !isDefaultSide(t) || !isDefaultSide(u); };

export function isBlendIfActive(blendIf){
  if(!blendIf) return false;
  return !isDefaultSide(blendIf.thisLayer) || !isDefaultSide(blendIf.underlying) || CHANNELS.some(c => channelActive(blendIf, c));
}

/* Sólo tiene sentido sobre una capa con lienzo propio de verdad: un
   grupo compone a sus miembros en un lienzo aparte (sería medir el
   resultado, no «esta capa»), y una capa de ajuste no tiene contenido
   propio que medir en absoluto. */
export const blendIfEligible = l => !!l && l.type !== "group" && l.type !== "adjust";

/* De 0 a 1 según dónde cae `value` en el par negro/blanco de un lado:
   por debajo del punto negro, invisible; por encima del blanco,
   invisible; entre los dos, visible del todo; en la rampa de en medio
   —cuando el punto está partido, blackMin<blackMax o
   whiteMin<whiteMax—, una transición lineal en vez de un corte duro. */
export function rampFactor(value, side){
  if(isDefaultSide(side)) return 1;                      // sin efecto (y sin que un redondeo de coma flotante por encima de 255 lo oculte)
  let lo = 1;
  if(side.blackMax > side.blackMin) lo = clamp((value - side.blackMin) / (side.blackMax - side.blackMin), 0, 1);
  else if(value < side.blackMin) lo = 0;
  let hi = 1;
  if(side.whiteMax > side.whiteMin) hi = clamp((side.whiteMax - value) / (side.whiteMax - side.whiteMin), 0, 1);
  else if(value > side.whiteMax) hi = 0;
  return Math.min(lo, hi);
}

const luminosity = (r, g, b) => r*0.2126 + g*0.7152 + b*0.0722;

/* El lienzo de alfa que `layertree.js` funde con `destination-in`,
   igual que ya hace con una máscara de capa: no hace falta un cauce
   aparte, sólo otra fuente de alfa que multiplicar. `thisCanvas` son
   los píxeles YA fusionados de esta capa (después de cualquier trazo
   en curso, antes de máscara o recorte); `underlyingImg` es un
   ImageData con lo que había compuesto DEBAJO justo antes de dibujar
   esta capa —lo que ya está en el `ctx` del compositor en ese
   instante, ver compositeTree()—. */
export function buildBlendIfAlphaCanvas(thisCanvas, underlyingImg, w, h, blendIf){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cx = c.getContext("2d", { colorSpace:"srgb" });
  const out = cx.createImageData(w, h);
  const s = thisCanvas.getContext("2d", { colorSpace:"srgb" }).getImageData(0, 0, w, h).data;
  const u = underlyingImg.data;
  const od = out.data;
  const chans = CHANNELS.map((c, k) => channelActive(blendIf, c) ? [k, ...channelSides(blendIf, c)] : null).filter(Boolean);
  for(let i = 0; i < od.length; i += 4){
    const thisLum = luminosity(s[i], s[i+1], s[i+2]);
    const underLum = luminosity(u[i], u[i+1], u[i+2]);
    let f = rampFactor(thisLum, blendIf.thisLayer) * rampFactor(underLum, blendIf.underlying);
    for(const [k, ts, us] of chans) f *= rampFactor(s[i + k], ts) * rampFactor(u[i + k], us);
    od[i+3] = Math.round(f * 255);
  }
  cx.putImageData(out, 0, 0);
  return c;
}

/* ── crear / confirmar / previsualizar ───────────────────────────
   Mismo esqueleto que las capas de relleno y de forma
   (editor/layercontent.js): `before` siempre EXPLÍCITO, nunca leído
   de `layer.blendIf` dentro de la propia función —para cuando se
   llama, la vista previa en vivo ya ha dejado `layer.blendIf` con el
   valor final del arrastre, así que leerlo aquí como «antes» dejaría
   Deshacer volviendo al mismo sitio en el que ya estaba—. */
export function setBlendIf(layer, before, params){
  const after = JSON.parse(JSON.stringify(params));
  if(JSON.stringify(before) === JSON.stringify(after)) return;
  layer.blendIf = isBlendIfActive(after) ? after : null;
  emit("doc:change");
  record("Fusionar si",
    () => { layer.blendIf = isBlendIfActive(before) ? before : null; emit("doc:change"); },
    () => { layer.blendIf = isBlendIfActive(after)  ? after  : null; emit("doc:change"); });
}

export function previewBlendIf(layer, params){
  layer.blendIf = JSON.parse(JSON.stringify(params));
  emit("doc:change");
}

/* ── el deslizador doble, con partición Alt ──────────────────────
   Una franja negro→blanco de referencia y, debajo, dos parejas de
   tiradores —negro a la izquierda, blanco a la derecha—. Cada pareja
   se arrastra UNIDA por defecto (un solo punto de corte); Alt al
   empezar a arrastrar la parte en dos mitades independientes, una a
   cada lado de donde estaba el punto unido, dejando la rampa entre
   ambas. Con la pareja ya partida, arrastrar cualquiera de las dos
   mitades no necesita Alt: ya son independientes. */
const SIZE = 256, PAD = 10, GY = 8, GH = 12, HY = GY + GH + 14, HIT = 14;

function normalizeSide(s){
  s.blackMin = clamp(Math.round(s.blackMin), 0, 255);
  s.blackMax = clamp(Math.round(s.blackMax), s.blackMin, 255);
  s.whiteMax = clamp(Math.round(s.whiteMax), 0, 255);
  s.whiteMin = clamp(Math.round(s.whiteMin), 0, s.whiteMax);
  if(s.blackMax > s.whiteMin){
    const mid = Math.round((s.blackMax + s.whiteMin) / 2);
    s.blackMax = mid; s.whiteMin = mid;
  }
  s.blackMin = Math.min(s.blackMin, s.blackMax);
  s.whiteMax = Math.max(s.whiteMax, s.whiteMin);
  return s;
}

function blendIfRow(label, getSide, setSideVal, preview){
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:2px 0 10px";
  const head = document.createElement("div");
  head.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px";
  const title = document.createElement("span");
  title.textContent = label;
  title.style.cssText = "font-size:var(--fs-sm);color:var(--tx-dim)";
  const readout = document.createElement("span");
  readout.className = "mono";
  readout.style.cssText = "font-size:var(--fs-xs);color:var(--tx-faint)";
  head.append(title, readout);
  wrap.appendChild(head);

  const cv = document.createElement("canvas");
  cv.width = SIZE + PAD * 2; cv.height = HY + 14;
  cv.style.cssText = "width:100%;max-width:320px;display:block;touch-action:none;cursor:pointer";
  wrap.appendChild(cv);
  const cx = cv.getContext("2d");

  const toX = v => PAD + v / 255 * SIZE;
  const toV = x => clamp(Math.round((x - PAD) / SIZE * 255), 0, 255);
  function eventX(e){
    const r = cv.getBoundingClientRect();
    return (e.clientX - r.left) * (cv.width / r.width);
  }

  function drawHandle(x, fill, dir){
    // `dir`: -1 mitad izquierda (apunta a la derecha), 1 mitad derecha
    // (apunta a la izquierda), 0 tirador entero (sin partir).
    cx.fillStyle = fill;
    cx.strokeStyle = "rgba(0,0,0,.5)";
    cx.lineWidth = 1;
    cx.beginPath();
    const top = HY - 6, bot = HY + 6, w2 = 6;
    if(dir === 0){
      cx.moveTo(x, top); cx.lineTo(x + w2, bot); cx.lineTo(x - w2, bot); cx.closePath();
    } else if(dir < 0){
      cx.moveTo(x, top); cx.lineTo(x, bot); cx.lineTo(x - w2, bot); cx.closePath();
    } else {
      cx.moveTo(x, top); cx.lineTo(x + w2, bot); cx.lineTo(x, bot); cx.closePath();
    }
    cx.fill(); cx.stroke();
  }

  function draw(){
    const s = getSide();
    cx.clearRect(0, 0, cv.width, cv.height);
    const g = cx.createLinearGradient(PAD, 0, PAD + SIZE, 0);
    g.addColorStop(0, "#000"); g.addColorStop(1, "#fff");
    cx.fillStyle = g;
    cx.fillRect(PAD, GY, SIZE, GH);
    cx.strokeStyle = "rgba(255,255,255,.25)";
    cx.strokeRect(PAD + 0.5, GY + 0.5, SIZE - 1, GH - 1);

    // Líneas finas uniendo cada pareja partida, para que se vea la rampa.
    cx.strokeStyle = "rgba(255,255,255,.35)";
    cx.beginPath();
    cx.moveTo(toX(s.blackMin), HY); cx.lineTo(toX(s.blackMax), HY);
    cx.moveTo(toX(s.whiteMin), HY); cx.lineTo(toX(s.whiteMax), HY);
    cx.stroke();

    if(s.blackMin === s.blackMax) drawHandle(toX(s.blackMin), "#141517", 0);
    else { drawHandle(toX(s.blackMin), "#141517", -1); drawHandle(toX(s.blackMax), "#141517", 1); }
    if(s.whiteMin === s.whiteMax) drawHandle(toX(s.whiteMin), "#f2f2f2", 0);
    else { drawHandle(toX(s.whiteMin), "#f2f2f2", -1); drawHandle(toX(s.whiteMax), "#f2f2f2", 1); }

    readout.textContent = `${s.blackMin}${s.blackMin !== s.blackMax ? "/" + s.blackMax : ""}  ·  ` +
                           `${s.whiteMax}${s.whiteMin !== s.whiteMax ? "/" + s.whiteMin : ""}`;
  }

  let drag = null;
  cv.addEventListener("pointerdown", e => {
    e.preventDefault();
    const x = eventX(e);
    const s = getSide();
    const bMinX = toX(s.blackMin), bMaxX = toX(s.blackMax);
    const wMinX = toX(s.whiteMin), wMaxX = toX(s.whiteMax);
    const dBlack = Math.min(Math.abs(x - bMinX), Math.abs(x - bMaxX));
    const dWhite = Math.min(Math.abs(x - wMinX), Math.abs(x - wMaxX));
    if(Math.min(dBlack, dWhite) > HIT) return;
    const key = dBlack <= dWhite ? "black" : "white";
    const joined = key === "black" ? s.blackMin === s.blackMax : s.whiteMin === s.whiteMax;
    if(joined){
      drag = e.altKey
        ? { key, mode:"split", origin: key === "black" ? s.blackMin : s.whiteMin }
        : { key, mode:"both" };
    } else {
      const dMin = Math.abs(x - toX(s[key + "Min"]));
      const dMax = Math.abs(x - toX(s[key + "Max"]));
      drag = { key, mode: dMin <= dMax ? "min" : "max" };
    }
    cv.setPointerCapture(e.pointerId);
    move(e);
  });
  function move(e){
    if(!drag) return;
    const v = toV(eventX(e));
    const s = { ...getSide() };
    const k = drag.key;
    if(drag.mode === "both"){ s[k + "Min"] = v; s[k + "Max"] = v; }
    else if(drag.mode === "split"){
      if(v <= drag.origin){ s[k + "Min"] = v; s[k + "Max"] = drag.origin; }
      else { s[k + "Min"] = drag.origin; s[k + "Max"] = v; }
    } else if(drag.mode === "min") s[k + "Min"] = v;
    else if(drag.mode === "max") s[k + "Max"] = v;
    normalizeSide(s);
    setSideVal(s);
    draw();
    preview();
  }
  cv.addEventListener("pointermove", move);
  const stop = () => { drag = null; };
  cv.addEventListener("pointerup", stop);
  cv.addEventListener("pointercancel", stop);
  // Doble clic devuelve ese lado a «sin efecto», como en Photoshop.
  cv.addEventListener("dblclick", () => {
    setSideVal(blendIfSideDefault());
    draw();
    preview();
  });

  draw();
  return { el: wrap, draw };
}

export function mountBlendIfEditor(layer, container){
  if(!blendIfEligible(layer)) return null;
  const original = layer.blendIf ? JSON.parse(JSON.stringify(layer.blendIf)) : blendIfDefault();
  const p = JSON.parse(JSON.stringify(original));
  const preview = () => previewBlendIf(layer, p);

  const box = document.createElement("div");
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.style.margin = "0 0 8px";
  hint.textContent = "Arrastra un punto para cortar por brillo; mantén Alt al empezar a arrastrar para partirlo en una rampa suave. Doble clic en un lado lo quita.";
  box.appendChild(hint);

  // Gris (luminosidad) o un canal suelto: Rojo, Verde, Azul
  let cur = "gray";
  const chan = c => { p.channels = p.channels || {}; p.channels[c] = p.channels[c] || { thisLayer: blendIfSideDefault(), underlying: blendIfSideDefault() }; return p.channels[c]; };
  const getSide = which => cur === "gray" ? p[which] : channelSides(p, cur)[which === "thisLayer" ? 0 : 1];
  const setSide = (which, v) => { if(cur === "gray") p[which] = v; else chan(cur)[which] = v; };
  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:4px;margin:0 0 8px";
  const TAB = [["gray", "Gris"], ["r", "Rojo"], ["g", "Verde"], ["b", "Azul"]];
  const refreshTabs = () => tabs.querySelectorAll("button").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.c === cur)); b.style.fontWeight = b.dataset.c === cur ? "600" : "400"; b.style.outline = (b.dataset.c !== "gray" && channelActive(p, b.dataset.c)) || (b.dataset.c === "gray" && (!isDefaultSide(p.thisLayer) || !isDefaultSide(p.underlying))) ? "2px solid var(--accent, #4c8dff)" : ""; });
  for(const [c, lab] of TAB){ const b = document.createElement("button"); b.type = "button"; b.dataset.c = c; b.textContent = lab; b.style.flex = "1"; b.addEventListener("click", () => { cur = c; rowThis.draw(); rowUnder.draw(); refreshTabs(); }); tabs.appendChild(b); }
  const rowThis = blendIfRow("Esta capa", () => getSide("thisLayer"),
    v => { setSide("thisLayer", v); refreshTabs(); }, preview);
  const rowUnder = blendIfRow("Capa subyacente", () => getSide("underlying"),
    v => { setSide("underlying", v); refreshTabs(); }, preview);
  box.append(tabs, rowThis.el, rowUnder.el);
  refreshTabs();

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Quitar";
  clearBtn.title = "Vuelve todas las franjas (gris y canales) a su rango completo, sin efecto";
  clearBtn.addEventListener("click", () => {
    p.thisLayer = blendIfSideDefault();
    p.underlying = blendIfSideDefault();
    delete p.channels;
    rowThis.draw(); rowUnder.draw(); refreshTabs();
    preview();
  });
  box.appendChild(clearBtn);

  container.appendChild(box);
  return {
    commit(){ setBlendIf(layer, original, p); }
  };
}
