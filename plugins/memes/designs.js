/* ═══════════════════════════════════════════════════════════════
   MEMES · DISEÑOS
   Cada diseño decide, a partir del tamaño de la foto y de las
   opciones de marco (`frame` = { color, size 0-100 }):
     · el tamaño del lienzo del meme (W×H) —algunos lo amplían para
       poner barras o marcos fuera de la foto—,
     · dónde queda la foto (img = { x, y, w, h }), siempre a su tamaño
       real: ampliar el lienzo nunca reescala la foto,
     · qué se pinta DEBAJO de la foto (fondo, marcos) y ENCIMA (barras
       semitransparentes, degradados),
     · y sus textos iniciales (sólo al elegir el diseño).
   ═══════════════════════════════════════════════════════════════ */

import { newText, applyPreset } from "./model.js";
import { MORE_DESIGNS } from "./designs-more.js";

const T = (preset, over) => { const t = newText(over); applyPreset(t, preset); Object.assign(t, over); return t; };

const BASE_DESIGNS = [
  { id: "classic", label: "Clásico", hint: "Texto arriba y abajo, blanco con contorno", frameColor: "#000000", frameSize: 0,
    layout: (w, h) => ({ W: w, H: h, img: { x: 0, y: 0, w, h } }),
    texts: () => [T("classic", { text: "CUANDO ABRES EL EDITOR", y: 9, size: 85 }), T("classic", { text: "Y YA NO PUEDES PARAR", y: 91, size: 85 })] },

  { id: "modern", label: "Moderno", hint: "Barra blanca arriba con texto negro", frameColor: "#ffffff", frameSize: 40,
    layout: (w, h, f) => { const bar = Math.round(w * (.1 + .3 * f.size / 100)); return { W: w, H: h + bar, img: { x: 0, y: bar, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w, bar) }; },
    texts: (L) => [T("modern", { text: "Nadie:\nYo a las 3 de la mañana:", x: 50, y: L.img.y / 2 / L.H * 100, size: 55, w: 92, align: "left" })] },

  { id: "caption", label: "Pie de foto", hint: "Barra debajo de la foto", frameColor: "#ffffff", frameSize: 35,
    layout: (w, h, f) => { const bar = Math.round(w * (.1 + .3 * f.size / 100)); return { W: w, H: h + bar, img: { x: 0, y: 0, w, h }, under: ctx => fill(ctx, f.color, 0, h, w, bar) }; },
    texts: (L) => [T("modern", { text: "Cuando por fin entiendes el chiste", y: (L.img.h + (L.H - L.img.h) / 2) / L.H * 100, size: 55 })] },

  { id: "demotivational", label: "Desmotivador", hint: "Marco negro, foto con filete blanco y título", frameColor: "#000000", frameSize: 40,
    layout: (w, h, f) => {
      const pad = Math.round(w * (.06 + .08 * f.size / 100)), foot = Math.round(w * .3);
      const W = w + pad * 2, H = h + pad + foot, line = Math.max(2, Math.round(w * .004)), gap = line * 2;
      return { W, H, img: { x: pad, y: pad, w, h }, under: ctx => {
        fill(ctx, f.color, 0, 0, W, H);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = line; ctx.strokeRect(pad - gap, pad - gap, w + gap * 2, h + gap * 2);
      } };
    },
    texts: (L) => [
      T("elegant", { text: "FRACASO", font: "Playfair Display", italic: false, caps: true, size: 95, y: (L.img.y + L.img.h + (L.H - L.img.y - L.img.h) * .38) / L.H * 100, shadow: 0, tracking: 8 }),
      T("elegant", { text: "Cuando lo intentas todo y aun así no funciona", italic: false, caps: false, font: "Roboto", size: 38, y: (L.img.y + L.img.h + (L.H - L.img.y - L.img.h) * .72) / L.H * 100, shadow: 0 })] },

  { id: "polaroid", label: "Polaroid", hint: "Marco blanco con texto a mano", frameColor: "#fbfaf6", frameSize: 30,
    layout: (w, h, f) => {
      const pad = Math.round(w * (.04 + .05 * f.size / 100)), foot = Math.round(w * .22);
      const W = w + pad * 2, H = h + pad + foot;
      return { W, H, img: { x: pad, y: pad, w, h }, under: ctx => fill(ctx, f.color, 0, 0, W, H) };
    },
    texts: (L) => [T("handwritten", { text: "verano del 98", size: 80, y: (L.img.y + L.img.h + (L.H - L.img.y - L.img.h) / 2) / L.H * 100 })] },

  { id: "movie", label: "Película", hint: "Bandas negras y subtítulo", frameColor: "#000000", frameSize: 45,
    layout: (w, h, f) => { const bar = Math.round(h * (.05 + .12 * f.size / 100)); return { W: w, H: h + bar * 2, img: { x: 0, y: bar, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w, h + bar * 2) }; },
    texts: (L) => [T("subtitle", { text: "— ¿Tú también lo has visto?\n— Todo el mundo lo ha visto.", size: 42, y: (L.img.y + L.img.h * .86) / L.H * 100, lineHeight: 125 })] },

  { id: "news", label: "Última hora", hint: "Rótulo de noticiario", frameColor: "#d10000", frameSize: 0,
    layout: (w, h) => ({ W: w, H: h, img: { x: 0, y: 0, w, h }, over: ctx => {
      const g = ctx.createLinearGradient(0, h * .72, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = g; ctx.fillRect(0, h * .72, w, h * .28);
    } }),
    texts: () => [
      T("news", { text: "ÚLTIMA HORA", size: 42, x: 17, y: 78, w: 30, align: "left" }),
      T("pill", { text: "Descubren que el lunes vuelve cada semana", bgShape: "rect", bgColor: "#ffffff", color: "#111111", bgOpacity: 100, size: 44, x: 50, y: 87, w: 94, align: "left", bgPad: 30 })] },

  { id: "tweet", label: "Publicación", hint: "Cabecera de red social con avatar", frameColor: "#ffffff", frameSize: 45,
    layout: (w, h, f) => {
      const bar = Math.round(w * (.2 + .25 * f.size / 100)), av = Math.round(w * .09), m = Math.round(w * .04);
      return { W: w, H: h + bar, img: { x: 0, y: bar, w, h }, under: ctx => {
        fill(ctx, f.color, 0, 0, w, bar);
        const g = ctx.createLinearGradient(m, m, m + av, m + av); g.addColorStop(0, "#7aa7ff"); g.addColorStop(1, "#c36bff");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m + av / 2, m + av / 2, av / 2, 0, Math.PI * 2); ctx.fill();
      } };
    },
    texts: (L) => {
      const u = L.W, m = .04 * u, av = .09 * u;
      return [
        T("modern", { text: "Realify", size: 36, x: (m + av + m * .6) / u * 100 + 35, y: (m + av * .3) / L.H * 100, w: 70, align: "left" }),
        T("modern", { text: "@realify_es", size: 30, bold: false, color: "#6b7280", x: (m + av + m * .6) / u * 100 + 35, y: (m + av * .78) / L.H * 100, w: 70, align: "left" }),
        T("modern", { text: "Yo explicando por qué necesito otra cámara", size: 44, bold: false, x: 50, y: (m + av + (L.img.y - m - av) / 2) / L.H * 100, w: 92, align: "left" })];
    } },

  { id: "comic", label: "Cómic", hint: "Bocadillo de diálogo sobre la foto", frameColor: "#111111", frameSize: 20,
    layout: (w, h, f) => { const b = Math.round(w * .025 * f.size / 100); return { W: w + b * 2, H: h + b * 2, img: { x: b, y: b, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w + b * 2, h + b * 2) }; },
    texts: () => [T("bubble", { text: "¿En serio? ¿Otra vez lunes?", size: 55, x: 62, y: 18, w: 55 })] },

  { id: "quote", label: "Cita", hint: "Frase célebre sobre degradado oscuro", frameColor: "#000000", frameSize: 70,
    layout: (w, h, f) => ({ W: w, H: h, img: { x: 0, y: 0, w, h }, over: ctx => {
      const g = ctx.createLinearGradient(0, h * .35, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${.3 + .6 * f.size / 100})`);
      ctx.fillStyle = g; ctx.fillRect(0, h * .35, w, h * .65);
    } }),
    texts: () => [
      T("elegant", { text: "“No es un error, es una característica.”", size: 62, y: 76, w: 86 }),
      T("elegant", { text: "— Anónimo", italic: false, font: "Roboto", size: 34, y: 90, color: "#e5e5e5" })] },

  { id: "poster", label: "Póster", hint: "Marco de color y título enorme", frameColor: "#ffd400", frameSize: 50,
    layout: (w, h, f) => {
      const b = Math.round(w * (.03 + .07 * f.size / 100)), foot = Math.round(w * .24);
      return { W: w + b * 2, H: h + b * 2 + foot, img: { x: b, y: b, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w + b * 2, h + b * 2 + foot) };
    },
    texts: (L) => [T("hardshadow", { text: "¡NO TE LO PIERDAS!", color: "#111111", shadowColor: "#ffffff", font: "Anton", size: 110, y: (L.img.y + L.img.h + (L.H - L.img.y - L.img.h) / 2) / L.H * 100 })] },

  { id: "free", label: "Libre", hint: "Sólo la foto: añade los textos que quieras", frameColor: "#000000", frameSize: 0,
    layout: (w, h) => ({ W: w, H: h, img: { x: 0, y: 0, w, h } }),
    texts: () => [T("classic", { text: "TU TEXTO AQUÍ", y: 50 })] }
];

function fill(ctx, color, x, y, w, h){ ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

/* Orden en que se ofrecen: por familias —barras de texto, paneles y
   comparaciones, marcos, sobre la foto, formatos de redes— y «Libre»
   al final. */
const ORDER = ["classic", "blackbars", "whitebars", "blacktop", "blackbottom", "modern", "caption",
  "demotivational", "side", "choice", "expectation", "polaroid", "movie", "news", "tweet", "chat",
  "comic", "comicpanel", "quote", "poster", "movieposter", "newspaper", "wanted", "square", "story", "free"];
const ALL = [...BASE_DESIGNS, ...MORE_DESIGNS];
export const DESIGNS = [...ORDER.map(id => ALL.find(d => d.id === id)).filter(Boolean),
  ...ALL.filter(d => !ORDER.includes(d.id))];

export const design = id => DESIGNS.find(d => d.id === id) || DESIGNS[0];
