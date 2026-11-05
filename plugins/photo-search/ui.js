/* ═══════════════════════════════════════════════════════════════
   BUSCAR FOTOS · VENTANA
   Pantalla completa (js/ui/kit/fsshell.js): al centro, las miniaturas que cumplen la frase; a la derecha (móvil: abajo) la caja de búsqueda y la
   biblioteca (añadir fotos, vaciar el índice). Tocar una miniatura abre esa foto en una pestaña; si es de otra sesión, pide volver a elegirla.
   Entradas: ninguna. Salida: promesa que se resuelve al cerrar.
   ═══════════════════════════════════════════════════════════════ */
import { createShell, mountControls, decodePhoto, pickFiles } from "../../js/ui/kit/fsshell.js";
import { toast } from "../../js/core/toast.js";
import { indexarFoto } from "../../js/features/library/shared/indexar.js";
import { buscar } from "../../js/features/library/search-photos/engine/consulta.js";
import { todos, guardar, conocida, vaciar, claveDe } from "../../js/features/library/search-photos/indice.js";

const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
const EJEMPLOS = ["perro", "playa azul", "retrato en blanco y negro", "de noche", "comida"];

export function openPhotoSearchEditor(){
  return new Promise(async resolve => {
    const S = { q: "" }, sesion = new Map(), bmp = new Map();
    let regs = [], lista = [], grid = null, closed = false, ocupado = false;
    const sh = createShell({ title: "Buscar fotos", subtitle: "Premium 👑 · todo se queda en este dispositivo", applyLabel: "Abrir las encontradas", onCancel: () => close(), onApply: () => abrirTodas(), onUndo: () => {}, onRedo: () => {} });
    sh.root.querySelector('[data-a="undo"]').hidden = true; sh.root.querySelector('[data-a="redo"]').hidden = true;
    sh.setApplyEnabled(false);

    const mapa = () => { const o = {}; regs.forEach((r, i) => { o[i] = r; }); return o; };
    function filtrar(){
      const q = S.q.trim();
      lista = q ? buscar(regs.map(r => r.reg), q).map(x => regs[x.i]) : [...regs].sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
      sh.setApplyEnabled(lista.some(r => sesion.has(r.clave)));
    }
    async function bitmapDe(r){ if(!bmp.has(r.clave)) bmp.set(r.clave, r.mini ? await createImageBitmap(r.mini) : null); return bmp.get(r.clave); }

    const view = document.createElement("canvas");
    async function dibujar(){
      filtrar();
      if(!lista.length){ sh.setView(null); sh.setEmpty(`<b>Buscar fotos</b><span>${regs.length ? "No hay fotos que cumplan eso. Prueba con otra palabra." : "Añade fotos de la galería para crear tu índice."}</span>`); return; }
      sh.setEmpty(null);
      const n = lista.length, cols = Math.max(1, Math.min(n, TOUCH ? 3 : 5)), rows = Math.ceil(n / cols), cw = TOUCH ? 200 : 250, ch = Math.round(cw * 0.75), g = 12, lab = 22;
      view.width = cols * cw + (cols + 1) * g; view.height = rows * (ch + lab) + (rows + 1) * g;
      const x = view.getContext("2d"); x.fillStyle = "#15191e"; x.fillRect(0, 0, view.width, view.height);
      grid = { cols, cw, ch, g, lab, lista: [...lista] };
      for(let i = 0; i < n; i++){
        const r = lista[i], b = await bitmapDe(r), X = g + (i % cols) * (cw + g), Y = g + Math.floor(i / cols) * (ch + lab + g);
        if(b){ const k = Math.min(cw / b.width, ch / b.height), w = b.width * k, h = b.height * k; x.globalAlpha = sesion.has(r.clave) ? 1 : 0.6; x.drawImage(b, X + (cw - w) / 2, Y + (ch - h) / 2, w, h); x.globalAlpha = 1; }
        x.fillStyle = "#e9edf4"; x.font = "600 12px system-ui"; x.textAlign = "center"; x.textBaseline = "middle";
        const t = `${r.nombre.replace(/\.[^.]+$/, "")}${r.reg?.catEtiqueta ? " · " + r.reg.catEtiqueta : ""}`; let s = t; while(s.length > 4 && x.measureText(s).width > cw - 8) s = s.slice(0, -2);
        x.fillText(s === t ? s : s + "…", X + cw / 2, Y + ch + lab / 2 + 2);
      }
      sh.setView(view, !!sh.view);
    }
    sh.setInteract((type, pt) => {
      if(type !== "down" || !grid || !pt) return false;
      const { cols, cw, ch, g, lab, lista: l } = grid, c = Math.floor((pt.x - g / 2) / (cw + g)), r = Math.floor((pt.y - g / 2) / (ch + lab + g)), f = l[r * cols + c];
      if(c < 0 || c >= cols || !f) return false;
      abrirUna(f); return true;
    });
    sh.stage.addEventListener("click", e => { if(e.target.closest("[data-add]")) anadir(); });

    async function abrirArchivos(files){
      const [{ openFile }, docs] = await Promise.all([import("../../js/io/open.js"), import("../../js/editor/documents.js")]);
      let n = 0; for(const f of files.slice(0, 30)){ try{ if(await docs.openAsNewTab(() => openFile(f))) n++; } catch(err){ toast(err.message, "err"); } }
      return n;
    }
    async function abrirUna(r){
      let f = sesion.get(r.clave);
      if(!f){
        toast("Esa foto es de otra sesión: vuelve a elegirla para abrirla");
        const files = await pickFiles(); f = files.find(x => claveDe(x) === r.clave) || files.find(x => x.name === r.nombre);
        if(!f){ toast("No era esa foto", "err"); return; } sesion.set(r.clave, f);
      }
      close(); await abrirArchivos([f]);
    }
    async function abrirTodas(){ const fs = lista.map(r => sesion.get(r.clave)).filter(Boolean); if(!fs.length) return; close(); const n = await abrirArchivos(fs); toast(`${n} foto(s) abiertas en pestañas${fs.length > 30 ? " (las 30 primeras)" : ""}`, "ok"); }

    async function indexar(files){
      if(ocupado) return; ocupado = true; let n = 0;
      for(let i = 0; i < files.length && !closed; i++){
        const file = files[i], clave = claveDe(file); sesion.set(clave, file);
        sh.setSubtitle(`Premium 👑 · indexando ${i + 1} de ${files.length}…`);
        try{
          if(!await conocida(clave)){
            const proxy = await decodePhoto(file, 640), { reg, mini } = await indexarFoto(proxy), rec = { clave, nombre: file.name, tam: file.size, fecha: Date.now(), reg, mini };
            await guardar(rec); n++;
          }
        } catch(err){ if(err && err.cancelled) break; toast(`${file.name}: ${err.message}`, "err"); }
        regs = await todos(); await dibujar();
      }
      ocupado = false; sh.setSubtitle("Premium 👑 · todo se queda en este dispositivo"); controls.refresh(); if(n) toast(`${n} foto(s) añadidas al índice`, "ok");
    }
    async function anadir(){ const files = await pickFiles(); if(files.length) await indexar(files); }

    const panel = () => {
      const box = document.createElement("div"), i = document.createElement("input");
      i.type = "search"; i.className = "fsp-text"; i.placeholder = "Ej.: perro en la playa"; i.value = S.q; i.setAttribute("aria-label", "Buscar fotos");
      let t = 0; i.addEventListener("input", () => { S.q = i.value; clearTimeout(t); t = setTimeout(dibujar, 250); });
      i.addEventListener("keydown", e => { if(e.key === "Enter") i.blur(); });
      box.appendChild(i);
      const ch = document.createElement("div"); ch.className = "fsp-chips";
      EJEMPLOS.forEach(e => { const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn"; b.textContent = e; b.addEventListener("click", () => { S.q = e; i.value = e; dibujar(); }); ch.appendChild(b); });
      box.appendChild(ch); return box;
    };
    const biblioteca = () => {
      const box = document.createElement("div"), p = document.createElement("p"); p.className = "fsp-note"; p.textContent = regs.length ? `${regs.length} foto(s) en el índice de este dispositivo.` : "Todavía no hay fotos indexadas."; box.appendChild(p);
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn dashed"; b.textContent = "+ Añadir fotos de la galería"; b.addEventListener("click", anadir); box.appendChild(b);
      const d = document.createElement("button"); d.type = "button"; d.className = "fsp-btn"; d.textContent = "Vaciar el índice"; d.addEventListener("click", async () => { await vaciar(); regs = []; bmp.clear(); controls.refresh(); dibujar(); toast("Índice vaciado"); }); box.appendChild(d);
      return box;
    };
    const sections = [
      { id: "buscar", label: "Buscar", props: [{ key: "q", label: "Buscar", type: "custom", render: panel }] },
      { id: "biblioteca", label: "Biblioteca", props: [{ key: "bib", label: "Biblioteca", type: "custom", render: biblioteca }] }
    ];
    const controls = mountControls(sh, { sections, get: k => S[k], set: (k, v) => { S[k] = v; } });

    function close(){ if(closed) return; closed = true; sh.close(); resolve(); }
    window.__realifyTest = Object.assign(window.__realifyTest || {}, { busqueda: { S, indexar, buscarTexto: async q => { S.q = q; await dibujar(); return lista.map(r => r.nombre); }, regs: () => regs } });
    regs = await todos(); await dibujar();
  });
}
