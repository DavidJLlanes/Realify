/* ═══════════════════════════════════════════════════════════════
   LOTE · SALIDA DEL ZIP
   Dos ayudas para la exportación en ZIP: adaptar una foto ya exportada a un formato de red (recorte al centro y reducción, sin ampliar) y poner
   nombre a cada archivo con una plantilla ({nombre} {n} {fecha} {ancho} {alto} {formato}) sin repetir nombres.
   Entradas: Blob y plan (js/features/library/shared/formatos-redes.js); plantilla y datos. Salidas: Blob / nombre único.
   Límites: tras recortar se vuelve a codificar con el lienzo (JPEG, PNG y WebP); AVIF pasa a WebP.
   ═══════════════════════════════════════════════════════════════ */
import { planFormato } from "../../js/features/library/shared/formatos-redes.js";
import { aplicarPlantilla } from "../../js/features/library/auto-tags/engine/plantilla.js";

export const necesitaRecodificar = id => id && id !== "original";

export async function adaptarAFormato(blob, id, { type = "image/jpeg", quality = 0.9, background = "#ffffff" } = {}){
  const bmp = await createImageBitmap(blob), p = planFormato(id, bmp.width, bmp.height), c = document.createElement("canvas"); c.width = p.w; c.height = p.h;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
  if(type === "image/jpeg"){ x.fillStyle = background; x.fillRect(0, 0, p.w, p.h); }
  x.drawImage(bmp, p.sx, p.sy, p.sw, p.sh, 0, 0, p.w, p.h); bmp.close?.();
  const tipo = type === "image/avif" ? "image/webp" : type;
  const out = await new Promise(ok => c.toBlob(ok, tipo, tipo === "image/png" ? undefined : quality));
  if(!out) throw new Error("no se pudo adaptar al formato");
  return { blob: out, type: tipo, w: p.w, h: p.h };
}

/** Nombre de archivo (sin extensión) según la plantilla; si ya existe en `usados`, añade -2, -3… */
export function nombreUnico(plantilla, datos, usados){
  const base = aplicarPlantilla(plantilla || "{nombre}", datos); let n = base, i = 1;
  while(usados.has(n)) n = `${base}-${++i}`;
  usados.add(n); return n;
}
