/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · EXPORTAR
   Renderiza el proyecto completo a la resolución de salida (ajustada al máximo del dispositivo) con un motor propio, lo codifica a MP4 o WebM y devuelve el Blob. Informa del progreso y se cancela.
   Entradas: { proyecto, movil, contenedor, motorDe(proyecto, ancho)→motor, alProgreso(n,total), senal }. Salida: { blob, nombre, ancho, alto, codec }. Lanza Error con mensaje claro si no se puede.
   ═══════════════════════════════════════════════════════════════ */
import { duracionProyecto } from "../project/modelo.js";
import { comprobarExportacion, salidaAjustada } from "../render/limites.js";
import { renderizar } from "../render/aplicar.js";
import { crearCodificador } from "../media/importar.js";

export async function exportarProyecto({ proyecto, movil, contenedor = "mp4", motorDe, alProgreso, senal }){
  const c = comprobarExportacion(proyecto, movil); if(!c.ok) throw new Error(c.motivo);
  const { ancho, alto } = salidaAjustada(proyecto.salida), fps = proyecto.salida.fps;
  const codificador = await crearCodificador({ ancho, alto, fps, contenedor }), motor = motorDe(proyecto, ancho);
  try{
    const blob = await renderizar({ motor, codificador, ancho, alto, fps, desde: 0, hasta: duracionProyecto(proyecto), alProgreso, senal });
    return { blob, ancho, alto, codec: codificador.codec, nombre: `${(proyecto.nombre || "video").replace(/[^\w\- ]+/g, "").trim() || "video"}.${contenedor}` };
  }finally{ await motor.cerrar(); }
}
