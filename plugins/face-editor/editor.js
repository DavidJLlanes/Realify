/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CARA · FLUJO
   Imagen visible → análisis de caras (478 puntos + piel) → editor a pantalla completa (js/ui/kit/ai-editor/) con un objetivo por cara y
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
import { GRUPOS, PARAMS, inicio, hayEfecto } from "./params.js";
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
  const targets = personas.map((p, i) => ({ id: String(i), label: `Cara ${i + 1}`, box: ampliar(p.cara.caja, 0.35), profile: null }));

  function pintar(id){
    let prep = preps.get(id);
    if(!prep){ prep = prepararCara(src, personas[+id], PREVIEW_SIDE); preps.set(id, prep); }
    const c = prep.crop;
    vista.getContext("2d").drawImage(src, c.x, c.y, c.w, c.h, c.x, c.y, c.w, c.h);          // vuelve a la foto original antes de pintar
    if(hayEfecto(ed.values(id))) componer(vista, prep, renderCara(prep, ed.values(id)));
  }
  function programar(id){
    pendiente.add(id); clearTimeout(timer);
    timer = setTimeout(() => {
      const mia = ++version; ed.sh.setBusy("Calculando…");
      requestAnimationFrame(() => setTimeout(() => {
        for(const t of [...pendiente]) pintar(t);
        pendiente.clear();
        if(mia === version){ ed.sh.setBusy(""); ed.setImage(vista, true); if(!enfocada){ enfocada = true; ed.focus(0.2); } }
      }, 0));
    }, 90);
  }

  ed = await createAiEditor({
    title: "Piel", subtitle: "Arrugas, ojeras, brillos, textura y tono", groups: GRUPOS, params: PARAMS, targets,
    onChange: c => programar(c.target),
    onApply: async e => {
      const hechas = targets.filter(t => hayEfecto(e.values(t.id)));
      if(!hechas.length){ toast("Sube algún mando para retocar la piel", "err"); return; }
      e.sh.setBusy("Aplicando…");
      try{
        const salida = await aiSession("Retocando la piel", async () => {
          const out = copia(src);
          for(const t of hechas){ const prep = prepararCara(src, personas[+t.id], WORK()); componer(out, prep, renderCara(prep, e.values(t.id))); }
          return out;
        }, { unit: "cara" });
        e.close(); await toNewLayer(salida, "Piel · retoque");
      } catch(err){ e.sh.setBusy(""); if(!err.cancelled) toast("No se pudo retocar la piel: " + (err.message || err), "err"); }
    }
  });
  ed.setImage(vista, false); ed.setOriginal(src);
  for(const t of targets) ed.setValues(t.id, inicio(group));
  ed.openGroup(group);
  for(const t of targets) programar(t.id);
}
