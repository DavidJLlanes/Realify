/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN RÁPIDA · ANÁLISIS DE UNA FOTO
   Con una copia reducida: nitidez, rango dinámico y recortes (js/features/realism/engine/informe.js), hash perceptual, ojos cerrados (puntos de
   la cara de js/ai/people) y composición (mapa de importancia de «Recorte inteligente»). Los dos últimos usan modelos y son opcionales.
   Entradas: lienzo reducido (≤ 640 px) y { ojos, compo }. Salida: { hash, medidas, ojos, compo, puntos, motivos }.
   ═══════════════════════════════════════════════════════════════ */
import { medir } from "../../js/features/realism/engine/informe.js";
import { dHash, ojosCerrados, composicion, puntuar } from "./engine.js";

function gris9x8(c){
  const t = document.createElement("canvas"); t.width = 9; t.height = 8; const x = t.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, 9, 8);
  const d = x.getImageData(0, 0, 9, 8).data, g = new Float32Array(72); for(let i = 0; i < 72; i++) g[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; return g;
}

export async function analizarFoto(c, { ojos = true, compo = true } = {}){
  const px = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height), m = medir(px.data, c.width, c.height);
  let cerr = null, cp = null;
  if(ojos){
    try{
      const { analyze } = await import("../../js/ai/people/analyze.js"), r = await analyze(c, { quality: "bueno", kinds: ["landmarks"] }), caras = r.personas.filter(p => p.cara?.puntos?.length >= 400);
      if(caras.length) cerr = caras.some(p => ojosCerrados(p.cara.puntos));
    } catch(err){ if(err && err.cancelled) throw err; }
  }
  if(compo){
    try{ const { importanceMap } = await import("../../js/features/smartcrop.js"), M = await importanceMap(c); cp = composicion(M.imp, M.gw, M.gh); } catch(err){ if(err && err.cancelled) throw err; }
  }
  const s = puntuar({ ...m, ojos: cerr, compo: cp });
  return { hash: dHash(gris9x8(c)), medidas: m, ojos: cerr, compo: cp, puntos: s.puntos, motivos: s.motivos };
}
