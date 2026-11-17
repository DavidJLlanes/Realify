/* ═══════════════════════════════════════════════════════════════
   PANEL DE CAPAS · CONTENIDO DE CADA FILA
   El estado de una fila (foco en imagen o máscara, qué deslizador de filtro lleva), su HTML (ojo, miniaturas, insignias, deslizador
   «filtro/mezcla» y cadena de filtros) y los mandos de esos deslizadores. Lo usa renderLayers() de js/ui/panels.js por cada capa.
   Entradas: rowState(l, i) · rowHtml(l, s) · wireFxControls(el, l, s). Salidas: estado, cadena HTML y listeners sobre la fila.
   Límites: no selecciona ni repinta (eso es layer-row-click.js y panels.js).
   ═══════════════════════════════════════════════════════════════ */
import { doc, layerThumb } from "../core/doc.js";
import { getMaskTarget } from "../editor/layers/masks.js";
import { isAdjustLayer, adjustTypeName } from "../editor/layers/adjustlayers.js";
import { isFillLayer, isShapeLayer, fillKindName, SHAPE_KIND_NAME } from "../editor/layers/layercontent.js";
import { isBlendIfActive } from "../editor/layers/blendif.js";
import { filterOf, filterAmount } from "../editor/layers/filterlayer.js";
import { knownFilter } from "../editor/layers/filterregistry.js";
import { setFilterAmount, amountMode } from "../editor/layers/filteramount.js";
import { toggleFilterEntry, setFilterEntryAmount, removeFilterEntry, moveFilterEntry } from "../editor/layers/filterchain.js";
import { hasEnabledStyle } from "../editor/layers/layerstyles.js";
import { escapeHtml } from "../core/util/html.js";

/* Los `<input type=range>` dentro de una fila de capa viven bajo un
   contenedor arrastrable. En algunos navegadores el arrastre HTML de la fila
   gana al control nativo; en iOS, además, el gesto puede interpretarse como
   desplazamiento de la hoja. Controlamos el gesto directamente con Pointer
   Events: una sola ruta para ratón, lápiz y dedo, con captura hasta soltar.
   El evento `input` nativo se conserva para teclado y lectores de pantalla. */
function wireLayerRangeDrag(range, { start, preview, commit }){
  let pointerId = null;
  const setFromPointer = event => {
    const box = range.getBoundingClientRect();
    if(box.width <= 0) return;
    const min = Number(range.min || 0), max = Number(range.max || 100);
    const step = Number(range.step || 1) || 1;
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const value = Math.round((min + (max - min) * ratio) / step) * step;
    range.value = String(Math.max(min, Math.min(max, value)));
    preview(+range.value);
  };
  const finish = event => {
    if(event.pointerId !== pointerId) return;
    setFromPointer(event);
    if(range.hasPointerCapture?.(pointerId)) range.releasePointerCapture(pointerId);
    pointerId = null;
    commit();
  };
  range.addEventListener("pointerdown", event => {
    if(event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    start();
    range.focus({ preventScroll:true });
    range.setPointerCapture?.(pointerId);
    setFromPointer(event);
  });
  range.addEventListener("pointermove", event => {
    if(event.pointerId === pointerId) setFromPointer(event);
  });
  range.addEventListener("pointerup", finish);
  range.addEventListener("pointercancel", finish);
}

/** Qué lleva la fila de la capa `l` (posición `i` en doc.layers). */
export function rowState(l, i){
  const isGroup = l.type === "group";
  const maskOn = l.mask && getMaskTarget() === l.id;
  // Foco en la imagen: la capa está activa y no hay foco de pintura
  // puesto en su máscara. El equivalente a los corchetes blancos de
  // Photoshop alrededor de la miniatura que se está editando.
  const imgOn = l.id === doc.activeId && getMaskTarget() !== l.id;
  const fxEntry = filterOf(l);
  const fxChained = (l.filters?.length || 0) > 1;
  // El diálogo completo (con todos sus deslizadores propios) sólo
  // sabe recalcular su vista previa a partir de la capa de debajo,
  // así que sólo tiene sentido reabrirlo cuando la capa lleva UN
  // filtro — con más de uno encadenado, el ajuste fino se hace con
  // el interruptor y el porcentaje de cada fila (ver `.fxchain`
  // más abajo), no reabriendo ningún panel.
  const fxEditable = !!(fxEntry && knownFilter(fxEntry.id) && i > 0 && l.type !== "text" && !isAdjustLayer(l) && !isGroup && !fxChained);
  /* Efectos que no se pueden recalcular (herramientas de IA, efectos
     de Fotografía): también llevan porcentaje, como mezcla con la
     capa de debajo, siempre que sea del mismo tamaño. */
  const fxBase = fxEntry && !fxEditable && !fxChained && i > 0 ? doc.layers[i - 1] : null;
  const fxMixOnly = !!(fxBase && l.type !== "text" && !isAdjustLayer(l) && !isGroup && fxBase.canvas && l.canvas &&
    fxBase.canvas.width === l.canvas.width && fxBase.canvas.height === l.canvas.height);
  const fxSlider = fxEditable || fxMixOnly;
  const fxAmt = fxSlider ? filterAmount(l) : 100;
  const fxMode = fxMixOnly ? "mix" : fxEditable ? amountMode(l) : "scale";
  const styled = hasEnabledStyle(l.styles);
  return { isGroup, maskOn, imgOn, fxEntry, fxChained, fxEditable, fxMixOnly, fxSlider, fxAmt, fxMode, styled };
}

/** HTML interior de la fila. */
export function rowHtml(l, s){
  const { isGroup, maskOn, imgOn, fxChained, fxEditable, fxMixOnly, fxSlider, fxAmt, fxMode, styled } = s;
  const maskLabel = isGroup ? "grupo" : "capa";
  const maskHtml = l.mask
    ? `<div class="thumb mask-thumb${maskOn ? " on" : ""}${l.maskEnabled ? "" : " off"}"
        title="Máscara de ${maskLabel} — clic: pintarla (negro oculta, blanco muestra) · doble clic: propiedades · Mayús+clic: activar o desactivar · Ctrl+clic: cargar como selección · Alt+clic: ver y pintar sólo la máscara · clic derecho: más opciones"
        data-mask="1">⬚</div>`
    : `<button type="button" class="thumb add-mask" data-add-mask="1"
        title="Añadir máscara de ${maskLabel}${isGroup ? "" : " — Alt+clic: máscara negra u ocultar selección"}"
        aria-label="Añadir máscara de ${maskLabel}">+</button>`;
  return
    `<button class="eye" title="Mostrar u ocultar" aria-label="Mostrar u ocultar capa">
       ${l.visible
         ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
         : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M17 17A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5m4-2h1c7 0 11 7 11 7a18 18 0 0 1-2 3M1 1l22 22"/></svg>'}
     </button>
     ${isGroup ? `<button type="button" class="caret${l.collapsed ? "" : " open"}" data-caret="1"
            title="${l.collapsed ? "Desplegar grupo" : "Plegar grupo"}"
            aria-label="Plegar o desplegar grupo">›</button>` : ""}
     ${isGroup
        ? `<div class="thumb group-thumb${imgOn ? " on" : ""}" data-img="1" title="Grupo de capas">▤</div>`
        : isAdjustLayer(l)
        ? `<div class="thumb adjust-thumb${imgOn ? " on" : ""}" data-img="1" title="Capa de ajuste">◐</div>`
        : `<div class="thumb${imgOn ? " on" : ""}" data-img="1" style="background-image:url(${layerThumb(l)})"></div>`}
     ${maskHtml}
     <span class="grip" data-grip="1" title="Arrastrar para cambiar el orden" aria-label="Arrastrar para reordenar">⠿</span>
     <div class="meta">
       <div class="name">${escapeHtml(l.name)}</div>
       <div class="sub">${Math.round(l.opacity * 100)}%${l.filters.length ? " · " + l.filters.length + " filtro" + (l.filters.length > 1 ? "s" : "") : ""}</div>
     </div>
     ${l.type === "text" ? '<span class="fx" title="Capa de texto">T</span>' : ""}
     ${isAdjustLayer(l) ? `<button type="button" class="fx editable" data-open-fx="adjust"
         title="${escapeHtml(adjustTypeName(l.adjustType))} — abrir sus mandos">adj</button>` : ""}
     ${isFillLayer(l) ? `<span class="fx" title="Capa de relleno: ${escapeHtml(fillKindName(l.fill?.kind))}">rel</span>` : ""}
     ${isShapeLayer(l) ? `<span class="fx" title="Capa de forma: ${escapeHtml(SHAPE_KIND_NAME[l.shape?.kind] || "")}, editable con la herramienta Formas (U)">forma</span>` : ""}
     ${l.smart ? '<span class="fx smart-badge" title="Objeto inteligente: Transformación libre remuestrea siempre desde el original guardado, sin perder nitidez">obj</span>' : ""}
     ${l.dodgeBurn ? '<span class="fx" title="Capa gris de Dodge &amp; Burn — la herramienta sigue pintando aquí mientras esté activa">D&amp;B</span>' : ""}
     ${l.clipped ? '<span class="fx clip-badge" title="Recortada a la capa de abajo — Alt+clic en la miniatura para quitarlo">⌐</span>' : ""}
     ${isBlendIfActive(l.blendIf) ? '<span class="fx" title="Fusionar si activo: parte de esta capa (o de lo que tiene debajo) queda oculta por brillo, sin ninguna máscara pintada">FSi</span>' : ""}
     ${styled ? `<span class="fx style-badge editable" title="Estilos de capa activos — doble clic: editar">✦</span>` : ""}
     ${l.filters.length ? (fxEditable
         ? `<button type="button" class="fx editable" data-open-fx="filter" title="${escapeHtml(
             l.filters.map(f => f.name || f.id).join(" · "))} — abrir el panel del filtro">fx</button>`
         : `<span class="fx" title="${escapeHtml(l.filters.map(f => f.name || f.id).join(" · "))}${
             fxChained ? " — " + l.filters.length + " filtros encadenados" : ""}">fx${
             fxChained ? "·" + l.filters.length : ""}</span>`) : ""}
     ${fxSlider ? `<div class="fxrow" title="${fxMixOnly
         ? "Aplicación del efecto: mezcla el resultado con el original de la capa de debajo (100 % = el efecto entero, 0 % = el original), sin volver a calcularlo"
         : fxMode === "mix"
         ? "Aplicación del filtro: este filtro no tiene mandos de intensidad, así que el porcentaje mezcla el resultado con el original"
         : "Aplicación del filtro: vuelve a calcularlo con sus valores escalados a este porcentaje (no es la opacidad)"}">
         <span class="fxlab">${fxMode === "mix" ? "mezcla" : "filtro"}</span>
         <input type="range" class="fxamt" min="0" max="100" step="1" value="${fxAmt}" aria-label="Porcentaje de aplicación del filtro">
         <span class="mono fxval">${fxAmt}%</span>
       </div>` : ""}
     ${fxChained ? `<div class="fxchain">${l.filters.map((f, fi) => `
         <div class="fxchain-row" data-idx="${fi}">
           <input type="checkbox" class="fxc-on" ${f.enabled === false ? "" : "checked"}
             aria-label="Activar o desactivar ${escapeHtml(f.name || f.id)}">
           <span class="fxc-name" title="${escapeHtml(f.name || f.id)}">${escapeHtml(f.name || f.id)}</span>
           <input type="range" class="fxc-amt" min="0" max="100" step="1" value="${f.amount ?? 100}"
             aria-label="Porcentaje de ${escapeHtml(f.name || f.id)}">
           <span class="mono fxc-val">${f.amount ?? 100}%</span>
           <button type="button" class="fxc-up icon" title="Subir en la cadena" ${fi === 0 ? "disabled" : ""}>↑</button>
           <button type="button" class="fxc-down icon" title="Bajar en la cadena" ${fi === l.filters.length - 1 ? "disabled" : ""}>↓</button>
           <button type="button" class="fxc-remove icon" title="Quitar del encadenado">✕</button>
         </div>`).join("")}</div>` : ""}`;
}

/** Deslizador «filtro/mezcla» y filas de la cadena de filtros (si la fila los lleva). */
export function wireFxControls(el, l, s){
  const { fxSlider, fxChained, fxAmt } = s;
  if(fxSlider){
    const row = el.querySelector(".fxrow");
    const range = row.querySelector(".fxamt");
    const val = row.querySelector(".fxval");
    // Ni el clic ni el arrastre sobre el deslizador deben seleccionar
    // la fila (que la vuelve a pintar y mata el gesto a medias).
    ["pointerdown", "click", "dblclick", "mousedown", "touchstart"].forEach(ev =>
      row.addEventListener(ev, e => e.stopPropagation(), { passive: ev === "touchstart" }));
    /* Toda la fila es `draggable="true"` (para reordenar/copiar la
       capa arrastrándola) y eso compite con el arrastre NATIVO del
       propio círculo del deslizador: aunque el `dragstart` de la
       fila ya evita empezar un arrastre de capa cuando el objetivo
       es un <input> (más abajo), el navegador sigue de fondo
       evaluando si el gesto ES un arrastre de elemento durante los
       primeros píxeles de movimiento, y esa evaluación le roba
       seguimiento fino al círculo justo al empezar a mover el ratón
       —se nota como que "no responde bien" al arrastrar—. Puesto
       explícitamente en `false`, el navegador ni se plantea la duda:
       el gesto es, desde el primer píxel, el propio del <input>. */
    row.draggable = false;
    let startAmt = fxAmt, committed = null;
    const preview = amount => {
      val.textContent = amount + "%";
      setFilterAmount(l, amount, { preview: true });
    };
    const commit = () => {
      const amount = +range.value;
      if(committed === amount || (amount === filterAmount(l) && amount === startAmt)) return;
      committed = amount;
      setFilterAmount(l, amount, { preview: false });
    };
    wireLayerRangeDrag(range, {
      start: () => { startAmt = filterAmount(l); committed = null; }, preview, commit
    });
    range.addEventListener("input", () => {
      preview(+range.value);
    });
    range.addEventListener("change", commit);
    // Doble clic en el deslizador: vuelve al 100 %
    range.addEventListener("dblclick", () => { range.value = 100; val.textContent = "100%"; setFilterAmount(l, 100); });
  }

  if(fxChained){
    const chain = el.querySelector(".fxchain");
    // Igual que en `.fxrow`: nada de lo que pasa dentro de la
    // cadena debe seleccionar la fila entera ni repintar el panel a
    // medio gesto, y tampoco debe competir con el arrastre nativo
    // de sus propios deslizadores (ver el comentario de `.fxrow`).
    ["pointerdown", "click", "dblclick", "mousedown", "touchstart"].forEach(ev =>
      chain.addEventListener(ev, e => e.stopPropagation(), { passive: ev === "touchstart" }));
    chain.draggable = false;

    chain.querySelectorAll(".fxchain-row").forEach(row => {
      const idx = +row.dataset.idx;
      const onBox = row.querySelector(".fxc-on");
      const range = row.querySelector(".fxc-amt");
      const val = row.querySelector(".fxc-val");

      onBox.addEventListener("change", () => toggleFilterEntry(l, idx));

      let startAmt = +range.value, committed = null;
      const preview = amount => {
        val.textContent = amount + "%";
        setFilterEntryAmount(l, idx, amount, { preview: true });
      };
      const commit = () => {
        const amount = +range.value;
        if(committed === amount || amount === startAmt) return;
        committed = amount;
        setFilterEntryAmount(l, idx, amount, { preview: false });
      };
      wireLayerRangeDrag(range, {
        start: () => { startAmt = l.filters[idx]?.amount ?? 100; committed = null; }, preview, commit
      });
      range.addEventListener("input", () => {
        preview(+range.value);
      });
      range.addEventListener("change", commit);
      range.addEventListener("dblclick", () => {
        range.value = 100; val.textContent = "100%";
        setFilterEntryAmount(l, idx, 100);
      });

      row.querySelector(".fxc-up").addEventListener("click", () => moveFilterEntry(l, idx, -1));
      row.querySelector(".fxc-down").addEventListener("click", () => moveFilterEntry(l, idx, 1));
      row.querySelector(".fxc-remove").addEventListener("click", () => removeFilterEntry(l, idx));
    });
  }
}

/* Profundidad de anidamiento de cada capa (0 = nivel superior) y qué
   ids quedan ocultos en el panel porque alguno de sus grupos
   ancestros está plegado. Plegar no afecta al lienzo, sólo a esta
   lista: la capa sigue componiéndose con normalidad. */
export function layerDepthsAndHidden(){
  const byId = new Map(doc.layers.map(l => [l.id, l]));
  const depth = new Map();
  const depthOf = l => {
    if(depth.has(l.id)) return depth.get(l.id);
    // `byId.get` puede no encontrar nada si `groupId` apunta a una capa
    // que ya no existe: se trata como nivel superior en vez de romper.
    const parent = l.groupId != null ? byId.get(l.groupId) : null;
    const d = parent ? 1 + depthOf(parent) : 0;
    depth.set(l.id, d);
    return d;
  };
  for(const l of doc.layers) depthOf(l);
  const hidden = new Set();
  for(const l of doc.layers){
    let p = l.groupId;
    while(p != null){
      const g = byId.get(p);
      if(!g) break;
      if(g.collapsed){ hidden.add(l.id); break; }
      p = g.groupId;
    }
  }
  return { depth, hidden };
}
