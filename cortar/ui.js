/* ═══════════════════════════════════════════════════════════════
   CORTAR · VENTANA
   Pantalla completa (js/ui/fsshell.js). La imagen con los cortes
   encima (numerados, y oscurecido lo que se descarta).

     · Cortes a mano: tocar la imagen añade un corte (vertical u
       horizontal, según el interruptor); arrastrar un corte lo mueve y
       sacarlo de la imagen lo quita.
     · Carrusel y perfil de Instagram: arrastrar mueve el encuadre.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, stateHistory } from "../js/ui/fsshell.js";
import { plan, pieceNumber, RATIOS, MODES, modeSvg } from "./plan.js";

export function openCutEditor({ source, name, canLayers, onAccept }){
  const W = source.width, H = source.height;
  const state = {
    p: { mode: "grid", rows: 2, cols: 2, tileW: Math.round(W / 2), tileH: Math.round(H / 2), pieces: 3, ratio: "4:5",
         igRows: 3, igRatio: "3:4", xs: [0.5], ys: [], ox: 0.5, oy: 0.5, addDir: "v" },
    out: { output: canLayers ? "layers" : "zip", format: "png", quality: 92, prefix: name }
  };
  const P = state.p, O = state.out;
  let closed = false;

  const sh = createShell({
    title: "Cortar en partes", subtitle: `${W} × ${H}`, applyLabel: "Cortar", cls: "fsp-noleft",
    onCancel: () => close(), onApply: () => apply(), onUndo: () => hist.undo(), onRedo: () => hist.redo()
  });
  const hist = stateHistory(state, () => { Object.assign(P, state.p); state.p = P; Object.assign(O, state.out); state.out = O; controls.refresh(); refresh(); }, sh);
  sh.setView(source, false);

  /* ── Dibujo de los cortes ── */
  let drag = null, hover = null;
  function info(){
    const pl = plan(P, W, H), q = pl.rects[0];
    sh.setSubtitle(`${W} × ${H} · ${pl.rects.length} ${pl.rects.length === 1 ? "trozo" : "trozos"}${q ? ` · ${q.w} × ${q.h} px` : ""}${P.mode === "instagram" ? " · numerados en orden de subida" : ""}`);
    return pl;
  }
  sh.setOverlay((x, t) => {
    const pl = plan(P, W, H), k = t.k, X = v => t.ox + v * k, Y = v => t.oy + v * k, a = pl.area, d = t.dpr;
    // Lo que se descarta
    x.fillStyle = "rgba(0,0,0,.62)";
    x.fillRect(X(0), Y(0), W * k, a.y * k); x.fillRect(X(0), Y(a.y + a.h), W * k, (H - a.y - a.h) * k);
    x.fillRect(X(0), Y(a.y), a.x * k, a.h * k); x.fillRect(X(a.x + a.w), Y(a.y), (W - a.x - a.w) * k, a.h * k);
    x.lineWidth = 1.6 * d; x.setLineDash([6 * d, 4 * d]);
    for(const q of pl.rects){ x.strokeStyle = "rgba(0,0,0,.5)"; x.strokeRect(X(q.x) + d, Y(q.y) + d, q.w * k, q.h * k); x.strokeStyle = "#fff"; x.strokeRect(X(q.x), Y(q.y), q.w * k, q.h * k); }
    x.setLineDash([]);
    if(P.mode === "manual"){
      x.lineWidth = 3 * d;
      P.xs.forEach((v, i) => { x.strokeStyle = hover?.axis === "x" && hover.i === i || drag?.axis === "x" && drag.i === i ? "#9cbcff" : "#6794ff"; x.beginPath(); x.moveTo(X(v * W), Y(0)); x.lineTo(X(v * W), Y(H)); x.stroke(); });
      P.ys.forEach((v, i) => { x.strokeStyle = hover?.axis === "y" && hover.i === i || drag?.axis === "y" && drag.i === i ? "#9cbcff" : "#6794ff"; x.beginPath(); x.moveTo(X(0), Y(v * H)); x.lineTo(X(W), Y(v * H)); x.stroke(); });
    }
    const r = Math.max(10 * d, Math.min(18 * d, Math.min(...pl.rects.map(q => Math.min(q.w, q.h))) * k / 4));
    x.font = `600 ${Math.round(r * 1.05)}px system-ui`; x.textAlign = "center"; x.textBaseline = "middle";
    pl.rects.forEach((q, i) => {
      const cx = X(q.x + q.w / 2), cy = Y(q.y + q.h / 2);
      x.fillStyle = "rgba(10,12,16,.72)"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.fillText(String(pieceNumber(P, pl.rects.length, i)), cx, cy + .5);
    });
  });
  const lineAt = pt => {
    const tol = 14 / Math.max(.01, pt.k);
    let best = null;
    P.xs.forEach((v, i) => { const d = Math.abs(v * W - pt.x); if(d < tol && (!best || d < best.d)) best = { axis: "x", i, d }; });
    P.ys.forEach((v, i) => { const d = Math.abs(v * H - pt.y); if(d < tol && (!best || d < best.d)) best = { axis: "y", i, d }; });
    return best;
  };
  sh.setInteract((type, pt) => {
    const fixed = P.mode === "carousel" || P.mode === "instagram";
    if(P.mode !== "manual" && !fixed) return false;
    if(type === "hover"){ if(P.mode === "manual"){ const h = lineAt(pt); if(JSON.stringify(h) !== JSON.stringify(hover)){ hover = h; sh.redraw(); } } return false; }
    if(type === "down"){
      if(fixed){ drag = { area: true, x: pt.x, y: pt.y, ox: P.ox, oy: P.oy }; return true; }
      const hit = lineAt(pt);
      drag = hit ? { ...hit, moved: false } : { add: true, x: pt.x, y: pt.y, moved: false };
      return true;
    }
    if(!drag) return false;
    if(type === "move"){
      if(drag.area){
        const a = plan({ ...P, ox: .5, oy: .5 }, W, H).area;
        const fx = W - a.w, fy = H - a.h;
        if(fx > 0) P.ox = Math.min(1, Math.max(0, drag.ox + (pt.x - drag.x) / fx));
        if(fy > 0) P.oy = Math.min(1, Math.max(0, drag.oy + (pt.y - drag.y) / fy));
        refresh(); return true;
      }
      if(drag.add){ if(Math.hypot(pt.x - drag.x, pt.y - drag.y) * pt.k > 8) drag.moved = true; return true; }
      drag.moved = true;
      if(drag.axis === "x") P.xs[drag.i] = pt.x / W; else P.ys[drag.i] = pt.y / H;
      refresh(); return true;
    }
    if(type === "up" || type === "cancel"){
      const d = drag; drag = null;
      if(type === "up"){
        if(d.add && !d.moved && pt && pt.x > 0 && pt.y > 0 && pt.x < W && pt.y < H){
          (P.addDir === "v" ? P.xs : P.ys).push(P.addDir === "v" ? pt.x / W : pt.y / H);
        } else if(!d.add && !d.area){
          // Sacado de la imagen: se quita
          const arr = d.axis === "x" ? P.xs : P.ys, v = arr[d.i];
          if(v <= 0.005 || v >= 0.995) arr.splice(d.i, 1);
        }
        hist.commit();
      }
      refresh(); return true;
    }
    return false;
  });
  function refresh(){ info(); sh.redraw(); }

  /* ── Ajustes ── */
  const is = (...m) => () => m.includes(P.mode);
  const sections = [
    { id: "mode", label: "Modo", props: [{ key: "mode", label: "Modo", type: "thumbs", options: MODES, thumb: modeSvg }] },
    { id: "grid", label: "Cuadrícula", when: is("grid"), props: [
      { key: "rows", label: "Filas", type: "range", min: 1, max: 20, def: 2 },
      { key: "cols", label: "Columnas", type: "range", min: 1, max: 20, def: 2 }
    ] },
    { id: "size", label: "Tamaño del trozo", when: is("size"), props: [
      { key: "tileW", label: "Ancho (px)", type: "number", min: 16, max: W },
      { key: "tileH", label: "Alto (px)", type: "number", min: 16, max: H }
    ] },
    { id: "carousel", label: "Carrusel", when: is("carousel"), props: [
      { key: "pieces", label: "Publicaciones", type: "range", min: 2, max: 10, def: 3 },
      { key: "ratio", label: "Proporción de cada una", type: "select", options: RATIOS.map(r => [r[0], r[0]]) }
    ], note: "Arrastra sobre la imagen para mover el encuadre." },
    { id: "instagram", label: "Perfil de Instagram", when: is("instagram"), props: [
      { key: "igRows", label: "Filas del perfil", type: "range", min: 1, max: 6, def: 3 },
      { key: "igRatio", label: "Proporción", type: "select", options: [["3:4", "Vertical 3:4 (perfil actual)"], ["1:1", "Cuadrada 1:1"]] }
    ], note: "Sube primero el trozo 1 (abajo a la derecha). Arrastra para mover el encuadre." },
    { id: "manual", label: "Cortes a mano", when: is("manual"), props: [
      { key: "addDir", label: "Tocar la imagen añade un corte", type: "seg", options: [["v", "Vertical"], ["h", "Horizontal"]] },
      { key: "evenV", label: "Repartir verticales por igual", type: "button", run: () => { P.xs = P.xs.map((_, i, a) => (i + 1) / (a.length + 1)); hist.commit(); refresh(); } },
      { key: "evenH", label: "Repartir horizontales por igual", type: "button", run: () => { P.ys = P.ys.map((_, i, a) => (i + 1) / (a.length + 1)); hist.commit(); refresh(); } },
      { key: "clear", label: "Quitar todos los cortes", type: "button", run: () => { P.xs = []; P.ys = []; hist.commit(); refresh(); } }
    ], note: "Arrastra un corte para moverlo; sácalo de la imagen para quitarlo." },
    { id: "out", label: "Guardar", props: [
      { key: "o.output", label: "Guardar como", type: "select", options: [...(canLayers ? [["layers", "Capas nuevas en este documento"]] : []), ["tabs", "Cada trozo en una pestaña"], ["zip", "Un archivo ZIP"], ["files", "Archivos sueltos"]] },
      { key: "o.format", label: "Formato", type: "select", options: [["png", "PNG (sin pérdida)"], ["jpeg", "JPEG"], ["webp", "WebP"]], when: () => O.output === "zip" || O.output === "files" },
      { key: "o.quality", label: "Calidad", type: "range", min: 40, max: 100, unit: " %", def: 92, when: () => (O.output === "zip" || O.output === "files") && O.format !== "png" },
      { key: "o.prefix", label: "Nombre", type: "text", when: () => O.output === "zip" || O.output === "files" }
    ] }
  ];
  const controls = mountControls(sh, {
    sections,
    get: k => k.startsWith("o.") ? O[k.slice(2)] : P[k],
    set: (k, v, final) => {
      if(k.startsWith("o.")) O[k.slice(2)] = v; else P[k] = v;
      if(final){ hist.commit(); if(k === "mode" || k === "o.output" || k === "o.format") controls.refresh(); }
      refresh();
    }
  });

  function apply(){
    const pl = plan(P, W, H);
    const pieces = pl.rects.map((q, i) => ({ ...q, n: pieceNumber(P, pl.rects.length, i) })).sort((a, b) => a.n - b.n);
    close();
    onAccept(pieces, { ...O });
  }
  function close(){ if(closed) return; closed = true; sh.close(); }
  refresh();
  return { close };
}
