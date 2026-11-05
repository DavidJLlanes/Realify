/* ═════════════════════════════════════════════════
   PRUEBA · motor de ropa y tejidos (Node, sin navegador)
   Tela sintética (forma general + pliegues de media frecuencia + trama fina + una raya de color) y comprobaciones numéricas de planchar,
   cambiar color, textura y zona por toque. Uso: node tests/ia/ropa/motor.mjs
   ═════════════════════════════════════════════════ */
import { planchar, texturar, recolorear, etapas } from "../../../js/features/clothing/engine/index.js";
import { crecerRegion } from "../../../js/features/clothing/shared/region.js";
import { oklab } from "../../../js/features/ai-kit/oklab.js";

let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const W = 240, H = 200, n = W * H;
function tela({ trama = 0.04, pliegue = 0.25 } = {}){
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), Y = new Float32Array(n), mask = new Float32Array(n);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = y * W + x, dentro = x >= 40 && x < 200 && y >= 30 && y < 170; mask[i] = dentro ? 1 : 0;
    let r = 0.5, g = 0.25, b = 0.2;                                        // tela rojiza
    if(dentro && x >= 110 && x < 125){ r = 0.2; g = 0.15; b = 0.5; }       // raya azul (dibujo, no pliegue)
    const forma = 1 + 0.15 * Math.sin(y / 40), fold = 1 + pliegue * Math.sin(x / 5 + y / 17), weave = 1 + trama * Math.sin(x * 2.1) * Math.sin(y * 2.1);
    const f = dentro ? forma * fold * weave : 0.9;
    if(!dentro){ r = g = b = 0.4; }
    R[i] = r * f; G[i] = g * f; B[i] = b * f; Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  }
  return { p: { W, H, R, G, B, Y }, mask };
}
const copia = p => ({ W, H, R: Float32Array.from(p.R), G: Float32Array.from(p.G), B: Float32Array.from(p.B), Y: Float32Array.from(p.Y) });
const std = (a, mask, x0, x1, y0, y1) => { let s = 0, s2 = 0, c = 0; for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++){ const v = Math.log(a[y * W + x]); s += v; s2 += v * v; c++; } const m = s / c; return Math.sqrt(Math.max(0, s2 / c - m * m)); };
const hp = (Y, x0, x1, y0, y1) => { let e = 0, c = 0; for(let y = y0; y < y1; y++) for(let x = x0 + 1; x < x1 - 1; x++){ const d = Math.log(Y[y * W + x]) - 0.5 * (Math.log(Y[y * W + x - 1]) + Math.log(Y[y * W + x + 1])); e += d * d; c++; } return Math.sqrt(e / c); };

/* 1 · planchar */
{
  const { p, mask } = tela(), o = copia(p);
  const antes = std(p.Y, mask, 50, 100, 40, 160), trAntes = hp(p.Y, 50, 100, 40, 160);
  planchar(p, mask, { arrugas: 100, tamano: 40, conservaTrama: 100, conservar: 0 });
  const despues = std(p.Y, mask, 50, 100, 40, 160), trDespues = hp(p.Y, 50, 100, 40, 160);
  console.log(`planchar: variación de luz ${antes.toFixed(3)} → ${despues.toFixed(3)} · trama ${trAntes.toFixed(4)} → ${trDespues.toFixed(4)}`);
  ok(despues < antes * 0.5, "no aplana los pliegues (se queda en " + (despues / antes).toFixed(2) + ")");
  ok(trDespues > trAntes * 0.6, "pierde la trama del tejido");
  let fuera = 0; for(let i = 0; i < n; i++) if(mask[i] === 0 && (p.R[i] !== o.R[i] || p.G[i] !== o.G[i] || p.B[i] !== o.B[i])) fuera++;
  ok(fuera === 0, "toca píxeles fuera de la prenda: " + fuera);
  /* la raya azul sigue siendo azul: cromaticidad B/R dentro de la raya no cambia más de un 10 % */
  const i = 100 * W + 117, antesBR = o.B[i] / o.R[i], despBR = p.B[i] / p.R[i];
  ok(Math.abs(despBR / antesBR - 1) < 0.1, `la raya cambia de color (${antesBR.toFixed(2)} → ${despBR.toFixed(2)})`);
  /* el matiz de la tela no se mueve */
  const j = 100 * W + 70; ok(Math.abs((p.G[j] / p.R[j]) / (o.G[j] / o.R[j]) - 1) < 0.02, "el color de la tela se desplaza al planchar");
  /* fuerza 0 → igual */
  const q = copia(o); planchar(q, mask, { arrugas: 0, conservaTrama: 100 }); let dif = 0; for(let k = 0; k < n; k++) dif += Math.abs(q.R[k] - o.R[k]); ok(dif === 0, "con fuerza 0 cambia la imagen");
  /* la raya no se aplana: el salto de luz entre la raya y la tela sigue ahí */
  const media = (q, x0, x1) => { let t = 0, c = 0; for(let y = 40; y < 160; y++) for(let x = x0; x < x1; x++){ t += Math.log(q.Y[y * W + x]); c++; } return t / c; };
  const sal = q => media(q, 113, 122) - media(q, 85, 104); console.log("salto raya", sal(o).toFixed(3), sal(p).toFixed(3));
  ok(Math.abs(sal(p) - sal(o)) < 0.15, "la raya se aplana como si fuera un pliegue");
}

/* 2 · cambiar color */
{
  const { p, mask } = tela({ pliegue: 0.3 }), o = copia(p), a = new Float32Array(3), b = new Float32Array(3);
  recolorear(p, mask, { tono: 120, saturacion: 0, luminosidad: 0, tinte: 0 });
  let maxL = 0, giro = 0, c = 0, fuera = 0;
  for(let y = 30; y < 170; y++) for(let x = 45; x < 100; x++){ const i = y * W + x; oklab(o.R[i], o.G[i], o.B[i], a); oklab(p.R[i], p.G[i], p.B[i], b); maxL = Math.max(maxL, Math.abs(a[0] - b[0])); let d = Math.atan2(b[2], b[1]) - Math.atan2(a[2], a[1]); d = ((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; giro += d; c++; }
  for(let i = 0; i < n; i++) if(mask[i] === 0 && p.R[i] !== o.R[i]) fuera++;
  console.log(`color: error de luminosidad máx. ${maxL.toFixed(4)} · giro medio ${(giro / c * 180 / Math.PI).toFixed(1)}°`);
  ok(maxL < 0.03, "el color cambia la luminosidad (pliegues)"); ok(Math.abs(giro / c * 180 / Math.PI - 120) < 8, "el giro de tono no es el pedido"); ok(fuera === 0, "toca fuera de la prenda");
  /* prenda gris + tinte */
  const g = tela().p; for(let i = 0; i < n; i++){ const v = g.Y[i]; g.R[i] = g.G[i] = g.B[i] = v; }
  const m2 = tela().mask; recolorear(g, m2, { tono: 200, tinte: 100 }); oklab(g.R[100 * W + 70], g.G[100 * W + 70], g.B[100 * W + 70], b);
  ok(Math.hypot(b[1], b[2]) > 0.05, "una prenda gris no recibe color con el tinte");
  /* sin salirse de la gama */
  let mal = 0; for(let i = 0; i < n; i++) if(!(g.R[i] >= 0 && g.R[i] <= 1 && g.G[i] >= 0 && g.G[i] <= 1 && g.B[i] >= 0 && g.B[i] <= 1)) mal++; ok(mal === 0, "valores fuera de gama");
}

/* 3 · textura */
{
  const { p, mask } = tela({ trama: 0.05, pliegue: 0 }); const lisa = copia(p);
  for(let y = 30; y < 170; y++) for(let x = 40; x < 120; x++){ const i = y * W + x, v = 0.3; lisa.R[i] = v * 1.5; lisa.G[i] = v * 0.75; lisa.B[i] = v * 0.6; lisa.Y[i] = 0.2126 * lisa.R[i] + 0.7152 * lisa.G[i] + 0.0722 * lisa.B[i]; }
  const antes = hp(lisa.Y, 50, 110, 40, 160); texturar(lisa, mask, { trama: 0, rellenar: 100 }); const despues = hp(lisa.Y, 50, 110, 40, 160);
  console.log(`textura: trama en la zona lisa ${antes.toFixed(4)} → ${despues.toFixed(4)}`);
  ok(despues > antes + 0.008, "no rellena la zona lisa con trama");
  const q = tela().p; const t0 = hp(q.Y, 130, 190, 40, 160); texturar(q, mask, { trama: 100, rellenar: 0 }); ok(hp(q.Y, 130, 190, 40, 160) > t0 * 1.4, "«Trama» no la realza");
  const r = tela().p; const t1 = hp(r.Y, 130, 190, 40, 160); texturar(r, mask, { trama: -100, rellenar: 0 }); ok(hp(r.Y, 130, 190, 40, 160) < t1 * 0.4, "«Trama» negativa no la apaga");
}

/* 4 · zona por toque */
{
  const { p, mask } = tela({ pliegue: 0.2 });
  const m = crecerRegion(p, 60, 100, 40); let dentro = 0, fuera = 0, total = 0;
  for(let i = 0; i < n; i++){ if(mask[i] && i % W < 108) { total++; if(m[i] > 0.5) dentro++; } else if(!mask[i] && m[i] > 0.5) fuera++; }
  console.log(`toque: cubre ${(100 * dentro / total).toFixed(0)} % de la tela · ${fuera} px fuera`);
  ok(dentro / total > 0.7, "la zona no cubre la tela"); ok(fuera < n * 0.003, "la zona se sale de la tela");
}

/* 5 · etapas */
{ const { p, mask } = tela(), o = copia(p); etapas(p, mask, { arrugas: 80, tamano: 40, tono: 60 }); let c = 0; for(let i = 0; i < n; i++) if(p.R[i] !== o.R[i]) c++; ok(c > 1000, "etapas no cambia nada"); }

console.log(fallos ? "ropa (motor): FALLO" : "ropa (motor): OK");
process.exit(fallos ? 1 : 0);
