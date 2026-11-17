/* ═══════════════════════════════════════════════════════════════
   PANEL DE CAPAS · CLICS DE CADA FILA
   Doble clic (máscara, estilos, ajuste), renombrar y el clic: ojo, insignias «fx»/«adj», máscara (Mayús, Ctrl, Alt, móvil), añadir
   máscara, recortar a la de abajo, foco en la imagen y selección múltiple (Ctrl, Mayús, modo selección).
   Entradas: wireRowClick(el, l, ctx) con ctx = { fxEntry, maskMenu, render, reveal, multi(), setMulti(ids), selectMode() }.
   Salidas: listeners sobre la fila. Límites: no construye la fila (layer-row.js); repinta con ctx.render().
   ═══════════════════════════════════════════════════════════════ */
import { emit } from "../core/bus.js";
import { doc, setActive } from "../core/doc.js";
import { record } from "../core/history.js";
import { getMaskTarget, setMaskTarget, addMask, toggleMask, maskAlphaAsSelectionMask,
         getIsolateView, setIsolateView, toggleIsolateView } from "../editor/layers/masks.js";
import { isAdjustLayer, openAdjustPanel } from "../editor/layers/adjustlayers.js";
import { hasSelection, commitSelection } from "../editor/selection/selection.js";
import { filterLiveCapable, openFilterEditor } from "../editor/layers/filterregistry.js";
import { toggleClip } from "../editor/layers/groups.js";
import { openLayerStyles } from "../editor/layers/layerstyles.js";
import { promptDlg } from "./kit/dialog.js";
import { toast } from "../core/toast.js";
import { isMobile } from "../core/device.js";

export function wireRowClick(el, l, ctx){
  const { fxEntry, maskMenu } = ctx;
  const renderLayers = ctx.render, revealProperties = ctx.reveal, setMultiSelect = ctx.setMulti;
  el.addEventListener("dblclick", e => {
    if(e.target.closest("[data-mask]")){ setActive(l.id); revealProperties(); return; }
    if(e.target.closest(".style-badge")){
      setActive(l.id);
      openLayerStyles(l);
      return;
    }
    // «fx» y «adj» ya no están aquí: abren su panel con un solo clic
    // desde el manejador de `click` (ver más abajo).
    if(isAdjustLayer(l) && !e.target.closest(".eye") && !e.target.closest("[data-open-fx]")){
      setActive(l.id); revealProperties();
    }
  });
  el.querySelector(".name")?.addEventListener("dblclick", async e => {
    e.preventDefault(); e.stopPropagation();
    setActive(l.id);
    const name = await promptDlg("Renombrar capa", "Nombre", l.name);
    if(name === null) return;
    const before = l.name, after = name.trim().slice(0, 80) || before;
    if(after === before) return;
    l.name = after;
    record("Renombrar capa", () => { l.name = before; emit("doc:structure"); }, () => { l.name = after; emit("doc:structure"); });
    emit("doc:structure");
  });
  el.addEventListener("click", e => {
    if(ctx.selectMode() && !e.target.closest("button, input, [data-mask], [data-add-mask], [data-open-fx]")){
      const selected = new Set(ctx.multi());
      selected.has(l.id) ? selected.delete(l.id) : selected.add(l.id);
      setMultiSelect(selected);
      setActive(l.id);
      renderLayers();
      return;
    }
    /* Insignia «fx» / «adj»: abre el panel del propio efecto con UN
       clic —o un toque en móvil—, que es lo que se espera de un
       botón que lleva escrito el nombre del filtro. Antes pedía
       doble clic y, encima, sólo desplazaba el panel de Propiedades
       a la vista sin abrir nada del filtro. */
    const fxBtn = e.target.closest("[data-open-fx]");
    if(fxBtn){
      e.stopPropagation();
      setActive(l.id);
      /* Móvil y escritorio piden cosas distintas aquí.

         En ESCRITORIO, los filtros con editor en vivo (Brillo y
         contraste, Niveles, Curvas…) y las capas de ajuste ya tienen
         sus mandos a la vista en el panel de Propiedades, al lado —
         ver ui/properties.js—: abrir encima un diálogo con los
         mismos deslizadores era la «ventana duplicada» que sobraba.
         Basta con llevar el foco a ese panel.

         En MÓVIL no hay «al lado»: Propiedades y Capas son la misma
         hoja, que además tapa la foto. Aquí lo útil es cerrar la
         hoja y abrir el panel del efecto, que sube como una hoja
         corta dejando la foto a la vista mientras se ajusta. Sin la
         hoja de capas delante ya no hay nada duplicado. */
      // Móvil: el editor del efecto se abre ENCIMA de Capas, sin cerrarla.
      const mob = isMobile();
      if(fxBtn.dataset.openFx === "adjust"){
        if(mob) openAdjustPanel(l); else revealProperties();
      } else if(!fxEntry || (filterLiveCapable(fxEntry.id) && !mob)){
        revealProperties();
      } else {
        openFilterEditor(l, fxEntry);
      }
      return;
    }
    if(e.target.closest(".eye")){
      const was = l.visible;
      l.visible = !was;
      record(was ? "Ocultar capa" : "Mostrar capa",
             () => { l.visible = was;  emit("doc:structure"); emit("doc:change"); },
             () => { l.visible = !was; emit("doc:structure"); emit("doc:change"); });
      emit("doc:structure"); emit("doc:change");
      return;
    }
    if(e.target.closest("[data-mask]")){
      setActive(l.id);
      if(e.shiftKey){
        // Mayús+clic: activar/desactivar sin entrar a pintarla,
        // igual que tachar la miniatura en Photoshop.
        toggleMask(l);
      } else if(e.ctrlKey || e.metaKey){
        // Ctrl/Cmd+clic: las zonas blancas de la máscara pasan a ser
        // la selección activa, tal cual el canal alfa que ya guardan.
        const alpha = maskAlphaAsSelectionMask(l.mask, doc.w, doc.h);
        commitSelection(alpha, "new");
      } else if(e.altKey){
        // Alt+clic: el lienzo enseña sólo la máscara en gris, y se
        // pinta sobre ella, hasta que se repite el gesto.
        const on = toggleIsolateView(l.id);
        toast(on ? "Máscara a la vista: pinta en negro para ocultar y en blanco para mostrar · Alt+clic de nuevo para volver" : "Vista normal");
      } else if(isMobile() && getMaskTarget() === l.id){
        // Móvil: segundo toque sobre la máscara ya elegida → su menú
        // (ver sólo la máscara, volver a la imagen, aplicar…).
        const r = e.target.closest("[data-mask]").getBoundingClientRect();
        // Tras este mismo clic (el «clic fuera» del menú lo cerraría)
        setTimeout(() => maskMenu(r.left, r.bottom), 0);
        return;
      } else {
        // Un segundo clic sobre la misma máscara vuelve a pintar la
        // capa; es el mismo gesto que alternar entre las dos
        // miniaturas en cualquier editor con capas.
        setMaskTarget(getMaskTarget() === l.id ? null : l.id);
        if(getMaskTarget() === null && getIsolateView() === l.id) setIsolateView(null);
      }
      renderLayers();
      return;
    }
    if(e.target.closest("[data-add-mask]")){
      // Máscara blanca (revela todo) o desde la selección; con Alt,
      // la variante opuesta de Photoshop —negra, u ocultar la
      // selección en vez de descubrirla—. Añadirla deja el destino
      // de pintura puesto para poder empezar a pintarla ya mismo.
      setActive(l.id);
      addMask(l, hasSelection(), e.altKey);
      setMaskTarget(l.id);
      renderLayers();
      return;
    }
    if(e.target.closest("[data-img]") && e.altKey && !isAdjustLayer(l)){
      // Alt+clic en la miniatura: «recortar a la capa de abajo», el
      // mismo gesto que Photoshop entre dos filas de capas —aquí,
      // más fácil de acertar, directamente sobre la miniatura—.
      setActive(l.id);
      const now = toggleClip(l.id);
      toast(now ? "Recortada a la capa de abajo" : "Recorte quitado");
      renderLayers();
      return;
    }
    if(e.target.closest("[data-img]") && !e.ctrlKey && !e.metaKey && !e.shiftKey){
      // Clic en la miniatura de la imagen: el foco vuelve a ella
      // aunque la máscara de esta misma capa lo tuviera puesto (y se
      // sale de la vista de sólo la máscara).
      setActive(l.id);
      setMaskTarget(null);
      if(getIsolateView() !== null) setIsolateView(null);
      renderLayers();
      return;
    }
    if(e.ctrlKey || e.metaKey){
      const s = new Set(ctx.multi());
      s.has(l.id) ? s.delete(l.id) : s.add(l.id);
      setMultiSelect(s);
      setActive(l.id);
      renderLayers();
      return;
    }
    if(e.shiftKey && ctx.multi().size){
      // Rango contiguo entre la última marcada y ésta, en el orden
      // en que aparecen en el panel (de arriba abajo).
      const ids = doc.layers.map(x => x.id).slice().reverse();
      const last = [...ctx.multi()][ctx.multi().size - 1];
      const a = ids.indexOf(last), b = ids.indexOf(l.id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setMultiSelect(ids.slice(lo, hi + 1));
      setActive(l.id);
      renderLayers();
      return;
    }
    setMultiSelect([l.id]);
    setActive(l.id);
  });
}
