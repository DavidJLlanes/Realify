/* ═══════════════════════════════════════════════════════════════
   BANCO DE UNMARK · ESCENAS Y MARCAS SINTÉTICAS (F11.7)
   Se ejecuta DENTRO de la página (import dinámico desde Playwright). Genera 20 escenas limpias con semilla (cielo, degradados, texturas, bordes, ruido de sensor) y dibuja encima 4 tipos de marca con su máscara exacta.
   Entradas: escena(i) → canvas 640×480 limpio; marcar(canvas, tipo, i) → { canvas, verdad:Uint8Array(0/1), caja }. Salida: sólo datos de prueba; no se usa en la app.
   ═══════════════════════════════════════════════════════════════ */
export const W = 640, H = 480, N_ESCENAS = 20;
export const TIPOS = ["texto", "esquina", "fecha", "mosaico"];

const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

export function escena(i){
  const r = rng(1234 + i * 77), c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), tipo = i % 5;
  const g = x.createLinearGradient(0, 0, r() * W, H);
  g.addColorStop(0, `hsl(${r() * 360},${30 + r() * 40}%,${35 + r() * 35}%)`); g.addColorStop(1, `hsl(${r() * 360},${30 + r() * 40}%,${20 + r() * 40}%)`);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if(tipo >= 1){ // formas y bordes
    for(let k = 0; k < 6 + tipo * 4; k++){ x.fillStyle = `hsla(${r() * 360},50%,${20 + r() * 60}%,${0.4 + r() * 0.5})`; x.beginPath(); x.ellipse(r() * W, r() * H, 20 + r() * 120, 10 + r() * 90, r() * 3, 0, 7); x.fill(); }
  }
  if(tipo >= 2){ // textura de hojas/ladrillo
    for(let k = 0; k < 900 * (tipo - 1); k++){ x.fillStyle = `rgba(${r() * 255 | 0},${r() * 255 | 0},${r() * 255 | 0},0.12)`; x.fillRect(r() * W, r() * H, 3 + r() * 14, 2 + r() * 6); }
  }
  const d = x.getImageData(0, 0, W, H), a = d.data, sg = tipo === 4 ? 9 : 3; // ruido de sensor
  for(let q = 0; q < a.length; q += 4){ const n = (r() + r() + r() - 1.5) * sg; a[q] += n; a[q + 1] += n; a[q + 2] += n; }
  x.putImageData(d, 0, 0); return c;
}

export function marcar(limpio, tipo, i){
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(limpio, 0, 0);
  const m = document.createElement("canvas"); m.width = W; m.height = H; const mx = m.getContext("2d"); // la verdad se dibuja en blanco sobre negro
  mx.fillStyle = "#000"; mx.fillRect(0, 0, W, H);
  const dibujar = (f, ctxs) => { for(const k of ctxs) f(k); };
  let caja;
  if(tipo === "texto"){ // rótulo claro con sombra, abajo
    const t = "© FOTOGRAFÍA " + (1000 + i), fs = 30; caja = null;
    const pinta = (k, col, sh) => { k.font = `bold ${fs}px sans-serif`; k.textBaseline = "alphabetic"; if(sh){ k.shadowColor = "rgba(0,0,0,.55)"; k.shadowBlur = 3; } k.fillStyle = col; k.fillText(t, 30, H - 28); k.shadowBlur = 0; };
    x.globalAlpha = 0.85; pinta(x, "#fff", true); x.globalAlpha = 1; pinta(mx, "#fff", false);
    caja = { x: 30, y: H - 28 - fs, w: x.measureText(t).width, h: fs + 8 };
  } else if(tipo === "esquina"){ // logo de stock: círculo + palabra, arriba-derecha
    const cx = W - 110, cy = 46;
    const logo = k => { k.beginPath(); k.arc(cx, cy, 20, 0, 7); k.fill(); k.font = "bold 22px sans-serif"; k.fillText("STOCK", cx + 26, cy + 8); };
    x.globalAlpha = 0.7; x.fillStyle = "#fff"; logo(x); x.globalAlpha = 1; mx.fillStyle = "#fff"; logo(mx);
    caja = { x: cx - 22, y: cy - 22, w: 150, h: 44 };
  } else if(tipo === "fecha"){ // sello de fecha naranja de cámara compacta
    const t = "'26 11 06";
    const pinta = (k, col) => { k.font = "bold 26px monospace"; k.fillStyle = col; k.fillText(t, W - 170, H - 30); };
    x.globalAlpha = 0.95; pinta(x, "#ff8a1c"); x.globalAlpha = 1; pinta(mx, "#fff");
    caja = { x: W - 172, y: H - 54, w: 140, h: 32 };
  } else { // mosaico diagonal semitransparente por toda la foto
    const marca = k => { k.save(); k.rotate(-0.5); k.font = "bold 28px sans-serif"; for(let yy = -400; yy < H + 400; yy += 140) for(let xx = -200; xx < W + 400; xx += 260) k.fillText("realify.es", xx, yy); k.restore(); };
    x.globalAlpha = 0.28; x.fillStyle = "#fff"; marca(x); x.globalAlpha = 1; mx.fillStyle = "#fff"; marca(mx);
    caja = { x: 0, y: 0, w: W, h: H };
  }
  const md = mx.getImageData(0, 0, W, H).data, verdad = new Uint8Array(W * H);
  for(let q = 0; q < verdad.length; q++) verdad[q] = md[q * 4] > 100 ? 1 : 0;
  return { canvas: c, verdad, caja };
}

/* PSNR (dB, sobre 255) y SSIM (ventanas 8×8, luminancia) de `a` frente a `b` dentro de la zona `zona` (Uint8Array 0/1). */
export function medir(a, b, zona){
  const L = d => { const o = new Float32Array(W * H); for(let q = 0; q < o.length; q++) o[q] = 0.299 * d[q * 4] + 0.587 * d[q * 4 + 1] + 0.114 * d[q * 4 + 2]; return o; };
  const la = L(a), lb = L(b); let se = 0, n = 0;
  for(let q = 0; q < la.length; q++) if(zona[q]){ const e = la[q] - lb[q]; se += e * e; n++; }
  const psnr = n ? (se ? 10 * Math.log10(255 * 255 / (se / n)) : 99) : 99;
  let ss = 0, ns = 0; const C1 = 6.5025, C2 = 58.5225;
  for(let y = 0; y + 8 <= H; y += 4) for(let xx = 0; xx + 8 <= W; xx += 4){
    let hit = 0; for(let j = 0; j < 8; j++) for(let k = 0; k < 8; k++) hit += zona[(y + j) * W + xx + k]; if(!hit) continue;
    let ma = 0, mb = 0; for(let j = 0; j < 8; j++) for(let k = 0; k < 8; k++){ ma += la[(y + j) * W + xx + k]; mb += lb[(y + j) * W + xx + k]; } ma /= 64; mb /= 64;
    let va = 0, vb = 0, cv = 0; for(let j = 0; j < 8; j++) for(let k = 0; k < 8; k++){ const p = la[(y + j) * W + xx + k] - ma, q2 = lb[(y + j) * W + xx + k] - mb; va += p * p; vb += q2 * q2; cv += p * q2; } va /= 63; vb /= 63; cv /= 63;
    ss += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); ns++;
  }
  return { psnr, ssim: ns ? ss / ns : 1 };
}
