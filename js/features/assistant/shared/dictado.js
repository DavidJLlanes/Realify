/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · DICTADO POR VOZ (F14.4)
   Añade al diálogo del asistente un botón 🎤: pulsa para hablar, vuelve a pulsar (o espera 30 s) y Whisper tiny, en este equipo, pone lo dicho en el
   campo de texto. No se envía ni se guarda audio. Entradas: cuerpo del diálogo y valores vivos (values.pedido). Salida: ninguna (modifica el cuerpo).
   Límites: pide permiso de micrófono; sin micro o sin permiso, avisa y el texto sigue funcionando.
   ═══════════════════════════════════════════════════════════════ */
import { toast } from "../../../core/toast.js";

export function anadirDictado(body, values){
  const campo = body.querySelector('input[type="text"]'); if(!campo) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "🎤 Dictar"; b.setAttribute("aria-label", "Dictar con la voz");
  b.style.marginTop = "8px"; campo.closest(".field")?.after(b) || body.appendChild(b);
  let rec = null;
  b.addEventListener("click", async () => {
    if(rec){ rec.parar(); return; }
    try{
      const { grabar, transcribir } = await import("../../../ai/voz.js");
      rec = await grabar(); b.textContent = "⏹ Parar y escribir";
      const muestras = await rec.fin; rec = null; b.textContent = "Entendiendo…"; b.disabled = true;
      const texto = (await transcribir(muestras, "es")).replace(/^[\s.]+|[\s]+$/g, "");
      if(texto){ campo.value = texto; values.pedido = texto; campo.dispatchEvent(new Event("input", { bubbles: true })); }
      else toast("No he oído nada. Prueba otra vez, más cerca del micrófono.", "err");
    } catch(err){ rec = null; if(!(err && err.cancelled)) toast("Dictado: " + (err.name === "NotAllowedError" ? "no hay permiso para usar el micrófono" : err.message || err), "err"); }
    finally{ b.disabled = false; b.textContent = "🎤 Dictar"; }
  });
}
