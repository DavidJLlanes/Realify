/* Prueba de los perfiles de lente propios y el modelo «acm» (js/lens/lensmath.js + userprofiles.js, v251), sin navegador: la corrección sigue la fórmula
   radial + tangencial; «keep» (foto ya recortada) reduce los radios; el viñeteo da 1/(1+v1) en la esquina; validación de perfiles; búsqueda por cámara. */
import * as M from "../js/lens/lensmath.js";
globalThis.localStorage = { _: {}, getItem(k){ return this._[k] ?? null; }, setItem(k, v){ this._[k] = String(v); } };
const UP = await import("../js/lens/userprofiles.js");
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } }; const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;
const W = 1200, H = 800, diag = Math.hypot(W, H);
const prof = UP.toProfile(UP.sanitize({ name: "t", match: { make: "Google", model: "Pixel 8" }, distortion: { k: [0.1, 0, 0], p: [0.01, -0.02] }, vignette: { v: [-0.4, 0, 0] }, tca: { red: 1.0005, blue: 0.9995 } }));
const C = M.makeCorrector(prof, { crop: 1, W, H, autoScale: false });
const o = new Array(6); const px = 900, py = 300; C.map(px, py, o);
const nx = (px - (W - 1) / 2) * 2 / diag, ny = (py - (H - 1) / 2) * 2 / diag, r2 = nx * nx + ny * ny, rad = 1 + 0.1 * r2;
const ex = nx * rad + 2 * 0.01 * nx * ny + (-0.02) * (r2 + 2 * nx * nx), ey = ny * rad + 0.01 * (r2 + 2 * ny * ny) + 2 * (-0.02) * nx * ny;
const gx = ex * diag / 2 + (W - 1) / 2, gy = ey * diag / 2 + (H - 1) / 2;
chk(near(o[2], gx, 1e-6) && near(o[3], gy, 1e-6), `acm: la posición verde debe seguir la fórmula (${o[2].toFixed(3)},${o[3].toFixed(3)} vs ${gx.toFixed(3)},${gy.toFixed(3)})`);
chk(near((o[0] - (W - 1) / 2) / (o[2] - (W - 1) / 2), 1.0005, 1e-6), "acm: el rojo se escala 1,0005 respecto al verde");
// Esquina: viñeteo 1/(1 + v1)
const cx = 0, cy = 0, rr = ((cx - (W - 1) / 2) * 2 / diag) ** 2 + ((cy - (H - 1) / 2) * 2 / diag) ** 2; chk(near(C.gain(cx, cy), 1 / (1 - 0.4 * rr), 1e-9), "viñeteo: ganancia en la esquina");
// keep: con la mitad del ancho conservado, el mismo píxel está en un radio la mitad de grande
const K = M.makeCorrector(UP.toProfile(UP.sanitize({ name: "k", distortion: { k: [0.1, 0, 0] } })), { crop: 1, W, H, autoScale: false, keep: 0.5 }), K1 = M.makeCorrector(UP.toProfile(UP.sanitize({ name: "k", distortion: { k: [0.1, 0, 0] } })), { crop: 1, W, H, autoScale: false });
const a = new Array(6), b = new Array(6); K.map(1100, 700, a); K1.map(1100, 700, b);
const dA = Math.hypot(a[2] - (W - 1) / 2, a[3] - (H - 1) / 2), dB = Math.hypot(b[2] - (W - 1) / 2, b[3] - (H - 1) / 2), r0 = Math.hypot(1100 - (W - 1) / 2, 700 - (H - 1) / 2);
chk(dA < r0 * 1.02 && dA > r0 * 0.5 && dB > dA && near(dA / r0, 1 + 0.1 * (0.5 * r0 * 2 / diag) ** 2, 1e-6), `keep 0,5: radios menores (${(dA / r0).toFixed(4)} vs ${(dB / r0).toFixed(4)})`);
// Validación
for(const [bad1, msg] of [[{}, "sin nombre"], [{ name: "x" }, "no corrige nada"], [{ name: "x", distortion: { k: [9] } }, "fuera de rango"], [{ name: "x", distortion: { model: "poly3", k: [0.1] } }, "modelo no admitido"]]){ let ok = false; try{ UP.sanitize(bad1); }catch{ ok = true; } chk(ok, "debe rechazar un perfil " + msg); }
// Guardar, buscar por cámara, exportar/importar
UP.put({ name: "Pixel 8", match: { make: "Google", model: "Pixel 8" }, distortion: { k: [0.05, 0, 0] } }); UP.put({ name: "Otro", match: { make: "Apple", model: "iPhone 15" }, vignette: { v: [-0.3, 0, 0] } });
chk(UP.findFor({ make: "Google LLC", model: "Pixel 8" })?.name === "Pixel 8", "buscar por marca y modelo"); chk(UP.findFor({ make: "Google", model: "Pixel 7" }) === null, "otro modelo no debe coincidir");
const json = UP.exportJson(UP.list()[0]); UP.remove("Pixel 8"); chk(UP.list().length === 1, "quitar"); UP.importJson(json); chk(UP.list().length === 2 && UP.findFor({ make: "Google", model: "Pixel 8" }), "importar lo exportado");
console.log(bad ? "lente-acm: FALLO" : "lente-acm: OK"); process.exit(bad ? 1 : 0);
