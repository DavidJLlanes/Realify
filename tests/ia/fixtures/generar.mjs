/* ═══════════════════════════════════════════════════════════════
   FIXTURES SINTÉTICAS · generador de imágenes de prueba para tests/ia/
   Escribe PNG deterministas (sin derechos: se generan aquí) para que las pruebas del motor no dependan de fotos de nadie:
     retrato-sintetico.png  512×512 · fondo en degradado, óvalo de «piel» con ojos y boca, y una banda de tela
     degradado.png          256×256 · degradado horizontal de gris con ruido leve (para probar luz y tonos)
     tejido.png             256×256 · trama de hilos con «pliegues» suaves de luz (para probar arrugas de tela)
   Uso:  node tests/ia/fixtures/generar.mjs     (se ejecuta sólo cuando cambie el generador; los PNG se guardan en el repositorio)
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const crcTab = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcTab[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, "ascii"); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function retrato() {
  const W = 512, H = 512, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, t = (x + y) / (W + H);
    let r = 60 + 90 * t, g = 80 + 80 * t, b = 120 + 60 * t;
    const dx = (x - 256) / 120, dy = (y - 230) / 160;
    if (dx * dx + dy * dy < 1) { const s = 1 - 0.25 * (dx * dx + dy * dy); r = 222 * s; g = 170 * s; b = 140 * s; }
    for (const ex of [-45, 45]) { const ax = (x - 256 - ex) / 16, ay = (y - 210) / 8; if (ax * ax + ay * ay < 1) { r = 40; g = 30; b = 30; } }
    const mx = (x - 256) / 34, my = (y - 300) / 9; if (mx * mx + my * my < 1) { r = 170; g = 70; b = 80; }
    if (y > 420) { const f = Math.sin(x / 9) * 12; r = 90 + f; g = 110 + f; b = 160 + f; }
    const n = (rnd() - 0.5) * 6;
    px[i] = r + n; px[i + 1] = g + n; px[i + 2] = b + n; px[i + 3] = 255;
  }
  return png(W, H, px);
}
function degradado() {
  const W = 256, H = 256, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = x + (rnd() - 0.5) * 4; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
  return png(W, H, px);
}
function tejido() {
  const W = 256, H = 256, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, trama = ((x >> 1) + (y >> 1)) & 1 ? 14 : -14;
    const pliegue = 38 * Math.sin(x / 23 + Math.sin(y / 41) * 2.2) * Math.cos(y / 31);
    const v = 150 + trama + pliegue + (rnd() - 0.5) * 4;
    px[i] = v * 0.9; px[i + 1] = v * 0.95; px[i + 2] = v; px[i + 3] = 255;
  }
  return png(W, H, px);
}
for (const [n, f] of [["retrato-sintetico.png", retrato], ["degradado.png", degradado], ["tejido.png", tejido]]) {
  seed = 12345;
  fs.writeFileSync(path.join(aqui, n), f());
  console.log("escrito", n);
}
