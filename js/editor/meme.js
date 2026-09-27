/* ═══════════════════════════════════════════════════════════════
   CREAR MEME

   Cada diseño se describe como una RECETA: una lista de piezas
   —rectángulos, marcos, burbujas, textos— en coordenadas relativas al
   tamaño de la imagen. Esa misma receta se usa para dos cosas:

     · pintar la miniatura del diálogo, sobre la foto de verdad y con
       el texto que se esté escribiendo;
     · crear las capas reales al aceptar.

   Que las dos salgan de la misma descripción es lo único que garantiza
   que la miniatura no mienta. Si cada una tuviera su propio código,
   tarde o temprano se separarían y la vista previa enseñaría una cosa
   y el resultado sería otra.

   Lo que se crea son capas normales —de texto las de texto, de píxeles
   las formas—, así que después se puede retocar todo con las
   herramientas de siempre.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../core/doc.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { renderTextLayer, fontString } from "./text.js";

const IMPACT = "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
const SANS   = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF  = "Georgia, 'Times New Roman', serif";

/* Lienzo suelto sólo para medir texto. Medir de verdad en vez de
   contar caracteres es la diferencia entre que el texto quepa y que se
   salga por los lados con la primera palabra larga. */
const meter = document.createElement("canvas").getContext("2d");

function measure(line, size, font, weight){
  meter.font = `${weight} ${size}px ${font}`;
  return meter.measureText(line).width;
}

/* Parte el texto en líneas que quepan en `maxW` y, si aun así el
   bloque no cabe en `maxH`, baja el cuerpo hasta que quepa. Devuelve
   el contenido ya con saltos de línea y el tamaño definitivo. */
function fitText(text, maxW, maxH, baseSize, font, weight, lineHeight = 1.05){
  const words = String(text).split(/\s+/).filter(Boolean);
  if(!words.length) return { content: "", size: baseSize };

  for(let size = Math.round(baseSize); size >= 11; size = Math.round(size * 0.94)){
    const lines = [];
    let line = "";
    let cabe = true;
    for(const w of words){
      const probe = line ? line + " " + w : w;
      if(measure(probe, size, font, weight) <= maxW || !line){
        // Una palabra sola más ancha que el hueco: no hay nada que
        // partir sin cortarla, así que se prueba con un cuerpo menor.
        if(!line && measure(probe, size, font, weight) > maxW){ cabe = false; break; }
        line = probe;
      } else {
        lines.push(line);
        line = w;
      }
    }
    if(!cabe) continue;
    if(line) lines.push(line);
    if(lines.length * size * lineHeight <= maxH)
      return { content: lines.join("\n"), size };
  }
  return { content: words.join(" "), size: 11 };
}

/* ── las recetas ──────────────────────────────────────────────
   Piezas admitidas:
     {t:"rect",   x,y,w,h, color, alpha}
     {t:"stroke", x,y,w,h, color, lw}
     {t:"bubble", x,y,w,h, tailAt}
     {t:"text",   x,y, content, size, font, weight, color,
                  strokeWidth, strokeColor, lineHeight, tracking}
   Todo en píxeles del documento; el diálogo escala al dibujar. */

export const STYLES = [
  {
    id:"classic", name:"Clásico",
    note:"Blanco con contorno negro, arriba y abajo, en mayúsculas. El de toda la vida.",
    build(W, H, top, bottom){
      const out = [];
      const margen = W * 0.06;
      const cuerpo = H * 0.13;
      const grosor = s => Math.max(2, Math.round(s * 0.055));
      if(top){
        const f = fitText(top.toUpperCase(), W - margen*2, H*0.30, cuerpo, IMPACT, 700);
        out.push({ t:"text", x:W/2, y:H*0.10 + f.size*0.2, content:f.content, size:f.size,
                   font:IMPACT, weight:700, color:"#ffffff",
                   strokeWidth:grosor(f.size), strokeColor:"#000000" });
      }
      if(bottom){
        const f = fitText(bottom.toUpperCase(), W - margen*2, H*0.30, cuerpo, IMPACT, 700);
        out.push({ t:"text", x:W/2, y:H*0.90 - f.size*0.2, content:f.content, size:f.size,
                   font:IMPACT, weight:700, color:"#ffffff",
                   strokeWidth:grosor(f.size), strokeColor:"#000000" });
      }
      return out;
    }
  },

  {
    id:"bar", name:"Barra inferior",
    note:"Una franja blanca al pie con el texto en negro dentro.",
    build(W, H, top, bottom){
      const txt = bottom || top || "";
      const barH = Math.max(56, H * 0.17);
      const f = fitText(txt.toUpperCase(), W * 0.92, barH * 0.72, barH * 0.4, IMPACT, 700);
      return [
        { t:"rect", x:0, y:H - barH, w:W, h:barH, color:"#ffffff", alpha:1 },
        { t:"text", x:W/2, y:H - barH/2, content:f.content, size:f.size,
          font:IMPACT, weight:700, color:"#111111", lineHeight:1.05 }
      ];
    }
  },

  {
    id:"caption", name:"Subtítulo",
    note:"Franja negra semitransparente al pie, como el subtítulo de un vídeo.",
    build(W, H, top, bottom){
      const txt = bottom || top || "";
      const barH = Math.max(48, H * 0.14);
      const f = fitText(txt, W * 0.9, barH * 0.66, barH * 0.34, SANS, 500, 1.2);
      return [
        { t:"rect", x:0, y:H - barH, w:W, h:barH, color:"#000000", alpha:0.68 },
        { t:"text", x:W/2, y:H - barH/2, content:f.content, size:f.size,
          font:SANS, weight:500, color:"#ffffff", lineHeight:1.2 }
      ];
    }
  },

  {
    id:"bubble", name:"Burbuja",
    note:"Un globo de cómic con su piquito, para poner palabras en boca de alguien.",
    build(W, H, top){
      const w = Math.min(W * 0.72, W - 40), h = w * 0.42;
      const x = (W - w) / 2, y = H * 0.06;
      const f = fitText(top || "Texto", w * 0.82, h * 0.66, h * 0.26, SANS, 600, 1.15);
      return [
        { t:"bubble", x, y, w, h, tailAt: 0.28 },
        { t:"text", x:x + w/2, y:y + h/2, content:f.content, size:f.size,
          font:SANS, weight:600, color:"#111111", lineHeight:1.15 }
      ];
    }
  },

  /* ── diseños nuevos ─────────────────────────────────────── */

  {
    id:"polaroid", name:"Polaroid",
    note:"Marco blanco por los cuatro lados con un margen ancho abajo para el pie.",
    build(W, H, top, bottom){
      const lado = Math.min(W, H);
      const b = Math.round(lado * 0.045);         // marco fino
      const pie = Math.round(lado * 0.17);        // margen ancho de abajo
      const txt = bottom || top || "";
      const f = fitText(txt, W - b*2 - 16, pie * 0.62, pie * 0.34, SERIF, 400, 1.15);
      const out = [
        // El marco se pinta como cuatro bandas: así el centro queda
        // limpio y la foto se ve entera dentro del hueco.
        { t:"rect", x:0, y:0, w:W, h:b, color:"#f6f4ef", alpha:1 },
        { t:"rect", x:0, y:H - pie, w:W, h:pie, color:"#f6f4ef", alpha:1 },
        { t:"rect", x:0, y:0, w:b, h:H, color:"#f6f4ef", alpha:1 },
        { t:"rect", x:W - b, y:0, w:b, h:H, color:"#f6f4ef", alpha:1 },
        { t:"stroke", x:b, y:b, w:W - b*2, h:H - b - pie, color:"rgba(0,0,0,.18)", lw:Math.max(1, b*0.08) }
      ];
      if(txt) out.push({ t:"text", x:W/2, y:H - pie/2, content:f.content, size:f.size,
                         font:SERIF, weight:400, color:"#2a2723", lineHeight:1.15 });
      return out;
    }
  },

  {
    id:"topbar", name:"Cartel superior",
    note:"Franja blanca ENCIMA de la foto con el texto en negro: el formato de las redes.",
    build(W, H, top, bottom){
      const txt = top || bottom || "";
      const barH = Math.max(56, H * 0.18);
      const f = fitText(txt, W * 0.94, barH * 0.74, barH * 0.30, SANS, 600, 1.2);
      return [
        { t:"rect", x:0, y:0, w:W, h:barH, color:"#ffffff", alpha:1 },
        { t:"text", x:W/2, y:barH/2, content:f.content, size:f.size,
          font:SANS, weight:600, color:"#0f1113", lineHeight:1.2 }
      ];
    }
  },

  {
    id:"demotivator", name:"Desmotivador",
    note:"Marco negro con filete blanco, título en versales y una línea pequeña debajo.",
    build(W, H, top, bottom){
      const lado = Math.min(W, H);
      const b = Math.round(lado * 0.07);
      const pie = Math.round(lado * 0.26);
      const out = [
        { t:"rect", x:0, y:0, w:W, h:b, color:"#000000", alpha:1 },
        { t:"rect", x:0, y:H - pie, w:W, h:pie, color:"#000000", alpha:1 },
        { t:"rect", x:0, y:0, w:b, h:H, color:"#000000", alpha:1 },
        { t:"rect", x:W - b, y:0, w:b, h:H, color:"#000000", alpha:1 },
        { t:"stroke", x:b*0.55, y:b*0.55, w:W - b*1.1, h:H - b*0.55 - pie + b*0.45,
          color:"#e8e6e0", lw:Math.max(1, lado*0.004) }
      ];
      const titulo = (top || bottom || "").toUpperCase();
      const sub = top && bottom ? bottom : "";
      if(titulo){
        const f = fitText(titulo, W - b*2 - 20, pie * (sub ? 0.42 : 0.62), pie * 0.34,
                          SERIF, 400, 1.1);
        out.push({ t:"text", x:W/2, y:H - pie + pie*(sub ? 0.34 : 0.5),
                   content:f.content, size:f.size, font:SERIF, weight:400,
                   color:"#f2efe8", lineHeight:1.1, tracking: f.size * 0.12 });
      }
      if(sub){
        const f = fitText(sub, W - b*2 - 20, pie * 0.30, pie * 0.15, SANS, 400, 1.2);
        out.push({ t:"text", x:W/2, y:H - pie*0.28, content:f.content, size:f.size,
                   font:SANS, weight:400, color:"#c9c5bc", lineHeight:1.2 });
      }
      return out;
    }
  },

  {
    id:"quote", name:"Cita",
    note:"Velo oscuro sobre toda la foto y la frase grande en el centro, con su firma.",
    build(W, H, top, bottom){
      const frase = top || bottom || "";
      const firma = top && bottom ? bottom : "";
      const out = [{ t:"rect", x:0, y:0, w:W, h:H, color:"#0a0c0f", alpha:0.52 }];
      if(frase){
        const f = fitText("«" + frase + "»", W * 0.82, H * 0.5, H * 0.11, SERIF, 400, 1.25);
        out.push({ t:"text", x:W/2, y:H*0.46, content:f.content, size:f.size,
                   font:SERIF, weight:400, color:"#ffffff", lineHeight:1.25 });
      }
      if(firma){
        const f = fitText("— " + firma, W * 0.7, H * 0.12, H * 0.045, SANS, 500, 1.2);
        out.push({ t:"text", x:W/2, y:H*0.72, content:f.content, size:f.size,
                   font:SANS, weight:500, color:"#d8d4cc", lineHeight:1.2,
                   tracking: f.size * 0.06 });
      }
      return out;
    }
  }
];

/* ── dibujo ───────────────────────────────────────────────────
   Un solo pintor, usado por la miniatura y —indirectamente— por las
   capas. `s` es el factor de escala respecto al tamaño del documento;
   la miniatura pinta a 0,2 y las capas a 1. */
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBubble(ctx, p, s){
  const x = p.x*s, y = p.y*s, w = p.w*s, h = p.h*s;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(1, w * 0.008);
  roundRect(ctx, x, y, w, h, w * 0.06);
  ctx.fill(); ctx.stroke();
  const tx = x + w * (p.tailAt ?? 0.28), ty = y + h;
  ctx.beginPath();
  ctx.moveTo(tx, ty - 1);
  ctx.lineTo(tx - w * 0.05, ty + h * 0.28);
  ctx.lineTo(tx + w * 0.14, ty - 1);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tx, ty - 1);
  ctx.lineTo(tx - w * 0.05, ty + h * 0.28);
  ctx.stroke();
}

/* Pinta un texto exactamente como lo hará renderTextLayer: mismo
   encuadre vertical del bloque, mismo contorno a caballo del borde y
   mismo espaciado entre letras. */
function drawTextPiece(ctx, p, s){
  const size = p.size * s;
  const lh = size * (p.lineHeight ?? 1.05);
  const tracking = (p.tracking || 0) * s;
  ctx.font = `${p.weight} ${size}px ${p.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const lines = String(p.content).split("\n");
  let y = p.y*s - (lh * lines.length)/2 + size * 0.82;

  const put = (line, stroke) => {
    if(!tracking){
      stroke ? ctx.strokeText(line, p.x*s, y) : ctx.fillText(line, p.x*s, y);
      return;
    }
    const chars = [...line];
    const w = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0)
            + tracking * Math.max(0, chars.length - 1);
    let cx = p.x*s - w/2;
    const prev = ctx.textAlign;
    ctx.textAlign = "left";
    for(const ch of chars){
      stroke ? ctx.strokeText(ch, cx, y) : ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + tracking;
    }
    ctx.textAlign = prev;
  };

  for(const line of lines){
    if(p.strokeWidth > 0){
      ctx.strokeStyle = p.strokeColor || "#000000";
      ctx.lineWidth = p.strokeWidth * s * 2;
      put(line, true);
    }
    ctx.fillStyle = p.color;
    put(line, false);
    y += lh;
  }
}

export function drawPieces(ctx, pieces, s){
  for(const p of pieces){
    ctx.save();
    if(p.t === "rect"){
      ctx.globalAlpha = p.alpha ?? 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x*s, p.y*s, p.w*s, p.h*s);
    } else if(p.t === "stroke"){
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, p.lw * s);
      ctx.strokeRect(p.x*s, p.y*s, p.w*s, p.h*s);
    } else if(p.t === "bubble"){
      drawBubble(ctx, p, s);
    } else if(p.t === "text"){
      drawTextPiece(ctx, p, s);
    }
    ctx.restore();
  }
}

/* ── creación de capas ────────────────────────────────────────
   Las formas contiguas se agrupan en una sola capa de píxeles —son
   decorado, no hace falta una capa por rectángulo— y cada texto va a
   la suya, que es lo que permite volver a editarlo después. */
export function buildMeme(styleId, topText, bottomText){
  if(!doc.open) return [];
  const style = STYLES.find(s => s.id === styleId) || STYLES[0];
  const pieces = style.build(doc.w, doc.h, topText, bottomText);
  const created = [];

  let shapeLayer = null;
  for(const p of pieces){
    if(p.t === "text"){
      const l = addLayer({ name: "Meme · texto" });
      l.type = "text";
      l.text = {
        content: p.content, x: p.x, y: p.y,
        font: p.font, size: p.size, weight: p.weight, italic: false,
        color: p.color, align: "center", baseline: "middle",
        lineHeight: p.lineHeight ?? 1.05,
        tracking: p.tracking || 0,
        strokeWidth: p.strokeWidth || 0,
        strokeColor: p.strokeColor || "#000000",
        shadow: false, shadowBlur: 6, shadowX: 0, shadowY: 2,
        shadowColor: "#000000", shadowAlpha: 60
      };
      renderTextLayer(l);
      created.push(l);
      shapeLayer = null;      // un texto corta el grupo de formas
    } else {
      if(!shapeLayer){
        shapeLayer = addLayer({ name: "Meme · marco" });
        created.push(shapeLayer);
      }
      drawPieces(shapeLayer.ctx, [p], 1);
      shapeLayer.thumbDirty = true;
    }
  }

  emit("doc:structure");
  emit("doc:change");
  return created;
}

/* ── diálogo ──────────────────────────────────────────────── */
export async function openMeme(){
  if(!doc.open){ toast("No hay documento abierto"); return; }

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="field"><label>Texto arriba</label>
      <input type="text" id="mmTop" class="grow" placeholder="Escribe y mira las miniaturas"></div>
    <div class="field"><label>Texto abajo</label>
      <input type="text" id="mmBottom" class="grow" placeholder="Opcional según el diseño"></div>
    <p class="hint" id="mmNote" style="margin:10px 0"></p>
    <div id="mmGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
         gap:10px"></div>
    <p class="hint" style="margin-top:12px">Cada miniatura es tu foto con tu texto, no un
      ejemplo genérico. Se crean como capas normales: luego se pueden mover y reescribir
      con la herramienta de texto de siempre.</p>`;

  const grid = wrap.querySelector("#mmGrid");
  const note = wrap.querySelector("#mmNote");
  const inTop = wrap.querySelector("#mmTop");
  const inBot = wrap.querySelector("#mmBottom");

  let picked = "classic";

  /* Copia reducida de la foto compuesta, una sola vez: cada miniatura
     parte de ella en vez de reescalar el documento entero ocho veces
     por cada tecla que se pulsa. */
  const TW = 300;
  const TH = Math.max(1, Math.round(TW * doc.h / doc.w));
  const base = document.createElement("canvas");
  base.width = TW; base.height = TH;
  {
    const bx = base.getContext("2d");
    for(const l of doc.layers){
      if(!l.visible || l.opacity <= 0) continue;
      bx.save();
      bx.globalAlpha = l.opacity;
      bx.globalCompositeOperation = l.blend;
      bx.drawImage(l.canvas, 0, 0, TW, TH);
      bx.restore();
    }
  }

  const cells = [];
  for(const s of STYLES){
    const cell = document.createElement("button");
    cell.style.cssText = "padding:0;display:flex;flex-direction:column;gap:5px;" +
                         "background:transparent;border:0;cursor:pointer";
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    cv.style.cssText = "width:100%;height:auto;display:block;border-radius:var(--r);" +
                       "border:2px solid var(--line)";
    const label = document.createElement("span");
    label.textContent = s.name;
    label.style.cssText = "font-size:var(--fs-xs);color:var(--tx-dim);text-align:center";
    cell.append(cv, label);
    cell.addEventListener("click", () => {
      picked = s.id;
      marcar();
      note.textContent = s.note;
    });
    grid.appendChild(cell);
    cells.push({ id: s.id, cv, style: s });
  }

  const marcar = () => cells.forEach(c =>
    c.cv.style.borderColor = c.id === picked ? "var(--ac)" : "var(--line)");

  let pend = false;
  const repintar = () => {
    if(pend) return;
    pend = true;
    requestAnimationFrame(() => {
      pend = false;
      const top = inTop.value.trim();
      const bot = inBot.value.trim();
      const s = TW / doc.w;
      for(const c of cells){
        const cx = c.cv.getContext("2d");
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, TW, TH);
        cx.drawImage(base, 0, 0);
        try{
          // Con los dos campos vacíos se enseña un texto de muestra,
          // para que la rejilla no salga toda igual antes de escribir.
          const a = top || (bot ? "" : "TU TEXTO");
          const b = bot || (top ? "" : "AQUÍ ABAJO");
          drawPieces(cx, c.style.build(doc.w, doc.h, a, b), s);
        }catch(err){ console.error("[meme]", c.id, err); }
      }
    });
  };

  inTop.addEventListener("input", repintar);
  inBot.addEventListener("input", repintar);
  marcar();
  note.textContent = STYLES[0].note;
  repintar();

  const res = await dialog({
    title: "Crear meme", wide: true, body: wrap,
    buttons: [{ label:"Cancelar", value:null }, { label:"Crear", primary:true, value:"go" }]
  });
  if(res !== "go") return;

  const top = inTop.value.trim();
  const bottom = inBot.value.trim();
  if(!top && !bottom){ toast("Escribe al menos un texto"); return; }

  buildMeme(picked, top, bottom);
  toast("Meme creado: el texto sigue siendo editable", "ok");
}
