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

/** Lo que hace falta para corregir con perfil: base de Lensfun, EXIF de la foto (archivo original o EXIF guardado), objetivo más probable y ajustes iniciales. */
async function gather(source){
  const db = await loadDb();
  const M = await import("../lens/lensmath.js"), { readLensExif } = await import("../lens/exifread.js"), UP = await import("../lens/userprofiles.js");
  let exif = null; if(source?.file) exif = await readLensExif(source.file);
  const id = source?.exif || {};
  const info = { make: exif?.make || id.make || "", model: exif?.model || id.model || "", lens: exif?.lens || id.lens || "", focal: exif?.focal || 0, focal35: exif?.focal35 || 0, fNumber: exif?.fNumber || 0, distance: exif?.distance || 0 };
  const { camera, candidates } = M.matchLenses(db, info);
  const label = l => l.n.toLowerCase().startsWith(l.m.toLowerCase().split(" ")[0]) ? l.n : `${l.m} ${l.n}`;
  /* La base repite objetivos (una entrada por cada calibración): se usa la más completa de cada nombre */
  const richness = l => l.s.reduce((a, s) => a + (s.d.length ? 1 : 0) + (s.t.length ? 1 : 0) + (s.v.length ? 1 : 0), 0);
  const byLabel = new Map();
  for(const l of db.lenses){ const k = label(l), cur = byLabel.get(k); if(!cur || richness(l) > richness(cur)) byLabel.set(k, l); }
  const best = candidates[0] ? byLabel.get(label(candidates[0].lens)) : null;
  const S = { lens: best, focal: info.focal || (best ? Math.round(((best.s[0].d[0] || [24])[0] + (best.s[0].d.at(-1) || [24])[0]) / 2) : 35), aperture: info.fNumber || 4, distance: info.distance || 1000,
    userProfile: UP.findFor(info), keep: 100, score: candidates[0]?.score ?? 0,
    crop: camera?.crop || (info.focal && info.focal35 ? info.focal35 / info.focal : best?.c || 1), dist: true, tca: true, vig: true, scale: true };
  return { db, M, UP, info, camera, candidates, byLabel, label, best, S };
}

/** Corrección automática, sin diálogo (también para «Acciones» y el lote): perfil propio de la cámara o, si no, el objetivo de Lensfun que dice el EXIF.
    Devuelve true si corrigió; si no hay perfil, avisa y no toca la imagen. */
export async function applyLensAuto(){
  if(!doc.open){ toast("Abre una imagen primero"); return false; }
  let G; try{ G = await gather(doc.source); }catch(e){ toast(e.message, "err"); return false; }
  const { M, UP, S, label } = G;
  let prof = null, name = "";
  if(S.userProfile){ prof = UP.toProfile(S.userProfile); name = S.userProfile.name; }
  else if(S.lens && S.score >= 0.5){ prof = M.buildProfile(S.lens, { crop: S.crop, focal: S.focal, aperture: S.aperture, distance: S.distance }); name = label(S.lens); }
  if(!prof || (!prof.dist && !prof.tca && !prof.vig)){ toast("No hay perfil de lente para esta foto: usa Corrección de lente por perfil para elegirlo o crear uno propio", "err"); return false; }
  await run(M, S, prof, name);
  return true;
}

export async function openLensProfile(){
  if(!doc.open){ toast("Abre una imagen primero"); return; }
  status("Cargando la base de objetivos…");
  let G; try{ G = await gather(doc.source); }catch(e){ status(""); toast(e.message, "err"); return; } status("");
  const { db, M, UP, info, camera, byLabel, label, best, S } = G;

  const cam = info.model && info.make && info.model.toLowerCase().startsWith(info.make.toLowerCase().split(" ")[0]) ? info.model : [info.make, info.model].filter(Boolean).join(" ");
  const found = cam + (info.lens ? ` · ${info.lens}` : "") + (info.focal ? ` · ${+info.focal.toFixed(1)} mm` : "") + (info.fNumber ? ` f/${+info.fNumber.toFixed(1)}` : "");
  let bodyEl = null;
  // Perfil propio (móviles y cámaras sin objetivo en Lensfun): el de esta cámara si ya hay uno guardado
  S.userProfile = UP.findFor(info);
  const profile = () => S.userProfile ? UP.toProfile(S.userProfile) : S.lens ? M.buildProfile(S.lens, { crop: S.crop, focal: S.focal, aperture: S.aperture, distance: S.distance }) : null;
  const refresh = () => {
    if(!bodyEl) return;
    const p = profile(), ok = bodyEl.closest(".modal")?.querySelector(".modal-foot button.primary");
    bodyEl.querySelector(".lp-state").textContent = S.userProfile ? `Perfil propio «${S.userProfile.name}»: ${[p?.dist && "distorsión", p?.tca && "aberración cromática", p?.vig && "viñeteo"].filter(Boolean).join(", ")}.` : !S.lens ? "Elige un objetivo de la lista o usa un perfil propio." : !p || (!p.dist && !p.tca && !p.vig) ? "Este objetivo no tiene perfil para ese recorte de sensor." : `Perfil: ${[p.dist && "distorsión", p.tca && "aberración cromática", p.vig && "viñeteo"].filter(Boolean).join(", ")}.`;
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
      <div class="field"><label>Perfil propio</label><select class="grow" data-k="uprof"></select></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px"><button type="button" data-a="uimport">Importar…</button><button type="button" data-a="usave">Nuevo / editar…</button><button type="button" data-a="uexport">Exportar</button><button type="button" data-a="udel">Quitar</button></div>
      <div class="field"><label>Foto recortada: conserva el</label><input type="number" class="grow" data-k="keep" min="10" max="100" step="1" value="100" title="Si el propio archivo ya viene recortado (recorte centrado), qué porcentaje del ancho original conserva"> <span class="hint">% del ancho</span></div>
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
        if(k === "lens"){ if(S.userProfile){ S.userProfile = null; fillUser(); } const v = e.target.value; const l = byLabel.get(v) || null; if(l){ S.lens = l; const fs = l.s.flatMap(s => s.d.map(d => d[0])); if(fs.length && !info.focal) S.focal = fs[0]; } else S.lens = null; }
        else if(e.target.type === "checkbox"){ S[k] = e.target.checked; e.target.dataset.touched = "1"; }
        else if(k === "uprof") return;
        else S[k] = +e.target.value || S[k];
        refresh();
      });
      const fillUser = () => {
        const sel = body.querySelector('[data-k="uprof"]'), all = UP.list();
        sel.innerHTML = `<option value="">Ninguno (base de Lensfun)</option>` + all.map(u => `<option value="${esc(u.name)}"${S.userProfile?.name === u.name ? " selected" : ""}>${esc(u.name)}</option>`).join("");
        if(!S.userProfile) sel.value = "";
        for(const a of ["uexport", "udel"]) body.querySelector(`[data-a="${a}"]`).disabled = !S.userProfile;
      };
      body.addEventListener("change", e => { if(e.target.dataset.k === "uprof"){ S.userProfile = UP.list().find(u => u.name === e.target.value) || null; fillUser(); refresh(); } });
      body.addEventListener("click", async e => {
        const a = e.target.closest("[data-a]")?.dataset.a; if(!a) return;
        try{
          if(a === "uimport"){
            const { pickFiles } = await import("../ui/fsshell.js"), f = (await pickFiles({ multiple: false, accept: ".json,application/json", gallery: false }))[0];
            if(f){ const got = UP.importJson(await f.text()); S.userProfile = got[0] || null; toast(`${got.length} ${got.length === 1 ? "perfil importado" : "perfiles importados"}`, "ok"); }
          } else if(a === "usave"){
            const p = await editUserProfile(S.userProfile, { make: info.make, model: info.model });
            if(p){ S.userProfile = UP.put(p); toast("Perfil guardado: se aplicará solo a las fotos de esta cámara", "ok"); }
          } else if(a === "uexport"){
            const { download } = await import("../io/export.js");
            download(new Blob([UP.exportJson(S.userProfile)], { type: "application/json" }), `${S.userProfile.name.replace(/[^\w.-]+/g, "_")}.lensprofile.json`);
          } else if(a === "udel"){ UP.remove(S.userProfile.name); S.userProfile = null; }
        }catch(err){ toast(err.message || String(err), "err"); }
        fillUser(); refresh();
      });
      fillUser();
      body.querySelector('[data-k="lens"]').blur();
      refresh();
    }
  });
  if(go !== "go" || (!S.lens && !S.userProfile)) return;
  await run(M, S, profile(), S.userProfile ? S.userProfile.name : label(S.lens));
}

async function run(M, S, prof, name){
  status("Corrigiendo la lente…"); progress(0.03);
  await new Promise(r => setTimeout(r, 30));
  try{
    const { flatten } = await import("../editor/layertree.js"), f = flatten(), W = f.width, H = f.height;
    const src = f.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const C = M.makeCorrector(prof, { crop: S.crop, W, H, distortion: S.dist, tca: S.tca, vignette: S.vig, autoScale: S.scale, keep: (S.keep || 100) / 100 });
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

/** Diálogo para crear o editar un perfil propio (modelo «acm»); devuelve el perfil o null. */
async function editUserProfile(cur, { make = "", model = "" } = {}){
  const c = cur || {}, k = c.distortion?.k || [], t = c.distortion?.p || [], v = c.vignette?.v || [];
  const f = (key, label, val, step = "0.0001") => `<div class="field" style="display:grid;gap:2px;margin:0"><label>${label}</label><input type="number" data-p="${key}" step="${step}" value="${val ?? 0}"></div>`;
  let box = null;
  const go = await dialog({
    title: "Perfil de lente propio", cls: "dlg-lensprofile",
    body: `<p class="hint" style="margin:0 0 8px">Modelo «acm» (radial + tangencial de Adobe), con el radio 1 en la esquina de la foto. Distorsión: k1 &lt; 0 corrige el barril; viñeteo: v1 &lt; 0 oscurece las esquinas.</p>
      <div class="field"><label>Nombre</label><input type="text" class="grow" data-p="name" value="${esc(c.name || [make, model].filter(Boolean).join(" ") || "Mi perfil")}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="field" style="margin:0"><label>Marca de la cámara</label><input type="text" data-p="make" value="${esc(c.match?.make ?? make)}"></div><div class="field" style="margin:0"><label>Modelo de la cámara</label><input type="text" data-p="model" value="${esc(c.match?.model ?? model)}"></div></div>
      <h4 style="margin:10px 0 4px">Distorsión</h4><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${f("k1", "k1", k[0])}${f("k2", "k2", k[1])}${f("k3", "k3", k[2])}${f("p1", "p1 (tang.)", t[0])}${f("p2", "p2 (tang.)", t[1])}</div>
      <h4 style="margin:10px 0 4px">Viñeteo</h4><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${f("v1", "v1", v[0], "0.001")}${f("v2", "v2", v[1], "0.001")}${f("v3", "v3", v[2], "0.001")}</div>
      <h4 style="margin:10px 0 4px">Aberración cromática</h4><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${f("red", "Rojo (escala)", c.tca?.red ?? 1, "0.00001")}${f("blue", "Azul (escala)", c.tca?.blue ?? 1, "0.00001")}</div>`,
    buttons: [{ label: "Cancelar", value: null }, { label: "Guardar", primary: true, value: "go" }],
    onOpen(b){ box = b; }
  });
  if(go !== "go") return null;
  const g = key => box.querySelector(`[data-p="${key}"]`).value, n = key => +g(key) || 0;
  return { name: g("name"), match: { make: g("make"), model: g("model") },
    distortion: { model: "acm", k: [n("k1"), n("k2"), n("k3")], p: [n("p1"), n("p2")] }, vignette: { model: "acm", v: [n("v1"), n("v2"), n("v3")] },
    tca: { red: +g("red") || 1, blue: +g("blue") || 1 } };
}
