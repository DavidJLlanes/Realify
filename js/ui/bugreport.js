/* ═══════════════════════════════════════════════════════════════
   INFORMAR DE UN ERROR (fase 18)
   Ayuda › Informar de un error…: qué ha pasado, correo opcional (sólo para responderte),
   «Adjuntar diagnóstico» (marcada; con vista previa del texto exacto) y «Adjuntar la imagen» (desmarcada: una copia
   reducida de lo que ves, nunca el archivo original). Se envía a /api/informe (server/informe), que lo reenvía por correo.
   ═══════════════════════════════════════════════════════════════ */
import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { dialog } from "./dialog.js";
import { toast } from "./toast.js";
import { isMobile } from "../core/device.js";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const EMAIL = /^[^\s@<>",;:\\]+@[^\s@<>",;:\\]+\.[A-Za-z]{2,}$/;
const MAX_IMG_B64 = 440 * 1024 * 4 / 3;

/** Texto del diagnóstico que se enviaría: el de Ayuda › Diagnóstico más el estado del documento (sin nombre de archivo). */
export function diagnosticText(){
  const extra = ["Modo: " + (isMobile() ? "móvil" : "escritorio"),
    "Documento: " + (doc.open ? `${doc.w}×${doc.h} px, ${doc.layers.length} capa${doc.layers.length === 1 ? "" : "s"}` : "ninguno abierto")];
  return typeof window.__realifyDiag === "function" ? window.__realifyDiag(extra) : extra.join("\n");
}

/** Copia reducida (JPEG en base64) de lo que se ve; null si no hay imagen o no cabe. */
export function imageSample(){
  if(!doc.open) return null;
  const src = flatten(), k = Math.min(1, 1200 / Math.max(src.width, src.height));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
  for(const q of [.8, .65, .5, .35]){ const b64 = c.toDataURL("image/jpeg", q).split(",")[1]; if(b64.length <= MAX_IMG_B64) return b64; }
  return null;
}

export async function sendReport({ mensaje, correo, diag, imagen, version }){
  const r = await fetch("/api/informe", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensaje, correo, diag, imagen, version, sitio: "" }) });
  if(!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status });
}

export async function openBugReport(){
  const body = document.createElement("div");
  const hasDoc = doc.open;
  body.innerHTML = `
    <p class="hint" style="margin:0 0 6px">Cuéntanos qué ha pasado y qué estabas haciendo. Sólo se envía lo que ves aquí.</p>
    <div class="field" style="align-items:flex-start"><label>Qué ha pasado</label><textarea id="brMsg" class="grow" rows="4" maxlength="4000" placeholder="Por ejemplo: al abrir un PSD de 40 MB la pantalla se queda en blanco"></textarea></div>
    <div class="field"><label>Tu correo</label><input id="brMail" type="email" class="grow" placeholder="opcional, sólo para responderte" autocomplete="email" inputmode="email"></div>
    <label class="chk"><input id="brDiag" type="checkbox" checked> Adjuntar diagnóstico (navegador, versión y errores)</label>
    <details style="margin:2px 0 6px"><summary style="cursor:pointer;font-size:var(--fs-sm)">Ver el diagnóstico que se enviará</summary>
      <textarea id="brDiagText" readonly rows="6" style="width:100%;box-sizing:border-box;font:11px/1.35 ui-monospace,monospace"></textarea></details>
    <label class="chk"><input id="brImg" type="checkbox"${hasDoc ? "" : " disabled"}> Adjuntar una copia reducida de la imagen que ves</label>
    <input id="brTrap" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    <div class="field" style="margin-top:8px"><button type="button" class="primary grow" id="brSend">Enviar informe</button></div>
    <div class="hint" id="brStatus" style="margin:4px 0 0" role="status"></div>`;
  const $ = s => body.querySelector(s);
  $("#brDiagText").value = diagnosticText();
  const status = (t, bad) => { $("#brStatus").textContent = t; $("#brStatus").style.color = bad ? "var(--bad)" : ""; };
  $("#brSend").addEventListener("click", async () => {
    if($("#brTrap").value) return;
    const mensaje = $("#brMsg").value.trim(), correo = $("#brMail").value.trim();
    if(mensaje.length < 5){ status("Escribe qué ha pasado (unas palabras bastan).", true); $("#brMsg").focus(); return; }
    if(correo && !EMAIL.test(correo)){ status("Ese correo no parece válido: corrígelo o déjalo vacío.", true); $("#brMail").focus(); return; }
    const btn = $("#brSend"); btn.disabled = true; status("Enviando…");
    try{
      const imagen = $("#brImg").checked ? imageSample() : null;
      if($("#brImg").checked && !imagen) status("La imagen no cabe: se envía sin ella…");
      await sendReport({ mensaje, correo, diag: $("#brDiag").checked ? $("#brDiagText").value : "", imagen, version: (document.querySelector('script[src*="main.js"]')?.getAttribute("src") || "").replace(/^.*\?v=/, "v") });
      status("Enviado. Gracias por avisar" + (correo ? ": te responderemos a ese correo." : "."));
      toast("Informe enviado", "ok");
      $("#brMsg").disabled = true; btn.textContent = "Enviado ✓";
    }catch(err){
      btn.disabled = false;
      status(err.status === 429 ? "Has enviado varios informes seguidos: prueba más tarde." : "No se pudo enviar (¿sin conexión?). Copia el texto y mándalo por correo.", true);
      if(!body.querySelector("#brCopy")){
        const b = document.createElement("button"); b.type = "button"; b.id = "brCopy"; b.textContent = "Copiar informe";
        b.addEventListener("click", () => navigator.clipboard?.writeText(`${$("#brMsg").value}\n\n${$("#brDiag").checked ? $("#brDiagText").value : ""}`).then(() => toast("Copiado", "ok"), () => toast("No se pudo copiar", "err")));
        $("#brSend").parentElement.appendChild(b);
      }
    }
  });
  await dialog({ title: "Informar de un error", body, wide: true, cls: isMobile() ? "dlg-compact" : "", buttons: [{ label: "Cerrar", primary: false, value: null }] });
}
