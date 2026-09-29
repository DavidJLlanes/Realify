/* ═══════════════════════════════════════════════════════════════
   FORMAS · ENTRADA
   Recorta la CAPA ACTIVA (o, sin documento, una foto que se elige) con
   una forma:
     · «Capa nueva»: crea encima una capa con sólo la forma visible y
       transparencia fuera, y oculta TODAS las demás capas —también la
       de origen— para que lo que se vea, y lo que se guarde en PNG,
       WebP o AVIF, sea la forma sobre transparente. Todo es un único
       paso de deshacer. Al aplicar, un aviso lo explica y ofrece
       exportar directamente.
     · «Pestaña nueva»: la forma recortada a su caja, en otro documento.
   Las demás capas no se modifican nunca, sólo se ocultan.
   ═══════════════════════════════════════════════════════════════ */

import { ensureShellStyles, pickFiles, decodePhoto, resultToLayer } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

export async function openShapes(given = null){
  await ensureShellStyles();
  const [{ openShapeEditor }, { doc, activeLayer }, { flatten }] = await Promise.all([
    import("./ui.js"), import("../js/core/doc.js"), import("../js/editor/layertree.js")]);
  let source, fromDoc = doc.open, name = doc.name || "Imagen", srcLayer = null;
  if(fromDoc){
    srcLayer = activeLayer();
    if(!srcLayer){ toast("Elige en Capas la capa que quieres recortar", "err"); return; }
    if(srcLayer.type === "adjust"){ toast("La capa activa es de ajuste y no tiene imagen: elige en Capas una capa con imagen", "err"); return; }
    // Sólo la capa activa (con su máscara y sus estilos; si es un grupo,
    // con lo que contiene), aunque estuviera oculta.
    const kids = [];
    const collect = id => { for(const l of doc.layers.filter(x => x.groupId === id)){ kids.push(l); if(l.type === "group") collect(l.id); } };
    if(srcLayer.type === "group") collect(srcLayer.id);
    source = flatten(null, [srcLayer, ...kids].map(l => ({ ...l, visible: true })), doc.w, doc.h);
    name = srcLayer.name || name;
  }
  else {
    const [file] = given ? [given] : await pickFiles({ multiple: false });
    if(!file) return;
    try{ source = await decodePhoto(file, 8192); }catch(err){ toast(err.message, "err"); return; }
    name = file.name.replace(/\.[^.]+$/, "");
  }
  openShapeEditor({
    source, canLayer: fromDoc,
    onAccept: async (canvas, { output, bounds, name: shapeName, transparent }) => {
      if(output === "layer"){
        await shapeToLayer(canvas, `Forma · ${shapeName}`, srcLayer);
        notice(shapeName, transparent);
        return;
      }
      const c = document.createElement("canvas"); c.width = bounds.w; c.height = bounds.h;
      c.getContext("2d").drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
      await resultToLayer(c, { name: `Forma · ${shapeName}`, docName: `${name} · ${shapeName}`, newDocument: true });
      toast(`Recorte en forma de ${shapeName.toLowerCase()} en una pestaña nueva · ${c.width} × ${c.height}`, "ok");
    }
  });
}

/* Capa nueva sobre la de origen y el resto oculto, en un solo paso. */
async function shapeToLayer(canvas, layerName, srcLayer){
  const [{ doc, addLayer, layerIndex }, { record }, { emit }] = await Promise.all([
    import("../js/core/doc.js"), import("../js/core/history.js"), import("../js/core/bus.js")]);
  const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
  const prevVisible = prevLayers.map(l => [l, l.visible]);
  // Encima de la capa de origen (dentro de su mismo grupo, si lo tiene).
  const at = srcLayer ? layerIndex(srcLayer.id) + 1 : undefined;
  const l = addLayer({ name: layerName, above: at });
  if(srcLayer && srcLayer.type !== "group") l.groupId = srcLayer.groupId ?? null;
  l.ctx.drawImage(canvas, 0, 0, doc.w, doc.h);
  l.thumbDirty = true;
  // Todo lo demás, oculto: los grupos que contienen la capa nueva se
  // quedan visibles (si no, la ocultarían también).
  const keep = new Set([l.id]);
  for(let g = l.groupId; g != null; g = doc.layers.find(x => x.id === g)?.groupId) keep.add(g);
  for(const x of doc.layers) if(!keep.has(x.id)) x.visible = false;
  const nextLayers = doc.layers.slice(), nextActive = l.id;
  const nextVisible = nextLayers.map(x => [x, x.visible]);
  const put = (layers, active, vis) => {
    for(const [x, v] of vis) x.visible = v;
    doc.layers = layers.slice(); doc.activeId = active;
    emit("doc:structure"); emit("doc:change");
  };
  record(layerName, () => put(prevLayers, prevActive, prevVisible), () => put(nextLayers, nextActive, nextVisible));
  emit("doc:structure"); emit("doc:change");
}

/* Aviso después de aplicar: qué ha pasado y cómo guardarlo. */
async function notice(shapeName, transparent){
  const { dialog } = await import("../js/ui/dialog.js");
  const v = await dialog({
    title: "Recorte con forma aplicado",
    body: `<p class="hint" style="margin:0 0 8px">Se ha creado la capa <b>«Forma · ${shapeName}»</b> con sólo la forma visible${transparent ? " y transparencia alrededor" : ""}, y se han <b>ocultado todas las demás capas</b> (no se borran ni se modifican).</p>
      ${transparent ? `<p class="hint" style="margin:0 0 8px">Para guardarla con la transparencia, exporta en <b>PNG, WebP o AVIF</b>. JPEG y PDF no admiten transparencia: las zonas transparentes se rellenarían con un color.</p>` : ""}
      <p class="hint" style="margin:0">Para volver a ver las demás capas, actívalas con su ojo en el panel Capas, o deshaz (Ctrl+Z).</p>`,
    buttons: [{ label: "Entendido", value: "ok" }, { label: transparent ? "Exportar con transparencia…" : "Exportar…", primary: true, value: "export" }],
    cls: "dlg-stack"
  });
  if(v === "export"){ const { run } = await import("../js/ui/commands.js"); run("file.export"); }
}
