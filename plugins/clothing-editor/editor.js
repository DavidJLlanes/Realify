/* ═══════════════════════════════════════════════════════════════
   EDITOR DE ROPA · FLUJO
   Imagen visible → análisis de personas (partes: camiseta, vestido, falda, pantalón…) → editor a pantalla completa (js/ui/kit/ai-editor/) con un
   objetivo por persona y otro «Telas y fondos», donde se tocan sábanas, cortinas o manteles → vista previa en vivo (foto a ≤ 1000 px, luz
   lineal) → al aplicar se calcula a la resolución de trabajo y todo va a UNA capa nueva con alfa (sólo la tela; el resto de la foto no se toca).
   Los mandos salen de `params`; aquí no hay píxeles: los calcula render.js con el motor de js/features/clothing/.
   Entradas: { group } (grupo que se abre). Salida: promesa que se resuelve al cerrar el editor.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../js/features/ai-kit/visible-image.js";
import { analyze } from "../../js/ai/people/analyze.js";
import { createAiEditor } from "../../js/ui/kit/ai-editor/index.js";
import { toNewLayer } from "../../js/features/ai-kit/new-layer.js";
import { aiSession } from "../../js/features/ai-kit/session.js";
import { WORK } from "../../js/features/ai-kit/preview.js";
import { toast } from "../../js/core/toast.js";
import { GRUPOS, PARAMS, inicio, hayEfecto } from "./params.js";
import { prepararVista, mascaraPersona, mascaraTelas, capa } from "./render.js";

const PREVIEW_SIDE = 1000, TELAS = "telas";
const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

export async function abrirEditorRopa({ group = "planchar", telas = false } = {}){
  const src = await visibleImage(); if(!src) return;
  let personas = [];
  try{
    const res = await aiSession("Buscando la ropa con IA", () => analyze(src, { quality: "mejor", kinds: ["landmarks", "poses", "partes"] }), { unit: "persona" });
    personas = res.personas.filter(p => p.partes && p.caja);
  } catch(err){ if(!err.cancelled) toast("No se pudo analizar la foto: " + (err.message || err), "err"); else return; }

  const targets = personas.map((p, i) => ({ id: String(i), label: `Prenda ${i + 1}`, box: p.caja }));
  targets.push({ id: TELAS, label: "Telas y fondos" });
  const preview = prepararVista(src, PREVIEW_SIDE), toques = [], vista = lienzo(src.width, src.height);
  let timer = 0, version = 0, ed = null, enCurso = Promise.resolve(), sam = null, samFallo = false, pintaTela = null;

  const mascaraDe = (prep, id, v) => id === TELAS ? (toques.length ? mascaraTelas(prep, toques, src) : null) : mascaraPersona(prep, personas[+id], v.prenda || "todo");

  async function procesar(){
    const mia = ++version; ed.sh.setBusy("Calculando…");
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    try{
      const x = vista.getContext("2d"); x.clearRect(0, 0, vista.width, vista.height); x.drawImage(src, 0, 0);
      for(const t of targets){
        const v = ed.values(t.id); if(!hayEfecto(v)) continue;
        const c = capa(preview, mascaraDe(preview, t.id, v), v); if(c) x.drawImage(c, 0, 0, vista.width, vista.height);
      }
    } catch(err){ console.error(err); }
    if(mia === version){ ed.sh.setBusy(""); ed.setImage(vista, true); }
  }
  const programar = () => { clearTimeout(timer); timer = setTimeout(() => { enCurso = enCurso.then(procesar); }, 120); };

  /* Telas: un toque añade o quita una zona. Con IA, SAM propone el borde; sin ella (o si falla) crece por color. */
  async function tocar(p){
    const v = ed.values(TELAS), t = { x: p.x, y: p.y, modo: v.telaModo === "sub" ? "sub" : "add", tol: v.telaTolerancia ?? 40 };
    if(v.telaIA && !samFallo){
      ed.sh.setBusy("Buscando la tela…");
      try{
        const { samPrepare, samPredict } = await import("../../js/ai/sam.js");
        sam = sam || await samPrepare(src);
        const r = await samPredict(sam, [{ x: p.x, y: p.y, pos: true }]); if(r) t.sam = r;
      } catch(err){ samFallo = true; console.warn("SAM no disponible, se crece por color:", err); }
      ed.sh.setBusy("");
    }
    toques.push(t); pintaTela = null; ed.sh.redraw(); programar();
  }
  function marcaTela(){
    if(pintaTela || !toques.length) return pintaTela;
    const m = mascaraTelas(preview, toques, src), c = lienzo(preview.W, preview.H), x = c.getContext("2d"), d = x.createImageData(preview.W, preview.H);
    for(let i = 0; i < m.length; i++){ d.data[i * 4] = 255; d.data[i * 4 + 1] = 120; d.data[i * 4 + 2] = 40; d.data[i * 4 + 3] = Math.round(m[i] * 110); }
    x.putImageData(d, 0, 0); return (pintaTela = c);
  }

  ed = await createAiEditor({
    title: "Ropa y tejidos", subtitle: "Planchar, color y textura", groups: GRUPOS, params: PARAMS, targets,
    onChange: c => { if(c.key && ["telaElegir", "telaModo", "telaTolerancia", "telaIA"].includes(c.key)) { ed.sh.redraw(); return; } programar(); },
    onApply: async e => {
      clearTimeout(timer); await enCurso;
      const hechas = targets.filter(t => hayEfecto(e.values(t.id)) && (t.id !== TELAS || toques.length));
      if(!hechas.length){ toast(toques.length || personas.length ? "Mueve algún mando para retocar la ropa" : "Toca una tela de la foto y mueve algún mando", "err"); return; }
      e.sh.setBusy("Aplicando…");
      try{
        const salida = await aiSession("Retocando la ropa", async () => {
          const prep = prepararVista(src, WORK()), out = lienzo(src.width, src.height), x = out.getContext("2d"); x.imageSmoothingQuality = "high";
          for(const t of hechas){ const v = e.values(t.id), c = capa(prep, mascaraDe(prep, t.id, v), v); if(c) x.drawImage(c, 0, 0, out.width, out.height); }
          return out;
        }, { unit: "prenda" });
        e.close(); await toNewLayer(salida, "Ropa · retoque");
      } catch(err){ e.sh.setBusy(""); if(!err.cancelled) toast("No se pudo retocar la ropa: " + (err.message || err), "err"); }
    }
  });
  const enTelas = () => ed.target === TELAS && ed.values(TELAS).telaElegir;
  ed.sh.setOverlay((cx, t) => { if(ed.target !== TELAS) return; const m = marcaTela(); if(m){ cx.globalAlpha = 0.9; cx.drawImage(m, t.ox, t.oy, src.width * t.k, src.height * t.k); cx.globalAlpha = 1; } });
  let abajo = null;
  ed.sh.setInteract((tipo, p) => {
    if(!enTelas()) return false;
    if(tipo === "down"){ abajo = { x: p.x, y: p.y, k: p.k }; return true; }
    if(tipo === "up" && abajo && p && Math.hypot(p.x - abajo.x, p.y - abajo.y) * abajo.k < 8){ abajo = null; tocar(p); return false; }
    if(tipo === "up" || tipo === "cancel") abajo = null;
    return false;
  });
  if(globalThis.__realifyTest) globalThis.__realifyTest.ropa = { ed, personas, toques };   /* gancho para las pruebas */
  for(const t of targets) ed.setValues(t.id, inicio(group));
  ed.setImage(vista, false); ed.setOriginal(src);
  if(telas || group === "telas" || !personas.length) ed.selectTarget(TELAS);
  ed.openGroup(group);
  programar();
}
