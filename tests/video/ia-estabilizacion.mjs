/* ═════════════════════════════════════════════════
   PRUEBA · estabilización (motor puro) y composición del fondo (motor puro), más los efectos «fondo» y «estabilizar» en el navegador con un alfa inyectado. Uso: CHROME_EXE=… node tests/video/ia-estabilizacion.mjs
   ═════════════════════════════════════════════════ */
import { perfiles, desplazamiento1D, estimar, crearEstabilizador } from "../../plugins/video/effects/estabilizar/engine.js";
import { suavizarTemporal, escalarAlfa, endurecer, componer } from "../../plugins/video/effects/fondo/engine.js";
import { abrir } from "../ia/lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

// escena sintética: manchas suaves; desplazada (sx, sy)
const W = 96, H = 64;
const escena = (sx, sy) => { const g = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x - sx, v = y - sy; g[y * W + x] = 128 + 60 * Math.sin(u / 7) * Math.cos(v / 9) + 40 * Math.sin(u / 17 + v / 13) + (u > 30 && u < 50 && v > 15 && v < 40 ? 50 : 0); } return g; };
for (const [sx, sy] of [[3, 0], [0, -4], [5, 2], [-2, 3], [0, 0]]) { const m = estimar(escena(0, 0), escena(sx, sy), W, H); ok(Math.abs(m.dx - sx) < 0.8 && Math.abs(m.dy - sy) < 0.8, `estima (${sx},${sy}) → (${m.dx.toFixed(2)},${m.dy.toFixed(2)})`); }
const plano = new Float32Array(W * H).fill(100); const mp = estimar(plano, plano, W, H); ok(mp.dx === 0 && mp.dy === 0, "imagen plana: sin corrección");

// temblor aleatorio sobre un travelling lento: la trayectoria corregida debe moverse menos
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const e = crearEstabilizador({ suavizado: 0.9 }); let sumaTemblor = 0, sumaFinal = 0, ant = null, antC = null;
for (let i = 0; i < 40; i++) { const px = Math.round(i * 0.3 + (rnd() - 0.5) * 8), py = Math.round((rnd() - 0.5) * 6); const c = e.paso(escena(px, py), W, H); const fx = px + c.dx; if (ant !== null) { sumaTemblor += Math.abs(px - ant); sumaFinal += Math.abs(fx - antC); } ant = px; antC = fx; }
ok(sumaFinal < sumaTemblor * 0.6, `estabiliza: salto medio ${(sumaTemblor / 39).toFixed(2)} → ${(sumaFinal / 39).toFixed(2)}`);
e.reiniciar(); const c0 = e.paso(escena(0, 0), W, H); ok(c0.dx === 0 && c0.dy === 0, "tras reiniciar el primer fotograma no se corrige");

// fondo: suavizado, escalado, composición
const a1 = new Float32Array(100).fill(1), a0 = new Float32Array(100).fill(0);
const s = suavizarTemporal(a1, a0.map(() => 0.9), 0.5); ok(Math.abs(s[0] - 0.95) < 1e-6, "suavizado temporal mezcla");
ok(suavizarTemporal(a1, a0, 0.5)[0] === 0, "corte de escena: reinicia");
ok(suavizarTemporal(null, a1, 0.5) === a1, "sin pasado devuelve el actual");
const esc = escalarAlfa(new Float32Array([0, 1, 0, 1]), 2, 5, 5); ok(esc[0] === 0 && esc[4] === 1 && esc[2] > 0.4 && esc[2] < 0.6, "escalado bilinear");
const d = endurecer(new Float32Array([0.05, 0.5, 0.95]), 1); ok(d[0] === 0 && d[2] === 1 && d[1] === 0.5, "endurecer");
const im = new Uint8ClampedArray([200, 0, 0, 255, 200, 0, 0, 255]), fo = new Uint8ClampedArray([0, 0, 100, 255, 0, 0, 100, 255]); componer(im, fo, new Float32Array([1, 0]));
ok(im[0] === 200 && im[4] === 0 && im[6] === 100 && im[7] === 255, "compone sujeto sobre fondo");

// efectos en el navegador
const nav = await abrir("escritorio"), { page } = nav;
const r = await page.evaluate(async () => {
  const F = await import("/plugins/video/effects/fondo/efecto.js"), S = await import("/plugins/video/effects/estabilizar/efecto.js");
  const src = Object.assign(document.createElement("canvas"), { width: 200, height: 120 }), x = src.getContext("2d"); x.fillStyle = "#e33"; x.fillRect(0, 0, 200, 120); x.fillStyle = "#fff"; x.fillRect(60, 30, 80, 60);
  const alfaDe = async () => { const n = 64, a = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) a[y * n + xx] = xx > 20 && xx < 44 ? 1 : 0; return { alfa: a, n }; };
  const px = (c, xx, yy) => Array.from(c.getContext("2d").getImageData(xx, yy, 1, 1).data);
  const o = {}, f = F.crear({ alfaDe }); f.prepare({ fps: 30 });
  const g = await f.process(src, { modo: "gris", fuerza: 100, estable: 0 }, 0); o.fondoGris = px(g, 10, 60); o.sujeto = px(g, 100, 60);
  const c = await F.crear({ alfaDe }).process(src, { modo: "color", color: "#00ff00", estable: 0 }, 0); o.fondoColor = px(c, 5, 5);
  const s = S.crear(); s.prepare({ fps: 30 }); const s1 = await s.process(src, { fuerza: 60, recorte: 10 }, 0), s2 = await s.process(src, { fuerza: 60, recorte: 10 }, 1 / 30); o.est = [s1.width, s1.height, s2.width]; o.estPx = px(s2, 100, 60);
  return o;
});
console.log(JSON.stringify(r));
ok(Math.abs(r.fondoGris[0] - r.fondoGris[1]) < 8 && Math.abs(r.fondoGris[1] - r.fondoGris[2]) < 8, "fondo gris fuera del sujeto");
ok(r.sujeto[0] > 240 && r.sujeto[1] > 240, "el sujeto conserva su color");
ok(r.fondoColor[1] > 200 && r.fondoColor[0] < 60, "fondo de color liso");
ok(r.est[0] === 200 && r.est[1] === 120 && r.estPx[0] > 200, "estabilizar conserva tamaño y dibuja");
ok(nav.errs.length === 0, "sin errores de página: " + nav.errs.join(" | "));
await nav.cerrar();
console.log(fallos ? `${fallos} fallos` : "OK · estabilización y fondo"); process.exit(fallos ? 1 : 0);
