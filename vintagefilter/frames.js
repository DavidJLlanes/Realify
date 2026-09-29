/* ═══════════════════════════════════════════════════════════════
   FILTRO VINTAGE · MARCOS
   Más de cien marcos dibujados con el lienzo 2D, en coordenadas de la
   imagen completa (como el resto de overlays.js): la vista previa, cada
   tesela del resultado y la miniatura del selector salen del mismo
   dibujo. Van en la capa «paint», que el shader compone al final, así
   que los virados y dominantes del filtro no tiñen el marco.

   El marco se pinta ENCIMA de la foto (cubre sus bordes), no la reduce:
   el tamaño del documento no cambia y el filtro sigue siendo una capa
   reeditable. «Anchura del marco» (0-100) lo ensancha hasta ×2,2.

   Todo lo aleatorio (texturas de papel, bordes rasgados, quemaduras…)
   sale de la semilla del filtro: el botón ⚄ da otra variación.
   ═══════════════════════════════════════════════════════════════ */

import { rng } from "./overlays.js";

const TAU = Math.PI * 2;

/* ── utilidades de dibujo ─────────────────────────────────────── */
const px = c => { const t = c.getTransform(); return Math.hypot(t.a, t.b) || 1; };   // escala a píxeles de salida
const outer = (c, W, H) => c.rect(-4, -4, W + 8, H + 8);
const rr = (c, x, y, w, h, r = 0) => { if(r > 0 && c.roundRect) c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else c.rect(x, y, w, h); };
/* Rellena todo menos la ventana. */
function band(c, W, H, fill, x, y, w, h, r = 0){
  c.beginPath(); outer(c, W, H); rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill("evenodd");
}
/* Recorte a la zona del marco (fuera de la ventana) para texturas. */
function clipFrame(c, W, H, x, y, w, h, r = 0){ c.beginPath(); outer(c, W, H); rr(c, x, y, w, h, r); c.clip("evenodd"); }
function clipWin(c, x, y, w, h, r = 0){ c.beginPath(); rr(c, x, y, w, h, r); c.clip(); }
/* Sombra interior del marco sobre la foto (relieve). */
function innerShadow(c, W, H, x, y, w, h, r, blur, alpha){
  c.save(); clipWin(c, x, y, w, h, r);
  c.shadowColor = `rgba(0,0,0,${alpha})`; c.shadowBlur = blur * px(c);
  c.beginPath(); outer(c, W, H); rr(c, x, y, w, h, r); c.fillStyle = "#000"; c.fill("evenodd");
  c.restore();
}
/* Motas de textura (papel, cartón, óxido) */
function speckle(c, R, x, y, w, h, n, color, s0, s1, a0 = 0.15, a1 = 0.5){
  c.fillStyle = color;
  for(let i = 0; i < n; i++){
    c.globalAlpha = a0 + (a1 - a0) * R();
    const s = s0 + (s1 - s0) * R() ** 2;
    c.fillRect(x + R() * w, y + R() * h, s, s);
  }
  c.globalAlpha = 1;
}
/* Fibras (papel hecho a mano, lino) */
function fibers(c, R, x, y, w, h, n, color, len, lw){
  c.strokeStyle = color; c.lineWidth = lw;
  for(let i = 0; i < n; i++){
    const x0 = x + R() * w, y0 = y + R() * h, a = R() * TAU, l = len * (0.4 + R());
    c.globalAlpha = 0.08 + 0.18 * R();
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + Math.cos(a + 0.6) * l / 2, y0 + Math.sin(a + 0.6) * l / 2, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); c.stroke();
  }
  c.globalAlpha = 1;
}
/* Marco biselado: cuatro trapecios con degradado perpendicular (moldura). */
function bevel(c, W, H, x, y, w, h, stops, light = 0.18){
  const sides = [
    [[0, 0], [W, 0], [x + w, y], [x, y], [0, 0, 0, y], light],
    [[0, H], [W, H], [x + w, y + h], [x, y + h], [0, H, 0, y + h], -light],
    [[0, 0], [0, H], [x, y + h], [x, y], [0, 0, x, 0], light * 0.5],
    [[W, 0], [W, H], [x + w, y + h], [x + w, y], [W, 0, x + w, 0], -light * 0.5]
  ];
  for(const [a, b, d, e, g, lit] of sides){
    const grad = c.createLinearGradient(...g);
    for(const [p, col] of stops) grad.addColorStop(p, col);
    c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath();
    c.fillStyle = grad; c.fill();
    c.fillStyle = lit > 0 ? `rgba(255,255,255,${lit})` : `rgba(0,0,0,${-lit})`; c.fill();
  }
}
/* Contorno de la ventana con el borde perturbado por `f(t)` (0..1 a lo
   largo del perímetro → desplazamiento hacia dentro, en píxeles). */
function wobblyWin(c, x, y, w, h, f, steps = 240){
  const per = 2 * (w + h);
  for(let i = 0; i <= steps; i++){
    const d = i / steps * per;
    let X, Y, nx, ny;
    if(d < w){ X = x + d; Y = y; nx = 0; ny = 1; }
    else if(d < w + h){ X = x + w; Y = y + d - w; nx = -1; ny = 0; }
    else if(d < 2 * w + h){ X = x + w - (d - w - h); Y = y + h; nx = 0; ny = -1; }
    else { X = x; Y = y + h - (d - 2 * w - h); nx = 1; ny = 0; }
    const o = f(i / steps, d);
    if(i) c.lineTo(X + nx * o, Y + ny * o); else c.moveTo(X + nx * o, Y + ny * o);
  }
  c.closePath();
}
function wobblyBand(c, W, H, fill, x, y, w, h, f, steps){
  c.beginPath(); outer(c, W, H); wobblyWin(c, x, y, w, h, f, steps); c.fillStyle = fill; c.fill("evenodd");
}
/* Ruido suave 1D determinista (para bordes rasgados y quemados) */
function noise1(R, n = 64){ const v = Array.from({ length: n }, () => R() * 2 - 1); return t => { const p = (t % 1 + 1) % 1 * n, i = Math.floor(p), f = p - i, s = f * f * (3 - 2 * f); return v[i % n] * (1 - s) + v[(i + 1) % n] * s; }; }
const fbm = (R, oct = 4) => { const ns = Array.from({ length: oct }, (_, k) => noise1(R, 16 << k)); return t => ns.reduce((a, n, k) => a + n(t) / (1 << k), 0) / 1.9; };
/* Cinta adhesiva semitransparente con los extremos dentados */
function tape(c, R, cx, cy, len, wid, ang, color, alpha = 0.55){
  c.save(); c.translate(cx, cy); c.rotate(ang);
  c.beginPath(); c.moveTo(-len / 2, -wid / 2);
  for(let i = 1; i <= 8; i++) c.lineTo(-len / 2 + (R() - 0.5) * wid * 0.12, -wid / 2 + wid * i / 8);
  c.lineTo(len / 2, wid / 2);
  for(let i = 7; i >= 0; i--) c.lineTo(len / 2 + (R() - 0.5) * wid * 0.12, -wid / 2 + wid * i / 8);
  c.closePath();
  c.globalAlpha = alpha; c.fillStyle = color; c.fill();
  c.globalAlpha = alpha * 0.35; c.fillStyle = "#fff"; c.fillRect(-len / 2, -wid / 2, len, wid * 0.18);
  c.globalAlpha = 1; c.restore();
}
/* Esquina de álbum (triángulo que sujeta la foto) */
function albumCorner(c, x, y, s, dx, dy, color, shine = "rgba(255,255,255,.25)"){
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * s, y); c.lineTo(x, y + dy * s); c.closePath();
  c.fillStyle = color; c.fill();
  c.beginPath(); c.moveTo(x + dx * s * 0.15, y + dy * s * 0.15); c.lineTo(x + dx * s * 0.8, y + dy * s * 0.15); c.lineWidth = s * 0.04; c.strokeStyle = shine; c.stroke();
}
/* Garabato de «escrito a mano» (sin letras reales) */
function scribble(c, R, x, y, w, h, color, lw){
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = "round"; c.lineJoin = "round";
  let cx = x;
  const baseY = y + h * 0.65;
  c.beginPath(); c.moveTo(cx, baseY);
  while(cx < x + w){
    const step = h * (0.18 + R() * 0.22), up = h * (0.25 + R() * 0.55);
    c.bezierCurveTo(cx + step * 0.3, baseY - up, cx + step * 0.7, baseY - up * (R() < 0.3 ? 1.4 : 0.6), cx + step, baseY + (R() - 0.5) * h * 0.1);
    cx += step;
    if(R() < 0.18){ c.moveTo(cx + h * 0.35, baseY); cx += h * 0.35; }
  }
  c.stroke();
}
/* Etiqueta de texto discreta */
function label(c, text, x, y, size, color, font = "600", align = "left", family = "monospace"){
  c.font = `${font} ${size}px ${family}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = "middle"; c.fillText(text, x, y); c.textAlign = "left";
}
/* Viñeta con forma: todo fuera de `shape` en `color`, con borde suave `soft` (0..1) */
function shapeVignette(c, W, H, shape, color, soft, rgb){
  /* Varias formas = unión: se recorta fuera de todas menos la última
     (con evenodd, dos formas que se solapan se anularían). */
  if(Array.isArray(shape)){
    const k = 1 + (soft > 0 ? soft * 0.35 : 0);
    c.save();
    for(const sh of shape.slice(0, -1)){ c.beginPath(); outer(c, W, H); sh(c, k); c.clip("evenodd"); }
    shapeVignette(c, W, H, shape.at(-1), color, soft, rgb);
    c.restore();
    if(soft > 0) for(const sh of shape.slice(0, -1)){ c.save(); c.beginPath(); outer(c, W, H); shape.at(-1)(c, k); c.clip("evenodd"); shapeVignette(c, W, H, sh, "rgba(0,0,0,0)", soft, rgb); c.restore(); }
    return;
  }
  if(soft > 0){
    // borde difuminado con varias pasadas decrecientes
    const n = 10;
    for(let i = 0; i < n; i++){
      const k = 1 + soft * (i / n) * 0.35;
      c.save(); c.globalAlpha = 1 / n * 1.6;
      c.beginPath(); outer(c, W, H); shape(c, k); c.fillStyle = `rgb(${rgb})`; c.fill("evenodd"); c.restore();
    }
  }
  c.beginPath(); outer(c, W, H); shape(c, 1 + (soft > 0 ? soft * 0.35 : 0)); c.fillStyle = color; c.fill("evenodd");
}
const ellipseShape = (W, H, rx, ry) => (c, k) => { c.moveTo(W / 2 + rx * k, H / 2); c.ellipse(W / 2, H / 2, rx * k, ry * k, 0, 0, TAU); };

/* ── familias paramétricas ────────────────────────────────────── */
/* Instantánea: bordes laterales t, inferior grande. */
function instant(color, { bottom = 3.4, side = 1, aged = 0, dark = false, square = false, tex = true, extra = null } = {}){
  return (c, W, H, u, R) => {
    const t = u * 1.05 * side;
    let x = t, y = t, w = W - 2 * t, h = H - t - t * bottom;
    if(square){ const s = Math.min(w, h); x = (W - s) / 2; w = s; if(h > s){ y = t + (h - s) / 2; h = s; } }
    band(c, W, H, color, x, y, w, h);
    c.save(); clipFrame(c, W, H, x, y, w, h);
    if(tex) speckle(c, R, 0, 0, W, H, 900, dark ? "#fff" : "#6b5a40", u * 0.02, u * 0.07, 0.03, 0.12);
    if(aged){
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, `rgba(190,150,70,${0.28 * aged})`); g.addColorStop(0.5, "rgba(190,150,70,0)"); g.addColorStop(1, `rgba(150,110,50,${0.35 * aged})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    c.restore();
    innerShadow(c, W, H, x, y, w, h, 0, u * 0.35, dark ? 0.6 : 0.35);
    if(extra) extra(c, W, H, u, R, { x, y, w, h, t, bottom: H - y - h });
  };
}
/* Paspartú (cartón con bisel claro alrededor de la ventana). */
function mat(color, { width = 2.2, bevelColor = "#f4efe3", r = 0, doubleColor = null, tex = true, shadow = 0.25 } = {}){
  return (c, W, H, u, R) => {
    const t = u * width, x = t, y = t, w = W - 2 * t, h = H - 2 * t, bv = u * 0.14;
    band(c, W, H, color, x, y, w, h, r);
    if(tex){ c.save(); clipFrame(c, W, H, x, y, w, h, r); speckle(c, R, 0, 0, W, H, 700, "#3a3226", u * 0.015, u * 0.05, 0.02, 0.08); c.restore(); }
    if(doubleColor){ band(c, W, H, doubleColor, x + u * 0.55, y + u * 0.55, w - u * 1.1, h - u * 1.1, r); }
    const k = doubleColor ? u * 0.55 : 0;
    c.beginPath(); rr(c, x + k - bv, y + k - bv, w - 2 * k + 2 * bv, h - 2 * k + 2 * bv, r + bv); rr(c, x + k, y + k, w - 2 * k, h - 2 * k, r);
    c.fillStyle = bevelColor; c.fill("evenodd");
    innerShadow(c, W, H, x + k, y + k, w - 2 * k, h - 2 * k, r, u * 0.25, shadow);
  };
}
/* Moldura de cuadro (madera, metal, laca). */
function molding(stops, { width = 1.8, inner = null, beads = null, grain = null, lip = null, mat: matColor = null } = {}){
  return (c, W, H, u, R) => {
    const t = u * width;
    let x = t, y = t, w = W - 2 * t, h = H - 2 * t;
    bevel(c, W, H, x, y, w, h, stops);
    if(grain){
      c.save(); clipFrame(c, W, H, x, y, w, h);
      c.strokeStyle = grain; c.lineWidth = u * 0.03;
      for(let i = 0; i < 70; i++){
        const o = R() * t, wv = u * 0.08 * R();
        c.globalAlpha = 0.15 + 0.25 * R();
        c.beginPath(); for(let s = 0; s <= 40; s++){ const X = W * s / 40, Y = o + Math.sin(s * 0.7 + i) * wv; if(s) c.lineTo(X, Y); else c.moveTo(X, Y); } c.stroke();
        c.beginPath(); for(let s = 0; s <= 40; s++){ const X = W * s / 40, Y = H - o + Math.sin(s * 0.6 + i * 2) * wv; if(s) c.lineTo(X, Y); else c.moveTo(X, Y); } c.stroke();
        c.beginPath(); for(let s = 0; s <= 40; s++){ const Y = H * s / 40, X = o + Math.sin(s * 0.7 + i * 3) * wv; if(s) c.lineTo(X, Y); else c.moveTo(X, Y); } c.stroke();
        c.beginPath(); for(let s = 0; s <= 40; s++){ const Y = H * s / 40, X = W - o + Math.sin(s * 0.5 + i) * wv; if(s) c.lineTo(X, Y); else c.moveTo(X, Y); } c.stroke();
      }
      c.globalAlpha = 1; c.restore();
    }
    if(beads){
      const r = u * 0.13, gap = r * 2.6, off = t * 0.55;
      c.fillStyle = beads;
      const row = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / gap); for(let i = 0; i <= n; i++){ const k = i / n; c.beginPath(); c.arc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r, 0, TAU); c.fill(); } };
      row(off, off, W - off, off); row(off, H - off, W - off, H - off); row(off, off, off, H - off); row(W - off, off, W - off, H - off);
      c.fillStyle = "rgba(0,0,0,.25)";
      row(off + r * 0.3, off + r * 0.3, W - off + r * 0.3, off + r * 0.3);
    }
    if(lip){ c.beginPath(); rr(c, x - u * 0.12, y - u * 0.12, w + u * 0.24, h + u * 0.24); rr(c, x, y, w, h); c.fillStyle = lip; c.fill("evenodd"); }
    if(matColor){ const m = u * 1.5; band(c, W, H, matColor, x + m, y + m, w - 2 * m, h - 2 * m); x += m; y += m; w -= 2 * m; h -= 2 * m;
      c.beginPath(); rr(c, x - u * 0.12, y - u * 0.12, w + u * 0.24, h + u * 0.24); rr(c, x, y, w, h); c.fillStyle = "#f6f1e6"; c.fill("evenodd"); }
    if(inner){ c.beginPath(); rr(c, x - u * 0.06, y - u * 0.06, w + u * 0.12, h + u * 0.12); rr(c, x, y, w, h); c.fillStyle = inner; c.fill("evenodd"); }
    innerShadow(c, W, H, x, y, w, h, 0, u * 0.4, 0.5);
  };
}
/* Tira de película (35 mm, 120, cine…), dibujada en horizontal y girada si la foto es vertical. */
function film({ base = "rgb(14,12,10)", holes = "rgb(236,228,210)", ink = "rgba(245,170,60,.92)", both = true, kind = "35", rough = 0, text = true } = {}){
  return (c, W, H, u, R) => {
    c.save();
    let w = W, h = H;
    if(H > W){ c.translate(W, 0); c.rotate(Math.PI / 2); w = H; h = W; }
    const bandH = u * (kind === "120" ? 1.3 : kind === "s8" ? 1.1 : 1.9), side = u * (kind === "cine" ? 0.6 : 0.9), rad = u * 0.35;
    const x0 = side, y0 = bandH, x1 = w - side, y1 = h - bandH;
    c.beginPath(); outer(c, w, h);
    if(rough){ const n = fbm(R); wobblyWin(c, x0, y0, x1 - x0, y1 - y0, t => Math.max(0, n(t * 3) * u * 0.45 * rough), 320); }
    else { c.moveTo(x0 + rad, y0); c.arcTo(x1, y0, x1, y1, rad); c.arcTo(x1, y1, x0, y1, rad); c.arcTo(x0, y1, x0, y0, rad); c.arcTo(x0, y0, x1, y0, rad); c.closePath(); }
    c.fillStyle = base; c.fill("evenodd");
    if(kind === "35" || kind === "cine" || kind === "s8"){
      const hw = bandH * (kind === "s8" ? 0.34 : 0.28), hh = bandH * 0.36, pitch = bandH * (kind === "s8" ? 1.6 : 0.62);
      c.fillStyle = holes;
      for(const yy of both ? [bandH * 0.14, h - bandH * 0.14 - hh] : [bandH * 0.14]){
        for(let x = pitch * 0.4; x < w; x += pitch){ c.beginPath(); rr(c, x, yy, hw, hh, hw * 0.25); c.fill(); }
      }
    }
    if(kind === "120"){ c.fillStyle = holes; c.beginPath(); rr(c, w * 0.02, bandH * 0.25, u * 0.25, bandH * 0.5, u * 0.08); c.fill(); }
    if(text){
      const fs = bandH * 0.24;
      if(kind === "120"){ label(c, "6×6   ◂ 4   SAFETY", w * 0.08, h - bandH * 0.5, fs * 1.2, ink); label(c, "◂ 5", w * 0.8, bandH * 0.5, fs * 1.2, ink); }
      else if(kind === "cine"){ label(c, "▮ 24 FPS", w * 0.1, h - bandH * 0.62, fs, ink); }
      else { for(let x = w * 0.06, i = 0; x < w * 0.95; x += w * 0.34, i++){ label(c, i % 2 ? `${12 + i}A ▶` : "SAFETY FILM", x, h - bandH * 0.7, fs, ink); if(both) label(c, `▶ ${12 + i}`, x + w * 0.12, bandH * 0.7, fs, ink); } }
    }
    c.restore();
  };
}
/* Montura de diapositiva */
function slide(color, { r = 2.2, text = "#6b6b6b", shade = 0.2 } = {}){
  return (c, W, H, u, R) => {
    const t = u * 2.4, x = t, y = t * 0.9, w = W - 2 * t, h = H - 1.8 * t, rad = u * 0.6 * r / 2.2;
    band(c, W, H, color, x, y, w, h, rad);
    c.save(); clipFrame(c, W, H, x, y, w, h, rad);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, `rgba(0,0,0,${shade})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    label(c, "▲", W / 2, y * 0.5, u * 0.6, text, "700", "center");
    label(c, `${String(1 + Math.floor(R() * 36)).padStart(2, "0")}`, x + u * 0.2, H - y * 0.5, u * 0.55, text, "700");
    c.restore();
    innerShadow(c, W, H, x, y, w, h, rad, u * 0.3, 0.55);
  };
}
/* Borde festoneado / ondulado / dentado (copias de los años 50-60) */
function edged(color, kind, { width = 1.2, amp = 0.35, pitch = 0.9, tex = false } = {}){
  return (c, W, H, u, R) => {
    const t = u * width, a = u * amp, p = u * pitch;
    const f = kind === "scallop" ? ((_, d) => a * (1 - Math.abs(Math.sin(d / p * Math.PI))))
            : kind === "wave" ? ((_, d) => a * (0.5 + 0.5 * Math.sin(d / p * TAU)))
            : kind === "zigzag" ? ((_, d) => a * Math.abs(((d / p) % 1) * 2 - 1))
            : (() => { const n = fbm(R); return t2 => Math.max(0, a * (0.5 + n(t2 * 7))); })();
    const steps = Math.max(240, Math.round(2 * (W + H) / (p / 5)));
    wobblyBand(c, W, H, color, t, t, W - 2 * t, H - 2 * t, f, Math.min(steps, 4000));
    if(tex){ c.save(); c.beginPath(); outer(c, W, H); wobblyWin(c, t, t, W - 2 * t, H - 2 * t, f, 600); c.clip("evenodd"); speckle(c, R, 0, 0, W, H, 800, "#5d4d36", u * 0.02, u * 0.06, 0.03, 0.12); c.restore(); }
  };
}
/* Bordes grunge / quemados / rasgados, con perfil de ruido */
function rough(color, { width = 1.4, amp = 1.2, soft = null, spots = null, inner = null } = {}){
  return (c, W, H, u, R) => {
    const n = fbm(R, 5), t = u * width, a = u * amp;
    const f = tt => Math.max(-t * 0.8, a * n(tt * 9));
    if(soft){
      for(let i = 3; i >= 1; i--){
        c.globalAlpha = 0.18;
        wobblyBand(c, W, H, soft, t + i * u * 0.35, t + i * u * 0.35, W - 2 * (t + i * u * 0.35), H - 2 * (t + i * u * 0.35), f, 700);
      }
      c.globalAlpha = 1;
    }
    if(inner){ wobblyBand(c, W, H, inner, t + u * 0.18, t + u * 0.18, W - 2 * t - u * 0.36, H - 2 * t - u * 0.36, f, 700); }
    wobblyBand(c, W, H, color, t, t, W - 2 * t, H - 2 * t, f, 700);
    if(spots){ c.save(); c.beginPath(); rr(c, 0, 0, W, H); c.clip(); for(let i = 0; i < 90; i++){ const e = R(), x = e < .5 ? (R() < .5 ? R() * t * 3 : W - R() * t * 3) : R() * W, y = e < .5 ? R() * H : (R() < .5 ? R() * t * 3 : H - R() * t * 3); c.globalAlpha = 0.15 + 0.35 * R(); c.fillStyle = spots; c.beginPath(); c.arc(x, y, u * (0.05 + 0.4 * R() ** 3), 0, TAU); c.fill(); } c.globalAlpha = 1; c.restore(); }
  };
}
/* Cenefa repetida alrededor (decorativos) */
function border(bg, motif, { width = 1.3, pitch = 1, inner = null } = {}){
  return (c, W, H, u, R) => {
    const t = u * width, x = t, y = t, w = W - 2 * t, h = H - 2 * t;
    band(c, W, H, bg, x, y, w, h);
    c.save(); clipFrame(c, W, H, x, y, w, h);
    const p = u * pitch;
    const runs = [[0, t / 2, W, 0], [0, H - t / 2, W, 0], [t / 2, 0, H, Math.PI / 2], [W - t / 2, 0, H, Math.PI / 2]];
    for(const [x0, y0, L, ang] of runs){
      const n = Math.ceil(L / p);
      for(let i = 0; i <= n; i++){
        c.save(); c.translate(x0 + (ang ? 0 : i * p), y0 + (ang ? i * p : 0)); c.rotate(ang); motif(c, u, t, p, i, R); c.restore();
      }
    }
    c.restore();
    if(inner){ c.beginPath(); rr(c, x - u * 0.1, y - u * 0.1, w + u * 0.2, h + u * 0.2); rr(c, x, y, w, h); c.fillStyle = inner; c.fill("evenodd"); }
    innerShadow(c, W, H, x, y, w, h, 0, u * 0.25, 0.3);
  };
}

/* ── catálogo ─────────────────────────────────────────────────── */
const F = (id, cat, label, draw) => ({ id, cat, label, draw });
const CR = "rgb(247,244,236)", CREAM = "rgb(238,229,207)";

export const FRAME_CATS = ["Instantáneas", "Película", "Papel antiguo", "Marcos de cuadro", "Postales y sellos",
  "Viñetas y formas", "Pantallas y visores", "Desgaste", "Decorativos", "Álbum y recortes"];

export const FRAMES = [
  /* ── Instantáneas ── */
  F("instWhite", "Instantáneas", "Instantánea blanca", instant(CR)),
  F("instCream", "Instantáneas", "Instantánea amarillenta", instant(CREAM, { aged: 1 })),
  F("instBlack", "Instantáneas", "Instantánea negra", instant("rgb(22,21,20)", { dark: true })),
  F("instPink", "Instantáneas", "Instantánea rosa", instant("rgb(244,196,204)")),
  F("instMint", "Instantáneas", "Instantánea menta", instant("rgb(190,226,210)")),
  F("instSky", "Instantáneas", "Instantánea celeste", instant("rgb(186,212,236)")),
  F("instLemon", "Instantáneas", "Instantánea limón", instant("rgb(246,230,150)")),
  F("instKraft", "Instantáneas", "Instantánea de cartón", instant("rgb(186,152,112)", { aged: 0.4 })),
  F("instSquare", "Instantáneas", "Instantánea cuadrada", instant(CR, { square: true })),
  F("instWide", "Instantáneas", "Instantánea panorámica", instant(CR, { bottom: 1.6, side: 1.1 })),
  F("instTape", "Instantáneas", "Instantánea con cinta", instant(CR, { extra: (c, W, H, u, R) => {
    tape(c, R, W * 0.5, u * 0.7, W * 0.28, u * 1.7, (R() - 0.5) * 0.12, "rgb(226,206,140)", 0.7);
  } })),
  F("instNote", "Instantáneas", "Instantánea con nota", instant(CR, { extra: (c, W, H, u, R, b) => {
    scribble(c, R, W * 0.12, H - b.bottom * 0.8, W * 0.55, b.bottom * 0.55, "rgba(30,40,110,.8)", u * 0.09);
  } })),
  F("instCoffee", "Instantáneas", "Instantánea con café", instant(CR, { aged: 0.5, extra: (c, W, H, u, R, b) => {
    const cx = W * (0.7 + R() * 0.15), cy = H - b.bottom * 0.45, r = b.bottom * 0.55;
    c.lineWidth = u * 0.14; c.strokeStyle = "rgba(120,80,40,.45)"; c.beginPath(); c.ellipse(cx, cy, r, r * 0.92, 0.3, 0.2, TAU - 0.4); c.stroke();
    c.lineWidth = u * 0.05; c.strokeStyle = "rgba(120,80,40,.3)"; c.beginPath(); c.arc(cx + r * 0.1, cy, r * 0.9, 1, 4.5); c.stroke();
  } })),

  /* ── Película ── */
  F("film35", "Película", "Negativo de 35 mm", film()),
  F("film35Clean", "Película", "35 mm sin rótulos", film({ text: false })),
  F("filmOrange", "Película", "Negativo en color (base naranja)", film({ base: "rgb(196,112,52)", holes: "rgb(245,236,220)", ink: "rgba(60,20,0,.8)" })),
  F("filmSlide", "Película", "Positivo de diapositiva", film({ base: "rgb(10,10,12)", holes: "rgb(200,220,240)", ink: "rgba(250,250,250,.85)" })),
  F("film120", "Película", "Formato medio 120", film({ kind: "120", ink: "rgba(240,200,120,.9)" })),
  F("filmCine", "Película", "Fotograma de cine", film({ kind: "cine", ink: "rgba(230,230,230,.8)" })),
  F("filmS8", "Película", "Súper 8", film({ kind: "s8", both: false, ink: "rgba(245,190,90,.9)" })),
  F("filmFiled", "Película", "Portanegativos limado", film({ rough: 1, text: false })),
  F("filmFiledWhite", "Película", "Limado en positivo", film({ base: "rgb(248,246,240)", holes: "rgb(30,30,30)", ink: "rgba(40,40,40,.8)", rough: 1, text: false })),
  F("slideWhite", "Película", "Montura de diapositiva blanca", slide("rgb(236,234,228)")),
  F("slideGrey", "Película", "Montura de diapositiva gris", slide("rgb(150,152,156)", { text: "#e8e8e8" })),
  F("slideBlack", "Película", "Montura de diapositiva negra", slide("rgb(26,26,28)", { text: "#aaa", shade: 0.1 })),
  F("slideCard", "Película", "Montura de cartón", slide("rgb(214,196,160)", { r: 0.4, text: "#5a4630" })),

  /* ── Papel antiguo ── */
  F("deckleWhite", "Papel antiguo", "Borde barbado blanco", edged(CR, "deckle", { width: 1.3, amp: 0.55, tex: true })),
  F("deckleCream", "Papel antiguo", "Borde barbado crema", edged(CREAM, "deckle", { width: 1.6, amp: 0.7, tex: true })),
  F("scallop", "Papel antiguo", "Borde festoneado", edged(CR, "scallop", { width: 1.3, amp: 0.4, pitch: 0.85 })),
  F("wave", "Papel antiguo", "Borde ondulado años 50", edged(CR, "wave", { width: 1.3, amp: 0.3, pitch: 0.7 })),
  F("zigzag", "Papel antiguo", "Borde dentado de tijera", edged(CR, "zigzag", { width: 1.2, amp: 0.35, pitch: 0.55 })),
  F("torn", "Papel antiguo", "Papel rasgado", edged(CR, "deckle", { width: 1.7, amp: 1.6, tex: true })),
  F("albumen", "Papel antiguo", "Copia a la albúmina", (c, W, H, u, R) => {
    const t = u * 1.6, r = u * 1.4;
    band(c, W, H, "rgb(214,196,160)", t, t, W - 2 * t, H - 2 * t, r);
    c.save(); clipFrame(c, W, H, t, t, W - 2 * t, H - 2 * t, r); speckle(c, R, 0, 0, W, H, 900, "#6a5334", u * 0.02, u * 0.06, 0.05, 0.18); c.restore();
    c.lineWidth = u * 0.06; c.strokeStyle = "rgba(150,110,50,.8)"; c.beginPath(); rr(c, t - u * 0.5, t - u * 0.5, W - 2 * t + u, H - 2 * t + u, r + u * 0.4); c.stroke();
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, r, u * 0.3, 0.3);
  }),
  F("cabinet", "Papel antiguo", "Tarjeta de estudio (gabinete)", (c, W, H, u, R) => {
    const t = u * 1.4, b = u * 3.2, x = t, y = t, w = W - 2 * t, h = H - t - b;
    band(c, W, H, "rgb(46,34,28)", x, y, w, h, u * 0.5);
    c.save(); clipFrame(c, W, H, x, y, w, h, u * 0.5); speckle(c, R, 0, 0, W, H, 900, "#c9a86a", u * 0.02, u * 0.05, 0.05, 0.2); c.restore();
    c.strokeStyle = "rgb(201,168,106)"; c.lineWidth = u * 0.07; c.beginPath(); rr(c, x - u * 0.45, y - u * 0.45, w + u * 0.9, h + u * 0.9, u * 0.8); c.stroke();
    label(c, "FOTOGRAFÍA ARTÍSTICA", W / 2, H - b * 0.55, u * 0.62, "rgb(214,182,116)", "700", "center", "Georgia, serif");
    label(c, "· retratos · ampliaciones ·", W / 2, H - b * 0.22, u * 0.4, "rgba(214,182,116,.8)", "italic 400", "center", "Georgia, serif");
    innerShadow(c, W, H, x, y, w, h, u * 0.5, u * 0.3, 0.5);
  }),
  F("cdv", "Papel antiguo", "Carte de visite", (c, W, H, u, R) => {
    const t = u * 1.1, b = u * 2.2, x = t, y = t, w = W - 2 * t, h = H - t - b;
    band(c, W, H, "rgb(232,220,196)", x, y, w, h, u * 0.8);
    c.save(); clipFrame(c, W, H, x, y, w, h, u * 0.8); speckle(c, R, 0, 0, W, H, 700, "#6a5334", u * 0.02, u * 0.05, 0.05, 0.15); c.restore();
    label(c, "Estudio · Madrid", W / 2, H - b * 0.5, u * 0.55, "rgba(90,60,30,.85)", "italic 400", "center", "Georgia, serif");
    c.strokeStyle = "rgba(120,90,50,.7)"; c.lineWidth = u * 0.05; c.beginPath(); rr(c, x - u * 0.3, y - u * 0.3, w + u * 0.6, h + u * 0.6, u); c.stroke();
    innerShadow(c, W, H, x, y, w, h, u * 0.8, u * 0.25, 0.35);
  }),
  F("matCream", "Papel antiguo", "Paspartú crema", mat("rgb(238,230,212)")),
  F("matBlack", "Papel antiguo", "Paspartú negro", mat("rgb(28,27,26)", { bevelColor: "#e8e2d6" })),
  F("matDouble", "Papel antiguo", "Paspartú doble", mat("rgb(236,230,216)", { doubleColor: "rgb(110,32,36)" })),
  F("matOval", "Papel antiguo", "Paspartú redondeado", mat("rgb(236,228,210)", { r: 6 })),
  F("emboss", "Papel antiguo", "Cartón con gofrado", (c, W, H, u, R) => {
    const t = u * 2, x = t, y = t, w = W - 2 * t, h = H - 2 * t;
    band(c, W, H, "rgb(230,222,204)", x, y, w, h);
    c.save(); clipFrame(c, W, H, x, y, w, h); speckle(c, R, 0, 0, W, H, 700, "#5a4a36", u * 0.02, u * 0.05, 0.02, 0.1); c.restore();
    const g = u * 0.9;
    c.lineWidth = u * 0.07; c.strokeStyle = "rgba(255,255,255,.8)"; c.beginPath(); rr(c, x - g + u * 0.04, y - g + u * 0.04, w + 2 * g, h + 2 * g); c.stroke();
    c.strokeStyle = "rgba(0,0,0,.2)"; c.beginPath(); rr(c, x - g, y - g, w + 2 * g, h + 2 * g); c.stroke();
    innerShadow(c, W, H, x, y, w, h, 0, u * 0.2, 0.3);
  }),
  F("wornCorners", "Papel antiguo", "Esquinas gastadas", (c, W, H, u, R) => {
    const t = u * 1.1;
    band(c, W, H, "rgb(236,226,204)", t, t, W - 2 * t, H - 2 * t);
    for(const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]){
      const g = c.createRadialGradient(x, y, 0, x, y, u * 5); g.addColorStop(0, "rgba(90,60,30,.55)"); g.addColorStop(1, "rgba(90,60,30,0)");
      c.fillStyle = g; c.fillRect(x - u * 5, y - u * 5, u * 10, u * 10);
      c.fillStyle = "rgb(20,18,16)"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (x ? -1 : 1) * u * (0.8 + R()), y); c.lineTo(x, y + (y ? -1 : 1) * u * (0.8 + R())); c.closePath(); c.fill();
    }
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, 0, u * 0.2, 0.3);
  }),

  /* ── Marcos de cuadro ── */
  F("gold", "Marcos de cuadro", "Dorado clásico", molding([[0, "#6b4a12"], [0.25, "#e8c66a"], [0.5, "#a77a24"], [0.75, "#f4dc8c"], [1, "#5c3f0e"]], { inner: "#3d2a08" })),
  F("goldOrnate", "Marcos de cuadro", "Dorado barroco", molding([[0, "#5a3c0c"], [0.2, "#f0d27a"], [0.45, "#94691c"], [0.7, "#e2bd5c"], [1, "#4a3208"]], { width: 2.4, beads: "#f6de8e", inner: "#2a1c06" })),
  F("goldMuseum", "Marcos de cuadro", "Museo con paspartú", molding([[0, "#6b4a12"], [0.3, "#e0bd62"], [0.6, "#9c7222"], [1, "#5c3f0e"]], { width: 1.6, mat: "rgb(236,230,216)" })),
  F("silver", "Marcos de cuadro", "Plateado", molding([[0, "#4a4d52"], [0.3, "#e6e9ee"], [0.55, "#8a9098"], [0.8, "#f4f6f8"], [1, "#3c3f44"]], { inner: "#202226" })),
  F("bronze", "Marcos de cuadro", "Bronce envejecido", molding([[0, "#3c2414"], [0.3, "#b0763e"], [0.6, "#6e4222"], [0.85, "#c98e52"], [1, "#2e1a0e"]], { beads: "rgba(90,150,120,.5)" })),
  F("woodDark", "Marcos de cuadro", "Nogal", molding([[0, "#2a170c"], [0.4, "#5c3820"], [0.7, "#4a2c18"], [1, "#1e1008"]], { grain: "#130a04", width: 1.9 })),
  F("woodLight", "Marcos de cuadro", "Roble claro", molding([[0, "#8a6238"], [0.4, "#caa06a"], [0.7, "#b48a56"], [1, "#6e4c2a"]], { grain: "#6a4524", width: 1.9 })),
  F("woodRustic", "Marcos de cuadro", "Madera rústica", molding([[0, "#4a3a2a"], [0.5, "#7a644a"], [1, "#3a2c1e"]], { grain: "#241a10", width: 2.4 })),
  F("lacquer", "Marcos de cuadro", "Laca negra", molding([[0, "#050505"], [0.35, "#3a3a3c"], [0.5, "#0c0c0d"], [1, "#000"]], { width: 1.5, lip: "#c9a44a" })),
  F("gallery", "Marcos de cuadro", "Galería blanca", molding([[0, "#d8d6d2"], [0.5, "#fbfaf8"], [1, "#cfcdca"]], { width: 1.1, mat: "rgb(250,249,246)" })),
  F("artDeco", "Marcos de cuadro", "Art déco", (c, W, H, u, R) => {
    const t = u * 2.2;
    bevel(c, W, H, t, t, W - 2 * t, H - 2 * t, [[0, "#111"], [0.5, "#1c1c1e"], [1, "#0a0a0a"]], 0.08);
    c.strokeStyle = "#d4af5a";
    for(const [k, lw] of [[0.25, 0.08], [0.55, 0.05], [0.8, 0.08]]){ c.lineWidth = u * lw; c.beginPath(); rr(c, t * k, t * k, W - 2 * t * k, H - 2 * t * k); c.stroke(); }
    for(const [x, y, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]){
      c.save(); c.translate(x + sx * t * 0.25, y + sy * t * 0.25); c.scale(sx, sy);
      c.fillStyle = "#d4af5a"; for(let i = 0; i < 3; i++){ c.fillRect(0, i * u * 0.35, t * (0.9 - i * 0.25), u * 0.14); c.fillRect(i * u * 0.35, 0, u * 0.14, t * (0.9 - i * 0.25)); }
      c.restore();
    }
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, 0, u * 0.3, 0.5);
  }),
  F("floating", "Marcos de cuadro", "Caja flotante", (c, W, H, u, R) => {
    const t = u * 0.8, gap = u * 0.7;
    band(c, W, H, "rgb(20,20,20)", t, t, W - 2 * t, H - 2 * t);
    band(c, W, H, "rgb(40,38,36)", t + gap, t + gap, W - 2 * (t + gap), H - 2 * (t + gap));
    c.save(); clipWin(c, t, t, W - 2 * t, H - 2 * t); c.shadowColor = "rgba(0,0,0,.7)"; c.shadowBlur = u * 0.6 * px(c); c.shadowOffsetX = u * 0.2 * px(c); c.shadowOffsetY = u * 0.3 * px(c);
    c.beginPath(); outer(c, W, H); rr(c, t + gap, t + gap, W - 2 * (t + gap), H - 2 * (t + gap)); c.fillStyle = "#000"; c.fill("evenodd"); c.restore();
  }),
  F("shadowbox", "Marcos de cuadro", "Caja profunda", molding([[0, "#f2f0ec"], [0.5, "#dcd8d0"], [1, "#b8b2a6"]], { width: 2.8 })),
  F("redVelvet", "Marcos de cuadro", "Terciopelo y oro", molding([[0, "#3e060c"], [0.5, "#7a1420"], [1, "#2e0408"]], { width: 2, inner: "#e2bd5c", beads: "rgba(226,189,92,.55)" })),

  /* ── Postales y sellos ── */
  F("stamp", "Postales y sellos", "Sello perforado", (c, W, H, u, R) => {
    const t = u * 1.4, r = u * 0.42, p = u * 1.2;
    band(c, W, H, "rgb(250,247,240)", t, t, W - 2 * t, H - 2 * t);
    // Perforaciones: medios círculos del fondo oscuro sobre el borde
    c.fillStyle = "rgb(40,36,32)";
    for(let x = p / 2; x < W; x += p){ c.beginPath(); c.arc(x, 0, r, 0, TAU); c.arc(x, H, r, 0, TAU); c.fill(); }
    for(let y = p / 2; y < H; y += p){ c.beginPath(); c.arc(0, y, r, 0, TAU); c.arc(W, y, r, 0, TAU); c.fill(); }
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, 0, u * 0.15, 0.3);
    label(c, `${1 + Math.floor(R() * 9)}0 cts`, W - t - u * 0.2, H - t - u * 0.55, u * 0.7, "rgba(255,255,255,.92)", "800", "right", "Georgia, serif");
  }),
  F("postmark", "Postales y sellos", "Sello matasellado", (c, W, H, u, R) => {
    FRAMES_BY_ID.stamp.draw(c, W, H, u, R);
    const cx = W * 0.22, cy = H * 0.26, r = Math.min(W, H) * 0.14;
    c.strokeStyle = "rgba(20,20,40,.55)"; c.lineWidth = u * 0.12;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.72, 0, TAU); c.stroke();
    for(let i = 0; i < 5; i++){ c.beginPath(); for(let s = 0; s <= 40; s++){ const x = cx + r * 1.1 + s * u * 0.5, y = cy - r * 0.5 + i * r * 0.25 + Math.sin(s * 0.5) * u * 0.25; if(s) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
    label(c, "CORREOS", cx, cy, r * 0.28, "rgba(20,20,40,.6)", "800", "center", "sans-serif");
  }),
  F("airmail", "Postales y sellos", "Correo aéreo", border("rgb(248,246,240)", (c, u, t, p, i) => {
    c.fillStyle = i % 2 ? "rgb(200,40,48)" : "rgb(30,70,160)";
    c.beginPath(); c.moveTo(0, -t / 2); c.lineTo(p * 0.5, -t / 2); c.lineTo(p * 0.5 - t * 0.6, t / 2); c.lineTo(-t * 0.6, t / 2); c.closePath(); c.fill();
  }, { width: 1, pitch: 1.4 })),
  F("postcard", "Postales y sellos", "Postal antigua", (c, W, H, u, R) => {
    const t = u * 1.1;
    band(c, W, H, "rgb(242,236,222)", t, t, W - 2 * t, H - 2 * t);
    c.save(); clipFrame(c, W, H, t, t, W - 2 * t, H - 2 * t); speckle(c, R, 0, 0, W, H, 700, "#6a5334", u * 0.02, u * 0.05, 0.04, 0.14); c.restore();
    c.strokeStyle = "rgba(120,80,40,.7)"; c.lineWidth = u * 0.05; c.beginPath(); rr(c, t * 0.45, t * 0.45, W - t * 0.9, H - t * 0.9); c.stroke();
    label(c, "Recuerdo de…", t * 0.55, H - t * 0.5, u * 0.55, "rgba(120,60,30,.9)", "italic 400", "left", "Georgia, serif");
  }),
  F("ticket", "Postales y sellos", "Entrada de cine", (c, W, H, u, R) => {
    const t = u * 1.2, n = u * 1.1;
    c.beginPath(); outer(c, W, H); rr(c, t, t, W - 2 * t, H - 2 * t); c.fillStyle = "rgb(220,70,60)"; c.fill("evenodd");
    c.fillStyle = "rgb(30,28,26)";
    for(const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]){ c.beginPath(); c.arc(x, y, n, 0, TAU); c.fill(); }
    c.beginPath(); c.arc(0, H / 2, n * 0.8, 0, TAU); c.arc(W, H / 2, n * 0.8, 0, TAU); c.fill();
    label(c, "ADMIT ONE · ENTRADA", W / 2, t * 0.5, u * 0.6, "rgba(255,240,220,.95)", "800", "center", "sans-serif");
    label(c, `Nº ${String(Math.floor(R() * 99999)).padStart(5, "0")}`, W / 2, H - t * 0.5, u * 0.55, "rgba(255,240,220,.9)", "700", "center");
  }),
  F("label", "Postales y sellos", "Etiqueta de farmacia", (c, W, H, u, R) => {
    const t = u * 1.5;
    band(c, W, H, "rgb(240,230,200)", t, t, W - 2 * t, H - 2 * t, u * 2.5);
    c.strokeStyle = "rgb(40,70,60)"; c.lineWidth = u * 0.12; c.beginPath(); rr(c, t * 0.5, t * 0.5, W - t, H - t, u * 2.8); c.stroke();
    c.lineWidth = u * 0.05; c.beginPath(); rr(c, t * 0.72, t * 0.72, W - t * 1.44, H - t * 1.44, u * 2.6); c.stroke();
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, u * 2.5, u * 0.2, 0.3);
  }),
  F("telegram", "Postales y sellos", "Telegrama", (c, W, H, u, R) => {
    const t = u * 1, b = u * 2.4;
    band(c, W, H, "rgb(236,222,178)", t, b, W - 2 * t, H - b - t);
    label(c, "TELEGRAMA · URGENTE", t, b * 0.5, u * 0.8, "rgb(60,40,30)", "800", "left", "monospace");
    c.fillStyle = "rgba(60,40,30,.6)"; for(let i = 0; i < 3; i++) c.fillRect(W * 0.6, b * (0.3 + i * 0.18), W * 0.35, u * 0.06);
    innerShadow(c, W, H, t, b, W - 2 * t, H - b - t, 0, u * 0.2, 0.3);
  }),
  F("envelope", "Postales y sellos", "Sobre de carta", border("rgb(250,247,240)", (c, u, t, p, i) => {
    c.fillStyle = i % 2 ? "rgb(210,50,60)" : "rgb(250,247,240)";
    c.fillRect(0, -t / 2, p, t * 0.28);
  }, { width: 1.2, pitch: 1.6 })),

  /* ── Viñetas y formas ── */
  F("ovalDark", "Viñetas y formas", "Óvalo oscuro", (c, W, H, u) => shapeVignette(c, W, H, ellipseShape(W, H, W * 0.42, H * 0.42), "rgb(16,14,12)", 1, "16,14,12")),
  F("ovalWhite", "Viñetas y formas", "Óvalo blanco", (c, W, H, u) => shapeVignette(c, W, H, ellipseShape(W, H, W * 0.43, H * 0.43), "rgb(247,244,236)", 1, "247,244,236")),
  F("ovalSepia", "Viñetas y formas", "Óvalo sepia desvaído", (c, W, H, u) => shapeVignette(c, W, H, ellipseShape(W, H, W * 0.44, H * 0.44), "rgb(214,190,150)", 1.4, "214,190,150")),
  F("ovalMat", "Viñetas y formas", "Paspartú oval", (c, W, H, u, R) => {
    const rx = W * 0.4, ry = H * 0.4;
    c.beginPath(); outer(c, W, H); c.ellipse(W / 2, H / 2, rx, ry, 0, 0, TAU); c.fillStyle = "rgb(234,226,208)"; c.fill("evenodd");
    c.save(); c.beginPath(); outer(c, W, H); c.ellipse(W / 2, H / 2, rx, ry, 0, 0, TAU); c.clip("evenodd"); speckle(c, R, 0, 0, W, H, 800, "#5a4a36", u * 0.02, u * 0.05, 0.02, 0.1); c.restore();
    c.lineWidth = u * 0.16; c.strokeStyle = "#f6f1e6"; c.beginPath(); c.ellipse(W / 2, H / 2, rx + u * 0.08, ry + u * 0.08, 0, 0, TAU); c.stroke();
    c.save(); c.beginPath(); c.ellipse(W / 2, H / 2, rx, ry, 0, 0, TAU); c.clip(); c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = u * 0.4 * px(c);
    c.beginPath(); outer(c, W, H); c.ellipse(W / 2, H / 2, rx, ry, 0, 0, TAU); c.fill("evenodd"); c.restore();
  }),
  F("cameo", "Viñetas y formas", "Camafeo dorado", (c, W, H, u) => {
    const rx = W * 0.38, ry = H * 0.4;
    c.beginPath(); outer(c, W, H); c.ellipse(W / 2, H / 2, rx, ry, 0, 0, TAU); c.fillStyle = "rgb(30,22,18)"; c.fill("evenodd");
    for(const [w2, col] of [[0.6, "#6b4a12"], [0.42, "#e8c66a"], [0.22, "#a77a24"], [0.08, "#f4dc8c"]]){ c.lineWidth = u * w2; c.strokeStyle = col; c.beginPath(); c.ellipse(W / 2, H / 2, rx + u * 0.25, ry + u * 0.25, 0, 0, TAU); c.stroke(); }
  }),
  F("circle", "Viñetas y formas", "Círculo", (c, W, H, u) => { const r = Math.min(W, H) * 0.45; shapeVignette(c, W, H, (cc, k) => { cc.moveTo(W / 2 + r * k, H / 2); cc.arc(W / 2, H / 2, r * k, 0, TAU); }, "rgb(18,16,14)", 0.6, "18,16,14"); }),
  F("rounded", "Viñetas y formas", "Esquinas redondeadas", (c, W, H, u) => band(c, W, H, "rgb(18,16,14)", u * 0.5, u * 0.5, W - u, H - u, Math.min(W, H) * 0.12)),
  F("arch", "Viñetas y formas", "Ventana en arco", (c, W, H, u) => {
    const t = u * 1.6, x = t, w = W - 2 * t, rx = w / 2, top = t + rx;
    c.beginPath(); outer(c, W, H); c.moveTo(x, H - t); c.lineTo(x, top); c.arc(W / 2, top, rx, Math.PI, 0); c.lineTo(W - t, H - t); c.closePath();
    c.fillStyle = "rgb(236,228,210)"; c.fill("evenodd");
    c.lineWidth = u * 0.15; c.strokeStyle = "rgba(120,90,50,.5)"; c.beginPath(); c.moveTo(x, H - t); c.lineTo(x, top); c.arc(W / 2, top, rx, Math.PI, 0); c.lineTo(W - t, H - t); c.closePath(); c.stroke();
  }),
  F("keyhole", "Viñetas y formas", "Ojo de cerradura", (c, W, H, u) => {
    const r = Math.min(W, H) * 0.24, cx = W / 2, cy = H * 0.4;
    // Un solo contorno: el arco del círculo enlaza con los lados de la ranura
    shapeVignette(c, W, H, (cc, k) => {
      const R2 = r * k, hw = r * 0.55 * k, a = Math.asin(Math.sqrt(1 - 0.55 ** 2));
      cc.moveTo(cx + hw, cy + Math.sin(a) * R2); cc.arc(cx, cy, R2, a, Math.PI - a, true);
      cc.lineTo(cx - r * 0.95 * k, H * 0.88); cc.lineTo(cx + r * 0.95 * k, H * 0.88); cc.closePath();
    }, "rgb(8,8,8)", 0.3, "8,8,8");
  }),
  F("heart", "Viñetas y formas", "Corazón de San Valentín", (c, W, H, u) => {
    const s = Math.min(W, H) * 0.47, cx = W / 2, cy = H / 2;
    const heart = (cc, k) => { const z = s * k; cc.moveTo(cx, cy + z * 0.85); cc.bezierCurveTo(cx - z * 1.3, cy + z * 0.1, cx - z * 0.9, cy - z * 0.95, cx, cy - z * 0.45); cc.bezierCurveTo(cx + z * 0.9, cy - z * 0.95, cx + z * 1.3, cy + z * 0.1, cx, cy + z * 0.85); cc.closePath(); };
    shapeVignette(c, W, H, heart, "rgb(236,196,204)", 0.5, "236,196,204");
  }),
  F("octagon", "Viñetas y formas", "Octógono", (c, W, H, u) => {
    const t = u * 1.2, k = Math.min(W, H) * 0.14;
    c.beginPath(); outer(c, W, H); c.moveTo(t + k, t); c.lineTo(W - t - k, t); c.lineTo(W - t, t + k); c.lineTo(W - t, H - t - k); c.lineTo(W - t - k, H - t); c.lineTo(t + k, H - t); c.lineTo(t, H - t - k); c.lineTo(t, t + k); c.closePath();
    c.fillStyle = "rgb(30,28,26)"; c.fill("evenodd");
  }),
  F("diamond", "Viñetas y formas", "Rombo", (c, W, H, u) => shapeVignette(c, W, H, (cc, k) => { cc.moveTo(W / 2, H * (0.5 - 0.47 * k)); cc.lineTo(W * (0.5 + 0.47 * k), H / 2); cc.lineTo(W / 2, H * (0.5 + 0.47 * k)); cc.lineTo(W * (0.5 - 0.47 * k), H / 2); cc.closePath(); }, "rgb(244,240,230)", 0.2, "244,240,230")),
  F("scallopOval", "Viñetas y formas", "Óvalo festoneado", (c, W, H, u) => {
    const rx = W * 0.4, ry = H * 0.4, n = 48;
    c.beginPath(); outer(c, W, H);
    for(let i = 0; i <= n * 8; i++){ const a = i / (n * 8) * TAU, bump = 1 + 0.035 * Math.abs(Math.sin(a * n / 2)); const x = W / 2 + Math.cos(a) * rx * bump, y = H / 2 + Math.sin(a) * ry * bump; if(i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.closePath(); c.fillStyle = "rgb(247,244,236)"; c.fill("evenodd");
  }),

  /* ── Pantallas y visores ── */
  F("crt", "Pantallas y visores", "Televisor de tubo", (c, W, H, u, R) => {
    const t = u * 2.2, r = Math.min(W, H) * 0.14;
    band(c, W, H, "rgb(58,48,40)", t, t, W - 2 * t, H - 2 * t, r);
    c.save(); clipFrame(c, W, H, t, t, W - 2 * t, H - 2 * t, r); fibers(c, R, 0, 0, W, H, 300, "#1a120c", u * 2, u * 0.05);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.35)"); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    c.save(); clipWin(c, t, t, W - 2 * t, H - 2 * t, r);
    c.fillStyle = "rgba(0,0,0,.12)"; for(let y = t; y < H - t; y += u * 0.18) c.fillRect(0, y, W, u * 0.06);
    const gl = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.6); gl.addColorStop(0, "rgba(0,0,0,0)"); gl.addColorStop(1, "rgba(0,0,0,.55)"); c.fillStyle = gl; c.fillRect(0, 0, W, H);
    const sh = c.createLinearGradient(t, t, W * 0.5, H * 0.5); sh.addColorStop(0, "rgba(255,255,255,.14)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); c.fillStyle = sh; c.fillRect(0, 0, W, H);
    c.restore();
  }),
  F("crtGreen", "Pantallas y visores", "Monitor de fósforo", (c, W, H, u) => {
    const t = u * 1.8, r = u * 1.5;
    band(c, W, H, "rgb(200,196,184)", t, t, W - 2 * t, H - 2 * t, r);
    c.save(); clipWin(c, t, t, W - 2 * t, H - 2 * t, r); c.globalCompositeOperation = "source-over";
    c.fillStyle = "rgba(20,120,40,.28)"; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(0,0,0,.18)"; for(let y = 0; y < H; y += u * 0.16) c.fillRect(0, y, W, u * 0.06);
    c.restore();
    label(c, "READY.", t + u * 0.6, t + u * 1, u * 0.8, "rgba(170,255,170,.9)", "700");
  }),
  F("camcorder", "Pantallas y visores", "Videocámara REC", (c, W, H, u) => {
    const m = u * 1.2, L = u * 2.5;
    c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = u * 0.18;
    for(const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]){ c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); }
    c.fillStyle = "rgb(235,40,40)"; c.beginPath(); c.arc(m + u * 1.6, m + u * 1.4, u * 0.45, 0, TAU); c.fill();
    label(c, "REC", m + u * 2.4, m + u * 1.45, u * 1.0, "rgba(255,255,255,.95)", "800", "left", "sans-serif");
    label(c, "SP  0:04:27", W - m - u * 0.8, m + u * 1.45, u * 0.9, "rgba(255,255,255,.95)", "700", "right");
    c.strokeStyle = "rgba(255,255,255,.95)"; c.lineWidth = u * 0.12; c.strokeRect(W - m - u * 3.2, H - m - u * 2, u * 2.2, u * 1); c.fillStyle = "rgba(255,255,255,.95)"; c.fillRect(W - m - u * 3.05, H - m - u * 1.85, u * 1.4, u * 0.7); c.fillRect(W - m - u * 0.95, H - m - u * 1.7, u * 0.2, u * 0.4);
    label(c, "12.JUL.1994", m + u * 0.8, H - m - u * 1.4, u * 0.9, "rgba(255,255,255,.95)", "700");
  }),
  F("viewfinder", "Pantallas y visores", "Visor de cámara", (c, W, H, u) => {
    const r = Math.min(W, H) * 0.1;
    band(c, W, H, "rgb(8,8,8)", u * 1.2, u * 1.2, W - u * 2.4, H - u * 2.4, r);
    c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = u * 0.08;
    const cx = W / 2, cy = H / 2, rr2 = Math.min(W, H) * 0.08;
    c.beginPath(); c.arc(cx, cy, rr2, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, rr2 * 0.35, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(cx - rr2 * 0.35, cy); c.lineTo(cx + rr2 * 0.35, cy); c.stroke();
    label(c, "1/125   f5.6   ISO 400", W / 2, H - u * 0.6, u * 0.6, "rgba(120,255,140,.9)", "700", "center");
  }),
  F("rangefinder", "Pantallas y visores", "Líneas de telémetro", (c, W, H, u) => {
    c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = u * 0.1;
    const m = Math.min(W, H) * 0.12, L = u * 2.2;
    for(const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]){ c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); }
    c.fillStyle = "rgba(255,220,150,.18)"; c.fillRect(W / 2 - u * 1.4, H / 2 - u * 1, u * 2.8, u * 2);
    c.strokeStyle = "rgba(255,220,150,.6)"; c.strokeRect(W / 2 - u * 1.4, H / 2 - u * 1, u * 2.8, u * 2);
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }),
  F("vhs", "Pantallas y visores", "Cinta VHS", (c, W, H, u, R) => {
    c.fillStyle = "rgba(255,255,255,.08)";
    for(let i = 0; i < 6; i++){ const y = H * (0.82 + R() * 0.15); c.fillRect(0, y, W, u * (0.1 + R() * 0.3)); }
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(0, H - u * 0.9, W, u * 0.9);
    label(c, "▶ PLAY", u * 1.2, u * 1.6, u * 1.1, "rgba(255,255,255,.92)", "800", "left", "sans-serif");
    label(c, "SLP", W - u * 1.2, u * 1.6, u * 1.0, "rgba(255,255,255,.92)", "700", "right");
    label(c, "00:17:42", u * 1.2, H - u * 2, u * 1.0, "rgba(255,255,255,.92)", "700");
    c.fillStyle = "rgba(255,40,80,.12)"; c.fillRect(0, H * 0.3 + R() * H * 0.3, W, u * 0.15);
  }),
  F("projector", "Pantallas y visores", "Proyección en la pared", (c, W, H, u) => {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.8, "rgba(20,14,8,.55)"); g.addColorStop(1, "rgba(10,8,6,.9)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.beginPath(); outer(c, W, H); c.moveTo(W * 0.05, H * 0.07); c.lineTo(W * 0.95, H * 0.07); c.lineTo(W * 0.98, H * 0.95); c.lineTo(W * 0.02, H * 0.95); c.closePath(); c.fillStyle = "rgb(26,22,18)"; c.fill("evenodd");
  }),
  F("leader", "Pantallas y visores", "Cuenta atrás de cine", (c, W, H, u) => {
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.36;
    c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = u * 0.12;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.82, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(0, cy); c.lineTo(W, cy); c.moveTo(cx, 0); c.lineTo(cx, H); c.stroke();
    c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r * 0.82, -Math.PI / 2, 0.8); c.closePath(); c.fill();
    label(c, "3", cx, cy, r * 0.9, "rgba(255,255,255,.55)", "800", "center", "sans-serif");
  }),
  F("pinhole", "Pantallas y visores", "Estenopeica", (c, W, H, u) => {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.hypot(W, H) * 0.52);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.55, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,.95)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }),
  F("binoculars", "Pantallas y visores", "Prismáticos", (c, W, H, u) => {
    const r = Math.min(W * 0.3, H * 0.46), cy = H / 2, d = r * 0.8;
    shapeVignette(c, W, H, [(cc, k) => { cc.moveTo(W / 2 - d + r * k, cy); cc.arc(W / 2 - d, cy, r * k, 0, TAU); }, (cc, k) => { cc.moveTo(W / 2 + d + r * k, cy); cc.arc(W / 2 + d, cy, r * k, 0, TAU); }], "rgb(5,5,5)", 0.25, "5,5,5");
  }),

  /* ── Desgaste ── */
  F("burnt", "Desgaste", "Bordes quemados", rough("rgb(12,8,4)", { width: 1.2, amp: 1.6, soft: "rgb(120,60,10)", inner: "rgb(70,30,6)" })),
  F("water", "Desgaste", "Dañada por el agua", (c, W, H, u, R) => {
    rough("rgba(150,120,70,.45)", { width: 2.6, amp: 2.4 })(c, W, H, u, R);
    rough("rgb(236,226,204)", { width: 1, amp: 0.8 })(c, W, H, u, R);
  }),
  F("grungeBlack", "Desgaste", "Grunge negro", rough("rgb(10,10,10)", { width: 1.1, amp: 1.4, spots: "#000" })),
  F("grungeWhite", "Desgaste", "Grunge blanco", rough("rgb(244,242,236)", { width: 1.1, amp: 1.4, spots: "#fff" })),
  F("brush", "Desgaste", "Pincelada negra", (c, W, H, u, R) => {
    c.fillStyle = "rgb(12,12,12)";
    const n = fbm(R, 5);
    for(let pass = 0; pass < 3; pass++) wobblyBand(c, W, H, "rgba(12,12,12,.6)", u * (0.8 + pass * 0.3), u * (0.8 + pass * 0.3), W - u * (1.6 + pass * 0.6), H - u * (1.6 + pass * 0.6), t => u * 1.2 * Math.abs(n(t * 13 + pass)), 900);
  }),
  F("leakEdge", "Desgaste", "Borde velado de luz", (c, W, H, u, R) => {
    for(const side of [0, 1]){
      const x = side ? W : 0, g = c.createLinearGradient(x, 0, side ? W - W * 0.3 : W * 0.3, 0);
      g.addColorStop(0, "rgba(255,90,20,.85)"); g.addColorStop(0.35, "rgba(255,170,60,.35)"); g.addColorStop(1, "rgba(255,200,120,0)");
      c.fillStyle = g; c.fillRect(side ? W * 0.7 : 0, 0, W * 0.3, H);
    }
    film({ text: false })(c, W, H, u * 0.8, R);
  }),
  F("mold", "Desgaste", "Moho y humedad", (c, W, H, u, R) => {
    for(let i = 0; i < 70; i++){
      const e = R(), x = e < .5 ? (R() < .5 ? R() * u * 4 : W - R() * u * 4) : R() * W, y = e < .5 ? R() * H : (R() < .5 ? R() * u * 4 : H - R() * u * 4), r = u * (0.3 + R() * 2.2);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R() < .5 ? "90,110,60" : "140,120,60"},.45)`); g.addColorStop(1, "rgba(90,110,60,0)");
      c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    edged(CREAM, "deckle", { width: 0.9, amp: 0.4 })(c, W, H, u, R);
  }),
  F("frayed", "Desgaste", "Lienzo deshilachado", (c, W, H, u, R) => {
    const t = u * 1.1;
    rough("rgb(220,208,184)", { width: 1.1, amp: 0.7 })(c, W, H, u, R);
    c.strokeStyle = "rgba(120,100,70,.55)"; c.lineWidth = u * 0.04;
    for(let i = 0; i < 260; i++){ const e = R(), x = e < .5 ? (R() < .5 ? t + R() * u : W - t - R() * u) : R() * W, y = e < .5 ? R() * H : (R() < .5 ? t + R() * u : H - t - R() * u), a = R() * TAU, l = u * (0.3 + R() * 1.4); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  }),
  F("scratchedBlack", "Desgaste", "Negro rayado", (c, W, H, u, R) => {
    const t = u * 1.3;
    band(c, W, H, "rgb(14,14,14)", t, t, W - 2 * t, H - 2 * t);
    c.save(); clipFrame(c, W, H, t, t, W - 2 * t, H - 2 * t); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = u * 0.04;
    for(let i = 0; i < 180; i++){ const x = R() * W, y = R() * H, a = R() * TAU, l = u * (0.5 + R() * 4); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } c.restore();
  }),
  F("dusty", "Desgaste", "Borde polvoriento", (c, W, H, u, R) => {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, "rgba(120,100,70,0)"); g.addColorStop(1, "rgba(120,100,70,.7)"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    speckle(c, R, 0, 0, W, H, 2500, "#2a2016", u * 0.03, u * 0.12, 0.05, 0.4);
  }),

  /* ── Decorativos ── */
  F("lace", "Decorativos", "Puntilla de encaje", (c, W, H, u, R) => {
    const t = u * 1.6;
    edged("rgb(250,248,242)", "scallop", { width: 1.6, amp: 0.55, pitch: 1 })(c, W, H, u, R);
    c.save(); c.beginPath(); outer(c, W, H); rr(c, t * 1.2, t * 1.2, W - t * 2.4, H - t * 2.4); c.clip("evenodd");
    c.fillStyle = "rgb(70,62,58)";
    for(let x = u * 0.5; x < W; x += u * 1){ for(const y of [t * 0.55, H - t * 0.55]){ c.beginPath(); c.arc(x, y, u * 0.2, 0, TAU); c.fill(); } }
    for(let y = u * 0.5; y < H; y += u * 1){ for(const x of [t * 0.55, W - t * 0.55]){ c.beginPath(); c.arc(x, y, u * 0.2, 0, TAU); c.fill(); } }
    c.restore();
  }),
  F("floral", "Decorativos", "Esquinas florales", (c, W, H, u, R) => {
    const t = u * 1.2;
    band(c, W, H, "rgb(248,244,236)", t, t, W - 2 * t, H - 2 * t);
    const leaf = (x, y, a, s, col) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); c.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0); c.fill(); c.restore(); };
    for(const [x, y, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]){
      c.save(); c.translate(x + sx * t, y + sy * t); c.scale(sx, sy);
      for(let i = 0; i < 7; i++) leaf(u * 0.3 * i, u * 0.2 * i, 0.3 + i * 0.12, u * (2.2 - i * 0.15), i % 2 ? "rgb(110,140,90)" : "rgb(80,110,70)");
      for(let i = 0; i < 3; i++){ c.fillStyle = ["rgb(214,120,140)", "rgb(236,170,120)", "rgb(200,90,110)"][i]; c.beginPath(); c.arc(u * (0.8 + i * 1.3), u * (0.6 + i * 0.2), u * 0.55, 0, TAU); c.fill(); c.fillStyle = "rgba(255,255,255,.5)"; c.beginPath(); c.arc(u * (0.8 + i * 1.3), u * (0.6 + i * 0.2), u * 0.2, 0, TAU); c.fill(); }
      c.restore();
    }
  }),
  F("nouveau", "Decorativos", "Modernista", (c, W, H, u) => {
    const t = u * 1.8;
    band(c, W, H, "rgb(40,60,52)", t, t, W - 2 * t, H - 2 * t, u * 0.8);
    c.strokeStyle = "rgb(214,182,116)"; c.lineWidth = u * 0.12;
    c.beginPath(); rr(c, t * 0.35, t * 0.35, W - t * 0.7, H - t * 0.7, u * 1.2); c.stroke();
    for(const [x, y, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]){
      c.save(); c.translate(x, y); c.scale(sx, sy); c.beginPath();
      for(let i = 0; i < 3; i++){ c.moveTo(t * 0.35, t * (1.2 + i)); c.bezierCurveTo(t * 1.5, t * (0.8 + i * 0.5), t * (0.8 + i * 0.4), t * 1.5, t * (1.2 + i), t * 0.35); }
      c.stroke(); c.restore();
    }
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, u * 0.8, u * 0.3, 0.4);
  }),
  F("ribbon", "Decorativos", "Cintas en las esquinas", (c, W, H, u, R) => {
    band(c, W, H, "rgb(250,248,242)", u, u, W - 2 * u, H - 2 * u);
    for(const [x, y, a, sx, sy] of [[0, 0, -Math.PI / 4, 1, 1], [W, 0, Math.PI / 4, -1, 1], [0, H, Math.PI / 4, 1, -1], [W, H, -Math.PI / 4, -1, -1]]){
      c.save(); c.translate(x + sx * u * 2.2, y + sy * u * 2.2); c.rotate(a); c.fillStyle = "rgb(190,40,60)"; c.fillRect(-u * 6, -u * 0.7, u * 12, u * 1.4); c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(-u * 6, -u * 0.7, u * 12, u * 0.25); c.restore();
    }
  }),
  F("greek", "Decorativos", "Greca griega", border("rgb(236,228,210)", (c, u, t, p) => {
    c.strokeStyle = "rgb(140,40,30)"; c.lineWidth = u * 0.14; const s = t * 0.28;
    c.beginPath(); c.moveTo(0, s); c.lineTo(0, -s); c.lineTo(p * 0.7, -s); c.lineTo(p * 0.7, s * 0.4); c.lineTo(p * 0.3, s * 0.4); c.lineTo(p * 0.3, -s * 0.2); c.moveTo(p * 0.7, s); c.lineTo(p, s); c.stroke();
  }, { width: 1.4, pitch: 1.5 })),
  F("rope", "Decorativos", "Cuerda", border("rgb(92,70,44)", (c, u, t, p) => {
    c.fillStyle = "rgb(214,186,130)"; c.save(); c.rotate(0.6); c.beginPath(); c.ellipse(0, 0, p * 0.62, t * 0.22, 0, 0, TAU); c.fill(); c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(p * 0.1, t * 0.08, p * 0.5, t * 0.08, 0, 0, TAU); c.fill(); c.restore();
  }, { width: 1, pitch: 0.55 })),
  F("checker", "Decorativos", "Tablero de ajedrez", border("#fff", (c, u, t, p, i) => {
    c.fillStyle = "#111"; if(i % 2) c.fillRect(0, -t / 2, p, t / 2); else c.fillRect(0, 0, p, t / 2);
  }, { width: 1.1, pitch: 0.55 })),
  F("polka", "Decorativos", "Lunares", border("rgb(220,60,70)", (c, u, t, p, i) => {
    c.fillStyle = "#fff"; c.beginPath(); c.arc(p / 2, (i % 2 ? -1 : 1) * t * 0.18, t * 0.16, 0, TAU); c.fill();
  }, { width: 1.3, pitch: 0.7 })),
  F("candy", "Decorativos", "Rayas de caramelo", border("#fff", (c, u, t, p) => {
    c.fillStyle = "rgb(220,40,60)"; c.beginPath(); c.moveTo(0, -t / 2); c.lineTo(p * 0.5, -t / 2); c.lineTo(p * 0.5 - t, t / 2); c.lineTo(-t, t / 2); c.closePath(); c.fill();
  }, { width: 1, pitch: 1 })),
  F("stars", "Decorativos", "Estrellas", border("rgb(24,36,86)", (c, u, t, p, i) => {
    const r = t * 0.22; c.fillStyle = i % 3 ? "rgb(255,230,140)" : "#fff"; c.beginPath();
    for(let k = 0; k < 10; k++){ const a = k / 10 * TAU - Math.PI / 2, rr2 = k % 2 ? r * 0.45 : r; c.lineTo(p / 2 + Math.cos(a) * rr2, Math.sin(a) * rr2); } c.closePath(); c.fill();
  }, { width: 1.3, pitch: 1.1 })),
  F("rainbow70", "Decorativos", "Arcoíris setentero", (c, W, H, u) => {
    const cols = ["rgb(90,50,30)", "rgb(200,90,30)", "rgb(236,150,40)", "rgb(240,200,80)"], s = u * 0.45;
    cols.forEach((col, i) => band(c, W, H, col, s * (i + 1), s * (i + 1), W - 2 * s * (i + 1), H - 2 * s * (i + 1), u * (2.2 - i * 0.4)));
    band(c, W, H, "rgb(248,236,208)", s * 5, s * 5, W - 10 * s, H - 10 * s, u * 0.8);
  }),
  F("neon80", "Decorativos", "Neón ochentero", (c, W, H, u) => {
    const t = u * 1.4;
    band(c, W, H, "rgb(20,10,40)", t, t, W - 2 * t, H - 2 * t);
    for(const [col, k] of [["rgba(255,40,200,.9)", 0.35], ["rgba(40,220,255,.9)", 0.75]]){
      c.save(); c.shadowColor = col; c.shadowBlur = u * 0.6 * px(c); c.strokeStyle = col; c.lineWidth = u * 0.12; c.beginPath(); rr(c, t * k, t * k, W - 2 * t * k, H - 2 * t * k, u * 0.4); c.stroke(); c.restore();
    }
  }),
  F("zigzagColor", "Decorativos", "Zigzag de colores", border("rgb(250,240,220)", (c, u, t, p, i) => {
    c.strokeStyle = ["rgb(230,90,60)", "rgb(60,150,170)", "rgb(240,190,60)"][i % 3]; c.lineWidth = u * 0.22; c.beginPath(); c.moveTo(0, t * 0.2); c.lineTo(p / 2, -t * 0.2); c.lineTo(p, t * 0.2); c.stroke();
  }, { width: 1.1, pitch: 0.9 })),
  F("tiles", "Decorativos", "Azulejo", border("rgb(242,240,234)", (c, u, t, p, i) => {
    c.strokeStyle = "rgb(30,70,150)"; c.lineWidth = u * 0.1; c.strokeRect(0, -t * 0.45, p, t * 0.9);
    c.beginPath(); c.arc(p / 2, 0, t * 0.28, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(p / 2, -t * 0.28); c.lineTo(p / 2, t * 0.28); c.moveTo(p / 2 - t * 0.28, 0); c.lineTo(p / 2 + t * 0.28, 0); c.stroke();
  }, { width: 1.6, pitch: 1.6 })),

  /* ── Álbum y recortes ── */
  F("cornersBlack", "Álbum y recortes", "Esquinas negras de álbum", (c, W, H, u) => {
    band(c, W, H, "rgb(34,32,30)", u * 1.2, u * 1.2, W - u * 2.4, H - u * 2.4);
    const s = u * 2.4, m = u * 1.2;
    albumCorner(c, m, m, s, 1, 1, "rgb(10,10,10)"); albumCorner(c, W - m, m, s, -1, 1, "rgb(10,10,10)"); albumCorner(c, m, H - m, s, 1, -1, "rgb(10,10,10)"); albumCorner(c, W - m, H - m, s, -1, -1, "rgb(10,10,10)");
  }),
  F("cornersGold", "Álbum y recortes", "Esquinas doradas", (c, W, H, u) => {
    band(c, W, H, "rgb(240,232,214)", u * 1.2, u * 1.2, W - u * 2.4, H - u * 2.4);
    const s = u * 2.4, m = u * 1.2, g = "rgb(200,160,70)";
    albumCorner(c, m, m, s, 1, 1, g); albumCorner(c, W - m, m, s, -1, 1, g); albumCorner(c, m, H - m, s, 1, -1, g); albumCorner(c, W - m, H - m, s, -1, -1, g);
  }),
  F("cornersWhite", "Álbum y recortes", "Esquinas blancas en papel negro", (c, W, H, u) => {
    band(c, W, H, "rgb(20,20,20)", u * 1.6, u * 1.6, W - u * 3.2, H - u * 3.2);
    const s = u * 2.2, m = u * 1.6, g = "rgb(236,234,228)";
    albumCorner(c, m, m, s, 1, 1, g); albumCorner(c, W - m, m, s, -1, 1, g); albumCorner(c, m, H - m, s, 1, -1, g); albumCorner(c, W - m, H - m, s, -1, -1, g);
  }),
  F("washi", "Álbum y recortes", "Cintas washi", (c, W, H, u, R) => {
    tape(c, R, u * 2, u * 2, u * 9, u * 1.8, -0.7, "rgb(240,150,170)", 0.75);
    tape(c, R, W - u * 2, H - u * 2, u * 9, u * 1.8, -0.7, "rgb(140,200,220)", 0.75);
    tape(c, R, W - u * 2.2, u * 2, u * 7, u * 1.6, 0.8, "rgb(250,220,120)", 0.7);
  }),
  F("clip", "Álbum y recortes", "Clip de papelería", (c, W, H, u) => {
    band(c, W, H, "rgb(248,246,240)", u * 0.9, u * 0.9, W - u * 1.8, H - u * 1.8);
    c.strokeStyle = "rgb(110,116,124)"; c.lineWidth = u * 0.32; c.lineCap = "round";
    const x = W * 0.18, y = -u * 0.5, L = u * 6, w = u * 1.4;
    c.beginPath(); c.moveTo(x, y + L); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + L * 0.9); c.arc(x + w * 0.65, y + L * 0.9, w * 0.35, 0, Math.PI); c.lineTo(x + w * 0.3, y + w); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = u * 0.08; c.beginPath(); c.moveTo(x - u * 0.05, y + L * 0.9); c.lineTo(x - u * 0.05, y + w); c.stroke();
  }),
  F("pin", "Álbum y recortes", "Chincheta", (c, W, H, u) => {
    band(c, W, H, "rgb(248,246,240)", u * 0.9, u * 0.9, W - u * 1.8, H - u * 1.8);
    const x = W / 2, y = u * 1.4, r = u * 1.1;
    c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(x + u * 0.35, y + u * 0.45, r, 0, TAU); c.fill();
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, "rgb(255,140,140)"); g.addColorStop(1, "rgb(170,20,30)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }),
  F("staples", "Álbum y recortes", "Grapas", (c, W, H, u) => {
    band(c, W, H, "rgb(248,246,240)", u * 0.9, u * 0.9, W - u * 1.8, H - u * 1.8);
    c.strokeStyle = "rgb(170,172,176)"; c.lineWidth = u * 0.2; c.lineCap = "butt";
    for(const [x, y, a] of [[u * 2.5, u * 1.2, -0.3], [W - u * 2.5, u * 1.2, 0.3]]){ c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(-u * 1.2, 0); c.lineTo(u * 1.2, 0); c.stroke(); c.restore(); }
  }),
  F("scrapbook", "Álbum y recortes", "Recorte de cuaderno", (c, W, H, u, R) => {
    edged("rgb(252,250,244)", "deckle", { width: 1.5, amp: 1.2 })(c, W, H, u, R);
    tape(c, R, W * 0.5, u * 0.9, W * 0.22, u * 1.6, (R() - 0.5) * 0.2, "rgb(230,220,190)", 0.7);
    tape(c, R, W * 0.12, H - u * 1.2, W * 0.16, u * 1.4, 0.5, "rgb(230,220,190)", 0.6);
  }),
  F("kraft", "Álbum y recortes", "Papel kraft", (c, W, H, u, R) => {
    const t = u * 1.6;
    band(c, W, H, "rgb(176,140,98)", t, t, W - 2 * t, H - 2 * t);
    c.save(); clipFrame(c, W, H, t, t, W - 2 * t, H - 2 * t); fibers(c, R, 0, 0, W, H, 700, "#5a3e20", u * 1.2, u * 0.04); c.restore();
    c.strokeStyle = "rgba(255,255,255,.7)"; c.setLineDash([u * 0.5, u * 0.35]); c.lineWidth = u * 0.1; c.beginPath(); rr(c, t * 0.45, t * 0.45, W - t * 0.9, H - t * 0.9); c.stroke(); c.setLineDash([]);
    innerShadow(c, W, H, t, t, W - 2 * t, H - 2 * t, 0, u * 0.25, 0.4);
  })
];

const FRAMES_BY_ID = Object.fromEntries(FRAMES.map(f => [f.id, f]));
export const frameById = id => FRAMES_BY_ID[id] || null;

/* Dibuja el marco `s.frame` (si hay) sobre `ctx`, en coordenadas de la
   imagen completa W×H (el llamante ya ha puesto la transformación). */
export function drawFrame(ctx, W, H, s){
  const f = frameById(s.frame);
  if(!f) return;
  const k = 1 + (s.frameWidth || 0) / 100 * 1.2;
  const u = Math.min(W, H) * 0.04 * k;
  let h = 2166136261; for(const ch of f.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const R = rng(((s.seed || 1) * 977) ^ h);
  ctx.save(); ctx.globalAlpha = 1; ctx.lineCap = "butt"; ctx.setLineDash([]);
  try{ f.draw(ctx, W, H, u, R); }
  finally{ ctx.restore(); }
}
