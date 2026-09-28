/* ═══════════════════════════════════════════════════════════════
   COMANDOS
   Un único registro para todo lo que la aplicación sabe hacer. Los
   menús, los botones con data-cmd y los atajos de teclado no hacen
   nada por su cuenta: sólo invocan comandos por su identificador.
   Eso evita tener la misma lógica escrita en tres sitios y permite
   que un comando se desactive solo cuando no procede.
   ═══════════════════════════════════════════════════════════════ */

import { emit } from "../core/bus.js";
import { toast } from "./toast.js";

const registry = new Map();

export function register(id, def){
  registry.set(id, typeof def === "function" ? { run: def } : def);
}

export function registerAll(obj){
  for(const id in obj) register(id, obj[id]);
}

export function get(id){ return registry.get(id); }

export function enabled(id){
  const c = registry.get(id);
  if(!c) return false;
  return c.enabled ? !!c.enabled() : true;
}

/* Observadores de comandos (grabador de acciones, features/actions.js):
   reciben cada comando de primer nivel antes de ejecutarse. */
const runHooks = new Set();
export const onRun = fn => { runHooks.add(fn); return () => runHooks.delete(fn); };
let depth = 0;

/** Ejecuta un comando y devuelve su promesa (para reproducir acciones). */
export async function runAsync(id, arg){
  const c = registry.get(id);
  if(!c) throw new Error(`El comando «${id}» ya no existe`);
  if(c.enabled && !c.enabled()) throw new Error(`«${id}» no se puede aplicar ahora`);
  return c.run(arg);
}

export function run(id, arg){
  const c = registry.get(id);
  if(!c){ console.warn("[cmd] no existe:", id); return; }
  if(c.enabled && !c.enabled()) return;
  if(depth === 0) for(const h of runHooks){ try{ h(id, arg); }catch{} }
  depth++;
  try{
    const r = c.run(arg);
    if(r instanceof Promise) r.catch(err => {
      console.error("[cmd]", id, err);
      toast(err.message || "Algo ha fallado", "err");
    });
  }catch(err){
    console.error("[cmd]", id, err);
    toast(err.message || "Algo ha fallado", "err");
  }finally{ depth--; }
  emit("cmd:done", id);
}

/* Cualquier elemento con data-cmd queda cableado sin registrar nada
   a mano. Se escucha en el documento para que también funcione con
   los botones que se creen después. */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-cmd]");
  if(!el) return;
  e.preventDefault();
  run(el.dataset.cmd, el.dataset.arg);
});

/* ── atajos ─────────────────────────────────────────────────── */
const shortcuts = [];

export function bind(combo, cmd){
  shortcuts.push({ ...parse(combo), cmd });
}

function parse(combo){
  const parts = combo.toLowerCase().split("+");
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes("ctrl") || parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt")
  };
}

const isTyping = el =>
  el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable);

addEventListener("keydown", e => {
  if(isTyping(e.target)) return;
  const key = e.key.toLowerCase();
  // Intro sobre un botón o enlace con el foco es «pulsarlo», no un atajo.
  if(key === "enter" && e.target.closest && e.target.closest("button, a[href], [role=button]")) return;
  // Con un diálogo abierto, Intro es su botón principal (ui/dialog.js)
  // y no debe además aplicar el recorte o la transformación de detrás.
  if(key === "enter" && (e.defaultPrevented || document.querySelector(".modal"))) return;
  const mod = e.ctrlKey || e.metaKey;
  for(const s of shortcuts){
    if(s.key !== key) continue;
    if(s.ctrl !== mod) continue;
    if(s.shift !== e.shiftKey) continue;
    if(s.alt !== e.altKey) continue;
    // Una misma tecla puede servir a varios comandos que se excluyen
    // entre sí (Intro: cerrar trazado, aplicar recorte, aplicar
    // transformación…): si éste no procede ahora, se prueba el siguiente.
    if(!enabled(s.cmd)) continue;
    e.preventDefault();
    run(s.cmd);
    return;
  }
});

/* Teclas cuyo nombre en el navegador no es lo que nadie espera leer en
   un menú: «delete» dentro de un desplegable en español canta. */
const KEY_LABEL = {
  delete: "Supr", backspace: "Retroceso", escape: "Esc",
  enter: "Intro", tab: "Tab", " ": "Espacio",
  arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→"
};

/* Etiqueta legible del atajo para pintarla en el menú */
export function labelFor(cmd){
  const s = shortcuts.find(x => x.cmd === cmd);
  if(!s) return "";
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const out = [];
  if(s.ctrl)  out.push(mac ? "⌘" : "Ctrl");
  if(s.shift) out.push(mac ? "⇧" : "Mayús");
  if(s.alt)   out.push(mac ? "⌥" : "Alt");
  out.push(KEY_LABEL[s.key] || (s.key.length === 1 ? s.key.toUpperCase() : s.key));
  return out.join(mac ? "" : "+");
}
