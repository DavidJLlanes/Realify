import { doc } from "../js/core/doc.js";
import { flatten } from "../js/editor/layertree.js";
import { ensureShellStyles } from "../js/ui/fsshell.js";
import { openAdvancedAIEditor } from "./ui/editor.js";

let cssPromise = null;
function ensureStyles(){
  if(cssPromise) return cssPromise;
  const href = new URL("./ui/advanced-ai.css", import.meta.url).href;
  if([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === href)) return Promise.resolve();
  cssPromise = new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return cssPromise;
}

export async function openAdvancedAI(){
  if(!doc.open) return;
  await Promise.all([ensureShellStyles(), ensureStyles()]);
  const source = flatten();
  openAdvancedAIEditor({
    source,
    name: doc.name || "Imagen",
    width: doc.w,
    height: doc.h
  });
}
