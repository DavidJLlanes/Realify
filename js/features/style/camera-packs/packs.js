/* ═══════════════════════════════════════════════════════════════
   PACKS DE CÁMARA · PACKS
   Agrupa las cámaras de plugins/cameras en tres packs por sus familias. Entradas: PRESETS de plugins/cameras/presets.js. Salida: opciones del selector [[id, «Pack · Nombre»]…].
   ═══════════════════════════════════════════════════════════════ */

export const PACKS = [
  { id: "pelicula", nombre: "Película", cats: ["Película en color", "Película en blanco y negro", "Instantáneas", "Compactas analógicas", "Cámaras de juguete"] },
  { id: "movil", nombre: "Móvil", cats: ["Móviles y webcams", "Compactas digitales CCD", "Vídeo y vigilancia"] },
  { id: "reflex", nombre: "Réflex y óptica", cats: ["Lentes y accesorios", "Ópticas especiales", "Luz y clima", "Cine y fotogramas"] }
];

export function opciones(presets){
  const out = [];
  for(const k of PACKS) for(const c of k.cats) for(const p of presets) if(p.cat === c) out.push([p.id, `${k.nombre} · ${p.name}`]);
  return out;
}
