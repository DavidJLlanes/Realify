/* Prueba en Node del editor de cuerpo: del mando al campo, sobre una figura sintética (sin fotos de personas).
   Comprueba que cada mando hace lo que dice, que no hay plegados, que el fondo lejano no se mueve y la seguridad del perfil infantil. */
import assert from "node:assert/strict";
import { campoCuerpo, hayCambio } from "../../../js/features/body/engine/index.js";
import { deformarCPU } from "../../../js/features/warp/index.js";
import { BODY_PARAMS, sanitize, controlsFor, clampTo, PROFILE_IDS } from "../../../js/ai/people/profiles.js";
import { paramsFor, validate } from "../../../js/ui/kit/params-panel.js";

const W = 400, H = 600, m = new Float32Array(W * H);
const rect = (x0, y0, x1, y1) => { for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++) m[y * W + x] = 1; };
rect(150, 140, 250, 340); rect(116, 150, 140, 320); rect(260, 150, 284, 320); rect(165, 340, 195, 560); rect(205, 340, 235, 560); rect(185, 105, 215, 145);
for(let y = 40; y < 120; y++) for(let x = 160; x < 240; x++) if((x - 200) ** 2 + (y - 80) ** 2 < 1600) m[y * W + x] = 1;
const persona = { cara: { caja: { x: 160, y: 40, w: 80, h: 80 } }, pose: { puntos: {
  nariz: [200, 80, 1], hombroI: [150, 150, 1], hombroD: [250, 150, 1], codoI: [128, 235, 1], codoD: [272, 235, 1], munecaI: [128, 315, 1], munecaD: [272, 315, 1],
  caderaI: [180, 335, 1], caderaD: [220, 335, 1], rodillaI: [180, 450, 1], rodillaD: [220, 450, 1], tobilloI: [180, 555, 1], tobilloD: [220, 555, 1] } } };

const ancho = (mask, y, x0 = 200) => { if(mask[y * W + x0] < 0.5) return 0; let a = x0, b = x0; while(mask[y * W + a - 1] > 0.5) a--; while(mask[y * W + b + 1] > 0.5) b++; return b - a; };      // tramo continuo que pasa por x0
const aplicar = (campo) => {                                    // deforma la propia máscara (como una imagen en gris)
  const rgba = new Uint8ClampedArray(W * H * 4); for(let i = 0; i < W * H; i++){ rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = m[i] * 255; rgba[i * 4 + 3] = 255; }
  const o = deformarCPU(rgba, W, H, campo, { lineal: false }), r = new Float32Array(W * H); for(let i = 0; i < r.length; i++) r[i] = o[i * 4] / 255; return r;
};
const val = (perfil, extra) => sanitize(perfil, extra);
const campo = (perfil, extra) => campoCuerpo(persona, m, W, H, val(perfil, extra));

/* 1 · sin cambios no hay campo */
assert.equal(campo("mujer", {}).sinCambio, true);

/* 2 · cintura −20: el torso se estrecha en la cintura y no se toca la cabeza ni el fondo lejano */
{ const r = campo("mujer", { cintura: -20 }); assert(r.campo, "hay campo");
  const o = aplicar(r.campo), y = 140 + Math.round(0.65 * 190);
  assert(ancho(o, y) < ancho(m, y) - 8, `cintura más estrecha (${ancho(m, y)} → ${ancho(o, y)})`);
  assert.equal(ancho(o, 80), ancho(m, 80), "la cabeza no cambia");
  let lejos = 0; for(let y2 = 0; y2 < H; y2++) for(let x = 0; x < 60; x++) lejos = Math.max(lejos, Math.abs(o[y2 * W + x] - m[y2 * W + x])); assert.equal(lejos, 0, "fondo lejano intacto"); }

/* 3 · caderas +20 las ensancha; delgado −20 estrecha torso y piernas */
{ const o = aplicar(campo("hombre", { caderas: 20 }).campo); assert(ancho(o, 335) > ancho(m, 335) + 6, "caderas más anchas (" + ancho(m, 335) + " → " + ancho(o, 335) + ")"); }
{ const o = aplicar(campo("mujer", { delgado: -20 }).campo); assert(ancho(o, 250) < ancho(m, 250) - 8, "delgado estrecha el torso"); assert(ancho(o, 500) <= ancho(m, 500), "y las piernas"); }

/* 4 · cabeza +10 agranda la cabeza; altura +10 sube la cabeza */
{ const o = aplicar(campo("mujer", { cabeza: 10 }).campo); assert(ancho(o, 80) > ancho(m, 80) + 3, "cabeza mayor (" + ancho(m, 80) + " → " + ancho(o, 80) + ")"); }
{ const o = aplicar(campo("hombre", { altura: 10 }).campo); let top = 0; while(o[top * W + 200] < 0.5) top++; let top0 = 0; while(m[top0 * W + 200] < 0.5) top0++; assert(top < top0 - 3, `más alto (${top0} → ${top})`); }

/* 5 · largo de piernas: los pies bajan */
{ const o = aplicar(campo("mujer", { piernaLargo: 10 }).campo); let b = H - 1; while(o[b * W + 180] < 0.5) b--; let b0 = H - 1; while(m[b0 * W + 180] < 0.5) b0--; assert(b > b0 + 5, `piernas más largas (${b0} → ${b})`); }

/* 6 · sin plegados ni con valores extremos de todos los mandos */
for(const perfil of PROFILE_IDS){
  const extremos = Object.fromEntries(controlsFor(perfil).filter(c => !["musculo", "tono", "pielSuavizar", "pielUniformar", "bronceado"].includes(c.key)).map((c, i) => [c.key, i % 2 ? c.max : c.min]));
  const r = campo(perfil, extremos); assert(r.campo, perfil + ": hay campo");
  const { minDet } = await import("../../../js/features/warp/jacobian.js"); assert(minDet(r.campo) >= 0.149, `${perfil}: sin plegados (${minDet(r.campo).toFixed(3)})`);
}

/* 7 · SEGURIDAD (F6.9): el perfil infantil no tiene pecho, caderas, glúteos ni definición, ni por interfaz ni por parámetros */
for(const perfil of ["nino", "nina"]){
  const claves = new Set(paramsFor(BODY_PARAMS, perfil).map(p => p.key));
  for(const k of ["pecho", "caderas", "gluteos", "cintura", "abdomen", "espalda", "musculo", "tono", "pielSuavizar", "bronceado"]) assert(!claves.has(k), `${perfil}: no existe ${k}`);
  for(const k of ["pecho", "caderas", "gluteos", "musculo"]) assert.equal(clampTo(perfil, k, 10), null, `${perfil}: ${k} no se puede fijar`);
  const { values, rejected } = validate(BODY_PARAMS, { pecho: 10, caderas: 10, gluteos: 10, musculo: 5, altura: 2 }, perfil);
  assert.deepEqual(Object.keys(values), ["altura"]); assert.equal(rejected.length, 4);
  const s = sanitize(perfil, { pecho: 20, caderas: 20, gluteos: 20, musculo: 20, delgado: 20 });
  assert(!("pecho" in s) && !("caderas" in s) && !("gluteos" in s) && !("musculo" in s), "sanitize los quita");
  assert(s.delgado <= 3, "rango reducido (" + s.delgado + ")");
  /* aunque alguien cuele valores adultos directamente al motor, el motor sólo recibe lo que deja pasar sanitize */
  const colado = campoCuerpo(persona, m, W, H, sanitize(perfil, { caderas: 20, pecho: 20, gluteos: 20 }));
  assert.equal(colado.sinCambio, true, perfil + ": los mandos adultos colados no hacen nada");
}
assert(hayCambio({ altura: 1 }) && !hayCambio({ tono: 5, altura: 0 }));

/* 8 · sin cuerpo no hay campo y se explica */
{ const r = campoCuerpo({ pose: null, cara: persona.cara }, m, W, H, { altura: 5 }); assert(r.error && /hombros/.test(r.error)); }

/* 9 · definición y piel: sólo cambian dentro de la máscara de piel y hacen lo que dicen */
{
  const { stage } = await import("../../../js/features/body/definition/engine.js");
  const w = 120, h = 90, n = w * h;
  const nuevo = () => { const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), Y = new Float32Array(n), piel = new Float32Array(n);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = y * w + x, v = 0.35 + 0.1 * Math.sin(x / 6) * Math.cos(y / 5) + ((i * 7919) % 100) / 2500;
      R[i] = v * 1.0; G[i] = v * 0.72 + 0.03 * Math.sin(x / 3) * Math.sin(y / 3); B[i] = v * 0.55; Y[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i]; if(x > 20 && x < 100 && y > 15 && y < 75) piel[i] = 1; }
    return { W: w, H: h, R, G, B, Y, piel, F: 40 }; };
  const desv = (p, c) => { let m = 0, k = 0; for(let i = 0; i < n; i++) if(p.piel[i] > 0.5){ m += c[i]; k++; } m /= k; let s2 = 0; for(let i = 0; i < n; i++) if(p.piel[i] > 0.5) s2 += (c[i] - m) ** 2; return Math.sqrt(s2 / k); };
  const media = (p, c) => { let m = 0, k = 0; for(let i = 0; i < n; i++) if(p.piel[i] > 0.5){ m += c[i]; k++; } return m / k; };
  const a = nuevo(), b = nuevo(); stage(b, { tono: 20 });
  assert(desv(b, b.G) > desv(a, a.G) * 1.05, "tono aumenta el relieve (" + desv(a, a.G).toFixed(4) + " → " + desv(b, b.G).toFixed(4) + ")");
  let fuera = 0; for(let i = 0; i < n; i++) if(b.piel[i] < 0.01) fuera = Math.max(fuera, Math.abs(b.G[i] - a.G[i])); assert.equal(fuera, 0, "fuera de la piel nada cambia");
  const rug = p => { let t = 0; for(let i = 0; i < n - 1; i++) if(p.piel[i] > 0.5 && p.piel[i + 1] > 0.5) t += Math.abs(p.G[i] - p.G[i + 1]); return t; };
  const c = nuevo(); stage(c, { pielSuavizar: 100 }); assert(rug(c) < rug(a) * 0.8, "suavizar reduce el grano (" + rug(a).toFixed(1) + " → " + rug(c).toFixed(1) + ")");
  const d = nuevo(); stage(d, { bronceado: 100 }); const lum = p => { const o = new Float32Array(n); for(let i = 0; i < n; i++) o[i] = 0.2126 * p.R[i] + 0.7152 * p.G[i] + 0.0722 * p.B[i]; return o; };
  assert(media(d, lum(d)) < media(a, lum(a)) * 0.95 && media(d, d.R) / media(d, d.B) > media(a, a.R) / media(a, a.B), "bronceado oscurece y calienta");
  const e2 = nuevo(); stage(e2, { pielUniformar: 100 }); const rg = p => { const o = new Float32Array(n); for(let i = 0; i < n; i++) o[i] = p.R[i] / p.G[i]; return o; };
  assert(desv(e2, rg(e2)) < desv(a, rg(a)) * 0.8, "uniformar iguala el color (" + desv(a, rg(a)).toFixed(4) + " → " + desv(e2, rg(e2)).toFixed(4) + ")");
}

console.log("cuerpo (motor): OK");
