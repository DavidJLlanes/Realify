/* ═══════════════════════════════════════════════════════════════
   COLLAGE / HISTORY / POST · FORMATOS
   Medidas del lienzo, en cuatro grupos:

     · Redes sociales: las medidas recomendadas por cada plataforma
       para publicaciones, historias, portadas y miniaturas.
     · Proporciones: las relaciones de aspecto habituales. Se generan
       con el lado corto a 1080 px (lo que usan casi todas las redes).
     · Móviles: la resolución nativa de pantalla de los modelos más
       vendidos y conocidos, para fondos de pantalla, historias a
       medida o capturas.
     · Personalizado: ancho y alto a mano.

   Todos son verticales u horizontales con el botón de orientación:
   girar un formato sólo intercambia ancho y alto.

   Las medidas de redes vienen de las guías públicas de cada
   plataforma y de las listas de formatos de tela y poster-studio
   (MIT, ver README.md).
   ═══════════════════════════════════════════════════════════════ */

/* [id, nombre, ancho, alto, zona segura (historias y pantallas)] */
const SOCIAL = [
  ["ig-portrait", "Instagram · publicación 4:5", 1080, 1350],
  ["ig-square", "Instagram · cuadrado 1:1", 1080, 1080],
  ["ig-34", "Instagram · vertical 3:4", 1080, 1440],
  ["ig-landscape", "Instagram · horizontal 1,91:1", 1080, 566],
  ["ig-story", "Instagram · historia / Reels 9:16", 1080, 1920, "story"],
  ["tiktok", "TikTok · vídeo o foto 9:16", 1080, 1920, "tiktok"],
  ["tiktok-photo", "TikTok · carrusel de fotos 3:4", 1080, 1440],
  ["fb-post", "Facebook · publicación 4:5", 1080, 1350],
  ["fb-link", "Facebook · enlace 1,91:1", 1200, 630],
  ["fb-story", "Facebook · historia 9:16", 1080, 1920, "story"],
  ["fb-cover", "Facebook · portada", 1640, 624],
  ["fb-event", "Facebook · evento", 1920, 1005],
  ["x-post", "X (Twitter) · publicación 16:9", 1600, 900],
  ["x-header", "X (Twitter) · cabecera 3:1", 1500, 500],
  ["threads", "Threads · publicación 4:5", 1080, 1350],
  ["li-post", "LinkedIn · publicación", 1200, 627],
  ["li-square", "LinkedIn · cuadrado", 1200, 1200],
  ["li-banner", "LinkedIn · banner del perfil", 1584, 396],
  ["yt-thumb", "YouTube · miniatura 16:9", 1280, 720],
  ["yt-shorts", "YouTube · Shorts 9:16", 1080, 1920, "story"],
  ["yt-banner", "YouTube · banner del canal", 2560, 1440],
  ["pin", "Pinterest · pin 2:3", 1000, 1500],
  ["pin-long", "Pinterest · pin largo 1:2,1", 1000, 2100],
  ["wa-status", "WhatsApp · estado 9:16", 1080, 1920, "story"],
  ["snap", "Snapchat · historia 9:16", 1080, 1920, "story"],
  ["tg-story", "Telegram · historia 9:16", 1080, 1920, "story"],
  ["twitch-banner", "Twitch · banner del perfil", 1200, 480],
  ["bsky-post", "Bluesky · publicación", 1200, 675],
  ["reddit", "Reddit · publicación 4:3", 1200, 900]
];

/* Proporciones [a, b, nombre]; a:b es la forma horizontal. */
const RATIOS = [
  [1, 1, "Cuadrado"], [5, 4, "Retrato clásico"], [4, 3, "Foto (4:3)"], [7, 5, "Foto 10 × 15 ampliada (7:5)"],
  [3, 2, "Cámara réflex (3:2)"], [Math.SQRT2, 1, "Papel A4 / A3"], [16, 10, "Pantalla (16:10)"],
  [16, 9, "Panorámico (16:9)"], [1.91, 1, "Enlace compartido (1,91:1)"], [2, 1, "Univisium (2:1)"],
  [19.5, 9, "Móvil moderno (19,5:9)"], [20, 9, "Móvil alargado (20:9)"], [21, 9, "Cine (21:9)"],
  [3, 1, "Panorámica (3:1)"], [4, 1, "Banner (4:1)"]
];
const ratioLabel = (a, b) => a === Math.SQRT2 ? "√2:1" : `${String(a).replace(".", ",")}:${b}`;

/* Pantallas de móvil [id, nombre, ancho, alto] (píxeles físicos,
   vertical). Las más vendidas y las más conocidas de cada marca. */
const PHONES = [
  ["iphone17promax", "iPhone 17 Pro Max · 16 Pro Max", 1320, 2868, "island"],
  ["iphone17pro", "iPhone 17 Pro · 17 · 16 Pro", 1206, 2622, "island"],
  ["iphoneair", "iPhone Air", 1260, 2736, "island"],
  ["iphone16plus", "iPhone 16 Plus · 15 Pro Max · 15 Plus", 1290, 2796, "island"],
  ["iphone16", "iPhone 16 · 15 · 15 Pro · 14 Pro", 1179, 2556, "island"],
  ["iphone14", "iPhone 16e · 14 · 13 · 12", 1170, 2532, "notch"],
  ["iphone13mini", "iPhone 13 mini · 12 mini", 1080, 2340, "notch"],
  ["iphone11", "iPhone 11 · XR", 828, 1792, "notch"],
  ["iphonese", "iPhone SE · 8", 750, 1334, "none"],
  ["s25ultra", "Samsung Galaxy S25 Ultra · S24 Ultra", 1440, 3120, "hole"],
  ["s25plus", "Samsung Galaxy S25+ · S24+", 1440, 3120, "hole"],
  ["s25", "Samsung Galaxy S25 · S24 · S23", 1080, 2340, "hole"],
  ["galaxya", "Samsung Galaxy A56 · A55 · A36 · A16", 1080, 2340, "hole"],
  ["zflip", "Samsung Galaxy Z Flip7 · Z Flip6", 1080, 2640, "hole"],
  ["zfold", "Samsung Galaxy Z Fold7 (abierto)", 1968, 2184, "hole"],
  ["pixel10proxl", "Google Pixel 10 Pro XL · 9 Pro XL", 1344, 2992, "hole"],
  ["pixel10pro", "Google Pixel 10 Pro · 9 Pro", 1280, 2856, "hole"],
  ["pixel10", "Google Pixel 10 · 9", 1080, 2424, "hole"],
  ["pixela", "Google Pixel 9a · 8a", 1080, 2424, "hole"],
  ["xiaomi15", "Xiaomi 15 · 14", 1200, 2670, "hole"],
  ["xiaomi15ultra", "Xiaomi 15 Ultra · 14 Ultra", 1440, 3200, "hole"],
  ["redminote", "Redmi Note 14 · Note 13", 1080, 2400, "hole"],
  ["oneplus13", "OnePlus 13", 1440, 3168, "hole"],
  ["oppofindx8", "OPPO Find X8", 1256, 2760, "hole"],
  ["motoedge", "Motorola Edge 50 · Edge 60", 1220, 2712, "hole"],
  ["huaweipura", "Huawei Pura 70 · P60", 1256, 2760, "hole"],
  ["honor400", "Honor 400 · Magic7", 1264, 2800, "hole"]
];

export const GROUPS = [
  ["social", "Redes sociales"],
  ["ratio", "Proporciones"],
  ["phone", "Móviles"],
  ["custom", "Personalizado"]
];

/* Lista común: { id, group, label, w, h, safe } siempre en su
   orientación de fábrica (vertical para móviles e historias). */
export const FORMATS = [
  ...SOCIAL.map(([id, label, w, h, safe]) => ({ id, group: "social", label, w, h, safe: safe || null })),
  ...RATIOS.map(([a, b, name]) => {
    const long = Math.round(1080 * a / b);
    const id = `r-${ratioLabel(a, b)}`;
    return { id, group: "ratio", label: `${ratioLabel(a, b)} · ${name}`, w: Math.min(long, 4320), h: 1080, safe: null };
  }),
  ...PHONES.map(([id, label, w, h, cut]) => ({ id, group: "phone", label, w, h, safe: "phone", cutout: cut })),
  { id: "custom", group: "custom", label: "Personalizado", w: 1080, h: 1350, safe: null }
];
export const format = id => FORMATS.find(f => f.id === id) || FORMATS[0];

/* Medidas finales del formato en la orientación pedida. `orient` es
   "portrait" o "landscape"; un cuadrado no cambia. */
export function sizeOf(f, orient, custom){
  let w = f.id === "custom" ? custom.w : f.w, h = f.id === "custom" ? custom.h : f.h;
  if(f.id !== "custom" && w !== h && (orient === "landscape") !== (w > h)) [w, h] = [h, w];
  return { w: Math.max(16, Math.min(8192, Math.round(w))), h: Math.max(16, Math.min(8192, Math.round(h))) };
}
/* Orientación natural del formato (para el botón al elegirlo). */
export const naturalOrient = f => f.w >= f.h ? (f.w === f.h ? "portrait" : "landscape") : "portrait";

/* Proporción legible de unas medidas: «4:5», «9:16», «≈ 9:19,5»…
   Primero las proporciones con nombre (las de pantallas de móvil se
   anuncian así, con medios pasos), luego la exacta si es sencilla y
   si no, en decimales. */
const NAMED = [[1, 1], [4, 5], [3, 4], [2, 3], [9, 16], [1, 2], [5, 7], [9, 18], [9, 19], [9, 19.5], [9, 20], [9, 20.5], [9, 21], [9, 22],
  [10, 16], [1.91, 1], [2.35, 1], [2.39, 1], [3, 1], [4, 1]];
export function aspectText(w, h){
  const r = w / h, fmt = v => String(v).replace(".", ",");
  for(const [a, b] of NAMED){
    for(const [x, y] of [[a, b], [b, a]]){
      const err = Math.abs(x / y - r) / r;
      if(err < 1e-9) return `${fmt(x)}:${fmt(y)}`;
      if(err < .008) return `≈ ${fmt(x)}:${fmt(y)}`;
    }
  }
  const g = (a, b) => b ? g(b, a % b) : a, d = g(w, h);
  if(w / d <= 32 && h / d <= 32) return `${w / d}:${h / d}`;
  return r >= 1 ? `${fmt(+r.toFixed(2))}:1` : `1:${fmt(+(1 / r).toFixed(2))}`;
}

/* Zonas seguras: lo que tapa la interfaz de la aplicación (historias)
   o del propio teléfono (barra de estado, isla, indicador de inicio).
   En fracciones del lado correspondiente. */
export function safeZones(f, W, H){
  if(!f || !f.safe) return null;
  const portrait = H >= W;
  if(f.safe === "story") return portrait ? { top: 250 / 1920, bottom: 340 / 1920, side: 0 } : null;
  if(f.safe === "tiktok") return portrait ? { top: 160 / 1920, bottom: 480 / 1920, side: 0, right: 150 / 1080 } : null;
  if(f.safe === "phone") return portrait ? { top: .055, bottom: .035, side: 0, cutout: f.cutout, radius: .09 } : { top: 0, bottom: 0, side: .055, cutout: null, radius: .09 };
  return null;
}
