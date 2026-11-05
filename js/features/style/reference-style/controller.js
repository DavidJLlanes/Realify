/* ═══════════════════════════════════════════════════════════════
   ESTILO DESDE UNA FOTO · FLUJO
   Elegir referencia → panel → zonas (IA) → estadísticas → transferencia (o sugerencias) → capa nueva. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { ejecutarEscena } from "../../scene/shared/ejecutar.js";
import { openReport } from "../../ai-kit/report-host.js";
import { toast } from "../../../core/toast.js";
import { estadisticas, transferir, sugerir } from "../engine/transferir.js";
import { elegirArchivo, imagenDe, medirReferencia, zonasDe } from "../shared/referencia.js";
import { panel } from "./ui.js";

const signo = (v, u) => (v > 0 ? "+" : "") + v + u;
function informe(s){
  const mas = (v, a, b) => v > 0 ? a : v < 0 ? b : "igual";
  return { title: "Ajustes sugeridos 👑", resumen: "Valores aproximados para acercar tu foto a la de referencia. Aplícalos con los ajustes de siempre.", items: [
    { nivel: "info", titulo: "Exposición", texto: `${signo(s.exposicion, " EV")} (${mas(s.exposicion, "más clara", "más oscura")})` },
    { nivel: "info", titulo: "Contraste", texto: `${signo(s.contraste, " %")} (${mas(s.contraste, "más contraste", "menos contraste")})` },
    { nivel: "info", titulo: "Calidez", texto: `${signo(s.calidez, "")} (${mas(s.calidez, "más cálida", "más fría")})` },
    { nivel: "info", titulo: "Tinte", texto: `${signo(s.tinte, "")} (${mas(s.tinte, "hacia magenta", "hacia verde")})` },
    { nivel: "info", titulo: "Saturación", texto: `${signo(s.saturacion, " %")} (${mas(s.saturacion, "más color", "menos color")})` }] };
}

export async function ejecutar(){
  const file = await elegirArchivo(); if(!file) return;
  let ref; try{ ref = await imagenDe(file); } catch{ toast("No se pudo leer la foto de referencia", "err"); return; }
  return ejecutarEscena({
    panel: panel(), nombre: "Estilo desde referencia",
    datos: async (src, prep, v) => {
      const stats = await medirReferencia(ref), pesos = await zonasDe(src, prep);
      if(v.modo === "sugerir"){ await openReport(informe(sugerir(estadisticas(prep.planes, pesos), stats))); return { fin: true }; }
      return { stats, pesos };
    },
    motor: (p, c, v) => transferir(p, c.stats, c.pesos, v)
  });
}
