// Prueba (Node, sin navegador): las proyecciones son inversas entre sí y el giro del mundo / nivelado se comportan.
import { PROJECTION_IDS, project, unproject, worldRotation, levelRotation, rotateWorld } from "../plugins/panorama/projections.js";
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
const f = 800, rays = [[0, 0, 1], [0.3, 0.1, 1], [-0.5, -0.2, 1], [1, 0.4, 0.8], [0.2, 0.05, 1]].map(r => { const n = Math.hypot(...r); return r.map(v => v / n); });
for(const k of PROJECTION_IDS) for(const r of rays){
  const p = project(k, f, r); if(!p){ chk(k === "rect" && r[2] < 0.5, `${k}: no proyecta ${r}`); continue; }
  const q = unproject(k, f, p[0], p[1]), n = Math.hypot(...q), d = Math.hypot(q[0] / n - r[0], q[1] / n - r[1], q[2] / n - r[2]);
  chk(d < 1e-9, `${k}: ida y vuelta ${d.toExponential(1)}`);
}
// Estereográfica y ojo de pez dejan el centro quieto; el ojo de pez es proporcional al ángulo
chk(Math.hypot(...project("fish", f, [0, 0, 1])) === 0, "fish centro");
const th = 0.5, pf = project("fish", f, [Math.sin(th), 0, Math.cos(th)]); chk(Math.abs(pf[0] - f * th) < 1e-9, "fish ρ = f·θ");
// Nivelado: cámaras inclinadas (cámara→mundo con un giro común Z de 10°) → el «arriba» vuelve a (0,−1,0)
const tilt = worldRotation(0, 0, 10), R = [tilt, tilt];   // R mundo→cámara con el mundo torcido
const Q = levelRotation(R), R2 = rotateWorld(R, Q);
const up = r => [-r[3], -r[4], -r[5]];   // trasp(R)·(0,−1,0)
const u = up(R2[0]); chk(Math.abs(u[0]) < 1e-9 && Math.abs(u[1] + 1) < 1e-9, `nivelado: ${u}`);
chk(levelRotation([null]).every((v, i) => v === [1, 0, 0, 0, 1, 0, 0, 0, 1][i]), "nivelado sin datos = identidad");
const W = worldRotation(0, 0, 0); chk(W.every((v, i) => Math.abs(v - [1, 0, 0, 0, 1, 0, 0, 0, 1][i]) < 1e-12), "giro nulo = identidad");
console.log(bad ? "panorama-proyecciones: FALLO" : "panorama-proyecciones: OK"); process.exit(bad ? 1 : 0);
