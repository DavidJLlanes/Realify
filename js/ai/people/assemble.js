/* ═══════════════════════════════════════════════════════════════
   PERSONAS · ENSAMBLADO (puro, sin DOM)
   Junta lo que dan los proveedores (caras, puntos de la cara, manos, pose, partes) en una lista de personas, asignando cada
   resultado a la persona a la que pertenece. Una persona nace de una cara detectada; si hay pose, su caja sale de los puntos.
   Entradas: caras [{x,y,w,h,score,...}] y resultados por tipo. Salida: personas [{ id, caja, cara, manos, pose, partes, proporciones }].
   ═══════════════════════════════════════════════════════════════ */
import { proportionsFromPose } from "./proportions.js";

const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const centro = b => [b.x + b.w / 2, b.y + b.h / 2];

/** Caja de la persona estimada desde su cara cuando no hay pose (cabeza y hombros): 3 anchos de cara de ancho, 3,2 de alto. */
export function boxFromFace(f, imgW, imgH){
  const w = f.w * 3, h = f.h * 3.2, x = f.x + f.w / 2 - w / 2, y = f.y - f.h * 0.4;
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  return { x: x0, y: y0, w: Math.min(imgW, x + w) - x0, h: Math.min(imgH, y + h) - y0 };
}

function boxFromPose(pose){
  const v = Object.values(pose.puntos).filter(p => (p[2] ?? 1) >= 0.3);
  if(v.length < 3) return null;
  const xs = v.map(p => p[0]), ys = v.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Índice de la persona cuya cara contiene el punto (la de caja más pequeña si hay varias), o -1. */
function ownerOf(personas, x, y){
  let best = -1, area = Infinity;
  personas.forEach((p, i) => { const b = p.cara.caja; if(inside(b, x, y) && b.w * b.h < area){ best = i; area = b.w * b.h; } });
  return best;
}

/**
 * @param {{x,y,w,h,score}[]} caras
 * @param {{ landmarks?, manos?, poses?, partes? }} res  — cada lista ya en píxeles de la foto
 *   · landmarks: [{ cara: índice-de-cara, puntos: [[x,y]…] }]
 *   · manos:     [{ lado, puntos, x,y,w,h }] (se asignan a la persona más cercana por la muñeca)
 *   · poses:     [{ puntos: {nombre:[x,y,conf]} }] (se asigna por la nariz/orejas dentro de la cara)
 *   · partes:    [{ persona: índice, mascaras: {parte: Uint8Array}, w, h }]
 */
export function buildPersons(caras, res = {}, imgW = 0, imgH = 0){
  const personas = caras.map((f, i) => ({
    id: i, caja: boxFromFace(f, imgW, imgH),
    cara: { caja: { x: f.x, y: f.y, w: f.w, h: f.h }, score: f.score, ojos: f.eyes, nariz: f.nose, boca: f.mouth, puntos: null },
    manos: [], pose: null, partes: null, proporciones: null
  }));
  for(const l of res.landmarks || []) if(personas[l.cara]) personas[l.cara].cara.puntos = l.puntos;
  for(const pose of res.poses || []){
    const n = pose.puntos.nariz || pose.puntos.ojoI || pose.puntos.ojoD;
    const i = n ? ownerOf(personas, n[0], n[1]) : -1;
    if(i < 0 || personas[i].pose) continue;
    personas[i].pose = pose;
    personas[i].caja = boxFromPose(pose) || personas[i].caja;
    personas[i].proporciones = proportionsFromPose(pose);
  }
  for(const m of res.manos || []){
    // la mano pertenece a la persona cuya caja la contiene (por su centro) o, si hay varias, la más cercana
    const [cx, cy] = m.w != null ? [m.x + m.w / 2, m.y + m.h / 2] : m.puntos[0];
    let best = -1, d = Infinity;
    personas.forEach((p, i) => { const [px, py] = centro(p.caja); const dd = Math.hypot(px - cx, py - cy) / Math.max(1, p.caja.w);
      if((inside(p.caja, cx, cy) || dd < 3) && dd < d){ best = i; d = dd; } });
    if(best >= 0) personas[best].manos.push(m);
  }
  for(const s of res.partes || []) if(personas[s.persona]) personas[s.persona].partes = { w: s.w, h: s.h, mascaras: s.mascaras };
  return personas;
}
