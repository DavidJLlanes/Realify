/* ═══════════════════════════════════════════════════════════════
   ARMAZÓN COMÚN DE LOS EDITORES DE IA A PANTALLA COMPLETA
   Los editores de cara, cuerpo, ropa… (plugins/*-editor) NO reescriben la ventana: se montan aquí, sobre fsshell.js (el
   mismo armazón que el collage: barra superior, deshacer y rehacer, zoom con rueda, pellizco y doble clic, panel lateral en
   escritorio y un mando cada vez en móvil). Este archivo añade sólo lo que comparten los editores de IA:
     · objetivos (varias caras, varias personas, una prenda) con selector y zoom automático al elegir uno;
     · grupos de mandos (chips en escritorio, desplegable «Grupo» en móvil) sacados del `params` de las funciones;
     · valores por objetivo, con su perfil (adulto, infantil…) y su deshacer;
     · marca Premium 👑 en el título (las funciones nuevas de IA son sólo Premium: sin interruptor).
   Entradas: título, grupos [{id, label}], params (ver params-panel.js), objetivos [{id, label, box, profile}], profiles [{id, label}] (opcional:
   selector de perfil del objetivo; al cambiarlo se recortan los valores al rango del perfil y desaparecen los mandos que no tiene), onChange, onApply.
   Salida: el editor { sh, setImage, setOriginal, selectTarget, openGroup, values, setValues, focus, close }.
   Límites: no calcula píxeles ni conoce ninguna función; quien lo usa decide qué hacer en onChange y onApply.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, ensureShellStyles, mountControls, stateHistory } from "../fsshell.js";
import { defaultsOf, toSections, validate } from "../params-panel.js";
import { escAttr as esc } from "../../../core/util/html.js";

export async function createAiEditor({ title, subtitle = "", cls = "", groups, params, targets = [], profiles = null, onChange = () => {}, onApply, onCancel,
                                      applyLabel = "Aplicar", premium = true }){
  await ensureShellStyles();
  let hist = null;
  const state = { target: targets[0]?.id ?? "", values: {} };
  const byId = id => targets.find(t => t.id === id) || null;
  const profileOf = id => byId(id)?.profile ?? null;
  const ensureValues = id => (state.values[id] ||= defaultsOf(params, profileOf(id)));
  ensureValues(state.target);

  const sh = createShell({ title: premium ? `${title} 👑` : title, subtitle, applyLabel, cls: "ai-editor" + (cls ? " " + cls : ""),
    onApply: () => onApply?.(editor), onCancel: () => (onCancel ? onCancel(editor) : editor.close()),
    onUndo: () => hist?.undo(), onRedo: () => hist?.redo() });

  const sections = toSections(params, groups, profileOf(state.target));
  const get = key => ensureValues(state.target)[key];
  const set = (key, v, final) => {
    ensureValues(state.target)[key] = v;
    onChange({ target: state.target, values: state.values[state.target], key, final });
    if(final) hist.commit();
  };

  /* Selector de objetivos: botones en el panel izquierdo (escritorio) y una fila encima del mando (móvil) */
  function targetRow(){
    const row = document.createElement("div");
    row.className = "fsp-field";
    const seg = (items, on, attr) => `<div class="fsp-seg">${items.map(t => `<button type="button" data-${attr}="${esc(t.id)}" class="${t.id === on ? "on" : ""}">${esc(t.label)}</button>`).join("")}</div>`;
    row.innerHTML = (targets.length > 1 ? seg(targets, state.target, "id") : "") + (profiles ? seg(profiles, profileOf(state.target), "perfil") : "");
    row.querySelectorAll("button[data-id]").forEach(b => b.addEventListener("click", () => editor.selectTarget(b.dataset.id)));
    row.querySelectorAll("button[data-perfil]").forEach(b => b.addEventListener("click", () => editor.setProfile(state.target, b.dataset.perfil)));
    return row;
  }
  const controls = mountControls(sh, { sections, get, set, mobileExtra: targets.length > 1 || profiles ? targetRow : null });
  const drawTargets = () => { sh.left.innerHTML = ""; if(targets.length > 1 || profiles) sh.left.appendChild(targetRow()); };
  drawTargets();

  hist = stateHistory(state, () => { drawTargets(); rebuild(); onChange({ target: state.target, values: state.values[state.target], key: null, final: true }); }, sh);

  function rebuild(){
    sections.length = 0;
    sections.push(...toSections(params, groups, profileOf(state.target)));
    ensureValues(state.target);
    controls.refresh();
  }

  const editor = {
    sh,
    setImage: (canvas, keep = true) => sh.setView(canvas, keep),
    setOriginal: canvas => sh.setOriginal(canvas),
    /** Encuadra el objetivo actual (zoom a su caja). */
    focus(margin){ const b = byId(state.target)?.box; if(b) sh.focusBox(b, margin); },
    selectTarget(id){
      if(!byId(id) || id === state.target) return;
      state.target = id; drawTargets(); rebuild(); editor.focus();
      onChange({ target: id, values: state.values[id], key: null, final: false });
    },
    /** Cambia el perfil de un objetivo: los valores se validan contra el perfil nuevo (se pierden los mandos que ya no existen). */
    setProfile(id, perfil){
      const t = byId(id); if(!t || t.profile === perfil) return;
      t.profile = perfil;
      const { values } = validate(params, ensureValues(id), perfil);
      state.values[id] = { ...defaultsOf(params, perfil), ...values };
      drawTargets(); rebuild(); onChange({ target: id, values: state.values[id], key: null, final: true });
    },
    /** Abre un grupo concreto (los accesos directos del menú: «Ojos», «Postura»…). */
    openGroup(id){ controls.select(id); },
    get target(){ return state.target; },
    values: id => ({ ...ensureValues(id ?? state.target) }),
    setValues(id, v){ Object.assign(ensureValues(id), v); controls.refresh(); },
    close: () => sh.close()
  };
  return editor;
}
