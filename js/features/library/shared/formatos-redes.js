/* ═══════════════════════════════════════════════════════════════
   BIBLIOTECA · FORMATOS PARA REDES (puro, sin DOM)
   Tamaños habituales de publicación y la cuenta de recorte: «cover» (llena el formato recortando al centro) o «lado largo» (sólo reduce).
   Entradas: id de formato y tamaño de la foto. Salida: { w, h, sx, sy, sw, sh } = tamaño final y rectángulo de origen a copiar.
   Los usa la exportación por lotes (plugins/batch). Nunca amplía una foto: si es más pequeña que el formato, la deja como está (recortada a su proporción).
   ═══════════════════════════════════════════════════════════════ */
export const FORMATOS = [
  { id: "original", label: "Tamaño original" },
  { id: "ig-cuadrado", label: "Instagram cuadrado · 1080×1080", w: 1080, h: 1080 },
  { id: "ig-vertical", label: "Instagram vertical 4:5 · 1080×1350", w: 1080, h: 1350 },
  { id: "historia", label: "Historia / Reel 9:16 · 1080×1920", w: 1080, h: 1920 },
  { id: "x", label: "X / Twitter 16:9 · 1600×900", w: 1600, h: 900 },
  { id: "facebook", label: "Facebook / enlaces · 1200×630", w: 1200, h: 630 },
  { id: "web", label: "Web ligera · lado largo 2048", largo: 2048 },
  { id: "miniatura", label: "Miniatura · lado largo 512", largo: 512 }
];

export function planFormato(id, W, H){
  const f = FORMATOS.find(x => x.id === id);
  if(!f || id === "original") return { w: W, h: H, sx: 0, sy: 0, sw: W, sh: H };
  if(f.largo){ const k = Math.min(1, f.largo / Math.max(W, H)); return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)), sx: 0, sy: 0, sw: W, sh: H }; }
  const ra = f.w / f.h; let sw = W, sh = H;
  if(W / H > ra) sw = Math.round(H * ra); else sh = Math.round(W / ra);
  const k = Math.min(1, f.w / sw);
  return { w: Math.max(1, Math.round(sw * k)), h: Math.max(1, Math.round(sh * k)), sx: Math.round((W - sw) / 2), sy: Math.round((H - sh) / 2), sw, sh };
}
