/* ═══════════════════════════════════════════════════════════════
   PRUEBA · js/ui/kit/ai-editor/ y simple-panel (móvil y escritorio)
   Monta un editor de ejemplo con dos objetivos (un adulto y un niño) y comprueba: grupos, mandos desde `params`, zoom
   automático al objetivo, perfil infantil sin mandos de adulto, deshacer, un mando cada vez en el móvil y el panel simple.
   Uso: node tests/ia/ai-editor.mjs
   ═══════════════════════════════════════════════════════════════ */
import { abrir, documentoDePrueba } from "./lib/navegador.mjs";

async function probar(tipo) {
  const m = await abrir(tipo);
  await documentoDePrueba(m.page, 800, 600);
  const r = await m.page.evaluate(async tipo => {
    const { createAiEditor } = await import("/js/ui/kit/ai-editor/index.js");
    const { buildSimpleBody } = await import("/js/features/ai-kit/simple-panel.js");
    const P = [
      { key: "altura", label: "Altura", type: "range", min: -10, max: 10, def: 0, group: "silueta", ranges: { nino: [-3, 3] } },
      { key: "hombros", label: "Hombros", type: "range", min: -20, max: 20, def: 0, group: "torso" },
      { key: "pecho", label: "Pecho", type: "range", min: -20, max: 20, def: 0, group: "torso", only: ["hombre"] }];
    const G = [{ id: "silueta", label: "Silueta" }, { id: "torso", label: "Torso" }];
    const cambios = [];
    const ed = await createAiEditor({ title: "Editor de prueba", groups: G, params: P,
      targets: [{ id: "a", label: "Persona 1", profile: "hombre", box: { x: 100, y: 100, w: 120, h: 160 } },
                { id: "b", label: "Persona 2", profile: "nino", box: { x: 500, y: 300, w: 80, h: 120 } }],
      onChange: c => cambios.push(c.target + ":" + c.key) });
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const x = c.getContext("2d"); x.fillStyle = "#468"; x.fillRect(0, 0, 800, 600);
    ed.setImage(c, false);
    await new Promise(r => setTimeout(r, 300));
    const zoom = () => +document.querySelector(".ai-editor .fsp-zoom").textContent.replace(/\D/g, "");
    const out = {};
    out.titulo = document.querySelector(".ai-editor .fsp-title b").textContent.includes("👑");
    const z0 = zoom();
    ed.focus(); await new Promise(r => setTimeout(r, 200));
    out.zoomAlObjetivo = zoom() > z0 * 2;
    const visibles = () => [...document.querySelectorAll(".ai-editor input[type=range]")].filter(e => e.offsetParent !== null);   // escritorio y móvil se montan a la vez; CSS esconde uno
    const sliders = () => visibles().length;
    out.mandos = tipo === "movil" ? sliders() === 1 : sliders() === 3;       // móvil: uno cada vez · escritorio: los tres del adulto
    out.grupoMovil = tipo === "movil" ? !!document.querySelector(".ai-editor .fsp-mobile select[aria-label=Grupo]") : true;
    const inp = visibles()[0];
    inp.value = 5; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    out.valor = ed.values("a").altura === 5 && cambios.some(s => s.startsWith("a:altura"));
    document.querySelector('.ai-editor [data-a="undo"]').click();
    out.deshacer = ed.values("a").altura === 0;
    ed.selectTarget("b"); await new Promise(r => setTimeout(r, 200));
    out.infantilSinPecho = !("pecho" in ed.values("b"));
    out.infantilRango = visibles()[0].max === "3";
    out.zoomOtro = zoom() > z0;
    ed.openGroup("torso");
    ed.close();
    out.cerrado = !document.querySelector(".ai-editor");
    const s = buildSimpleBody(P, { profile: "nino" });
    out.simple = s.body.querySelectorAll("input[type=range]").length === 2 && !("pecho" in s.values);
    return out;
  }, tipo);
  await m.cerrar();
  let fallos = 0;
  for (const [k, v] of Object.entries(r)) if (v !== true) { fallos++; console.log(`FALLO (${tipo}):`, k, v); }
  if (m.errs.length) { fallos++; console.log(`FALLO (${tipo}): errores de página:`, m.errs.join("; ")); }
  console.log(`ai-editor ${tipo}:`, fallos ? "FALLO" : "OK");
  return fallos;
}
const f = (await probar("escritorio")) + (await probar("movil"));
process.exit(f ? 1 : 0);
