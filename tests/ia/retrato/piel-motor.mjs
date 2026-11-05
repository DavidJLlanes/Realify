/* ═══════════════════════════════════════════════════════════════
   PRUEBA · motores de piel (Node, sin navegador)
   Piel sintética (degradado suave + grano fino) con un surco oscuro, una ojera, un brillo, un grano rojo y una zona lisa; comprueba que
   cada motor hace lo que dice y NO baja la textura de la piel por debajo de un umbral.
   Uso: node tests/ia/retrato/piel-motor.mjs
   ═══════════════════════════════════════════════════════════════ */
import { luma } from "../../../js/features/portrait/shared/planes.js";
import { stage as arrugas } from "../../../js/features/portrait/skin-wrinkles/engine.js";
import { stage as ojeras } from "../../../js/features/portrait/skin-dark-circles/engine.js";
import { stage as brillos } from "../../../js/features/portrait/skin-shine/engine.js";
import { stage as textura, detalleFino } from "../../../js/features/portrait/skin-texture/engine.js";
import { stage as igualar } from "../../../js/features/portrait/skin-even/engine.js";

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const W = 320, H = 320, n = W * H, F = 220;
const rnd = (() => { let s = 7; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5; })();

function piel(opts = {}){
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), Y = new Float32Array(n);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = y * W + x, base = 0.42 + 0.06 * Math.sin(x / 90) + 0.04 * (y / H), g = (opts.liso ? 0 : 0.03) * rnd() * 2;
    R[i] = base * 1.15 + g; G[i] = base * 0.85 + g; B[i] = base * 0.72 + g;
  }
  const p = { W, H, R, G, B, Y }; luma(p); return p;
}
const ctxDe = (p, zonas = {}) => {
  const uno = new Float32Array(n).fill(1), cero = new Float32Array(n);
  const z = k => zonas[k] || cero;
  return { ...p, F, piel: uno, cache: {}, zonas: { ovalo: uno, frente: z("frente"), entrecejo: z("entrecejo"), ojos: z("ojos"), ojeras: z("ojeras"), mejilla: z("mejilla"), surcos: z("surcos"), comisuras: z("comisuras"), cuello: z("cuello"), excluir: cero } };
};
const rect = (x0, y0, x1, y1) => { const m = new Float32Array(n); for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++) m[y * W + x] = 1; return m; };
const media = (a, m) => { let s = 0, c = 0; for(let i = 0; i < n; i++) if(m[i] > 0.5){ s += a[i]; c++; } return s / c; };
const hf = (Y, m) => { let s = 0, c = 0; for(let y = 2; y < H - 2; y++) for(let x = 2; x < W - 2; x++){ const i = y * W + x; if(m[i] > 0.5){ const d = Y[i] - (Y[i - 1] + Y[i + 1] + Y[i - W] + Y[i + W]) / 4; s += d * d; c++; } } return Math.sqrt(s / c); };

/* 1 · Arrugas: un surco oscuro y fino que baja la luz; textura fina conservada */
{
  const p = piel(), surco = new Float32Array(n);
  for(let y = 40; y < 280; y++){ const cx = Math.round(160 + 14 * Math.sin(y / 40)); for(let d = -2; d <= 2; d++){ const k = Math.exp(-d * d / 2); for(const c of [p.R, p.G, p.B]) c[cx + d + y * W] *= 1 - 0.28 * k; surco[(cx + d) + y * W] = 1; } }
  luma(p);
  const zona = rect(100, 30, 220, 290), canal = rect(150, 60, 170, 260);
  const antes = media(p.Y, surco), ctx = ctxDe(p, { frente: zona }); const hf0 = hf(p.Y, rect(40, 60, 90, 260));
  const orig = Float32Array.from(p.Y);
  arrugas(ctx, { arrugas_int: 100, arrugas_tex: 100, z_entrecejo: false, z_ojos: false, z_surcos: false, z_cuello: false });
  const despues = media(ctx.Y, surco), base = media(orig, rect(60, 100, 90, 250));
  const prof0 = (base - antes) / base, prof1 = (base - despues) / base;
  ok(prof1 < prof0 * 0.5, `arrugas: el surco debería perder al menos la mitad de su profundidad (${prof0.toFixed(3)} → ${prof1.toFixed(3)})`);
  ok(hf(ctx.Y, rect(100, 60, 140, 260)) > hf0 * 0.6, "arrugas: con «conservar textura» al 100 % la textura fina bajó demasiado");
  let lejos = 0; for(let i = 0; i < n; i++) if(zona[i] < 0.5) lejos = Math.max(lejos, Math.abs(ctx.Y[i] - orig[i])); ok(lejos < 1e-6, "arrugas: tocó píxeles fuera de la zona");
  const ctx2 = ctxDe(piel(), {}); ctx2.piel.fill(1); const y0 = Float32Array.from(ctx2.Y); arrugas(ctx2, { arrugas_int: 0 }); ok(ctx2.Y.every((v, i) => v === y0[i]), "arrugas: con intensidad 0 cambió algo");
}

/* 2 · Ojeras: la banda oscura sube hacia el nivel de la mejilla sin superarlo */
{
  const p = piel({ liso: true }), banda = rect(80, 100, 240, 130), mej = rect(80, 150, 240, 200);
  for(let i = 0; i < n; i++) if(banda[i]) for(const c of [p.R, p.G, p.B]) c[i] *= 0.72;
  luma(p);
  const antes = media(p.Y, banda), ref = media(p.Y, mej), ctx = ctxDe(p, { ojeras: banda, mejilla: mej });
  ojeras(ctx, { ojeras_int: 100 });
  const despues = media(ctx.Y, banda);
  ok(despues > antes * 1.12, `ojeras: no aclara (${antes.toFixed(3)} → ${despues.toFixed(3)})`);
  ok(despues <= ref * 1.05, "ojeras: pasa de largo el nivel de la mejilla");
  ok(Math.abs(media(ctx.Y, mej) - ref) < 1e-4, "ojeras: cambió la mejilla de referencia");
}

/* 3 · Brillos: una mancha clara se apaga y la piel normal no cambia */
{
  const p = piel({ liso: true }), brillo = new Float32Array(n);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const d = Math.hypot(x - 160, y - 160); if(d < 30){ const k = Math.exp(-d * d / 500); brillo[y * W + x] = 1; for(const c of [p.R, p.G, p.B]) c[y * W + x] += 0.35 * k; } }
  luma(p);
  const nucleo = new Float32Array(n); for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(Math.hypot(x - 160, y - 160) < 10) nucleo[y * W + x] = 1;
  const ctx = ctxDe(p), antes = media(p.Y, nucleo), lejos = media(p.Y, rect(10, 10, 60, 60));
  brillos(ctx, { brillos_int: 100 });
  ok(media(ctx.Y, nucleo) < antes * 0.8, "brillos: no apaga el brillo");
  ok(Math.abs(media(ctx.Y, rect(10, 10, 60, 60)) - lejos) < 0.004, "brillos: cambió la piel normal");
}

/* 4 · Textura: la piel lisa gana detalle fino; la que ya tiene textura casi no cambia */
{
  const lisa = ctxDe(piel({ liso: true })), tex = ctxDe(piel());
  const zl = rect(40, 40, 280, 280), a0 = hf(lisa.Y, zl), b0 = hf(tex.Y, zl);
  textura(lisa, { textura_int: 100, textura_poros: 50 }); textura(tex, { textura_int: 100, textura_poros: 50 });
  ok(hf(lisa.Y, zl) > Math.max(a0 * 5, 0.0015), `textura: la piel lisa no gana detalle (${a0.toFixed(5)} → ${hf(lisa.Y, zl).toFixed(5)})`);
  ok(hf(tex.Y, zl) < b0 * 1.5, `textura: la piel con textura cambió demasiado (${b0.toFixed(5)} → ${hf(tex.Y, zl).toFixed(5)})`);
  ok(detalleFino(lisa).length === n, "textura: detalleFino devuelve un mapa");
}

/* 5 · Imperfecciones y tono: un grano oscuro/rojo se rellena; una rojez suave se iguala */
{
  const p = piel({ liso: true }), grano = new Float32Array(n);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const d = Math.hypot(x - 160, y - 160); if(d < 9){ const k = Math.exp(-d * d / 30); grano[y * W + x] = 1; p.R[y * W + x] *= 1 - 0.3 * k; p.G[y * W + x] *= 1 - 0.55 * k; p.B[y * W + x] *= 1 - 0.5 * k; } }
  luma(p);
  const ctx = ctxDe(p), antes = media(ctx.Y, grano), r0 = media(p.R, grano) / media(p.G, grano);
  igualar(ctx, { tono_int: 0, imperf_int: 100 });
  ok(media(ctx.Y, grano) > antes * 1.04 || media(ctx.G, grano) > media(p.G, grano), "imperfecciones: no rellena el grano");
  const q = piel({ liso: true }); const rojez = rect(100, 100, 180, 180);
  for(let i = 0; i < n; i++) if(rojez[i]){ q.R[i] *= 1.18; q.G[i] *= 0.9; q.B[i] *= 0.92; } luma(q);
  const c2 = ctxDe(q), ratio0 = media(q.R, rojez) / media(q.G, rojez);
  igualar(c2, { tono_int: 100, imperf_int: 0 });
  ok(media(c2.R, rojez) / media(c2.G, rojez) < ratio0 - 0.03, "tono: no reduce la rojez");
  ok(Math.abs(media(c2.Y, rojez) - media(q.Y, rojez)) < 0.01, "tono: cambió la luminancia");
  void r0;
}

console.log(fallos ? "piel (motor): FALLO" : "piel (motor): OK");
process.exit(fallos ? 1 : 0);
