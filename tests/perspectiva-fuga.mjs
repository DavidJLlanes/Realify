/* Prueba de la selección de guías horizontales (js/cv/lines.js › pickHorizontals, v251) sin navegador: una fachada vista de lado (horizontales y diagonales que
   convergen en un punto de fuga lejano) debe darnos una familia convergente; una foto frontal (horizontales casi rectas) debe seguir dando la familia paralela
   de siempre; y el ruido (segmentos al azar) no debe inventar una convergencia. Uso: node tests/perspectiva-fuga.mjs */
import { pickHorizontals } from "../js/cv/lines.js";
const W = 1400, H = 1000; let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
const seg = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
// 1. Convergentes en (5200, 420): ocho líneas desde x = 60..700 hacia el punto de fuga, a distintas alturas
const vp = [5200, 420], conv = [];
for(let k = 0; k < 8; k++){ const x1 = 60 + k * 80, y1 = 80 + k * 110, t = 0.22 + rnd() * 0.05, x2 = x1 + (vp[0] - x1) * t, y2 = y1 + (vp[1] - y1) * t; conv.push(seg(x1, y1, x2, y2)); }
let noise = Array.from({ length: 10 }, () => { const x = rnd() * W, y = rnd() * H, a = (rnd() - 0.5) * 1.2, l = 120 + rnd() * 150; return seg(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l); });
const r1 = pickHorizontals([...conv, ...noise], W, H);
console.log("convergentes:", r1.converging, r1.segs.length);
chk(r1.converging, "la fachada de lado debe dar una familia convergente"); chk(r1.segs.length >= 3, "al menos 3 guías");
const dirs = r1.segs.map(s => Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI); chk(Math.max(...dirs) - Math.min(...dirs) > 2.5, "las guías deben abrirse (no paralelas)");
// cada guía elegida debe apuntar al punto de fuga real
for(const s of r1.segs){ const m = [(s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2], a1 = Math.atan2(vp[1] - m[1], vp[0] - m[0]), a2 = Math.atan2(s.y2 - s.y1, s.x2 - s.x1); chk(Math.abs(a1 - a2) < 0.04, "una guía elegida no apunta al punto de fuga"); }
// 2. Frontal: horizontales casi rectas (±1°)
const front = Array.from({ length: 6 }, (_, k) => seg(80, 120 + k * 130, 900 + rnd() * 200, 120 + k * 130 + (rnd() - 0.5) * 14));
const r2 = pickHorizontals([...front, ...noise], W, H); console.log("frontal:", r2.converging, r2.segs.length);
chk(!r2.converging, "una foto frontal no debe dar convergencia"); chk(r2.segs.length >= 2 && r2.segs.every(s => Math.abs(Math.atan2(s.y2 - s.y1, s.x2 - s.x1)) < 0.07), "debe dar las horizontales casi rectas");
// 3. Sólo ruido: nada convergente
const r3 = pickHorizontals(noise, W, H); console.log("ruido:", r3.converging); chk(!r3.converging, "el ruido no debe inventar una convergencia");
// 4. Con esas guías, la homografía debe volver paralelas las horizontales convergentes
try{
  const { homographyFromGuides } = await import("../js/editor/perspective.js");
  const Hm = homographyFromGuides([], r1.segs, W, H), ap = (x, y) => { const w = Hm[6] * x + Hm[7] * y + Hm[8]; return [(Hm[0] * x + Hm[1] * y + Hm[2]) / w, (Hm[3] * x + Hm[4] * y + Hm[5]) / w]; };
  const ang = r1.segs.map(s => { const a = ap(s.x1, s.y1), b = ap(s.x2, s.y2); return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; });
  console.log("ángulos tras corregir:", ang.map(v => v.toFixed(2)).join(", "));
  chk(Math.max(...ang) - Math.min(...ang) < 0.5, "tras la homografía las horizontales deben quedar paralelas");
}catch(e){ console.log("homografía no comprobada:", e.message); }
console.log(bad ? "perspectiva-fuga: FALLO" : "perspectiva-fuga: OK"); process.exit(bad ? 1 : 0);
