/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CARA · FLUJO
   Imagen visible → análisis de caras (478 puntos + partes: piel, pelo, gafas) → editor a pantalla completa (js/ui/kit/ai-editor/) con un objetivo por cara y
   zoom a la elegida → vista previa en vivo (recorte de la cara a ≤ 1000 px, en luz lineal) → al aplicar, cada cara con cambios se calcula
   a la resolución de trabajo y el resultado va a una capa nueva con «mezcla». Los mandos salen de `params` (params.js); aquí no hay píxeles:
   los calcula render.js con los motores de js/features/portrait/.
   Entradas: { group } (grupo que se abre). Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../js/features/ai-kit/visible-image.js";
import { analizarCaras } from "../../js/features/portrait/shared/analysis.js";
import { createAiEditor } from "../../js/ui/kit/ai-editor/index.js";
import { toNewLayer } from "../../js/features/ai-kit/new-layer.js";
import { aiSession } from "../../js/features/ai-kit/session.js";
import { WORK } from "../../js/features/ai-kit/preview.js";
import { toast } from "../../js/core/toast.js";
import { profundidadRecorte } from "../../js/features/relight/depth-crop.js";
import { GRUPOS, PARAMS, PERFILES, inicio, hayEfecto, pideProfundidad } from "./params.js";
import { prepararCara, renderCara, componer } from "./render.js";

const PREVIEW_SIDE = 1000;
const copia = c => { const r = document.createElement("canvas"); r.width = c.width; r.height = c.height; r.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0); return r; };
const ampliar = (b, m) => ({ x: b.x - b.w * m, y: b.y - b.h * m, w: b.w * (1 + 2 * m), h: b.h * (1 + 2 * m) });

export async function abrirEditorCara({ group = "arrugas" } = {}){
  const src = await visibleImage(); if(!src) return;
  let res;
  try{ res = await analizarCaras(src); }
  catch(err){ if(!err.cancelled) toast("No se pudo analizar la foto: " + (err.message || err), "err"); return; }
  const personas = res.personas;
  if(!personas.length){ toast("No he encontrado ninguna cara en la foto", "err"); return; }

  const vista = copia(src), preps = new Map(), pendiente = new Set();
  let timer = 0, version = 0, ed = null, enfocada = false;
  const targets = personas.map((p, i) => ({ id: String(i), label: `Cara ${i + 1}`, box: ampliar(p.cara.caja, 0.35), profile: "mujer" }));      // el perfil sólo cambia el rango de «Forma» (el infantil lo tiene reducido)

  /* La luz necesita el mapa de profundidad de la foto (Depth Anything V2 Small): se calcula una vez, sólo si se pide. Sin él (error) la luz usa el elipsoide. */
  let mapaProf = null, profFallo = false, enCurso = Promise.resolve();
  async function conProfundidad(prep, valores){
    if(!pideProfundidad(valores) || prep.profundidad || profFallo) return;
    try{
      mapaProf = mapaProf || import("../../js/ai/depth.js").then(m => m.depthMap(src));        // una sola vez aunque se pida a la vez (vista previa y aplicar)
      const mapa = await mapaProf;
      prep.profundidad = profundidadRecorte(mapa, src.width, src.height, prep.crop); prep.cache.normales = null;
    } catch(err){ profFallo = true; mapaProf = null; if(!err.cancelled) toast("No se pudo calcular la profundidad; la luz usa sólo la forma de la cara", "err"); }
  }

  async function pintar(id){
    let prep = preps.get(id);
    if(!prep){ prep = prepararCara(src, personas[+id], PREVIEW_SIDE); preps.set(id, prep); }
    await conProfundidad(prep, ed.values(id));
    const c = prep.crop;
    vista.getContext("2d").drawImage(src, c.x, c.y, c.w, c.h, c.x, c.y, c.w, c.h);          // vuelve a la foto original antes de pintar
    if(hayEfecto(ed.values(id))) componer(vista, prep, renderCara(prep, ed.values(id)));
  }
  function programar(id){
    pendiente.add(id); clearTimeout(timer);
    timer = setTimeout(() => { enCurso = enCurso.then(procesar); }, 90);
  }
  async function procesar(){
    const mia = ++version; ed.sh.setBusy("Calculando…");
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    try{ for(const t of [...pendiente]){ pendiente.delete(t); await pintar(t); } } catch(err){ console.error(err); }
    if(mia === version){ ed.sh.setBusy(""); ed.setImage(vista, true); if(!enfocada){ enfocada = true; ed.focus(0.2); } }
  }

  ed = await createAiEditor({
    title: "Cara", subtitle: "Piel, luz, ojos, boca, pelo y gafas", groups: GRUPOS, params: PARAMS, targets, profiles: PERFILES,
    onChange: c => programar(c.target),
    onApply: async e => {
      clearTimeout(timer); await enCurso;                                  // si la vista previa está calculando (p. ej. la profundidad), se espera
      const hechas = targets.filter(t => hayEfecto(e.values(t.id)));
      if(!hechas.length){ toast("Sube algún mando para retocar la cara", "err"); return; }
      e.sh.setBusy("Aplicando…");
      try{
        const preps2 = hechas.map(t => prepararCara(src, personas[+t.id], WORK()));
        for(let i = 0; i < hechas.length; i++) await conProfundidad(preps2[i], e.values(hechas[i].id));      // fuera de la sesión: la profundidad abre la suya
        const salida = await aiSession("Retocando la cara", async () => {
          const out = copia(src);
          hechas.forEach((t, i) => componer(out, preps2[i], renderCara(preps2[i], e.values(t.id))));
          return out;
        }, { unit: "cara" });
        e.close(); await toNewLayer(salida, "Cara · retoque");
      } catch(err){ e.sh.setBusy(""); if(!err.cancelled) toast("No se pudo retocar la cara: " + (err.message || err), "err"); }
    }
  });
  ed.setImage(vista, false); ed.setOriginal(src);
  for(const t of targets) ed.setValues(t.id, inicio(group));
  ed.openGroup(group);
  for(const t of targets) programar(t.id);
}
