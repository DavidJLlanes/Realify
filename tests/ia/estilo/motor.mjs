/* Prueba del motor de transferencia de estilo (sin DOM): tono y color hacia la referencia, por zonas; sugerencias; archivo de estilo. */
import { toPlanes } from "../../../js/features/portrait/shared/planes.js";
import { estadisticas, transferir, sugerir } from "../../../js/features/style/engine/transferir.js";
import { validos } from "../../../js/features/style/shared/estilos.js";
let fallos = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALLO ") + m); if(!c) fallos++; };
const W = 120, H = 80;
const foto = (r, g, b, grad = 0) => { const d = new Uint8ClampedArray(W * H * 4); for(let i = 0; i < W * H; i++){ const x = i % W, k = 1 + grad * (x / W - 0.5); d[i * 4] = Math.min(255, r * k); d[i * 4 + 1] = Math.min(255, g * k); d[i * 4 + 2] = Math.min(255, b * k); d[i * 4 + 3] = 255; } return toPlanes(d, W, H); };
const fria = foto(90, 110, 150, 0.5), calida = foto(200, 150, 90, 0.5);
const sr = estadisticas(calida), ss = estadisticas(fria);
ok(validos(sr) && sr.global.q.length === 33, "estadísticas válidas");
ok(validos(JSON.parse(JSON.stringify(sr))), "sobreviven a un archivo JSON");
ok(!validos({ version: 1, global: {}, zonas: {} }) && !validos(null), "rechaza estadísticas rotas");
const antes = estadisticas(fria).global.media[2];
transferir(fria, sr, {}, { fuerza: 100, tono: 100, color: 100 });
const des = estadisticas(fria).global;
ok(Math.abs(des.media[2] - sr.global.media[2]) < Math.abs(antes - sr.global.media[2]) * 0.2, `la foto fría pasa a cálida (b ${antes.toFixed(3)} → ${des.media[2].toFixed(3)} · ref ${sr.global.media[2].toFixed(3)})`);
ok(Math.abs(des.media[0] - sr.global.media[0]) < 0.03, "el tono se acerca a la referencia (L " + des.media[0].toFixed(3) + " vs " + sr.global.media[0].toFixed(3) + ")");
const f2 = foto(90, 110, 150, 0.5); transferir(f2, sr, {}, { fuerza: 0 }); ok(Math.abs(estadisticas(f2).global.media[2] - ss.global.media[2]) < 1e-3, "intensidad 0 no cambia nada");
const f3 = foto(90, 110, 150, 0.5); transferir(f3, sr, {}, { fuerza: 100, tono: 0, color: 100 }); ok(Math.abs(estadisticas(f3).global.media[0] - ss.global.media[0]) < 0.01, "tono 0 conserva la luminosidad");
// por zonas: la mitad izquierda es «cielo» y sólo ella cambia hacia la referencia de cielo
const g = foto(90, 110, 150, 0.2), cielo = new Float32Array(W * H); for(let i = 0; i < W * H; i++) cielo[i] = i % W < W / 2 ? 1 : 0;
const refZ = { version: 1, zonas: { cielo: sr.global, resto: ss.global }, global: sr.global };
const antesD = g.B[5 * W + 100]; transferir(g, refZ, { cielo }, { fuerza: 100 });
ok(Math.abs(g.B[5 * W + 100] - antesD) / antesD < 0.15 && g.R[5 * W + 10] > 0, "cada zona va a su referencia");
const s = sugerir(estadisticas(foto(90, 110, 150, 0.5)), sr);
ok(s.exposicion > 0 && s.calidez > 0, "sugiere más luz y más calidez " + JSON.stringify(s));
process.exit(fallos ? 1 : 0);
