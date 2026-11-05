/* ═══════════════════════════════════════════════════════════════
   AI-KIT · HOST DE INFORMES
   Muestra como diálogo el resultado de una función que sólo informa (avisos, informe de realismo): un resumen y una lista de líneas
   con su nivel (ok / aviso), y si se pide, botones para guardar el informe en JSON o PDF. Es el único sitio que importa `dialog` para esto.
   Entradas: { title, resumen, items: [{ nivel, titulo?, texto }], datos?, nombre? } (datos = objeto del JSON; nombre = base del archivo).
   Salida: promesa que se resuelve al cerrar.
   ═══════════════════════════════════════════════════════════════ */
import { dialog } from "../../ui/kit/dialog.js";
import { escAttr as esc } from "../../core/util/html.js";

const ICONO = { ok: "✓", aviso: "⚠", info: "•" };

export function htmlInforme({ resumen = "", items = [] }){
  return (resumen ? `<p class="hint" style="margin:0 0 10px">${esc(resumen)}</p>` : "") +
    items.map(i => `<div class="metric"><div class="mlabel"><span>${ICONO[i.nivel] || "•"} ${esc(i.titulo || "")}</span></div><p class="mnote" style="${i.nivel === "aviso" ? "color:var(--warn)" : ""}">${esc(i.texto)}</p></div>`).join("");
}

export async function exportarInforme(r, formato){
  const { download } = await import("../../io/export/export.js"), nombre = (r.nombre || "informe") + "-" + new Date().toISOString().slice(0, 10);
  if(formato === "json"){ download(new Blob([JSON.stringify(r.datos || { resumen: r.resumen, items: r.items }, null, 2)], { type: "application/json" }), nombre + ".json"); return; }
  const { loadPdfLib } = await import("../../io/export/pdfpro.js"), L = await loadPdfLib(), pdf = await L.PDFDocument.create(), font = await pdf.embedFont(L.StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]), y = 800;
  const quita = t => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
  const linea = (t, tam = 11) => { for(const l of quita(t).match(/.{1,90}(\s|$)/g) || [""]){ if(y < 50){ page = pdf.addPage([595, 842]); y = 800; } page.drawText(l.trim(), { x: 50, y, size: tam, font }); y -= tam + 5; } };
  linea(r.title || "Informe", 18); y -= 6; if(r.resumen) linea(r.resumen); y -= 6;
  for(const i of r.items) linea((i.nivel === "aviso" ? "[!] " : "[ok] ") + (i.titulo ? i.titulo + ": " : "") + i.texto);
  download(new Blob([await pdf.save()], { type: "application/pdf" }), nombre + ".pdf");
}

export async function openReport(r){
  const exportable = !!r.nombre;
  const botones = [{ label: "Cerrar", value: "cerrar", primary: true }];
  if(exportable) botones.unshift({ label: "PDF", value: "pdf" }, { label: "JSON", value: "json" });
  for(;;){
    const v = await dialog({ title: r.title, wide: true, body: htmlInforme(r), buttons: botones });
    if(v !== "pdf" && v !== "json") return;
    try{ await exportarInforme(r, v); } catch(err){ const { toast } = await import("../../core/toast.js"); toast("No se pudo guardar: " + err.message, "err"); }
  }
}
