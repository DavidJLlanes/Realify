/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CUERPO · ARTICULACIONES ARRASTRABLES
   El motor deforma a partir de los puntos de pose (hombros, codos, muñecas, caderas, rodillas, tobillos). Aquí se dibujan sobre la imagen y se
   dejan arrastrar: sirve para corregir un punto mal detectado o para colocar las caderas en un retrato que acaba en el pecho (las
   caderas que el modelo no ve se muestran huecas). Un punto movido pasa a tener confianza 1. Lo de pintar es lo único que toca el DOM
   (recibe el contexto 2D del armazón); buscar y mover son puros. Entradas: persona (pose.puntos en píxeles de la foto) y coordenadas de la foto.
   ═══════════════════════════════════════════════════════════════ */
export const ARTICULACIONES = ["hombroI", "hombroD", "codoI", "codoD", "munecaI", "munecaD", "caderaI", "caderaD", "rodillaI", "rodillaD", "tobilloI", "tobilloD"];
const SEGMENTOS = [["hombroI", "hombroD"], ["hombroI", "codoI"], ["codoI", "munecaI"], ["hombroD", "codoD"], ["codoD", "munecaD"], ["hombroI", "caderaI"], ["hombroD", "caderaD"],
  ["caderaI", "caderaD"], ["caderaI", "rodillaI"], ["rodillaI", "tobilloI"], ["caderaD", "rodillaD"], ["rodillaD", "tobilloD"]];

/* Articulaciones que caen dentro de la foto */
export function visibles(persona, W, H){
  const p = persona && persona.pose && persona.pose.puntos, out = [];
  if(!p) return out;
  for(const n of ARTICULACIONES){ const q = p[n]; if(q && q[0] >= 0 && q[1] >= 0 && q[0] <= W && q[1] <= H) out.push({ nombre: n, x: q[0], y: q[1], seguro: (q[2] ?? 1) >= 0.3 }); }
  return out;
}

/* La articulación más cercana a (x, y) dentro de `radio` (px de la foto), o null */
export function buscar(persona, x, y, radio, W, H){
  let mejor = null, d = radio;
  for(const j of visibles(persona, W, H)){ const e = Math.hypot(j.x - x, j.y - y); if(e <= d){ d = e; mejor = j.nombre; } }
  return mejor;
}

export function mover(persona, nombre, x, y, W, H){
  if(!persona.pose || !persona.pose.puntos[nombre]) return false;
  persona.pose.puntos[nombre] = [Math.min(W, Math.max(0, x)), Math.min(H, Math.max(0, y)), 1];
  return true;
}

/* Dibuja el esqueleto y los puntos. `t` = transformación del armazón { k, ox, oy } (foto → pantalla) */
export function pintar(cx, t, persona, W, H, activo = null){
  const p = persona && persona.pose && persona.pose.puntos; if(!p) return;
  const a = n => { const q = p[n]; return q && [t.ox + q[0] * t.k, t.oy + q[1] * t.k]; };
  cx.lineWidth = Math.max(1.5, t.k * 2); cx.strokeStyle = "rgba(255,255,255,.7)"; cx.beginPath();
  for(const [s, e] of SEGMENTOS){ const u = a(s), v = a(e); if(u && v){ cx.moveTo(u[0], u[1]); cx.lineTo(v[0], v[1]); } }
  cx.stroke();
  const r = Math.max(5, 7 * (t.dpr || 1));
  for(const j of visibles(persona, W, H)){
    const [x, y] = a(j.nombre); cx.beginPath(); cx.arc(x, y, j.nombre === activo ? r * 1.3 : r, 0, 2 * Math.PI);
    cx.fillStyle = j.seguro ? "rgba(255,200,40,.95)" : "rgba(255,200,40,.15)"; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = "#222"; cx.stroke();
  }
}
