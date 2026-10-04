/* ═══════════════════════════════════════════════════════════════
   CORRECCIÓN DE LENTE POR PERFIL (Premium 👑 · fase 9 de PENDIENTE.md)
   Menú Filtro › Corrección de lente por perfil…

   Con los datos EXIF de la foto (cámara, objetivo, distancia focal y
   diafragma) busca el objetivo en la base de Lensfun (1 500 objetivos,
   CC BY-SA 3.0, ver assets/lensdb/LICENSE.md) y corrige con sus
   calibraciones reales:
     · distorsión (barril, cojín, bigote), con zoom automático para no
       dejar bordes vacíos;
     · aberración cromática lateral (rojo y azul respecto al verde);
     · viñeteo, en luz lineal y con tramado.
   Todo a resolución completa en un único remuestreo bicúbico (Catmull-
   Rom). Se puede cambiar el objetivo a mano. El resultado va a una capa
   nueva. La base se descarga la primera vez (1,7 MB) y queda en caché.
   Las fórmulas están en js/lens/lensmath.js (comprobadas contra Lensfun
   a menos de 1 px).
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../ui/dialog.js";
import { toast, progress, status } from "../ui/toast.js";
import { doc } from "../core/doc.js";

let dbPromise = null;
const loadDb = () => dbPromise ||= fetch(new URL("../../assets/lensdb/lensfun.json", import.meta.url)).then(r => { if(!r.ok) throw new Error("No se pudo descargar la base de objetivos"); return r.json(); }).catch(e => { dbPromise = null; throw e; });
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export async function openLensProfile(){
  if(!doc.open){ toast("Abre una imagen primero"); return; }
  status("Cargando la base de objetivos…");
  let db; try{ db = await loadDb(); }catch(e){ status(""); toast(e.message, "err"); return; } status("");
  const M = await import("../lens/lensmath.js"), { readLensExif } = await import("../lens/exifread.js");
  let exif = null; if(doc.source?.file) exif = await readLensExif(doc.source.file);
  const id = doc.source?.exif || {};
  const info = { make: exif?.make || id.make || "", model: exif?.model || id.model || "", lens: exif?.lens || id.lens || "", focal: exif?.focal || 0, focal35: exif?.focal35 || 0, fNumber: exif?.fNumber || 0, distance: exif?.distance || 0 };
  const { camera, candidates } = M.matchLenses(db, info);
  const label = l => l.n.toLowerCase().startsWith(l.m.toLowerCase().split(" ")[0]) ? l.n : `${l.m} ${l.n}`;
  /* La base repite objetivos (una entrada por cada calibración): se usa la más completa de cada nombre */
  const richness = l => l.s.reduce((a, s) => a + (s.d.length ? 1 : 0) + (s.t.length ? 1 : 0) + (s.v.length ? 1 : 0), 0);
  const byLabel = new Map();
  for(const l of db.lenses){ const k = label(l), cur = byLabel.get(k); if(!cur || richness(l) > richness(cur)) byLabel.set(k, l); }
  const best = candidates[0] ? byLabel.get(label(candidates[0].lens)) : null;
  const S = { lens: best, focal: info.focal || (best ? Math.round(((best.s[0].d[0] || [24])[0] + (best.s[0].d.at(-1) || [24])[0]) / 2) : 35), aperture: info.fNumber || 4, distance: info.distance || 1000,
    crop: camera?.crop || (info.focal && info.focal35 ? info.focal35 / info.focal : best?.c || 1), dist: true, tca: true, vig: true, scale: true };

  const cam = info.model && info.make && info.model.toLowerCase().startsWith(info.make.toLowerCase().split(" ")[0]) ? info.model : [info.make, info.model].filter(Boolean).join(" ");
  const found = cam + (info.lens ? ` · ${info.lens}` : "") + (info.focal ? ` · ${+info.focal.toFixed(1)} mm` : "") + (info.fNumber ? ` f/${+info.fNumber.toFixed(1)}` : "");
  let bodyEl = null;
  const profile = () => S.lens ? M.buildProfile(S.lens, { crop: S.crop, focal: S.focal, aperture: S.aperture, distance: S.distance }) : null;
  const refresh = () => {
    if(!bodyEl) return;
    const p = profile(), ok = bodyEl.closest(".modal")?.querySelector(".modal-foot button.primary");
    bodyEl.querySelector(".lp-state").textContent = !S.lens ? "Elige un objetivo de la lista." : !p || (!p.dist && !p.tca && !p.vig) ? "Este objetivo no tiene perfil para ese recorte de sensor." : `Perfil: ${[p.dist && "distorsión", p.tca && "aberración cromática", p.vig && "viñeteo"].filter(Boolean).join(", ")}.`;
    if(ok) ok.disabled = !p || (!p.dist && !p.tca && !p.vig);
    for(const k of ["dist", "tca", "vig"]){ const el = bodyEl.querySelector(`[data-k="${k}"]`); el.disabled = !p || !p[k]; if(el.disabled) el.checked = false; else if(!el.dataset.touched) el.checked = S[k]; }
  };
  const go = await dialog({
    title: "Corrección de lente · Premium 👑", cls: "dlg-lensprofile",
    body: `<p class="hint" style="margin:0 0 8px">${found ? esc(found) : "La foto no trae datos de cámara: elige el objetivo."}</p>
      <div class="field"><label>Objetivo</label><input type="text" class="grow" data-k="lens" list="lp-lenses" value="${esc(best ? label(best) : "")}" placeholder="Busca por marca o modelo…" autocomplete="off"></div>
      <datalist id="lp-lenses">${[...byLabel.keys()].map(k => `<option value="${esc(k)}">`).join("")}</datalist>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 4px">
        <div class="field" style="display:grid;gap:2px;margin:0"><label>Focal (mm)</label><input type="number" data-k="focal" min="1" max="2000" step="0.1" value="${S.focal}"></div>
        <div class="field" style="display:grid;gap:2px;margin:0"><label>Diafragma f/</label><input type="number" data-k="aperture" min="0.7" max="64" step="0.1" value="${+S.aperture.toFixed(1)}"></div>
      </div>
      <div class="field" ${camera || (info.focal && info.focal35) ? "hidden" : ""}><label>Recorte</label><input type="number" class="grow" data-k="crop" min="0.5" max="8" step="0.01" value="${+S.crop.toFixed(2)}"></div>
      <p class="hint lp-state" style="margin:6px 0"></p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px">
        <label class="chk" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="dist" checked> Distorsión</label>
        <label class="chk" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="vig" checked> Viñeteo</label>
        <label class="chk" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="tca" checked> Aberración</label>
        <label class="chk" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="scale" checked> Sin bordes vacíos</label>
      </div>`,
    buttons: [{ label: "Cancelar", value: null }, { label: "Aplicar", primary: true, value: "go" }],
    onOpen(body){
      bodyEl = body;
      body.addEventListener("input", e => {
        const k = e.target.dataset.k; if(!k) return;
        if(k === "lens"){ const v = e.target.value; const l = byLabel.get(v) || null; if(l){ S.lens = l; const fs = l.s.flatMap(s => s.d.map(d => d[0])); if(fs.length && !info.focal) S.focal = fs[0]; } else S.lens = null; }
        else if(e.target.type === "checkbox"){ S[k] = e.target.checked; e.target.dataset.touched = "1"; }
        else S[k] = +e.target.value || S[k];
        refresh();
      });
      body.querySelector('[data-k="lens"]').blur();
      refresh();
    }
  });
  if(go !== "go" || !S.lens) return;
  await run(M, S, profile(), label(S.lens));
}

async function run(M, S, prof, name){
  status("Corrigiendo la lente…"); progress(0.03);
  await new Promise(r => setTimeout(r, 30));
  try{
    const { flatten } = await import("../editor/layertree.js"), f = flatten(), W = f.width, H = f.height;
    const src = f.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const C = M.makeCorrector(prof, { crop: S.crop, W, H, distortion: S.dist, tca: S.tca, vignette: S.vig, autoScale: S.scale });
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const ox = out.getContext("2d"), rows = Math.max(16, Math.floor(1.2e6 / W));
    for(let y0 = 0; y0 < H; y0 += rows){
      const y1 = Math.min(H, y0 + rows), strip = new Uint8ClampedArray(W * (y1 - y0) * 4);
      M.correctRows(src, W, H, C, y0, y1, strip);
      ox.putImageData(new ImageData(strip, W, y1 - y0), 0, y0);
      progress(0.05 + 0.9 * y1 / H); await new Promise(r => setTimeout(r, 0));
    }
    const { resultToLayer } = await import("../ui/fsshell.js");
    await resultToLayer(out, { name: `Lente · ${name}`.slice(0, 40) });
    progress(null);
    toast(`Lente corregida con el perfil de ${name}` + (C.hasDist && C.scale < 0.999 ? ` (zoom ${((1 / C.scale - 1) * 100).toFixed(1)} %)` : ""), "ok");
  }catch(err){ console.error(err); progress(null); toast("No se pudo corregir: " + (err.message || err), "err"); }
  finally{ status(""); }
}
