/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · CAPAS DIBUJADAS
   Todo lo que tiene FORMA —polvo, pelusas, arañazos, manchas, grietas,
   marcas de instantánea, bordes y sello de fecha— se dibuja con el
   lienzo 2D en tres capas que el shader compone al final:

     · burn  (negro + alfa)  → oscurece: polvo oscuro, grietas
     · dodge (blanco + alfa) → aclara: polvo claro, arañazos
     · paint (color + alfa)  → mezcla normal: manchas, marcas de
                               instantánea, bordes y sello de fecha

   La geometría se genera UNA vez por semilla y tamaño de imagen, en
   coordenadas de la imagen a resolución completa. Cada capa se dibuja
   después para una región cualquiera (la imagen entera en la vista
   previa, una tesela al aceptar) aplicando sólo una transformación:
   por eso la vista previa y el resultado final coinciden.

   Las cantidades deciden la DENSIDAD —cada elemento tiene un rango
   aleatorio y sólo aparece si su rango queda por debajo de la
   cantidad— y la opacidad.
   ═══════════════════════════════════════════════════════════════ */

/* Generador determinista (mulberry32). */
export function rng(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { drawFrame } from "./frames.js";

const cache = new Map();

function geometry(seed, W, H){
  const key = `${seed}:${W}:${H}`;
  if(cache.has(key)) return cache.get(key);
  const L = Math.max(W, H);
  const R = rng(seed * 2654435761);
  const r = (a = 0, b = 1) => a + (b - a) * R();

  const dust = [];
  for(let i = 0; i < 520; i++){
    const hair = R() < 0.22;
    const x = r(0, W), y = r(0, H), len = L * r(0.008, 0.05), ang = r(0, Math.PI * 2);
    dust.push({
      rank: R(), light: R() < 0.55, hair, x, y,
      size: L * (0.00035 + 0.0024 * Math.pow(R(), 3)),
      width: L * r(0.0003, 0.0008), opacity: r(0.35, 1),
      p1: [x + Math.cos(ang) * len * 0.35 + r(-1, 1) * len * 0.3, y + Math.sin(ang) * len * 0.35 + r(-1, 1) * len * 0.3],
      p2: [x + Math.cos(ang) * len * 0.7 + r(-1, 1) * len * 0.3, y + Math.sin(ang) * len * 0.7 + r(-1, 1) * len * 0.3],
      p3: [x + Math.cos(ang) * len, y + Math.sin(ang) * len]
    });
  }

  const scratches = [];
  for(let i = 0; i < 14; i++){
    const full = R() < 0.7, y0 = full ? -10 : r(0, H * 0.6);
    scratches.push({
      rank: R(), light: R() < 0.75, x: r(0.03, 0.97) * W, y0, y1: full ? H + 10 : y0 + r(0.2, 0.6) * H,
      width: L * r(0.0003, 0.0011), wobble: L * r(0.0005, 0.003), freq: r(1, 4), phase: r(0, 6.28),
      opacity: r(0.3, 0.85)
    });
  }

  const stains = [];
  for(let i = 0; i < 26; i++){
    const drip = R() < 0.35;
    stains.push({
      rank: R(), drip, x: r(0, W), y: drip ? r(-0.05, 0.3) * H : r(0, H),
      radius: L * r(0.012, 0.07), len: H * r(0.15, 0.55), width: L * r(0.006, 0.02),
      hue: R(), wobble: Array.from({ length: 24 }, () => r(0.82, 1.12))
    });
  }

  const cracks = [];
  for(let i = 0; i < 34; i++){
    const segs = [];
    const walk = (x, y, ang, n, depth) => {
      for(let k = 0; k < n; k++){
        const step = L * r(0.003, 0.009);
        ang += r(-0.55, 0.55);
        const nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
        segs.push([x, y, nx, ny, depth]);
        x = nx; y = ny;
        if(depth < 2 && R() < 0.1) walk(x, y, ang + r(-1.4, 1.4), Math.floor(n * r(0.3, 0.6)), depth + 1);
      }
    };
    walk(r(0, W), r(0, H), r(0, Math.PI * 2), Math.floor(r(18, 60)), 0);
    cracks.push({ rank: R(), segs, opacity: r(0.45, 1) });
  }

  const instant = [];
  const corners = [[0, 0], [W, 0], [0, H], [W, H]];
  for(let i = 0; i < 7; i++){
    const [cx, cy] = corners[Math.floor(R() * 4)];
    instant.push({
      rank: R(), x: cx + (cx ? -1 : 1) * r(0, 0.08) * W, y: cy + (cy ? -1 : 1) * r(0, 0.08) * H,
      radius: L * r(0.05, 0.16), color: Math.floor(R() * 4),
      wobble: Array.from({ length: 32 }, () => r(0.6, 1.15))
    });
  }
  const edgeBand = { side: R() < 0.5 ? "bottom" : "top", wobble: Array.from({ length: 48 }, () => r(0.3, 1)) };

  const deckle = Array.from({ length: 4 }, () => Array.from({ length: 160 }, () => r(-1, 1)));
  const frameNo = 1 + Math.floor(R() * 35);

  const g = { L, dust, scratches, stains, cracks, instant, edgeBand, deckle, frameNo };
  if(cache.size > 8) cache.clear();
  cache.set(key, g);
  return g;
}

/* Claves de los modificadores que se dibujan aquí: si ninguno cambia,
   no hace falta redibujar las capas. */
export const OVERLAY_KEYS = ["dust", "scratches", "stains", "cracks", "instant", "filmBorder", "paperBorder", "dateStamp", "frameWidth"];
export const overlayKey = s => OVERLAY_KEYS.map(k => s[k]).join(",") + "|" + s.seed + "|" + (s.date || "") + "|" + (s.frame || "");

const prep = (ctx, region) => {
  const c = ctx.canvas, sx = c.width / region.w, sy = c.height / region.h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.setTransform(sx, 0, 0, sy, -region.x * sx, -region.y * sy);
  return Math.min(sx, sy);
};

/* Contorno irregular: `wob` son radios relativos alrededor del centro. */
const blob = (ctx, x, y, radius, wob) => {
  ctx.beginPath();
  for(let i = 0; i <= wob.length; i++){
    const a = i / wob.length * Math.PI * 2, rr = radius * wob[i % wob.length];
    if(i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
};

/* ── Dígitos de siete segmentos del sello de fecha ── */
const SEG = { "0":"abcdef","1":"bc","2":"abged","3":"abgcd","4":"fgbc","5":"afgcd","6":"afgedc","7":"abc","8":"abcdefg","9":"abcdfg" };
function drawSevenSeg(ctx, text, x, y, h){
  const w = h * 0.52, t = h * 0.12, gap = h * 0.22;
  const segRect = { a:[t*0.6,0,w-t*1.2,t], d:[t*0.6,h-t,w-t*1.2,t], g:[t*0.6,h/2-t/2,w-t*1.2,t],
                    f:[0,t*0.6,t,h/2-t*0.9], b:[w-t,t*0.6,t,h/2-t*0.9], e:[0,h/2+t*0.3,t,h/2-t*0.9], c:[w-t,h/2+t*0.3,t,h/2-t*0.9] };
  let cx = x;
  for(const ch of text){
    if(ch === " "){ cx += w * 0.55; continue; }
    if(ch === "'"){ ctx.fillRect(cx, y, t, h * 0.28); cx += t + gap * 0.6; continue; }
    const segs = SEG[ch]; if(!segs){ cx += w + gap; continue; }
    for(const s of segs){ const [sx, sy, sw, sh] = segRect[s]; ctx.fillRect(cx + sx, y + sy, sw, sh); }
    cx += w + gap;
  }
  return cx - x;
}
function sevenSegWidth(text, h){
  const w = h * 0.52, t = h * 0.12, gap = h * 0.22;
  let n = 0;
  for(const ch of text) n += ch === " " ? w * 0.55 : ch === "'" ? t + gap * 0.6 : w + gap;
  return n;
}

/**
 * Dibuja las tres capas para `region` (en píxeles de la imagen
 * completa W×H). `ctxs` = { burn, dodge, paint }, cada uno ya con el
 * tamaño en píxeles de salida que se quiera.
 */
export function drawOverlays(ctxs, W, H, region, s){
  const g = geometry(s.seed, W, H), L = g.L;
  for(const c of [ctxs.burn, ctxs.dodge, ctxs.paint]) prep(c, region);
  const { burn, dodge, paint } = ctxs;

  // Polvo y pelusas
  const dust = s.dust / 100;
  if(dust > 0){
    for(const d of g.dust){
      if(d.rank > dust) continue;
      const ctx = d.light ? dodge : burn;
      const a = d.opacity * (0.35 + 0.65 * dust);
      ctx.globalAlpha = a;
      if(d.hair){
        ctx.strokeStyle = d.light ? "#fff" : "#000";
        ctx.lineWidth = d.width; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.bezierCurveTo(...d.p1, ...d.p2, ...d.p3); ctx.stroke();
      } else {
        ctx.fillStyle = d.light ? "#fff" : "#000";
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Arañazos de arrastre
  const scr = s.scratches / 100;
  if(scr > 0){
    for(const k of g.scratches){
      if(k.rank > scr) continue;
      const ctx = k.light ? dodge : burn;
      ctx.globalAlpha = k.opacity * (0.4 + 0.6 * scr);
      ctx.strokeStyle = k.light ? "#fff" : "#000"; ctx.lineWidth = k.width; ctx.lineCap = "butt";
      ctx.beginPath();
      const steps = 60;
      for(let i = 0; i <= steps; i++){
        const t = i / steps, y = k.y0 + (k.y1 - k.y0) * t;
        const x = k.x + Math.sin(t * k.freq * 6.283 + k.phase) * k.wobble;
        if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Craquelado: línea oscura con un filo claro al lado
  const cr = s.cracks / 100;
  if(cr > 0){
    for(const c of g.cracks){
      if(c.rank > cr) continue;
      for(const [ctx, dx, col, a] of [[burn, 0, "#000", 0.75], [dodge, L * 0.0006, "#fff", 0.35]]){
        ctx.globalAlpha = c.opacity * a * (0.4 + 0.6 * cr);
        ctx.strokeStyle = col; ctx.lineCap = "round";
        for(const [x0, y0, x1, y1, depth] of c.segs){
          ctx.lineWidth = L * (0.0007 - depth * 0.00018);
          ctx.beginPath(); ctx.moveTo(x0 + dx, y0 + dx); ctx.lineTo(x1 + dx, y1 + dx); ctx.stroke();
        }
      }
    }
  }
  burn.globalAlpha = dodge.globalAlpha = 1;

  // Manchas químicas: gotas secas (anillo) y escurridos
  const st = s.stains / 100;
  if(st > 0){
    for(const m of g.stains){
      if(m.rank > st) continue;
      const col = m.hue < 0.5 ? [120, 88, 40] : m.hue < 0.8 ? [150, 130, 60] : [90, 70, 60];
      const a = 0.22 + 0.4 * st;
      if(m.drip){
        const grad = paint.createLinearGradient(0, m.y, 0, m.y + m.len);
        grad.addColorStop(0, `rgba(${col},${a})`); grad.addColorStop(0.8, `rgba(${col},${a * 0.5})`); grad.addColorStop(1, `rgba(${col},0)`);
        paint.fillStyle = grad;
        paint.beginPath();
        paint.moveTo(m.x - m.width / 2, m.y);
        paint.quadraticCurveTo(m.x - m.width * 0.8, m.y + m.len * 0.6, m.x, m.y + m.len);
        paint.quadraticCurveTo(m.x + m.width * 0.8, m.y + m.len * 0.6, m.x + m.width / 2, m.y);
        paint.closePath(); paint.fill();
      } else {
        const grad = paint.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
        grad.addColorStop(0, `rgba(${col},${a * 0.25})`); grad.addColorStop(0.85, `rgba(${col},${a * 0.35})`);
        grad.addColorStop(0.97, `rgba(${col.map(v => v * 0.7)},${a})`); grad.addColorStop(1, `rgba(${col},0)`);
        paint.fillStyle = grad;
        blob(paint, m.x, m.y, m.radius, m.wobble); paint.fill();
      }
    }
  }

  // Marcas de revelado instantáneo: manchas en las esquinas y una
  // franja irregular donde se extiende la pasta química
  const ins = s.instant / 100;
  if(ins > 0){
    const COLORS = [[255, 214, 120], [110, 190, 205], [255, 250, 238], [205, 120, 70]];
    for(const m of g.instant){
      if(m.rank > ins) continue;
      const col = COLORS[m.color], a = 0.35 + 0.5 * ins;
      const grad = paint.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
      grad.addColorStop(0, `rgba(${col},${a})`); grad.addColorStop(0.6, `rgba(${col},${a * 0.6})`); grad.addColorStop(1, `rgba(${col},0)`);
      paint.fillStyle = grad; blob(paint, m.x, m.y, m.radius, m.wobble); paint.fill();
    }
    const band = g.edgeBand, depth = L * 0.04 * ins, top = band.side === "top";
    const grad = paint.createLinearGradient(0, top ? 0 : H, 0, top ? depth * 1.6 : H - depth * 1.6);
    grad.addColorStop(0, `rgba(250,235,200,${0.75 * ins})`); grad.addColorStop(1, "rgba(250,235,200,0)");
    paint.fillStyle = grad; paint.beginPath();
    paint.moveTo(0, top ? 0 : H);
    band.wobble.forEach((v, i) => { const x = W * i / (band.wobble.length - 1), d = depth * v; paint.lineTo(x, top ? d : H - d); });
    paint.lineTo(W, top ? 0 : H); paint.closePath(); paint.fill();
  }

  // Sello de fecha (antes que los bordes: se imprime sobre la imagen)
  const ds = s.dateStamp / 100;
  if(ds > 0 && s.date){
    const h = L * 0.032;
    const inset = L * 0.045 + (s.filmBorder > 0 ? L * (0.015 + 0.05 * s.filmBorder / 100) * 1.7 : 0)
                            + (s.paperBorder > 0 ? L * (0.012 + 0.06 * s.paperBorder / 100) : 0);
    const text = s.date, tw = sevenSegWidth(text, h);
    paint.save();
    paint.translate(W - inset - tw, H - inset - h);
    paint.transform(1, 0, -0.08, 1, 0, 0);
    paint.globalAlpha = 0.35 + 0.65 * ds;
    paint.shadowColor = `rgba(255,80,10,${0.9 * ds})`; paint.shadowBlur = h * 0.35;
    paint.fillStyle = "rgb(255,138,36)";
    drawSevenSeg(paint, text, 0, 0, h);
    paint.shadowBlur = 0; paint.fillStyle = "rgba(255,210,150,0.55)";
    drawSevenSeg(paint, text, 0, 0, h);
    paint.restore();
  }

  // Bordes de papel baritado cortado a mano
  const pb = s.paperBorder / 100;
  if(pb > 0){
    const m = L * (0.012 + 0.06 * pb), jag = Math.max(m * 0.14, L * 0.0015);
    paint.fillStyle = "rgb(243,238,226)";
    paint.beginPath();
    paint.rect(-2, -2, W + 4, H + 4);
    const edge = (x0, y0, x1, y1, noise) => {
      const n = noise.length;
      for(let i = 0; i < n; i++){
        const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const nx = -(y1 - y0), ny = x1 - x0, len = Math.hypot(nx, ny) || 1;
        paint.lineTo(x + nx / len * noise[i] * jag, y + ny / len * noise[i] * jag);
      }
    };
    paint.moveTo(m, m);
    edge(m, m, W - m, m, g.deckle[0]); edge(W - m, m, W - m, H - m, g.deckle[1]);
    edge(W - m, H - m, m, H - m, g.deckle[2]); edge(m, H - m, m, m, g.deckle[3]);
    paint.closePath();
    paint.fill("evenodd");
    paint.strokeStyle = "rgba(60,50,35,0.18)"; paint.lineWidth = L * 0.0008;
    paint.beginPath(); paint.moveTo(m, m);
    edge(m, m, W - m, m, g.deckle[0]); edge(W - m, m, W - m, H - m, g.deckle[1]);
    edge(W - m, H - m, m, H - m, g.deckle[2]); edge(m, H - m, m, m, g.deckle[3]);
    paint.stroke();
  }

  // Bordes de película de 35 mm: marco negro, perforaciones y rótulos
  const fb = s.filmBorder / 100;
  if(fb > 0){
    const landscape = W >= H;
    paint.save();
    // Se dibuja siempre como si la foto fuera horizontal; en vertical
    // se gira el sistema de coordenadas.
    let w = W, h = H;
    if(!landscape){ paint.translate(W, 0); paint.rotate(Math.PI / 2); w = H; h = W; }
    const t = L * (0.015 + 0.05 * fb), band = t * 1.7, side = t * 0.8, rad = t * 0.35;
    paint.fillStyle = "rgb(14,12,10)";
    paint.beginPath(); paint.rect(-2, -2, w + 4, h + 4);
    const x0 = side, y0 = band, x1 = w - side, y1 = h - band;
    paint.moveTo(x0 + rad, y0); paint.arcTo(x1, y0, x1, y1, rad); paint.arcTo(x1, y1, x0, y1, rad);
    paint.arcTo(x0, y1, x0, y0, rad); paint.arcTo(x0, y0, x1, y0, rad); paint.closePath();
    paint.fill("evenodd");
    // Perforaciones (dejan pasar la luz del escáner)
    const hw = band * 0.28, hh = band * 0.36, pitch = band * 0.62;
    paint.fillStyle = "rgb(236,228,210)";
    for(const yy of [band * 0.14, h - band * 0.14 - hh]){
      for(let x = pitch * 0.4; x < w; x += pitch){
        paint.beginPath(); paint.roundRect(x, yy, hw, hh, hw * 0.25); paint.fill();
      }
    }
    // Rótulos del borde, genéricos
    paint.fillStyle = "rgba(245,170,60,0.92)";
    paint.font = `bold ${band * 0.24}px monospace`; paint.textBaseline = "middle";
    const ty = h - band * 0.72, ty2 = band * 0.72;
    for(let x = w * 0.06, i = 0; x < w * 0.95; x += w * 0.34, i++){
      paint.fillText(i % 2 ? `${g.frameNo}A ▶` : "SAFETY FILM 400", x, ty);
      paint.fillText(i % 2 ? "SAFETY FILM 400" : `▶ ${g.frameNo}`, x + w * 0.12, ty2);
    }
    paint.restore();
  }
  paint.globalAlpha = 1;

  // Marco elegido en el desplegable «Marco» (frames.js), encima de todo
  drawFrame(paint, W, H, s);
}

/* Texto del sello: «'98 7 14». */
export function dateText(ms){
  const d = new Date(Number.isFinite(ms) ? ms : Date.now());
  return `'${String(d.getFullYear() % 100).padStart(2, "0")} ${d.getMonth() + 1} ${d.getDate()}`;
}
