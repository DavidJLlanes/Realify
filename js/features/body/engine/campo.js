/* ═══════════════════════════════════════════════════════════════
   CUERPO · DE LOS MANDOS AL CAMPO DE DEFORMACIÓN
   Une el esqueleto, las máscaras y los valores (ya validados por el perfil, js/ai/people/profiles.js → sanitize) y construye el campo
   de js/features/warp/ (MLS) a la resolución de trabajo. El fondo lejos de la persona queda protegido (campo cero) y el campo se limita
   para que no se pliegue. Los mandos que el perfil no tiene no llegan aquí: `sanitize` los quita antes.
   Entradas: persona (puntos a escala de trabajo), máscara de la persona (Float32Array W×H), W, H y valores. Salida:
   { campo, reducido, escala, sinCambio } o { error } si no se ve el cuerpo.
   ═══════════════════════════════════════════════════════════════ */
import { campoMLS, limitar } from "../../warp/index.js";
import { gauss, smoothstep } from "../../portrait/shared/blur.js";
import { esqueleto } from "./esqueleto.js";
import { Acum } from "../../warp/acum.js";
import { opsAncho } from "./ops-ancho.js";
import { opsLargo } from "./ops-largo.js";

export const hayCambio = v => Object.entries(v || {}).some(([k, x]) => typeof x === "number" && x !== 0 && !["musculo", "tono", "pielSuavizar", "pielUniformar", "bronceado"].includes(k));

export function campoCuerpo(persona, mascara, W, H, valores, { paso = 4 } = {}){
  const e = esqueleto(persona);
  if(!e) return { error: "No veo los hombros: hace falta la persona de frente, al menos hasta el pecho" };
  if(!hayCambio(valores)) return { campo: null, sinCambio: true };
  const a = new Acum(), ctx = { e, m: mascara, W, H };
  const manos = opsAncho(ctx, valores, a);
  opsLargo(e, valores, a);
  const todas = [...manos, ...a.lista()];
  if(!todas.length) return { campo: null, sinCambio: true };
  /* El fondo lejos de la persona no se mueve: protección 1 a más de ~0,45·u del cuerpo, con rampa suave */
  const g = gauss(mascara, W, H, Math.max(2, e.u * 0.22)), prot = new Float32Array(W * H);
  for(let i = 0; i < prot.length; i++) prot[i] = 1 - smoothstep(0.02, 0.2, g[i]);
  const bruto = campoMLS(W, H, todas, { paso, alpha: 1.5, modo: "similitud", protegida: prot });
  const l = limitar(bruto);
  return { campo: l.campo, reducido: l.reducido, escala: l.escala, sinCambio: false };
}
