/* ═══════════════════════════════════════════════════════════════
   ESTILOS DE CAPA
   Sombra paralela, resplandor exterior, trazo y superposición de
   degradado: propiedades reeditables de cualquier capa o grupo, con
   los mismos cuatro efectos con los que ya contaba el texto (sombra y
   contorno) pero generalizados a la forma alfa de cualquier
   contenido, no sólo a las letras. Se guardan en `layer.styles` y se
   recalculan en cada composición a partir de los píxeles actuales de
   la capa: nunca se «cuecen» dentro de ellos, así que reabrir el
   diálogo semanas después sigue permitiendo cambiar cualquier valor.
   ═══════════════════════════════════════════════════════════════ */

import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { slider } from "./adjust.js";

export function defaultStyles(){
  return {
    shadow:   { enabled:false, color:"#000000", opacity:75, blur:8,  x:4, y:4 },
    glow:     { enabled:false, color:"#ffd76a", opacity:75, size:12 },
    stroke:   { enabled:false, color:"#ffffff", width:3 },
    gradient: { enabled:false, color1:"#ff8a00", color2:"#e52e71", angle:90, opacity:100 }
  };
}

export function hasEnabledStyle(st){
  return !!(st && ((st.shadow && st.shadow.enabled) || (st.glow && st.glow.enabled) ||
                    (st.stroke && st.stroke.enabled) || (st.gradient && st.gradient.enabled)));
}

function hexToRgba(hex, a){
  const h = String(hex || "#000000").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* Dilata la silueta alfa de `src` un radio dado repitiéndola desplazada
   en círculo: una aproximación barata de una dilatación morfológica de
   verdad, de sobra para un ancho de trazo o resplandor típico de unos
   pocos a unas decenas de píxeles. */
function dilatedAlpha(src, w, h, radius, steps = 20){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  for(let i = 0; i < steps; i++){
    const a = (i / steps) * Math.PI * 2;
    x.drawImage(src, Math.round(Math.cos(a) * radius), Math.round(Math.sin(a) * radius));
  }
  x.drawImage(src, 0, 0);
  return c;
}

/* Anillo de `width` px por FUERA del contorno exacto de `src`, teñido
   de un color sólido. Sólo la variante «por fuera»: es la que cubre el
   caso normal (resaltar el borde de una capa recortada sobre otra) sin
   necesitar una segunda pasada de erosión para «por dentro» o «centrado». */
function strokeRing(src, w, h, width, color){
  const dil = dilatedAlpha(src, w, h, Math.max(1, width));
  const dctx = dil.getContext("2d");
  dctx.globalCompositeOperation = "destination-out";
  dctx.drawImage(src, 0, 0);
  dctx.globalCompositeOperation = "source-atop";
  dctx.fillStyle = color;
  dctx.fillRect(0, 0, w, h);
  return dil;
}

function linearGradient(ctx, g, w, h){
  const rad = (g.angle || 0) * Math.PI / 180;
  const cx = w / 2, cy = h / 2;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const dx = Math.cos(rad) * len / 2, dy = Math.sin(rad) * len / 2;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  grad.addColorStop(0, g.color1);
  grad.addColorStop(1, g.color2);
  return grad;
}

/* `drawn` es exactamente lo que va a verse de la capa —ya recortado
   por su máscara y por el recorte a la capa de abajo, pero SIN su
   opacidad ni su modo de fusión propios, que se aplican después—.
   Devuelve un lienzo nuevo del mismo tamaño con la sombra y el
   resplandor detrás, el degradado teñido sobre los píxeles reales y
   el trazo encima del borde. */
export function renderLayerStyles(drawn, st, w, h){
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d", { colorSpace:"srgb" });

  if(st.shadow && st.shadow.enabled){
    octx.save();
    octx.shadowColor = hexToRgba(st.shadow.color, (st.shadow.opacity ?? 75) / 100);
    octx.shadowBlur = st.shadow.blur ?? 8;
    octx.shadowOffsetX = st.shadow.x ?? 4;
    octx.shadowOffsetY = st.shadow.y ?? 4;
    octx.drawImage(drawn, 0, 0);
    octx.restore();
  }
  if(st.glow && st.glow.enabled){
    octx.save();
    octx.shadowColor = hexToRgba(st.glow.color, (st.glow.opacity ?? 75) / 100);
    octx.shadowBlur = st.glow.size ?? 12;
    octx.shadowOffsetX = 0; octx.shadowOffsetY = 0;
    // Dos pasadas para que el halo tenga cuerpo sin tener que subir
    // tanto el desenfoque que pierda forma.
    octx.drawImage(drawn, 0, 0);
    octx.drawImage(drawn, 0, 0);
    octx.restore();
  }

  let top = drawn;
  if(st.gradient && st.gradient.enabled){
    top = document.createElement("canvas");
    top.width = w; top.height = h;
    const tctx = top.getContext("2d", { colorSpace:"srgb" });
    tctx.drawImage(drawn, 0, 0);
    // source-atop: sólo tiñe donde ya había alfa, y conserva ESE alfa
    // —la forma de la capa no cambia, sólo su color—.
    tctx.globalCompositeOperation = "source-atop";
    tctx.globalAlpha = (st.gradient.opacity ?? 100) / 100;
    tctx.fillStyle = linearGradient(tctx, st.gradient, w, h);
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = "source-over";
    tctx.globalAlpha = 1;
  }
  octx.drawImage(top, 0, 0);

  if(st.stroke && st.stroke.enabled){
    octx.drawImage(strokeRing(drawn, w, h, st.stroke.width ?? 3, st.stroke.color ?? "#ffffff"), 0, 0);
  }

  return out;
}

/* ═══════════════════════════════════════════════════════════════
   DIÁLOGO DE EDICIÓN
   Cuatro secciones plegables con el mismo interruptor «sw» y el
   mismo aspecto que las etapas de la cadena de Realify: la vista
   previa es en vivo (se aplica a la capa real a cada cambio) y
   Cancelar la devuelve a como estaba al abrir.
   ═══════════════════════════════════════════════════════════════ */

function colorField(label, value, onInput){
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.innerHTML = `<label>${label}</label>
    <input type="color" value="${value}" style="width:100%;height:30px;padding:0;
      border:1px solid var(--line);border-radius:var(--r);background:transparent">`;
  wrap.querySelector("input").addEventListener("input", e => onInput(e.target.value));
  return wrap;
}

function section(container, key, title, st, preview, fields){
  const sec = document.createElement("section");
  sec.className = "cstage" + (st.enabled ? " on" : "");
  sec.innerHTML = `
    <header class="chead">
      <span class="ccaret" aria-hidden="true">›</span>
      <span class="cname">${title}</span>
      <input type="checkbox" class="sw" ${st.enabled ? "checked" : ""} aria-label="Activar ${title}">
    </header>
    <div class="cbody"></div>`;
  const head = sec.querySelector(".chead");
  const body = sec.querySelector(".cbody");
  const sw = sec.querySelector(".sw");
  sw.addEventListener("click", e => e.stopPropagation());
  sw.addEventListener("change", () => {
    st.enabled = sw.checked;
    sec.classList.toggle("on", st.enabled);
    preview();
  });
  head.addEventListener("click", e => {
    if(e.target === sw) return;
    sec.classList.toggle("collapsed");
  });
  fields(body, st);
  container.appendChild(sec);
}

export async function openLayerStyles(layer){
  if(!layer) return;
  const original = layer.styles ? JSON.parse(JSON.stringify(layer.styles)) : null;
  const p = layer.styles ? JSON.parse(JSON.stringify(layer.styles)) : defaultStyles();

  const preview = () => { layer.styles = p; layer.thumbDirty = true; emit("doc:change"); };

  const wrap = document.createElement("div");
  const box = document.createElement("div");
  box.className = "cadena-stages";
  wrap.appendChild(box);

  section(box, "shadow", "Sombra paralela", p.shadow, preview, (body, st) => {
    body.appendChild(colorField("Color", st.color, v => { st.color = v; preview(); }));
    body.appendChild(slider("Opacidad", 0, 100, st.opacity, v => { st.opacity = v; preview(); }, "%"));
    body.appendChild(slider("Desenfoque", 0, 60, st.blur, v => { st.blur = v; preview(); }, "px"));
    body.appendChild(slider("Desplazamiento X", -60, 60, st.x, v => { st.x = v; preview(); }, "px"));
    body.appendChild(slider("Desplazamiento Y", -60, 60, st.y, v => { st.y = v; preview(); }, "px"));
  });
  section(box, "glow", "Resplandor exterior", p.glow, preview, (body, st) => {
    body.appendChild(colorField("Color", st.color, v => { st.color = v; preview(); }));
    body.appendChild(slider("Opacidad", 0, 100, st.opacity, v => { st.opacity = v; preview(); }, "%"));
    body.appendChild(slider("Tamaño", 1, 60, st.size, v => { st.size = v; preview(); }, "px"));
  });
  section(box, "stroke", "Trazo", p.stroke, preview, (body, st) => {
    body.appendChild(colorField("Color", st.color, v => { st.color = v; preview(); }));
    body.appendChild(slider("Ancho", 1, 30, st.width, v => { st.width = v; preview(); }, "px"));
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Siempre por fuera del contorno de la capa, nunca por dentro ni centrado.";
    body.appendChild(hint);
  });
  section(box, "gradient", "Superposición de degradado", p.gradient, preview, (body, st) => {
    body.appendChild(colorField("Color 1", st.color1, v => { st.color1 = v; preview(); }));
    body.appendChild(colorField("Color 2", st.color2, v => { st.color2 = v; preview(); }));
    body.appendChild(slider("Ángulo", 0, 360, st.angle, v => { st.angle = v; preview(); }, "°"));
    body.appendChild(slider("Opacidad", 0, 100, st.opacity, v => { st.opacity = v; preview(); }, "%"));
  });

  preview();

  const res = await dialog({
    title: "Estilos de capa — " + layer.name,
    body: wrap,
    buttons: [{ label:"Cancelar", value:null }, { label:"Aceptar", primary:true, value:"go" }]
  });

  if(res === "go"){
    const after = hasEnabledStyle(p) ? p : null;
    layer.styles = after;
    layer.thumbDirty = true;
    record("Estilos de capa",
      () => { layer.styles = original; emit("doc:change"); },
      () => { layer.styles = after;    emit("doc:change"); });
    emit("doc:change");
  } else {
    layer.styles = original;
    layer.thumbDirty = true;
    emit("doc:change");
  }
}
