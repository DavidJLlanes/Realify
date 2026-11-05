/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN RÁPIDA · VENTANA
   Pantalla completa (js/ui/kit/fsshell.js): al centro, la rejilla con cada foto, su nota y su estado; a la derecha (móvil: abajo) las fotos, las
   opciones de análisis, la vista (Todas / Duplicados / Comparar) y «Marcar descartes». Tocar una foto la descarta o la recupera.
   Entradas: ninguna. Salida: promesa que se resuelve al cerrar.
   ═══════════════════════════════════════════════════════════════ */
import { createShell, mountControls, decodePhoto, pickFiles } from "../../js/ui/kit/fsshell.js";
import { toast } from "../../js/core/toast.js";
import { analizarFoto } from "./analisis.js";
import { grupos, mejores } from "./engine.js";

const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;

export function openCullingEditor(){
  return new Promise(resolve => {
    const fotos = [], S = { vista: "todas", ojos: true, compo: true, umbral: 40 };
    let closed = false, grid = null, seq = 0;
    const sh = createShell({ title: "Selección rápida", subtitle: "Premium 👑 · añade fotos de la galería", applyLabel: "Abrir las elegidas", onCancel: () => close(), onApply: () => apply(), onUndo: () => {}, onRedo: () => {} });
    sh.root.querySelector('[data-a="undo"]').hidden = true; sh.root.querySelector('[data-a="redo"]').hidden = true;
    sh.setApplyEnabled(false);

    const visibles = () => {
      if(S.vista === "duplicados") return fotos.filter(f => f.grupo != null);
      if(S.vista === "comparar") return fotos.filter(f => f.cmp).slice(0, 4);
      return fotos;
    };
    function recalcular(){
      fotos.forEach(f => { f.grupo = null; f.mejor = false; });
      const idx = fotos.map((f, i) => f.hash ? i : -1).filter(i => i >= 0), gr = grupos(idx.map(i => fotos[i].hash), 10).map(g => g.map(k => idx[k]));
      gr.forEach((g, n) => g.forEach(i => { fotos[i].grupo = n + 1; }));
      mejores(fotos.map(f => f.puntos || 0), gr).forEach(i => { fotos[i].mejor = true; });
      sh.setApplyEnabled(fotos.some(f => f.on));
    }

    const view = document.createElement("canvas");
    function dibujar(){
      const lista = visibles();
      if(!lista.length){ sh.setView(null); sh.setEmpty(`<b>Selección rápida</b><span>${S.vista === "comparar" ? "Marca de 2 a 4 fotos con «Comparar» en la lista de la derecha." : S.vista === "duplicados" ? "No hay fotos repetidas." : "Añade las fotos de la tanda."}</span><button type="button" data-add class="fsp-btn">+ Añadir fotos</button>`); return; }
      sh.setEmpty(null);
      const n = lista.length, comp = S.vista === "comparar", cols = comp ? (n <= 2 ? n : 2) : Math.max(1, Math.min(n, TOUCH ? 3 : 5)), rows = Math.ceil(n / cols), cw = comp ? 520 : TOUCH ? 220 : 280, ch = Math.round(cw * 0.75), g = 12, lab = 22;
      view.width = cols * cw + (cols + 1) * g; view.height = rows * (ch + lab) + (rows + 1) * g;
      const x = view.getContext("2d"); x.fillStyle = "#15191e"; x.fillRect(0, 0, view.width, view.height);
      grid = { cols, cw, ch, g, lab, lista };
      lista.forEach((f, i) => {
        const X = g + (i % cols) * (cw + g), Y = g + Math.floor(i / cols) * (ch + lab + g), k = Math.min(cw / f.proxy.width, ch / f.proxy.height), w = f.proxy.width * k, h = f.proxy.height * k;
        x.globalAlpha = f.on ? 1 : 0.28; x.drawImage(f.proxy, X + (cw - w) / 2, Y + (ch - h) / 2, w, h); x.globalAlpha = 1;
        if(f.grupo != null){ x.strokeStyle = f.mejor ? "#46c97a" : "#e0a030"; x.lineWidth = 3; x.strokeRect(X + 1.5, Y + 1.5, cw - 3, ch - 3); }
        x.font = "700 13px system-ui"; x.textAlign = "left"; x.textBaseline = "middle";
        const t = f.puntos == null ? "…" : String(f.puntos), bw = x.measureText(t).width + 14;
        x.fillStyle = f.puntos == null ? "#556" : f.puntos >= 70 ? "#2e9e5b" : f.puntos >= 45 ? "#b8872a" : "#b2433f"; x.fillRect(X + 6, Y + 6, bw, 20); x.fillStyle = "#fff"; x.fillText(t, X + 13, Y + 16);
        if(!f.on){ x.fillStyle = "#e9edf4"; x.font = "700 28px system-ui"; x.textAlign = "center"; x.fillText("✕", X + cw / 2, Y + ch / 2); }
        x.fillStyle = f.on ? "#e9edf4" : "#77808c"; x.font = "600 12px system-ui"; x.textAlign = "center";
        const txt = f.puntos == null ? "Analizando…" : (f.mejor ? "★ mejor del grupo · " : "") + (f.motivos.join(", ") || f.name); let s = txt; while(s.length > 4 && x.measureText(s).width > cw - 8) s = s.slice(0, -2);
        x.fillText(s === txt ? s : s + "…", X + cw / 2, Y + ch + lab / 2 + 2);
      });
      sh.setView(view, !!sh.view);
    }
    sh.setInteract((type, pt) => {
      if(type !== "down" || !grid || !pt) return false;
      const { cols, cw, ch, g, lab, lista } = grid, c = Math.floor((pt.x - g / 2) / (cw + g)), r = Math.floor((pt.y - g / 2) / (ch + lab + g)), f = lista[r * cols + c];
      if(c < 0 || c >= cols || !f) return false;
      f.on = !f.on; sh.setApplyEnabled(fotos.some(x => x.on)); controls.refresh(); dibujar(); return true;
    });
    sh.stage.addEventListener("click", e => { if(e.target.closest("[data-add]")) anadir(); });

    async function anadir(){
      const files = await pickFiles(); if(!files.length) return;
      const mi = ++seq, nuevos = [];
      for(const file of files){
        try{ const f = { file, name: file.name.replace(/\.[^.]+$/, ""), proxy: await decodePhoto(file, 640), on: true, puntos: null, motivos: [], hash: null, grupo: null, mejor: false, cmp: false }; fotos.push(f); nuevos.push(f); }
        catch(err){ toast(err.message, "err"); }
      }
      controls.refresh(); dibujar();
      for(const f of nuevos){
        if(closed || mi !== seq) return;
        sh.setSubtitle(`Premium 👑 · analizando ${nuevos.indexOf(f) + 1} de ${nuevos.length}…`);
        try{ Object.assign(f, await analizarFoto(f.proxy, { ojos: S.ojos, compo: S.compo })); }
        catch(err){ if(err && err.cancelled) break; f.puntos = 0; f.motivos = ["no se pudo analizar"]; }
        recalcular(); dibujar();
      }
      sh.setSubtitle("Premium 👑 · toca una foto para descartarla o recuperarla"); controls.refresh();
    }
    function marcarDescartes(){
      let n = 0; fotos.forEach(f => { if(f.puntos == null) return; const quitar = f.puntos < S.umbral || (f.grupo != null && !f.mejor); if(quitar && f.on){ f.on = false; n++; } });
      toast(n ? `${n} foto(s) marcadas para descartar` : "No hay nada que descartar"); sh.setApplyEnabled(fotos.some(f => f.on)); controls.refresh(); dibujar();
    }

    const lista = () => {
      const box = document.createElement("div"), l = document.createElement("div"); l.className = "fsp-photos";
      if(!fotos.length) l.innerHTML = `<p class="fsp-note">Todavía no hay fotos.</p>`;
      fotos.forEach(f => {
        const r = document.createElement("div"); r.className = "fsp-photo" + (f.on ? " on" : "");
        r.innerHTML = `<canvas width="60" height="45"></canvas><div><b>${f.name.replace(/[<>&]/g, "")}</b><small>${f.puntos == null ? "Analizando…" : f.puntos + " puntos"}${f.on ? "" : " · descartada"}</small></div><button type="button" class="x" aria-label="Descartar o recuperar">${f.on ? "✓" : "✕"}</button><button type="button" data-cmp aria-label="Comparar" title="Comparar">${f.cmp ? "◼" : "◻"}</button>`;
        const k = Math.min(60 / f.proxy.width, 45 / f.proxy.height); r.querySelector("canvas").getContext("2d").drawImage(f.proxy, 0, 0, f.proxy.width * k, f.proxy.height * k);
        r.querySelector(".x").addEventListener("click", () => { f.on = !f.on; sh.setApplyEnabled(fotos.some(x => x.on)); controls.refresh(); dibujar(); });
        r.querySelector("[data-cmp]").addEventListener("click", () => { f.cmp = !f.cmp; if(fotos.filter(x => x.cmp).length > 4) f.cmp = false, toast("Se comparan hasta 4 fotos"); controls.refresh(); dibujar(); });
        l.appendChild(r);
      });
      box.appendChild(l);
      const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn dashed"; b.textContent = "+ Añadir fotos de la galería"; b.addEventListener("click", anadir); box.appendChild(b);
      const d = document.createElement("button"); d.type = "button"; d.className = "fsp-btn"; d.textContent = "Marcar descartes (nota baja y repetidas peores)"; d.addEventListener("click", marcarDescartes); box.appendChild(d);
      return box;
    };
    const sections = [
      { id: "fotos", label: "Fotos", props: [{ key: "fotos", label: "Fotos", type: "custom", render: lista }] },
      { id: "vista", label: "Vista", props: [{ key: "vista", label: "Mostrar", type: "seg", options: [["todas", "Todas"], ["duplicados", "Duplicados"], ["comparar", "Comparar"]] }] },
      { id: "analisis", label: "Análisis", props: [
        { key: "ojos", label: "Buscar ojos cerrados (más lento)", type: "toggle" }, { key: "compo", label: "Valorar la composición (más lento)", type: "toggle" },
        { key: "umbral", label: "Descartar por debajo de", type: "range", min: 10, max: 80, unit: " pts", def: 40 }], note: "Se aplica a las fotos que añadas a partir de ahora." }
    ];
    const controls = mountControls(sh, { sections, get: k => S[k], set: (k, v) => { S[k] = v; if(k === "vista") dibujar(); } });

    async function apply(){
      const elegidas = fotos.filter(f => f.on); if(!elegidas.length) return;
      close();
      const [{ openFile }, docs] = await Promise.all([import("../../js/io/open.js"), import("../../js/editor/documents.js")]);
      let n = 0; for(const f of elegidas.slice(0, 30)){ try{ if(await docs.openAsNewTab(() => openFile(f.file))) n++; } catch(err){ toast(err.message, "err"); } }
      toast(`${n} foto(s) abiertas en pestañas${elegidas.length > 30 ? " (las 30 primeras)" : ""}`, "ok");
    }
    function close(){ if(closed) return; closed = true; sh.close(); resolve(); }
    window.__realifyTest = Object.assign(window.__realifyTest || {}, { culling: { fotos, S, anadirArchivos: async files => { for(const file of files){ const f = { file, name: file.name.replace(/\.[^.]+$/, ""), proxy: await decodePhoto(file, 640), on: true, puntos: null, motivos: [], hash: null, grupo: null, mejor: false, cmp: false }; fotos.push(f); Object.assign(f, await analizarFoto(f.proxy, { ojos: S.ojos, compo: S.compo })); recalcular(); } controls.refresh(); dibujar(); }, marcarDescartes } });
    dibujar();
  });
}
