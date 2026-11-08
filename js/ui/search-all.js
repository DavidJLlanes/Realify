/* ═══════════════════════════════════════════════════════════════
   BUSCADOR GLOBAL · «Buscar herramienta»
   Un solo índice con TODO lo que ofrece la web: cada comando de los menús (con su ruta, p. ej. «Filtro › Looks») y cada herramienta de la
   barra lateral. Lo usan el campo de la barra de menús (escritorio, tras Ayuda) y el cajón de Herramientas del móvil.
   Entradas: texto a buscar. Salidas: buscarTodo(q) → [{ cmd | tool, label, ruta }] (primero lo que contiene las palabras, luego lo parecido);
   initBuscador() monta el campo de escritorio. Límites: sólo lee los datos de los menús; no ejecuta nada hasta que se elige un resultado.
   ═══════════════════════════════════════════════════════════════ */
import { MENUS } from "./menu/data.js";
import { run, enabled } from "../core/commands.js";
import { TOOLS, setTool } from "../editor/tools/tools.js";
import { matchScore, searchable } from "../core/search.js";

const limpio = t => String(t || "").replace(/\s*Premium 👑|…/g, "").trim();
let INDICE = null;

function construir(){
  const out = [], vistos = new Set();
  const camina = (items, ruta) => {
    for(const it of items){
      if(it.submenu || it.items){ camina(it.submenu || it.items, it.label ? [...ruta, limpio(it.label)] : ruta); continue; }
      if(!it.cmd || !it.label || it.desktopOnly === false) continue;
      if(vistos.has(it.cmd)) continue; vistos.add(it.cmd);
      const label = limpio(it.label);
      out.push({ cmd: it.cmd, label, ruta: ruta.join(" › "), texto: searchable(`${label} ${ruta.join(" ")} ${it.help || ""}`) });
    }
  };
  for(const m of MENUS) camina(m.items, [limpio(m.label)]);
  for(const t of TOOLS) out.push({ tool: t.id, label: t.name, ruta: "Herramientas", texto: searchable(`${t.name} herramienta ${t.key || ""}`) });
  return out;
}

export function buscarTodo(q, limite = 40){
  if(!String(q || "").trim()) return [];
  INDICE ||= construir();
  const pun = INDICE.map(e => [e, matchScore(q, e.texto)]).filter(([, s]) => s > 0);
  return [...pun.filter(([, s]) => s === 2), ...pun.filter(([, s]) => s === 1)].slice(0, limite).map(([e]) => e);
}

export function lanzar(e){
  if(e.tool){ setTool(e.tool); return; }
  if(enabled(e.cmd)) run(e.cmd);
}

/* Campo de la barra de menús (escritorio): después del último menú, «Ayuda». */
export function initBuscador(){
  const roots = document.getElementById("menuRoots");
  if(!roots || document.getElementById("globalSearch")) return;
  const caja = document.createElement("div"); caja.id = "globalSearch"; caja.className = "gsearch";
  caja.innerHTML = `<input type="search" placeholder="Buscar herramienta" aria-label="Buscar herramienta" autocomplete="off" spellcheck="false" enterkeyhint="search">
    <div class="gsearch-list" role="listbox" hidden></div>`;
  roots.after(caja);
  const campo = caja.querySelector("input"), lista = caja.querySelector(".gsearch-list");
  let res = [], sel = 0;
  const cerrar = () => { lista.hidden = true; };
  const pinta = () => {
    lista.innerHTML = "";
    res.forEach((e, i) => {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "option");
      b.className = "gsearch-item" + (i === sel ? " on" : "") + (e.cmd && !enabled(e.cmd) ? " off" : "");
      b.innerHTML = `<span></span><small></small>`; b.firstChild.textContent = e.label; b.lastChild.textContent = e.ruta;
      b.addEventListener("mousedown", ev => { ev.preventDefault(); elige(e); });
      lista.appendChild(b);
    });
    if(!res.length){ const v = document.createElement("div"); v.className = "gsearch-empty"; v.textContent = "Nada coincide"; lista.appendChild(v); }
    lista.hidden = false;
  };
  const elige = e => { cerrar(); campo.value = ""; campo.blur(); lanzar(e); };
  campo.addEventListener("input", () => { res = buscarTodo(campo.value); sel = 0; if(campo.value.trim()) pinta(); else cerrar(); });
  campo.addEventListener("focus", () => { if(campo.value.trim()) pinta(); });
  campo.addEventListener("blur", () => setTimeout(cerrar, 120));
  campo.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ campo.value = ""; cerrar(); campo.blur(); }
    else if(ev.key === "ArrowDown" && res.length){ ev.preventDefault(); sel = (sel + 1) % res.length; pinta(); lista.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }
    else if(ev.key === "ArrowUp" && res.length){ ev.preventDefault(); sel = (sel - 1 + res.length) % res.length; pinta(); lista.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }
    else if(ev.key === "Enter" && res[sel]) elige(res[sel]);
  });
  addEventListener("keydown", ev => { if((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k"){ ev.preventDefault(); campo.focus(); campo.select(); } });
}
