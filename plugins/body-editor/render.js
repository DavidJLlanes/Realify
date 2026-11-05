/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CUERPO · PREPARAR Y PINTAR UNA PERSONA
   Para cada persona: copia de trabajo reducida (≤ 1000 px) con sus puntos y su máscara; la vista previa deforma esa copia con el campo del
   motor (js/features/body/engine) y aplica la definición y la piel (js/features/body/definition); al aplicar, lo mismo a resolución
   completa: la definición en un recorte de la persona y la deformación sobre toda la foto (GPU con respaldo en CPU).
   El resultado de cada persona es un lienzo del tamaño de la foto, transparente donde no ha cambiado nada, para ir a su propia capa.
   Entradas: lienzo con la imagen, persona de js/ai/people/analyze.js, valores del perfil. Sin interfaz.
   ═══════════════════════════════════════════════════════════════ */
import { campoCuerpo, hayCambio, esqueleto } from "../../js/features/body/engine/index.js";
import { stage as definir } from "../../js/features/body/definition/engine.js";
import { deformar, reescalar, muestrear } from "../../js/features/warp/index.js";
import { mascaraParte } from "../../js/features/portrait/shared/partes.js";
import { toPlanes, fromPlanes } from "../../js/features/portrait/shared/planes.js";
import { gauss } from "../../js/features/portrait/shared/blur.js";
import { pegarRecorte } from "../../js/features/ai-kit/crop-compose.js";
import { sanitize } from "../../js/ai/people/profiles.js";

const DEF = ["musculo", "tono", "pielSuavizar", "pielUniformar", "bronceado"];
export const hayDefinicion = v => DEF.some(k => v[k] > 0);
export const hayAlgo = v => hayCambio(v) || hayDefinicion(v);

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const escalar = (p, k) => p && [p[0] * k, p[1] * k, p[2]];

export function prepararPersona(src, persona, maxSide){
  const k = Math.min(1, maxSide / Math.max(src.width, src.height)), W = Math.max(1, Math.round(src.width * k)), H = Math.max(1, Math.round(src.height * k));
  const crop = { x: 0, y: 0, w: src.width, h: src.height, k, W, H };
  const cb = persona.cara.caja;
  const p = { cara: { caja: { x: cb.x * k, y: cb.y * k, w: cb.w * k, h: cb.h * k } },
    pose: persona.pose && { puntos: Object.fromEntries(Object.entries(persona.pose.puntos).map(([n, q]) => [n, escalar(q, k)])) } };
  const e = esqueleto(p);
  return { persona, k, W, H, crop, p, u: e ? e.u : W / 3, mascara: mascaraParte(persona.partes, "persona", crop) || new Float32Array(W * H), cache: {} };
}

/* Piel del cuerpo: piel del modelo de partes sin cara ni pelo, suavizada */
function pielCuerpo(persona, crop){
  const piel = mascaraParte(persona.partes, "piel", crop), cara = mascaraParte(persona.partes, "cara", crop), pelo = mascaraParte(persona.partes, "pelo", crop);
  if(!piel) return null;
  const n = crop.W * crop.H, o = new Float32Array(n);
  for(let i = 0; i < n; i++) o[i] = Math.max(0, piel[i] - (cara ? cara[i] : 0) - (pelo ? pelo[i] : 0));
  return gauss(o, crop.W, crop.H, 1.5);
}

/* Definición y piel sobre un lienzo que cubre `crop` (a su escala de trabajo). Devuelve ImageData antes y después. */
function conDefinicion(lienzo, persona, crop, F, v){
  const x = lienzo.getContext("2d", { willReadFrequently: true }), W = lienzo.width, H = lienzo.height, antes = x.getImageData(0, 0, W, H);
  const piel = pielCuerpo(persona, { ...crop, W, H }); if(!piel) return { antes, despues: antes };
  const despues = new ImageData(new Uint8ClampedArray(antes.data), W, H), pl = toPlanes(despues.data, W, H);
  definir({ ...pl, piel, F }, v); fromPlanes(pl, despues.data);
  return { antes, despues };
}

/* Vista previa: devuelve un lienzo de trabajo con la persona retocada sobre `base` (lienzo de trabajo ya con lo anterior). */
export async function pintarVista(prep, base, valores, perfil){
  const v = sanitize(perfil, valores);
  if(!hayAlgo(v)) return { lienzo: base };
  let lienzo = base;
  if(hayDefinicion(v)){
    lienzo = cv(prep.W, prep.H); lienzo.getContext("2d").drawImage(base, 0, 0);
    const { despues } = conDefinicion(lienzo, prep.persona, prep.crop, prep.u * 0.5, v); lienzo.getContext("2d").putImageData(despues, 0, 0);
  }
  const r = campoCuerpo(prep.p, prep.mascara, prep.W, prep.H, v);
  if(r.error) return { lienzo, error: r.error };
  if(r.campo) lienzo = await deformar(lienzo, r.campo);
  return { lienzo, reducido: r.reducido };
}

/* Resultado final de una persona a resolución completa: lienzo del tamaño de la foto con alfa (transparente donde no cambia). */
export async function aplicarPersona(src, prep, valores, perfil){
  const v = sanitize(perfil, valores), W = src.width, H = src.height;
  let lienzo = cv(W, H); lienzo.getContext("2d").drawImage(src, 0, 0);
  const r = campoCuerpo(prep.p, prep.mascara, prep.W, prep.H, v);
  if(r.error) throw new Error(r.error);
  if(hayDefinicion(v)){                                               // recorte de la persona (≤ 2400 px) con margen
    const b = prep.persona.caja, m = Math.max(b.w, b.h) * 0.1, x0 = Math.max(0, Math.floor(b.x - m)), y0 = Math.max(0, Math.floor(b.y - m));
    const w = Math.min(W, Math.ceil(b.x + b.w + m)) - x0, h = Math.min(H, Math.ceil(b.y + b.h + m)) - y0, k = Math.min(1, 2400 / Math.max(w, h));
    const crop = { x: x0, y: y0, w, h, k, W: Math.round(w * k), H: Math.round(h * k) }, c = cv(crop.W, crop.H);
    const cx = c.getContext("2d", { willReadFrequently: true }); cx.imageSmoothingQuality = "high"; cx.drawImage(src, x0, y0, w, h, 0, 0, crop.W, crop.H);
    const { antes, despues } = conDefinicion(c, prep.persona, crop, prep.u / prep.k * k * 0.5, v);
    pegarRecorte(lienzo, crop, antes, despues);
  }
  if(r.campo) lienzo = await deformar(lienzo, reescalar(r.campo, W, H, 8));
  /* alfa: sólo donde la persona cambia (campo no nulo, o piel si hay definición), con borde suave; fuera, transparente */
  const w0 = prep.W, h0 = prep.H, a0 = new Float32Array(w0 * h0), d = [0, 0];
  if(r.campo) for(let y = 0; y < h0; y++) for(let x = 0; x < w0; x++){ muestrear(r.campo, x, y, d); if(Math.abs(d[0]) + Math.abs(d[1]) > 0.02) a0[y * w0 + x] = 1; }
  if(hayDefinicion(v)) for(let i = 0; i < a0.length; i++) if(prep.mascara[i] > 0.5) a0[i] = 1;
  const ag = gauss(a0, w0, h0, Math.max(2, prep.p.cara.caja.w * 0.1)), m = cv(w0, h0), mx = m.getContext("2d"), id = mx.createImageData(w0, h0);
  for(let i = 0; i < ag.length; i++){ id.data[i * 4 + 3] = Math.min(255, ag[i] * 3 * 255); }
  mx.putImageData(id, 0, 0);
  const am = cv(W, H), ax = am.getContext("2d"); ax.imageSmoothingQuality = "high"; ax.drawImage(m, 0, 0, W, H);
  const fx = lienzo.getContext("2d"); fx.globalCompositeOperation = "destination-in"; fx.drawImage(am, 0, 0); fx.globalCompositeOperation = "source-over";
  return { lienzo, reducido: r.reducido };
}
