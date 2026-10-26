/* ═══════════════════════════════════════════════════════════════
   BARRA DE MENÚS
   En escritorio, menús desplegables clásicos. En móvil, la barra se
   pliega en un solo botón ☰ y los menús se apilan en una única lista
   a lo ancho, porque un submenú flotante en una pantalla estrecha es
   imposible de acertar con el pulgar.
   ═══════════════════════════════════════════════════════════════ */

import { run, enabled, labelFor } from "../core/commands.js";
import { ICONS } from "./tooldrawer-icons.js";
import { keyboardHeight } from "./kit/keyboard.js";
import { MENUS } from "./menu/data.js";
export { MENUS } from "./menu/data.js";

/* Icono opcional delante del texto de una entrada: un SVG en línea,
   que hereda el color del texto. Sólo lo usan las entradas a las que
   una marca visual les añade algo; el resto siguen siendo texto. */
/* `icon`: SVG completo propio; `ic`: nombre de un icono del cajón de
   herramientas (ui/tooldrawer-icons.js), el mismo que en el móvil. */
const iconHtml = it => it.icon ? `<span class="mi" aria-hidden="true">${it.icon}</span>`
  : it.ic && ICONS[it.ic] ? `<span class="mi" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.ic]}</svg></span>` : "";

const roots = document.getElementById("menuRoots");

let openPop = null, openRoot = null;

/* Submenú («Máscara de capa», «Combinar»…): un segundo `.menu-pop`
   flotante, anclado al botón que lo abrió en vez de a la barra. Vive
   aparte de `openPop` porque un menú de escritorio sólo tiene un
   nivel de anidamiento —no hace falta una pila— y así el cierre por
   clic fuera o por Escape puede tratar «el menú» como los dos
   lienzos que son sin complicarse. */
let subPop = null, subAnchor = null;

function closeSub(){
  if(subPop){ subPop.remove(); subPop = null; }
  subAnchor = null;
}

function closeMenu(){
  closeSub();
  if(openPop){ openPop._unfollow?.(); openPop.remove(); openPop = null; }
  if(openRoot){ openRoot.classList.remove("open"); openRoot = null; }
}

/* Despliega `items` a la derecha del botón `anchor` (a la izquierda si
   no cabe). Lo usan tanto el menú de la barra como el contextual, así
   que no depende de `enabled()`/`run()` para las entradas sin `cmd`:
   cada una decide con su propio `onCmd` si es un comando registrado o
   un `onClick` suelto (ver `submenuRow`, más abajo). */
function buildSubPop(items, anchor, onCmd){
  closeSub();
  const sub = document.createElement("div");
  sub.className = "menu-pop menu-sub";
  sub.setAttribute("role", "menu");
  for(const it of items){
    if(it.sep){
      const s = document.createElement("div");
      s.className = "menu-sep";
      sub.appendChild(s);
      continue;
    }
    sub.appendChild(submenuRow(it, onCmd));
  }
  document.body.appendChild(sub);
  const r = anchor.getBoundingClientRect();
  sub.style.top = r.top + "px";
  sub.style.left = r.right + "px";
  const sr = sub.getBoundingClientRect();
  if(sr.right > innerWidth - 8) sub.style.left = Math.max(4, r.left - sr.width) + "px";
  if(sr.bottom > innerHeight - 8) sub.style.top = Math.max(4, innerHeight - sr.height - 8) + "px";
  subPop = sub;
  subAnchor = anchor;
  return sub;
}

function submenuRow(it, onCmd){
  const b = document.createElement("button");
  b.className = "menu-item";
  b.setAttribute("role", "menuitem");
  if(it.cmd){
    b.disabled = !enabled(it.cmd);
    if(it.help) b.title = it.help;
    const k = labelFor(it.cmd);
    b.innerHTML = iconHtml(it) + `<span>${it.label}</span>` + (k ? `<span class="k">${k}</span>` : "");
    b.addEventListener("click", () => onCmd(it));
  } else {
    b.disabled = !!it.disabled;
    b.innerHTML = `<span>${it.label}</span>`;
    b.addEventListener("click", () => onCmd(it));
  }
  return b;
}

/* Fila «con flecha» que abre un submenú al pasar el ratón o al tocar,
   en vez de ejecutar nada por sí misma. */
function submenuParentRow(it, onCmd){
  const b = document.createElement("button");
  b.className = "menu-item menu-item-parent";
  b.setAttribute("role", "menuitem");
  b.setAttribute("aria-haspopup", "true");
  b.innerHTML = iconHtml(it) + `<span>${it.label}</span><span class="submenu-arrow" aria-hidden="true">›</span>`;
  let hoverTimer = null;
  const open = () => { clearTimeout(hoverTimer); buildSubPop(it.submenu, b, onCmd); };
  b.addEventListener("mouseenter", () => {
    if(subAnchor === b) return;
    hoverTimer = setTimeout(open, 40);
  });
  b.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
  b.addEventListener("click", e => { e.stopPropagation(); open(); });
  return b;
}

/* Menú contextual suelto, anclado a un punto (x, y) en vez de a un
   botón de la barra: lo que hace falta para un clic derecho sobre
   algo del lienzo o de un panel. Comparte `openPop`/`closeMenu` con
   los menús de la barra, así que Escape y el clic fuera —ya
   enganchados en `initMenu()`— también lo cierran a él sin más. Cada
   entrada trae su propio `onClick`, no un `cmd` global, porque estos
   menús suelen actuar sobre "la cosa concreta bajo el clic" y no
   sobre `activeLayer()` a secas. */
export function openContextMenu(items, x, y){
  closeMenu();
  const pop = document.createElement("div");
  pop.className = "menu-pop";
  pop.setAttribute("role", "menu");

  for(const it of items){
    if(it.sep){
      const s = document.createElement("div");
      s.className = "menu-sep";
      pop.appendChild(s);
      continue;
    }
    const b = document.createElement("button");
    b.className = "menu-item";
    b.setAttribute("role", "menuitem");
    b.disabled = !!it.disabled;
    b.innerHTML = `<span>${it.label}</span>`;
    b.addEventListener("click", () => { closeMenu(); it.onClick(); });
    pop.appendChild(b);
  }

  document.body.appendChild(pop);
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  const pr = pop.getBoundingClientRect();
  if(pr.right > innerWidth - 8) pop.style.left = Math.max(4, innerWidth - pr.width - 8) + "px";
  if(pr.bottom > innerHeight - 8) pop.style.top = Math.max(4, innerHeight - pr.height - 8) + "px";
  openPop = pop;
  return pop;
}

function buildPop(menu, anchor, fullWidth){
  closeMenu();
  const pop = document.createElement("div");
  pop.className = "menu-pop";
  pop.setAttribute("role", "menu");

  const runAndClose = it => { closeMenu(); run(it.cmd); };

  for(const it of menu.items){
    if(it.sep){
      const s = document.createElement("div");
      s.className = "menu-sep";
      pop.appendChild(s);
      continue;
    }
    if(it.header){
      // Título de sección (p. ej. en «Inteligencia Artificial»)
      const h = document.createElement("div");
      h.className = "menu-head";
      h.textContent = it.header;
      pop.appendChild(h);
      continue;
    }
    if(it.submenu){
      pop.appendChild(submenuParentRow(it, runAndClose));
      continue;
    }
    const b = document.createElement("button");
    b.className = "menu-item";
    b.setAttribute("role", "menuitem");
    b.disabled = !enabled(it.cmd);
    if(it.help){ b.title = it.help; b.dataset.help = it.help; }
    const k = labelFor(it.cmd);
    b.innerHTML = iconHtml(it) + `<span>${it.label}</span>` + (k ? `<span class="k">${k}</span>` : "");
    b.addEventListener("click", () => runAndClose(it));
    pop.appendChild(b);
  }

  // Pasar el ratón a otra fila del mismo nivel cierra el submenú que
  // hubiera abierto una anterior — el mismo comportamiento de
  // cualquier barra de menús de escritorio.
  pop.addEventListener("mouseover", e => {
    const row = e.target.closest(".menu-item");
    if(row && row !== subAnchor && !row.classList.contains("menu-item-parent")) closeSub();
  });

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  if(fullWidth){
    pop.style.top = r.bottom + 2 + "px";
  } else {
    pop.style.left = r.left + "px";
    pop.style.top  = r.bottom + "px";
    // Que no se salga por la derecha
    const pr = pop.getBoundingClientRect();
    if(pr.right > innerWidth - 8) pop.style.left = (innerWidth - pr.width - 8) + "px";
  }
  openPop = pop;
  return pop;
}

export function initMenu(){
  roots.innerHTML = "";
  MENUS.forEach(m => {
    const b = document.createElement("button");
    b.className = "menu-root";
    b.textContent = m.label;
    b.addEventListener("click", e => {
      e.stopPropagation();
      if(openRoot === b){ closeMenu(); return; }
      buildPop(m, b, false);
      b.classList.add("open");
      openRoot = b;
    });
    // Al tener uno abierto, pasar por encima de otro lo cambia, como
    // en cualquier barra de menús de escritorio.
    b.addEventListener("mouseenter", () => {
      if(openRoot && openRoot !== b){
        buildPop(m, b, false);
        b.classList.add("open");
        openRoot = b;
      }
    });
    roots.appendChild(b);
  });

  // Menú único para móvil
  const mBtn = document.getElementById("mMenu");
  mBtn.addEventListener("click", e => { e.stopPropagation(); openMobileMenu(mBtn); });

  document.addEventListener("click", e => {
    if(subPop && subPop.contains(e.target)) return;
    if(openPop && !openPop.contains(e.target)) closeMenu();
  });
  addEventListener("keydown", e => { if(e.key === "Escape") closeMenu(); });
  // Sólo un cambio de ANCHO cierra el menú (girar el móvil, cambiar de
  // ventana): el teclado en pantalla, al aparecer, sólo cambia el
  // alto —y en algunos Android eso también dispara `resize`—, y no
  // hay motivo para cerrar un menú que se sigue viendo perfectamente.
  let lastW = innerWidth;
  addEventListener("resize", () => {
    if(innerWidth === lastW) return;
    lastW = innerWidth;
    closeMenu();
  });
}

/* Menú único de móvil: los 9 menús de escritorio aplanados en una
   lista de 100+ ítems son imposibles de recorrer con el pulgar sin
   un buscador. El campo filtra por texto (insensible a mayúsculas y
   acentos) y cada `header` de sección sólo se queda si le sobrevive
   algún ítem debajo — así un término concreto ("recortar") no deja
   el título suelto de "Imagen" sin nada útil que mostrar. */
function norm(s){
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function buildPopMobile(menu, anchor){
  closeMenu();
  const pop = document.createElement("div");
  pop.className = "menu-pop menu-pop-mobile";

  const searchWrap = document.createElement("div");
  searchWrap.className = "menu-search";
  searchWrap.innerHTML = `<input type="search" placeholder="Buscar en el menú…" aria-label="Buscar en el menú"
    enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">`;
  pop.appendChild(searchWrap);
  const search = searchWrap.querySelector("input");

  const list = document.createElement("div");
  list.className = "menu-list";
  pop.appendChild(list);

  const rows = [];
  for(const it of menu.items){
    if(it.sep){
      const s = document.createElement("div"); s.className = "menu-sep";
      list.appendChild(s); rows.push({ el:s, header:false, sep:true, text:"" });
      continue;
    }
    if(it.header){
      const h = document.createElement("div");
      h.className = "section-label";
      h.style.padding = "6px 10px 2px";
      h.textContent = it.header;
      list.appendChild(h);
      rows.push({ el:h, header:true, text:"" });
      continue;
    }
    const b = document.createElement("button");
    b.className = "menu-item";
    b.disabled = !enabled(it.cmd);
    const k = labelFor(it.cmd);
    b.innerHTML = iconHtml(it) + `<span>${it.label}</span>` + (k ? `<span class="k">${k}</span>` : "");
    if(it.help) b.title = it.help;
    b.addEventListener("click", () => { closeMenu(); run(it.cmd); });
    list.appendChild(b);
    rows.push({ el:b, header:false, text:norm(it.label) });
  }

  const setRowHidden = (row, hide) => row.el.classList.toggle("menu-row-hidden", hide);

  function filter(){
    const q = norm(search.value.trim());
    let lastHeaderVisible = null, anyAfterHeader = false;
    for(const row of rows){
      if(row.header){
        if(lastHeaderVisible) setRowHidden(lastHeaderVisible, !anyAfterHeader);
        lastHeaderVisible = row; anyAfterHeader = false;
        continue;
      }
      if(row.sep){ setRowHidden(row, !!q); continue; }
      const show = !q || row.text.includes(q);
      setRowHidden(row, !show);
      if(show) anyAfterHeader = true;
    }
    if(lastHeaderVisible) setRowHidden(lastHeaderVisible, !anyAfterHeader);
  }
  search.addEventListener("input", filter);
  search.addEventListener("click", e => e.stopPropagation());
  // «Buscar» del teclado: lo cierra y deja los resultados a la vista
  search.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); search.blur(); } });

  /* Con el teclado abierto el menú se apoya justo ENCIMA de él y ocupa
     todo el alto que queda libre, así que el campo y los resultados se
     ven siempre. El teclado se abre sobre la página sin encogerla
     (iPhone y Chrome moderno de Android), así que se mide con
     `visualViewport`: `--kb` es lo que tapa el teclado y `--vvh` el alto
     visible. En los Android antiguos que sí encogen la ventana `--kb`
     vale 0 y el borde de abajo ya es el del teclado. Al cerrarse el
     teclado el menú vuelve junto a su botón. */
  const vv = window.visualViewport;
  let fitRaf = 0;
  const fit = () => {
    fitRaf = 0;
    const typing = document.activeElement === search;
    pop.classList.toggle("menu-kb", typing);
    if(typing){
      pop.style.setProperty("--kb", keyboardHeight() + "px");
      pop.style.setProperty("--vvh", Math.round(vv ? vv.height : innerHeight) + "px");
    } else {
      pop.style.removeProperty("--kb");
      pop.style.removeProperty("--vvh");
    }
  };
  const fitSoon = () => { if(!fitRaf) fitRaf = requestAnimationFrame(fit); };
  // El teclado tarda en abrirse (y en algunos móviles se anima): se vuelve a medir
  const onFocus = () => { fit(); for(const ms of [60, 150, 300, 600]) setTimeout(fit, ms); };
  const onBlur = () => setTimeout(fit, 0);
  search.addEventListener("focus", onFocus);
  search.addEventListener("blur", onBlur);
  vv?.addEventListener("resize", fitSoon);
  vv?.addEventListener("scroll", fitSoon);
  pop._unfollow = () => {
    cancelAnimationFrame(fitRaf);
    vv?.removeEventListener("resize", fitSoon);
    vv?.removeEventListener("scroll", fitSoon);
  };

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  if(r.top > innerHeight / 2){
    pop.style.bottom = Math.max(6, innerHeight - r.top + 2) + "px";
  } else {
    pop.style.top = r.bottom + 2 + "px";
  }
  openPop = pop;
  /* El buscador NO recibe el foco al abrir: en un móvil eso levanta
     el teclado en el acto —tapando media pantalla y, en Chrome para
     Android, disparando un `resize` de la ventana que el propio
     `closeMenu` de más abajo interpretaba como "cambió el tamaño,
     cierra el menú", así que el menú se abría y se cerraba solo en
     el mismo gesto. El usuario que quiera buscar toca el campo él
     mismo; quien sólo quería un ítem visible lo ve entero de un
     vistazo, sin que nada tape la lista. */
  return pop;
}

/* Extraído del handler de `#mMenu` para poder abrir el mismo menú
   desde otro botón (`#mobilebarMenu`, alcanzable con el pulgar) sin
   duplicar la lógica de aplanado. */
/* En el menú de la barra un submenú («Máscara de capa», «Combinar»…)
   es un desplegable aparte; en la lista única y con buscador del
   móvil no hay sitio para un segundo nivel, así que sus entradas se
   incrustan sueltas, con el nombre del grupo delante para que
   «aplicar» siga encontrando «Máscara de capa: Aplicar máscara» sin
   perder de dónde sale. */
function flattenForMobile(items){
  const out = [];
  for(const it of items){
    if(it.submenu){
      for(const sub of it.submenu){
        if(sub.sep) continue;
        out.push({ ...sub, label: it.label + ": " + sub.label });
      }
      continue;
    }
    out.push(it);
  }
  return out;
}

export function openMobileMenu(anchor){
  if(openRoot === anchor){ closeMenu(); return; }
  const all = { items: [] };
  MENUS.forEach((m, i) => {
    if(i) all.items.push({ sep:true });
    all.items.push({ header: m.label });
    /* `desktopOnly`: herramientas que en un móvil no son viables (p. ej.
       la reducción de ruido con IA: 91 MB de modelo y minutos de CPU
       sin WebGPU); en escritorio siguen en su menú de siempre. */
    all.items.push(...flattenForMobile(m.items.filter(x => !x.sep))
      .filter(x => !x.desktopOnly));
  });
  buildPopMobile(all, anchor);
  anchor.classList.add("open");
  openRoot = anchor;
}
