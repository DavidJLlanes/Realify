/* ═══════════════════════════════════════════════════════════════
   MEMES · MÁS DISEÑOS
   Formatos habituales en los generadores de memes (Imgflip, Kapwing…):
   barras de texto arriba y abajo en negro o blanco, panel lateral,
   comparación de dos opciones, «expectativa vs. realidad», formatos
   cuadrado y vertical para redes, portada de periódico, chat, cartel
   de «Se busca», cartela de cómic y póster de película.

   Mismo contrato que designs.js: `layout(w, h, frame, photo)` devuelve
   el lienzo, dónde va la foto y qué se pinta debajo / encima; `texts`
   los textos iniciales. La foto llega a `layout` para los diseños que
   pintan una copia de ella (fondo difuminado, «realidad» en B/N).
   ═══════════════════════════════════════════════════════════════ */

import { newText, applyPreset } from "./model.js";

const T = (preset, over) => { const t = newText(over); applyPreset(t, preset); Object.assign(t, over); return t; };
const fill = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
const pct = (v, total) => v / total * 100;

/* Copia de la foto a toda la zona (recorte «cover») muy difuminada:
   reducirla a unas decenas de píxeles y volver a ampliarla es un
   desenfoque fuerte que funciona en todos los navegadores. */
function blurCover(ctx, photo, x, y, W, H, darken = .35){
  const k = Math.max(W / photo.width, H / photo.height);
  const dw = photo.width * k, dh = photo.height * k;
  const small = document.createElement("canvas");
  small.width = 32; small.height = Math.max(1, Math.round(32 * dh / dw));
  const sx = small.getContext("2d"); sx.imageSmoothingQuality = "high"; sx.drawImage(photo, 0, 0, small.width, small.height);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, W, H); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, x + (W - dw) / 2, y + (H - dh) / 2, dw, dh);
  ctx.fillStyle = `rgba(0,0,0,${darken})`; ctx.fillRect(x, y, W, H);
  ctx.restore();
}
/* Copia en blanco y negro (modo de fusión «saturation»). */
function grayCopy(ctx, photo, x, y){
  ctx.save();
  ctx.drawImage(photo, x, y);
  ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "#808080"; ctx.fillRect(x, y, photo.width, photo.height);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
function mark(ctx, cx, cy, r, ok){
  ctx.save();
  ctx.fillStyle = ok ? "#1faa59" : "#e0303a"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = r * .22; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
  if(ok){ ctx.moveTo(cx - r * .45, cy + r * .02); ctx.lineTo(cx - r * .1, cy + r * .38); ctx.lineTo(cx + r * .5, cy - r * .35); }
  else { ctx.moveTo(cx - r * .4, cy - r * .4); ctx.lineTo(cx + r * .4, cy + r * .4); ctx.moveTo(cx + r * .4, cy - r * .4); ctx.lineTo(cx - r * .4, cy + r * .4); }
  ctx.stroke(); ctx.restore();
}
const bars = (w, f) => Math.round(w * (.12 + .2 * f.size / 100));

export const MORE_DESIGNS = [
  { id: "blackbars", label: "Negro arriba y abajo", hint: "Fondo negro con texto arriba y abajo", frameColor: "#000000", frameSize: 40,
    layout: (w, h, f) => { const b = bars(w, f); return { W: w, H: h + b * 2, img: { x: 0, y: b, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w, h + b * 2) }; },
    texts: L => [T("classic", { text: "CUANDO EL LUNES", stroke: 0, y: pct(L.img.y / 2, L.H), size: 80 }),
                 T("classic", { text: "VUELVE OTRA VEZ", stroke: 0, y: pct(L.img.y + L.img.h + L.img.y / 2, L.H), size: 80 })] },

  { id: "whitebars", label: "Blanco arriba y abajo", hint: "Barras blancas con texto negro", frameColor: "#ffffff", frameSize: 40,
    layout: (w, h, f) => { const b = bars(w, f); return { W: w, H: h + b * 2, img: { x: 0, y: b, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w, h + b * 2) }; },
    texts: L => [T("impact", { text: "YO ANTES DEL CAFÉ", color: "#111111", stroke: 0, y: pct(L.img.y / 2, L.H), size: 78 }),
                 T("impact", { text: "YO DESPUÉS DEL CAFÉ", color: "#111111", stroke: 0, y: pct(L.img.y + L.img.h + L.img.y / 2, L.H), size: 78 })] },

  { id: "blacktop", label: "Barra negra arriba", hint: "Título blanco sobre barra negra", frameColor: "#000000", frameSize: 35,
    layout: (w, h, f) => { const b = bars(w, f); return { W: w, H: h + b, img: { x: 0, y: b, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w, b) }; },
    texts: L => [T("modern", { text: "Cuando alguien dice «una última partida»", color: "#ffffff", y: pct(L.img.y / 2, L.H), size: 52, w: 92 })] },

  { id: "blackbottom", label: "Barra negra abajo", hint: "Pie blanco sobre barra negra", frameColor: "#000000", frameSize: 35,
    layout: (w, h, f) => { const b = bars(w, f); return { W: w, H: h + b, img: { x: 0, y: 0, w, h }, under: ctx => fill(ctx, f.color, 0, h, w, b) }; },
    texts: L => [T("modern", { text: "Mi cara cuando funciona a la primera", color: "#ffffff", y: pct(L.img.h + (L.H - L.img.h) / 2, L.H), size: 52, w: 92 })] },

  { id: "side", label: "Texto al lado", hint: "Panel lateral con el texto", frameColor: "#000000", frameSize: 40,
    layout: (w, h, f) => { const pw = Math.round(w * (.5 + .5 * f.size / 100)); return { W: w + pw, H: h, img: { x: 0, y: 0, w, h }, under: ctx => fill(ctx, f.color, w, 0, pw, h) }; },
    texts: L => { const pw = L.W - L.img.w; return [T("modern", { text: "Cuando por fin entiendes el código que escribiste ayer", color: "#ffffff", x: pct(L.img.w + pw / 2, L.W), w: pct(pw * .84, L.W), y: 50, size: 48, align: "left" })]; } },

  { id: "choice", label: "Comparación No / Sí", hint: "Dos opciones: la que no y la que sí", frameColor: "#ffffff", frameSize: 0,
    layout: (w, h, f) => ({ W: w * 2, H: h, img: { x: 0, y: 0, w, h }, under: ctx => {
      fill(ctx, f.color, w, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.fillRect(w, h / 2 - Math.max(1, w * .003), w, Math.max(2, w * .006));
      mark(ctx, w + w * .12, h * .25, w * .07, false); mark(ctx, w + w * .12, h * .75, w * .07, true);
    } }),
    // El texto empieza a la derecha de los iconos (que llegan al 60 % del ancho).
    texts: L => [T("modern", { text: "Hacer la tarea con tiempo", x: 79, w: 34, y: 25, size: 40, align: "left" }),
                 T("modern", { text: "Hacerla la noche antes", x: 79, w: 34, y: 75, size: 40, align: "left" })] },

  { id: "expectation", label: "Expectativa vs. realidad", hint: "La misma foto en color y en blanco y negro", frameColor: "#ffffff", frameSize: 30,
    layout: (w, h, f, photo) => {
      const gap = Math.round(w * .03), bar = Math.round(w * (.14 + .12 * f.size / 100));
      return { W: w * 2 + gap, H: h + bar, img: { x: 0, y: bar, w, h }, under: ctx => {
        fill(ctx, f.color, 0, 0, w * 2 + gap, h + bar);
        if(photo) grayCopy(ctx, photo, w + gap, bar);
      } };
    },
    texts: L => [T("impact", { text: "EXPECTATIVA", color: "#111111", stroke: 0, x: pct(L.img.w / 2, L.W), w: 46, y: pct(L.img.y / 2, L.H), size: 42 }),
                 T("impact", { text: "REALIDAD", color: "#111111", stroke: 0, x: pct(L.W - L.img.w / 2, L.W), w: 46, y: pct(L.img.y / 2, L.H), size: 42 })] },

  { id: "square", label: "Cuadrado difuminado", hint: "Formato cuadrado con el fondo de la propia foto", frameColor: "#000000", frameSize: 30,
    layout: (w, h, f, photo) => {
      const S = Math.round(Math.max(w, h) * (1.04 + .3 * f.size / 100));
      const x = Math.round((S - w) / 2), y = Math.round((S - h) / 2);
      return { W: S, H: S, img: { x, y, w, h }, under: ctx => { fill(ctx, "#000", 0, 0, S, S); if(photo) blurCover(ctx, photo, 0, 0, S, S); } };
    },
    texts: L => [T("caption", { text: "Cuando por fin es viernes", y: pct(Math.max(L.img.y / 2, L.H * .06), L.H), size: 52 })] },

  { id: "story", label: "Historia vertical 9:16", hint: "Para historias y vídeos cortos, con fondo difuminado", frameColor: "#000000", frameSize: 30,
    layout: (w, h, f, photo) => {
      const W = w, H = Math.max(Math.round(W * 16 / 9), Math.round(h + W * .5));
      const y = Math.round((H - h) / 2);
      return { W, H, img: { x: 0, y, w, h }, under: ctx => { fill(ctx, "#000", 0, 0, W, H); if(photo) blurCover(ctx, photo, 0, 0, W, H, .25 + .5 * f.size / 100); } };
    },
    texts: L => [T("caption", { text: "POV: abres la nevera por quinta vez", font: "Montserrat", bold: true, y: pct(L.img.y / 2, L.H), size: 62, w: 88 }),
                 T("caption", { text: "y sigue sin haber nada nuevo", font: "Montserrat", bold: true, y: pct(L.img.y + L.img.h + (L.H - L.img.y - L.img.h) / 2, L.H), size: 52, w: 88 })] },

  { id: "newspaper", label: "Portada de periódico", hint: "Cabecera, titular a toda página y pie de foto", frameColor: "#f3efe4", frameSize: 30,
    layout: (w, h, f) => {
      const pad = Math.round(w * .05), mast = Math.round(w * .16), head = Math.round(w * (.18 + .1 * f.size / 100)), cap = Math.round(w * .09);
      const W = w + pad * 2, H = pad + mast + head + h + cap + pad, iy = pad + mast + head;
      return { W, H, img: { x: pad, y: iy, w, h }, under: ctx => {
        fill(ctx, f.color, 0, 0, W, H);
        ctx.fillStyle = "#1a1a1a";
        const lw = Math.max(1, Math.round(w * .003));
        ctx.fillRect(pad, pad + mast * .78, w, lw * 2.5); ctx.fillRect(pad, pad + mast * .78 + lw * 4, w, lw);
        ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = lw; ctx.strokeRect(pad - lw, iy - lw, w + lw * 2, h + lw * 2);
      } };
    },
    texts: L => {
      const pad = L.img.x, mast = L.img.w * .16, head = L.img.y - pad - mast;
      return [
        T("elegant", { text: "El Diario de Realify", font: "UnifrakturMaguntia", italic: false, caps: false, color: "#111111", shadow: 0, size: 78, y: pct(pad + mast * .38, L.H), w: 92 }),
        T("elegant", { text: "MARTES · EDICIÓN ESPECIAL · 1 €", font: "Old Standard TT", italic: false, caps: true, color: "#333333", shadow: 0, size: 18, tracking: 12, y: pct(pad + mast * .92, L.H), w: 92 }),
        T("elegant", { text: "Descubren que el café no cuenta como desayuno", font: "Old Standard TT", bold: true, italic: false, caps: false, color: "#111111", shadow: 0, size: 56, lineHeight: 105, y: pct(pad + mast + head / 2, L.H), w: 90 }),
        T("elegant", { text: "Imagen de archivo. La redacción no ha podido confirmar nada.", font: "Old Standard TT", italic: true, caps: false, color: "#333333", shadow: 0, size: 22, y: pct(L.img.y + L.img.h + (L.H - L.img.y - L.img.h - pad) / 2, L.H), w: 90 })];
    } },

  { id: "chat", label: "Chat de mensajería", hint: "Dos mensajes de chat encima de la foto", frameColor: "#e9edf2", frameSize: 40,
    layout: (w, h, f) => { const top = Math.round(w * (.36 + .2 * f.size / 100)); return { W: w, H: h + top, img: { x: 0, y: top, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w, top) }; },
    texts: L => [
      T("modern", { text: "¿Qué estás haciendo?", bold: false, font: "Inter", color: "#111111", bgShape: "round", bgColor: "#ffffff", bgPad: 40, bgRadius: 60, size: 52, x: 38, w: 68, y: pct(L.img.y * .3, L.H), align: "left" }),
      T("modern", { text: "Nada, trabajando 🙂", bold: false, font: "Inter", color: "#ffffff", bgShape: "round", bgColor: "#2f7cf6", bgPad: 40, bgRadius: 60, size: 52, x: 62, w: 68, y: pct(L.img.y * .72, L.H), align: "right" })] },

  { id: "wanted", label: "Se busca", hint: "Cartel del Oeste con recompensa", frameColor: "#e6d2a3", frameSize: 40,
    layout: (w, h, f) => {
      const pad = Math.round(w * (.08 + .06 * f.size / 100)), top = Math.round(w * .3), bottom = Math.round(w * .3);
      const W = w + pad * 2, H = top + h + bottom;
      return { W, H, img: { x: pad, y: top, w, h }, under: ctx => {
        fill(ctx, f.color, 0, 0, W, H);
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
        g.addColorStop(0, "rgba(90,55,20,0)"); g.addColorStop(1, "rgba(90,55,20,.45)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const lw = Math.max(2, w * .012); ctx.strokeStyle = "#3b2612"; ctx.lineWidth = lw; ctx.strokeRect(pad - lw, top - lw, w + lw * 2, h + lw * 2);
      } };
    },
    texts: L => [
      T("classic", { text: "SE BUSCA", font: "Rye", color: "#3b2612", stroke: 0, size: 150, y: pct(L.img.y * .5, L.H), w: 94 }),
      T("classic", { text: "POR COMERSE EL ÚLTIMO TROZO", font: "Rye", color: "#3b2612", stroke: 0, size: 38, y: pct(L.img.y + L.img.h + (L.H - L.img.y - L.img.h) * .35, L.H), w: 92 }),
      T("classic", { text: "RECOMPENSA: 10.000 $", font: "Rye", color: "#7a1f10", stroke: 0, size: 62, y: pct(L.img.y + L.img.h + (L.H - L.img.y - L.img.h) * .72, L.H), w: 92 })] },

  { id: "comicpanel", label: "Viñeta de cómic", hint: "Cartela amarilla de narrador y borde negro", frameColor: "#111111", frameSize: 50,
    layout: (w, h, f) => { const b = Math.max(2, Math.round(w * .03 * f.size / 100)); return { W: w + b * 2, H: h + b * 2, img: { x: b, y: b, w, h }, under: ctx => fill(ctx, f.color, 0, 0, w + b * 2, h + b * 2) }; },
    texts: () => [
      T("typewriter", { text: "MIENTRAS TANTO, EN LA OFICINA…", font: "Bangers", caps: true, color: "#111111", bgShape: "rect", bgColor: "#ffe24a", bgPad: 30, size: 42, x: 27, w: 44, y: 8, align: "left", tracking: 4 }),
      T("typewriter", { text: "¡Y NADIE SE DIO CUENTA!", font: "Bangers", caps: true, color: "#111111", bgShape: "rect", bgColor: "#ffffff", bgPad: 30, size: 40, x: 72, w: 46, y: 91, align: "right", tracking: 3 })] },

  { id: "movieposter", label: "Póster de película", hint: "Título enorme, lema y créditos sobre degradado", frameColor: "#000000", frameSize: 60,
    layout: (w, h, f) => ({ W: w, H: h, img: { x: 0, y: 0, w, h }, over: ctx => {
      const g = ctx.createLinearGradient(0, h * .45, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${.4 + .55 * f.size / 100})`);
      ctx.fillStyle = g; ctx.fillRect(0, h * .45, w, h * .55);
      const t = ctx.createLinearGradient(0, 0, 0, h * .18); t.addColorStop(0, `rgba(0,0,0,${.25 + .4 * f.size / 100})`); t.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = t; ctx.fillRect(0, 0, w, h * .18);
    } }),
    texts: () => [
      T("caption", { text: "ESTE VERANO, NADIE ESTÁ A SALVO", font: "Oswald", bold: false, size: 26, tracking: 20, y: 5, shadow: 0 }),
      T("caption", { text: "EL LUNES", font: "Bebas Neue", size: 190, tracking: 6, y: 76, shadow: 6, shadowBlur: 40 }),
      T("caption", { text: "UNA PRODUCCIÓN DE REALIFY · CON TODO EL EQUIPO · MÚSICA DE NADIE", font: "Oswald", bold: false, size: 18, color: "#c9c9c9", tracking: 8, y: 92, shadow: 0, w: 84 }),
      T("caption", { text: "PRÓXIMAMENTE", font: "Bebas Neue", size: 40, tracking: 18, y: 97.2, shadow: 0, color: "#ffffff" })] }
];
