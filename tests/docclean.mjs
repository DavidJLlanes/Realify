/* Prueba de js/cv/docclean.js (v251): una «hoja» sintética con sombra de iluminación (de 0,45 a 1), texto negro y una mancha. «Aclarar el papel» debe dejar el
   papel liso y casi blanco (fuera del texto) y el texto oscuro; «bw» sólo blanco y negro con el texto negro; «gray» sin color. Sin navegador. Uso: node tests/docclean.mjs */
import { cleanDocument } from "../js/cv/docclean.js";
const W = 600, H = 800;
const make = () => {
  const d = new Uint8ClampedArray(W * H * 4), text = new Uint8Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const light = 0.45 + 0.55 * (x / W) * (0.6 + 0.4 * y / H), paper = [236, 232, 220];   // papel amarillento
    const isText = (y % 40 > 12 && y % 40 < 20 && x > 60 && x < W - 60 && ((x >> 2) % 5 !== 0)) ? 1 : 0;
    const v = isText ? [30, 30, 40] : paper, i = (y * W + x) * 4; text[y * W + x] = isText;
    for(let c = 0; c < 3; c++) d[i + c] = Math.round(v[c] * light); d[i + 3] = 255;
  }
  return { d, text };
};
let bad = 0; const chk = (c, m) => { if(!c){ bad++; console.log("FALLO:", m); } };
const stats = (d, text) => { let pv = 0, pn = 0, pmin = 255, tv = 0, tn = 0, ps = 0; for(let i = 0; i < W * H; i++){ const l = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114; if(text[i]){ tv += l; tn++; } else { pv += l; pn++; pmin = Math.min(pmin, l); ps += l * l; } } const pm = pv / pn; return { paper: pm, paperStd: Math.sqrt(ps / pn - pm * pm), paperMin: pmin, text: tv / tn }; };
{ const { d, text } = make(); const s0 = stats(d, text); const o = cleanDocument(new Uint8ClampedArray(d), W, H, "paper"); const s = stats(o, text);
  console.log("original", JSON.stringify(s0), "paper", JSON.stringify(s));
  chk(s0.paperStd > 25, "la hoja de prueba debería tener una sombra marcada"); chk(s.paper > 235 && s.paperStd < 12, "el papel debe quedar liso y casi blanco"); chk(s.text < 90, "el texto debe seguir oscuro"); }
{ const { d, text } = make(); const o = cleanDocument(new Uint8ClampedArray(d), W, H, "bw"); const s = stats(o, text); let mid = 0; for(let i = 0; i < W * H; i++){ const v = o[i * 4]; if(v > 30 && v < 225) mid++; }
  console.log("bw", JSON.stringify(s), "intermedios", (mid / (W * H)).toFixed(4));
  chk(s.paper > 250 && s.paperMin > 200, "bw: papel blanco"); chk(s.text < 40, "bw: texto negro"); chk(mid / (W * H) < 0.02, "bw: casi sólo blanco y negro"); }
{ const { d, text } = make(); const o = cleanDocument(new Uint8ClampedArray(d), W, H, "gray"); let col = 0; for(let i = 0; i < W * H; i++) if(o[i * 4] !== o[i * 4 + 1] || o[i * 4 + 1] !== o[i * 4 + 2]) col++; chk(col === 0, "gray: sin color"); chk(stats(o, text).paper > 235, "gray: papel claro"); }
console.log(bad ? "docclean: FALLO" : "docclean: OK"); process.exit(bad ? 1 : 0);
