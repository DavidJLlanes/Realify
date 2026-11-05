/* ═══════════════════════════════════════════════════════════════
   EDITOR DE CUERPO · FLUJO
   Imagen visible → análisis de personas (pose, partes y cara) → editor a pantalla completa (js/ui/kit/ai-editor/) con un objetivo por
   persona, selector de perfil (hombre, mujer, niño, niña; si las proporciones sugieren un menor se parte del infantil) y zoom a la persona →
   vista previa en vivo sobre una copia reducida → al aplicar, cada persona con cambios se calcula a resolución completa y va a su propia capa
   (transparente donde no cambia, con «mezcla»). Los mandos salen de `params`; aquí no hay píxeles (los calcula render.js con los motores).
   Entradas: { group }. Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../js/features/ai-kit/visible-image.js";
import { createAiEditor } from "../../js/ui/kit/ai-editor/index.js";
import { toNewLayer } from "../../js/features/ai-kit/new-layer.js";
import { aiSession } from "../../js/features/ai-kit/session.js";
import { analyze } from "../../js/ai/people/analyze.js";
import { suggestProfile, sanitize } from "../../js/ai/people/profiles.js";
import { toast } from "../../js/core/toast.js";
import { GRUPOS, PARAMS, PERFILES, aplicarAjuste } from "./params.js";
import { prepararPersona, pintarVista, aplicarPersona, hayAlgo, actualizarPose } from "./render.js";
import { buscar, mover, pintar } from "./puntos.js";

const PREVIEW_SIDE = 1000;
const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

export async function abrirEditorCuerpo({ group = "silueta" } = {}){
  const src = await visibleImage(); if(!src) return;
  let res;
  try{ res = await aiSession("Buscando personas con IA", () => analyze(src, { quality: "mejor", kinds: ["landmarks", "poses", "manos", "partes"] }), { unit: "persona" }); }
  catch(err){ if(!err.cancelled) toast("No se pudo analizar la foto: " + (err.message || err), "err"); return; }
  const personas = res.personas.filter(p => p.pose && p.partes);
  if(!personas.length){ toast("No he encontrado ninguna persona con el cuerpo a la vista", "err"); return; }

  const preps = personas.map(p => prepararPersona(src, p, PREVIEW_SIDE)), W = preps[0].W, H = preps[0].H;
  const base = lienzo(W, H), bx = base.getContext("2d", { willReadFrequently: true }); bx.imageSmoothingQuality = "high"; bx.drawImage(src, 0, 0, W, H);
  const vista = lienzo(src.width, src.height); vista.getContext("2d").drawImage(src, 0, 0);
  const targets = personas.map((p, i) => ({ id: String(i), label: `Persona ${i + 1}`, box: p.caja, profile: suggestProfile(p.proporciones) || "mujer" }));
  let timer = 0, version = 0, ed = null, enfocada = false, avisado = false, enCurso = Promise.resolve();

  async function procesar(){
    const mia = ++version; ed.sh.setBusy("Calculando…");
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    try{
      let l = base;
      for(let i = 0; i < targets.length; i++){
        const v = ed.values(targets[i].id); if(!hayAlgo(sanitize(targets[i].profile, v))) continue;
        const r = await pintarVista(preps[i], l, v, targets[i].profile);
        if(r.error){ toast(r.error, "err"); continue; }
        if(r.reducido && !avisado){ avisado = true; toast("He reducido el cambio para que la imagen no se deforme"); }
        l = r.lienzo;
      }
      if(mia === version){ const x = vista.getContext("2d"); x.drawImage(src, 0, 0); if(l !== base) x.drawImage(l, 0, 0, vista.width, vista.height); }
    } catch(err){ console.error(err); }
    if(mia === version){ ed.sh.setBusy(""); ed.setImage(vista, true); if(!enfocada){ enfocada = true; ed.focus(0.2); } }
  }
  const programar = () => { clearTimeout(timer); timer = setTimeout(() => { enCurso = enCurso.then(procesar); }, 120); };

  ed = await createAiEditor({
    title: "Cuerpo", subtitle: "Silueta, proporciones, postura y piel", groups: GRUPOS, params: PARAMS, targets, profiles: PERFILES,
    onChange: c => {
      const t = targets.find(x => x.id === c.target), ajuste = c.key === "ajusteAdulto" || c.key === "ajusteInfantil";
      if(ajuste && c.values[c.key]){ const v = aplicarAjuste(t.profile, c.values[c.key]); if(v) ed.setValues(c.target, { ...v, [c.key]: "" }); }
      if(c.key === "puntos") ed.sh.redraw(); else programar();
    },
    onApply: async e => {
      clearTimeout(timer); await enCurso;
      const hechas = targets.map((t, i) => ({ t, i })).filter(({ t }) => hayAlgo(sanitize(t.profile, e.values(t.id))));
      if(!hechas.length){ toast("Mueve algún mando para retocar el cuerpo", "err"); return; }
      e.sh.setBusy("Aplicando…");
      try{
        const salidas = await aiSession("Retocando el cuerpo", async () => {
          const out = [];
          for(const { t, i } of hechas) out.push({ t, r: await aplicarPersona(src, preps[i], e.values(t.id), t.profile) });
          return out;
        }, { unit: "persona" });
        e.close();
        for(const { t, r } of salidas) await toNewLayer(r.lienzo, salidas.length > 1 ? `Cuerpo · ${t.label}` : "Cuerpo · retoque");
      } catch(err){ e.sh.setBusy(""); if(!err.cancelled) toast("No se pudo retocar el cuerpo: " + (err.message || err), "err"); }
    }
  });
  /* Articulaciones arrastrables (F6.3): con el interruptor «Ver y mover las articulaciones» se dibujan y se arrastran; la vista previa se recalcula */
  let arrastro = null;
  const verPuntos = () => !!ed.values(ed.target).puntos, indice = () => targets.findIndex(t => t.id === ed.target);
  ed.sh.setOverlay((cx, t) => { if(verPuntos()) pintar(cx, t, personas[indice()], src.width, src.height, arrastro); });
  ed.sh.setInteract((tipo, p) => {
    if(!verPuntos()) return false;
    const i = indice(), pers = personas[i], t = ed.sh.transform;
    if(tipo === "down"){ const n = buscar(pers, p.x, p.y, 22 * (t.dpr || 1) / t.k, src.width, src.height); if(!n) return false; arrastro = n; mover(pers, n, p.x, p.y, src.width, src.height); actualizarPose(preps[i]); ed.sh.redraw(); return true; }
    if(tipo === "move" && arrastro){ mover(pers, arrastro, p.x, p.y, src.width, src.height); actualizarPose(preps[i]); programar(); ed.sh.redraw(); return true; }
    if(tipo === "up" || tipo === "cancel"){ arrastro = null; programar(); ed.sh.redraw(); }
    return false;
  });
  if(globalThis.__realifyTest) globalThis.__realifyTest.cuerpo = { ed, personas };   /* gancho para las pruebas */
  ed.setImage(vista, false); ed.setOriginal(src);
  ed.openGroup(group);
  programar();
}
