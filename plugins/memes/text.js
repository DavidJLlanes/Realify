/* ═══════════════════════════════════════════════════════════════
   MEMES · DIBUJO DE TEXTO
   Un texto se compone en un lienzo propio, en sus coordenadas locales
   (sin girar), por capas de atrás hacia delante:

     fondo (rectángulo, píldora, bocadillo…) → relieve 3D → contorno
     exterior → contorno → relleno (color o degradado)

   y después se pega en el destino, girado alrededor de su centro, con
   el brillo, la sombra y el glitch. Las sombras del lienzo 2D no giran
   con la transformación, así que la sombra siempre cae hacia donde
   dice su dirección, gire el texto como gire.

   Vista previa y resultado usan esta misma función; sólo cambia
   `scale` (píxeles de destino por píxel del meme a tamaño real).
   ═══════════════════════════════════════════════════════════════ */

import { fontStack } from "./fonts.js";

const make = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const rad = d => d * Math.PI / 180;
const rgba = (hex, a) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

export const fontCss = (t, px) => `${t.italic ? "italic " : ""}${t.bold ? 700 : 400} ${px}px ${fontStack(t.font)}`;

/* Parte el texto en líneas que quepan en `maxW` (respeta los saltos
   de línea escritos a mano). */
function wrap(ctx, text, maxW, tracking){
  const width = s => ctx.measureText(s).width + Math.max(0, s.length - 1) * tracking;
  const out = [];
  for(const para of String(text).split("\n")){
    const words = para.split(/\s+/).filter(Boolean);
    if(!words.length){ out.push(""); continue; }
    let line = "";
    for(const w of words){
      const probe = line ? `${line} ${w}` : w;
      if(!line || width(probe) <= maxW) line = probe;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.map(s => ({ s, w: width(s) }));
}

/* Recorre los glifos de todas las líneas y llama a `fn(ch, x, y, a)`
   con su posición (y ángulo si la línea va curvada). */
function glyphs(ctx, lines, t, px, boxW, lh, top, fn){
  const tracking = t.tracking / 100 * px;
  const bend = t.curve / 100 * Math.PI;   // arco total de la línea más larga
  const longest = Math.max(1, ...lines.map(l => l.w));
  lines.forEach((line, i) => {
    const baseY = top + lh * i + lh / 2;
    const start = t.align === "left" ? 0 : t.align === "right" ? boxW - line.w : (boxW - line.w) / 2;
    if(!bend){
      if(!tracking){ fn(line.s, start, baseY, 0, "whole"); return; }
      let x = start;
      for(const ch of line.s){ fn(ch, x, baseY, 0); x += ctx.measureText(ch).width + tracking; }
      return;
    }
    // Curva: la línea se enrolla en un arco. Positivo = sonrisa hacia
    // abajo (arco), negativo = hacia arriba.
    const R = longest / Math.abs(bend), sign = Math.sign(bend);
    const cx = boxW / 2, cy = baseY + sign * R;
    let x = start;
    for(const ch of line.s){
      const cw = ctx.measureText(ch).width;
      const a = ((x + cw / 2) - boxW / 2) / R;
      fn(ch, cx + Math.sin(a) * R, cy - sign * Math.cos(a) * R, sign * a, "center");
      x += cw + tracking;
    }
  });
}

function bgPath(ctx, shape, x, y, w, h, r, px){
  ctx.beginPath();
  if(shape === "rect"){ ctx.rect(x, y, w, h); return; }
  if(shape === "round"){ ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); return; }
  if(shape === "pill"){ ctx.roundRect(x, y, w, h, h / 2); return; }
  if(shape === "highlight"){
    // Trazo de subrayador: bandas algo irregulares por detrás de cada renglón
    ctx.moveTo(x, y + h * .12); ctx.lineTo(x + w, y); ctx.lineTo(x + w * .99, y + h); ctx.lineTo(x + w * .01, y + h * .95); ctx.closePath(); return;
  }
  if(shape === "bubble" || shape === "thought"){
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
}

/**
 * Compone el texto `t` para un lienzo de meme de `W`×`H` píxeles.
 * Devuelve { canvas, cx, cy } en píxeles de destino (ya escalados), o
 * null si no hay nada que dibujar.
 */
export function renderText(t, W, H, scale = 1){
  const px = t.size / 1000 * W * scale;
  if(px < 1 || !String(t.text).trim()) return null;
  const boxW = t.w / 100 * W * scale;
  const probe = make(1, 1).getContext("2d");
  probe.font = fontCss(t, px);
  const tracking = t.tracking / 100 * px;
  const text = t.caps ? String(t.text).toUpperCase() : String(t.text);
  const lines = wrap(probe, text, boxW, tracking);
  const lh = px * t.lineHeight / 100;
  const blockH = lh * lines.length;
  const s1 = t.stroke / 100 * px, s2 = t.stroke2 / 100 * px;
  const ex = t.extrude / 100 * px;
  const bgOn = t.bgShape !== "none" && t.bgOpacity > 0;
  const bp = bgOn ? t.bgPad / 100 * px : 0;
  const curveExtra = t.curve ? Math.abs(t.curve) / 100 * Math.max(...lines.map(l => l.w)) * .4 : 0;
  const bubbleExtra = t.bgShape === "bubble" || t.bgShape === "thought" ? .25 : 0;
  const margin = s1 + s2 + ex + bp * (1 + bubbleExtra) + px * .3 + curveExtra + (bubbleExtra ? px * 1.2 : 0);
  const cw = boxW + margin * 2, ch = blockH + margin * 2;
  const canvas = make(cw, ch), ctx = canvas.getContext("2d");
  ctx.font = fontCss(t, px);
  ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
  const ox = margin, oy = margin;

  // Fondo
  if(bgOn){
    const used = Math.max(...lines.map(l => l.w));
    const left = t.align === "left" ? 0 : t.align === "right" ? boxW - used : (boxW - used) / 2;
    let bx = ox + left - bp, by = oy - bp, bw = used + bp * 2, bh = blockH + bp * 2;
    if(t.bgShape === "bubble" || t.bgShape === "thought"){ bx -= bp * .25; by -= bp * .25; bw += bp * .5; bh += bp * .5; }
    ctx.save();
    ctx.globalAlpha = t.bgOpacity / 100; ctx.fillStyle = t.bgColor;
    if(t.bgShape === "highlight"){
      lines.forEach((l, i) => {
        const lx = ox + (t.align === "left" ? 0 : t.align === "right" ? boxW - l.w : (boxW - l.w) / 2);
        bgPath(ctx, "highlight", lx - bp * .6, oy + lh * i + lh * .18, l.w + bp * 1.2, lh * .7, 0, px); ctx.fill();
      });
    } else {
      bgPath(ctx, t.bgShape, bx, by, bw, bh, t.bgRadius / 100 * px, px); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.lineWidth = Math.max(1, px * .06);
      if(t.bgShape === "bubble" || t.bgShape === "thought") ctx.stroke();
      if(t.bgShape === "bubble"){
        // Rabito del bocadillo, hacia abajo a la izquierda
        const tx = bx + bw * .28, ty = by + bh * .92;
        ctx.beginPath(); ctx.moveTo(tx - bw * .06, ty - bh * .04); ctx.lineTo(tx - bw * .14, ty + bh * .32); ctx.lineTo(tx + bw * .08, ty - bh * .02); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx - bw * .055, ty - bh * .06); ctx.lineTo(tx + bw * .075, ty - bh * .045); ctx.lineWidth = Math.max(2, px * .1); ctx.strokeStyle = t.bgColor; ctx.stroke();
      } else if(t.bgShape === "thought"){
        for(const [k, r] of [[.25, .07], [.1, .045]]){
          ctx.beginPath(); ctx.arc(bx + bw * (.22 - k * .4), by + bh * (1 + k * .9), bh * r * 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  const drawAll = (mode, dx = 0, dy = 0) => glyphs(ctx, lines, t, px, boxW, lh, oy, (s, x, y, a, anchor) => {
    ctx.save();
    ctx.translate(ox + x + dx, y + dy);
    if(a) ctx.rotate(a);
    ctx.textAlign = anchor === "center" ? "center" : "left";
    if(mode === "fill") ctx.fillText(s, 0, 0); else ctx.strokeText(s, 0, 0);
    ctx.restore();
  });

  // Relieve 3D: copias apiladas hacia la dirección elegida
  if(ex > 0){
    const a = rad(t.extrudeAngle), steps = Math.max(2, Math.ceil(ex));
    ctx.fillStyle = t.extrudeColor; ctx.strokeStyle = t.extrudeColor; ctx.lineWidth = s1 * 2;
    for(let i = steps; i >= 1; i--){
      const d = ex * i / steps, dx = Math.cos(a) * d, dy = Math.sin(a) * d;
      if(s1 > 0) drawAll("stroke", dx, dy);
      drawAll("fill", dx, dy);
    }
  }
  if(s2 > 0){ ctx.strokeStyle = t.stroke2Color; ctx.lineWidth = (s1 + s2) * 2; drawAll("stroke"); }
  if(s1 > 0){ ctx.strokeStyle = t.strokeColor; ctx.lineWidth = s1 * 2; drawAll("stroke"); }
  if(t.fill === "gradient"){
    const a = rad(t.gradAngle - 90), cxm = cw / 2, cym = oy + blockH / 2;
    const len = Math.abs(Math.cos(a)) * boxW / 2 + Math.abs(Math.sin(a)) * blockH / 2;
    const g = ctx.createLinearGradient(cxm - Math.cos(a) * len, cym - Math.sin(a) * len, cxm + Math.cos(a) * len, cym + Math.sin(a) * len);
    g.addColorStop(0, t.color); g.addColorStop(1, t.color2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = t.color;
  drawAll("fill");

  return { canvas, cx: t.x / 100 * W * scale, cy: t.y / 100 * H * scale, px, w: cw, h: ch };
}

/* Tinte plano de un lienzo (para el glitch) */
function tinted(src, color){
  const c = make(src.width, src.height), x = c.getContext("2d");
  x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Pega un texto ya compuesto en `ctx` con giro, brillo, sombra y glitch. */
export function drawText(ctx, t, r){
  if(!r) return;
  const { canvas, cx, cy, px } = r;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad(t.rot));
  ctx.globalAlpha = t.opacity / 100;
  const x = -canvas.width / 2, y = -canvas.height / 2;
  if(t.glitch > 0){
    const g = t.glitch / 100 * px * .12;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = t.opacity / 100 * .8;
    ctx.drawImage(tinted(canvas, "#ff0040"), x - g, y);
    ctx.drawImage(tinted(canvas, "#00e5ff"), x + g, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = t.opacity / 100;
  }
  if(t.glow > 0){
    ctx.save();
    ctx.shadowColor = t.glowColor; ctx.shadowBlur = t.glow / 100 * px * .9;
    ctx.drawImage(canvas, x, y); ctx.drawImage(canvas, x, y);
    ctx.restore();
  }
  if(t.shadow > 0){
    ctx.save();
    const d = t.shadow / 100 * px, a = rad(t.shadowAngle);
    ctx.shadowColor = rgba(t.shadowColor, t.shadowOpacity / 100);
    ctx.shadowBlur = t.shadowBlur / 100 * px * .6;
    ctx.shadowOffsetX = Math.cos(a) * d; ctx.shadowOffsetY = Math.sin(a) * d;
    ctx.drawImage(canvas, x, y);
    ctx.restore();
  }
  ctx.drawImage(canvas, x, y);
  ctx.restore();
}

/** Cuadro del texto en píxeles de destino, para la selección y el toque. */
export function textBox(t, r){
  return { cx: r.cx, cy: r.cy, w: r.w, h: r.h, rot: rad(t.rot) };
}
