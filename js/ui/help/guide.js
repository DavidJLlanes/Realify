/* La guía. Es documentación larga y sólo la abre quien la pide, así
   que se carga bajo demanda y no pesa en el arranque.

   Índice + subpáginas, no un único scroll interminable: cada tema
   abre su propio contenido en el mismo hueco del diálogo, así que lo
   que se ve en pantalla es siempre corto aunque el conjunto no lo
   sea. «Realify» —el bloque más largo, con diferencia— es a su vez
   un índice con sus propias subpáginas, en vez de un tema más.

   Al añadir una función nueva a la app, el sitio para documentarla es
   aquí: un tema nuevo en TOPICS (o una entrada nueva dentro de un
   tema ya existente), nunca dejarla sin guía. */

import { dialog } from "../kit/dialog.js";
import { TOPICS } from "./topics/index.js";

const INTRO = `
  <p class="lead">Una fotografía no es una imagen limpia: es una imagen que ha
    atravesado un objetivo, un sensor y un procesador, y cada uno deja huellas
    medibles. Un generador de imágenes produce el resultado directamente, sin
    recorrer ese camino, y por eso le faltan todas esas huellas a la vez.
    Esta herramienta reproduce el recorrido físico, paso a paso y en el orden
    correcto.</p>

  <p>El botón <b>?</b> junto al nombre de la herramienta activa, en la barra de
    opciones, abre esta misma guía directamente en su explicación —sin tener que
    buscarla aquí a mano—.</p>

  <div class="callout">
    <p><b>Uso responsable.</b> Esta herramienta añade artefactos de captura y
      escribe metadatos EXIF. Eso es legítimo para investigación sobre robustez
      de detectores, para trabajo artístico que mezcla síntesis y fotografía,
      para privacidad sobre tu propio flujo de trabajo y para probar tus propias
      defensas. No lo es para presentar una imagen sintética como prueba, como
      documento, como noticia o como registro de un hecho que no ocurrió, ni
      para atribuirla a una persona o un equipo que no son los tuyos. La
      diferencia no está en la técnica, está en lo que afirmas con el
      resultado.</p>
  </div>`;

/* Dónde vive la explicación de cada herramienta de la barra: el tema
   y el id exacto del <li> al que saltar y resaltar —así el «?» de la
   barra de opciones lleva derecho a la frase que explica ESA
   herramienta, no sólo a la página entera del tema—. Dos herramientas
   que comparten un mismo párrafo (Mano/Zoom, Selección
   rectangular/elíptica) comparten también el mismo anchor. Añadir una
   herramienta nueva a TOOLS (editor/tools/tools.js) sin añadirla aquí deja
   su «?» sin sitio a donde ir —cae al índice general en vez de a su
   explicación—, así que ambas listas deben crecer juntas. */
const TOOL_LINKS = {
  move: ["mover", "tool-move"], crop: ["mover", "tool-crop"],
  transform: ["mover", "tool-transform"], perspective: ["mover", "tool-perspective"],
  brush: ["pintura", "tool-brush"], eraser: ["pintura", "tool-eraser"],
  clone: ["pintura", "tool-clone"], heal: ["pintura", "tool-heal"],
  expose: ["pintura", "tool-expose"], dodgeburn: ["pintura", "tool-dodgeburn"],
  smudge: ["pintura", "tool-smudge"], liquify: ["pintura", "tool-liquify"],
  historyBrush: ["pintura", "tool-historyBrush"],
  "select-rect": ["seleccion", "tool-select-rect"], "select-ellipse": ["seleccion", "tool-select-rect"],
  "select-lasso": ["seleccion", "tool-select-lasso"], "select-wand": ["seleccion", "tool-select-wand"],
  pen: ["seleccion", "tool-pen"], camove: ["seleccion", "tool-camove"],
  fill: ["otras", "tool-fill"], gradient: ["otras", "tool-gradient"], shape: ["otras", "tool-shape"],
  text: ["otras", "tool-text"], picker: ["otras", "tool-picker"],
  pan: ["otras", "tool-pan"], zoom: ["otras", "tool-pan"], compare: ["otras", "tool-compare"]
};

function findTopic(id){ return TOPICS.find(t => t.id === id); }

/* ── Búsqueda en toda la guía ────────────────────────────────────
   Cada entrada (<li> o <p>) de cada tema es un resultado posible. Se
   busca sin tildes, sin mayúsculas y con todas las palabras (en
   cualquier orden); un resultado lleva a su tema y resalta el párrafo
   exacto. Las entradas sin id reciben uno automático, el mismo al
   pintar el tema y al indexarlo. */
const fold = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function withIds(html, prefix){
  let n = 0;
  return html.replace(/<(li|p)(\s[^>]*)?>/g, (m, tag, attrs = "") => /\sid=/.test(attrs) ? m : `<${tag} id="${prefix}-${++n}"${attrs}>`);
}

let searchIndex = null;

function buildIndex(){
  if(searchIndex) return searchIndex;
  searchIndex = [];
  const add = (path, title, html) => {
    const d = document.createElement("div");
    d.innerHTML = withIds(html, path.replace("/", "-"));
    for(const el of d.querySelectorAll("li, p")){
      // Un <li> con sublista: su propio texto sin el de los hijos repetido
      const own = el.cloneNode(true); own.querySelectorAll("ul, li").forEach(x => x.remove());
      const text = (own.textContent || "").replace(/\s+/g, " ").trim();
      if(text.length < 12) continue;
      // Se busca en todo su texto (sublistas incluidas); se enseña el suyo propio
      const all = (el.textContent || "").replace(/\s+/g, " ").trim();
      const head = (el.querySelector(":scope > b, :scope > a")?.textContent || text.slice(0, 60)).replace(/\s+/g, " ").replace(/[.:]\s*$/, "").trim();
      searchIndex.push({ path, anchor: el.id, topic: title, head, text, key: fold(all) });
    }
  };
  for(const t of TOPICS){
    if(t.sub) for(const s of t.sub) add(t.id + "/" + s.id, t.title + " › " + s.title, s.html);
    else add(t.id, t.title, t.html);
  }
  return searchIndex;
}

const escapeHtml = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function renderResults(q){
  const words = fold(q).split(/\s+/).filter(Boolean);
  if(!words.length) return "";
  const hits = buildIndex().filter(e => words.every(w => e.key.includes(w)))
    .map(e => ({ e, score: words.reduce((s, w) => s + (fold(e.head).includes(w) ? 3 : 0) + (fold(e.topic).includes(w) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 40);
  if(!hits.length) return `<p class="guide-empty">Nada coincide con «${escapeHtml(q)}». Prueba con otra palabra.</p>`;
  const snippet = (text) => {
    const k = fold(text), i = Math.max(0, k.indexOf(words[0]) - 50);
    let out = escapeHtml((i ? "…" : "") + text.slice(i, i + 170) + (text.length > i + 170 ? "…" : ""));
    return out;
  };
  return `<div class="guide-index">${hits.map(({ e }) => `<button class="guide-row" data-go="${e.path}#${e.anchor}">
    <span class="guide-row-title">${escapeHtml(e.head)} <small>· ${escapeHtml(e.topic)}</small></span>
    <span class="guide-row-desc">${snippet(e.text)}</span></button>`).join("")}</div>`;
}

function indexRow(go, title, desc){
  return `<button class="guide-row" data-go="${go}">
    <span class="guide-row-title">${title}</span>
    <span class="guide-row-desc">${desc}</span>
  </button>`;
}

function renderIndex(){
  return `<input type="search" class="guide-search" placeholder="Buscar en la guía (p. ej. «curvas», «trozos», «simetría»)…" aria-label="Buscar en la guía">
    <div class="guide-results"></div>
    <div class="guide-home">` + INTRO + `<div class="guide-index">` +
    TOPICS.map(t => indexRow(t.id, t.title, t.desc)).join("") +
    `</div></div>`;
}

function renderTopic(t){
  if(t.sub){
    return `<button class="guide-back" data-back="index">← Índice</button>
      <h3 style="margin-top:0">${t.title}</h3>
      <div class="guide-index">${t.sub.map(s => indexRow(t.id + "/" + s.id, s.title, s.desc)).join("")}</div>`;
  }
  return `<button class="guide-back" data-back="index">← Índice</button>` + withIds(t.html, t.id);
}

function renderSub(t, s){
  return `<button class="guide-back" data-back="${t.id}">← ${t.title}</button>` + withIds(s.html, t.id + "-" + s.id);
}

/* `startPath`/`startAnchor` dejan abrir la guía YA en un tema
   concreto —y, con `startAnchor`, saltar y resaltar un <li> exacto
   dentro de él— en vez de siempre en el índice: es lo que usa el «?»
   de la barra de opciones (ver openGuideForTool más abajo), pero
   sirve para cualquier enlace directo a una explicación puntual. */
export function openGuide(startPath, startAnchor){
  const wrap = document.createElement("div");
  wrap.className = "guide";

  const nav = (path, anchor) => {
    let html;
    if(path === "index"){
      html = renderIndex();
    } else {
      const [tid, sid] = path.split("/");
      const t = findTopic(tid);
      html = !t ? renderIndex()
           : sid && t.sub ? (t.sub.find(s => s.id === sid) ? renderSub(t, t.sub.find(s => s.id === sid)) : renderIndex())
           : renderTopic(t);
    }
    wrap.innerHTML = html;
    wrap.closest(".modal-body")?.scrollTo(0, 0);
    if(!anchor) return;
    // Un frame para que el nuevo contenido ya esté en el DOM antes de
    // medir dónde desplazarse.
    requestAnimationFrame(() => {
      const el = wrap.querySelector("#" + anchor);
      if(!el) return;
      el.scrollIntoView({ block:"center", behavior:"smooth" });
      el.classList.add("guide-hit");
      setTimeout(() => el.classList.remove("guide-hit"), 1600);
    });
  };

  wrap.addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if(go){
      e.preventDefault();
      const [path, anchor] = go.dataset.go.split("#");
      nav(path, anchor);
      return;
    }
    const back = e.target.closest("[data-back]");
    if(back) nav(back.dataset.back);
  });

  // Buscador del índice: en cuanto hay texto, los resultados sustituyen
  // a la portada; al vaciarlo, vuelve el índice de temas.
  wrap.addEventListener("input", e => {
    if(!e.target.matches(".guide-search")) return;
    const q = e.target.value;
    wrap.querySelector(".guide-results").innerHTML = renderResults(q);
    wrap.querySelector(".guide-home").hidden = !!q.trim();
  });
  wrap.addEventListener("keydown", e => {
    if(e.key === "Enter" && e.target.matches(".guide-search")){
      const first = wrap.querySelector(".guide-results [data-go]");
      if(first){ e.preventDefault(); first.click(); }
    }
  });

  nav(startPath || "index", startAnchor);

  return dialog({
    title: "Guía",
    wide: true,
    body: wrap,
    buttons: [{ label:"Cerrar", primary:true }]
  });
}

/* Abre la guía derecho en la explicación de una herramienta de la
   barra —el «?» de la barra de opciones (ui/optionsbar.js) llama a
   esto con el id de la herramienta activa—. Sin entrada en
   TOOL_LINKS (una herramienta nueva que aún no se ha documentado ahí)
   cae al índice general en vez de fallar. */
export function openGuideForTool(toolId){
  const link = TOOL_LINKS[toolId];
  return openGuide(link ? link[0] : "index", link ? link[1] : undefined);
}
