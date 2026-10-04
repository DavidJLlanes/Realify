/* ═══════════════════════════════════════════════════════════════
   CONSTRUYE assets/lensdb/lensfun.json (fase 9 de PENDIENTE.md)
   Descarga la base de datos de objetivos de Lensfun
   (https://github.com/lensfun/lensfun, carpeta data/db) y la compacta a
   JSON para el navegador: cámaras (recorte), objetivos y sus
   calibraciones de distorsión, aberración cromática (TCA) y viñeteo.

   LICENCIA: la base de datos de Lensfun es CC BY-SA 3.0
   (https://creativecommons.org/licenses/by-sa/3.0/): uso comercial
   permitido, con atribución y COMPARTIR IGUAL las adaptaciones de la
   base. El JSON generado es una adaptación: se distribuye bajo esa
   misma licencia (ver assets/lensdb/LICENSE.md). El código de Realify
   sólo lo lee y no se ve afectado.

   Uso:  node tools/build-lensdb.mjs [carpeta con los XML ya descargados]
   ═══════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://raw.githubusercontent.com/lensfun/lensfun/master/data/db/";
const FILES = ["actioncams", "compact-canon", "compact-casio", "compact-fujifilm", "compact-kodak", "compact-leica", "compact-nikon", "compact-olympus", "compact-panasonic", "compact-pentax", "compact-ricoh", "compact-samsung", "compact-sigma", "compact-sony", "compact-konica-minolta", "compact-minolta", "compact-hp", "compact-agfa", "compact-epson", "compact-gopro", "compact-contax", "compact-vivitar", "compact-yi", "generic",
  "mil-canon", "mil-fujifilm", "mil-leica", "mil-nikon", "mil-olympus", "mil-panasonic", "mil-sigma", "mil-sony", "mil-zeiss", "mil-samsung", "mil-pentax", "mil-blackmagic", "mil-djiv", "mil-hasselblad", "mil-sirui", "mil-viltrox",
  "slr-canon", "slr-contax", "slr-fujifilm", "slr-hasselblad", "slr-konica-minolta", "slr-leica", "slr-nikon", "slr-olympus", "slr-pentax", "slr-samsung", "slr-sigma", "slr-sony", "slr-tamron", "slr-tokina", "slr-voigtlander", "slr-zeiss", "slr-minolta", "slr-mamiya", "slr-kodak", "slr-ricoh", "slr-yongnuo", "slr-samyang", "slr-rokinon", "slr-venus", "slr-phase-one",
  "misc", "other", "lensfun-extras"];

/* ── XML mínimo: etiquetas, atributos y texto (la base es muy regular) ── */
function parseXml(s){
  s = s.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[^>]*>/g, "");
  const root = { name: "#root", attrs: {}, kids: [], text: "" }, stack = [root], re = /<(\/?)([\w:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while((m = re.exec(s))){
    if(m[5] !== undefined){ stack.at(-1).text += m[5]; continue; }
    if(m[1]){ stack.pop(); continue; }
    const attrs = {}; for(const a of m[3].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2];
    const node = { name: m[2], attrs, kids: [], text: "" }; stack.at(-1).kids.push(node);
    if(!m[4]) stack.push(node);
  }
  return root;
}
const kids = (n, name) => n.kids.filter(k => k.name === name);
const txt = (n, name) => (kids(n, name)[0]?.text || "").trim();
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const ratio = v => { const m = /^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(v || ""); return m ? +m[1] / +m[2] : num(v, 1.5); };
const r5 = v => Math.round(v * 1e6) / 1e6;

export function compact(xmlTexts){
  const mounts = {}, cameras = [], lenses = [];
  for(const xml of xmlTexts){
    const db = parseXml(xml).kids.find(k => k.name === "lensdatabase"); if(!db) continue;
    for(const m of kids(db, "mount")){ const n = txt(m, "name"); if(n) mounts[n] = kids(m, "compat").map(c => c.text.trim()); }
    for(const c of kids(db, "camera")){
      const maker = txt(c, "maker"), model = txt(c, "model"); if(!maker || !model) continue;
      cameras.push([maker, model, txt(c, "mount"), num(txt(c, "cropfactor"), 1)]);
    }
    for(const l of kids(db, "lens")){
      const maker = txt(l, "maker"), model = kids(l, "model").find(k => !k.attrs.lang)?.text.trim() || txt(l, "model"); if(!maker || !model) continue;
      const crop = num(txt(l, "cropfactor"), 1), ar = ratio(txt(l, "aspect-ratio") || "3:2"), sets = [];
      const calibs = kids(l, "calibration");
      // Un objetivo puede traer varias calibraciones con distinto recorte o proporción
      for(const c of calibs){
        const set = { c: num(c.attrs.cropfactor, crop), a: r5(ratio(c.attrs["aspect-ratio"] || txt(l, "aspect-ratio") || "3:2")), d: [], t: [], v: [] };
        for(const d of kids(c, "distortion")){
          const e = d.attrs, model = e.model;
          const terms = model === "ptlens" ? [e.a, e.b, e.c] : model === "poly5" ? [e.k1, e.k2] : model === "poly3" ? [e.k1] : null;
          if(terms) set.d.push([num(e.focal), model, e["real-focal"] ? num(e["real-focal"]) : 0, ...terms.map(x => r5(num(x)))]);
        }
        for(const t of kids(c, "tca")){
          const e = t.attrs, model = e.model;
          if(model === "poly3") set.t.push([num(e.focal), model, r5(num(e.vr, 1)), r5(num(e.vb, 1)), r5(num(e.cr)), r5(num(e.cb)), r5(num(e.br)), r5(num(e.bb))]);
          else if(model === "linear") set.t.push([num(e.focal), model, r5(num(e.kr, 1)), r5(num(e.kb, 1))]);
        }
        for(const v of kids(c, "vignetting")){
          const e = v.attrs; if(e.model !== "pa") continue;
          set.v.push([num(e.focal), num(e.aperture), num(e.distance, 1000), r5(num(e.k1)), r5(num(e.k2)), r5(num(e.k3))]);
        }
        if(set.d.length || set.t.length || set.v.length) sets.push(set);
      }
      if(!sets.length) continue;
      lenses.push({ m: maker, n: model, t: kids(l, "mount").map(x => x.text.trim()), c: crop, s: sets });
    }
  }
  return { mounts, cameras, lenses };
}

if(process.argv[1] === fileURLToPath(import.meta.url)){
  const dir = process.argv[2], texts = [];
  for(const f of FILES){
    try{
      if(dir){ const p = path.join(dir, f + ".xml"); if(fs.existsSync(p)) texts.push(fs.readFileSync(p, "utf8")); }
      else{ const r = await fetch(BASE + f + ".xml"); if(r.ok) texts.push(await r.text()); }
    }catch{}
  }
  const db = compact(texts);
  const out = path.join(ROOT, "assets/lensdb/lensfun.json");
  fs.writeFileSync(out, JSON.stringify(db));
  console.log(`${texts.length} archivos · ${db.cameras.length} cámaras · ${db.lenses.length} objetivos · ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}
