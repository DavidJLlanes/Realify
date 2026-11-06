/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · EXPORTAR
   Renderiza el proyecto completo a la resolución de salida (ajustada al máximo del dispositivo) con un motor propio, mezcla el sonido en trozos de 10 s y lo codifica a MP4 o WebM.
   Informa del progreso y se cancela. Entradas: { proyecto, movil, contenedor, bitrate, audioBitrate, sonido (sí/no), motorDe(proyecto, ancho)→motor, lectorDe(idMedio), alProgreso(n,total), senal }.
   Salida: { blob, nombre, ancho, alto, codec, codecAudio }. Lanza Error con mensaje claro si no se puede.
   ═══════════════════════════════════════════════════════════════ */
import { duracionProyecto } from "../project/modelo.js";
import { comprobarExportacion, salidaAjustada } from "../render/limites.js";
import { renderizar } from "../render/aplicar.js";
import { crearCodificador } from "../media/importar.js";
import { hayAudio } from "../audio/mezcla.js";
import { mezclarVentana } from "../audio/mezclador.js";

const TROZO = 10, TASA = 48000;

export async function exportarProyecto({ proyecto, movil, contenedor = "mp4", bitrate = null, audioBitrate = 128000, sonido = true, motorDe, lectorDe, alProgreso, senal }){
  const c = comprobarExportacion(proyecto, movil); if(!c.ok) throw new Error(c.motivo);
  const { ancho, alto } = salidaAjustada(proyecto.salida), fps = proyecto.salida.fps, dur = duracionProyecto(proyecto), conSonido = sonido && hayAudio(proyecto);
  const cod = await crearCodificador({ ancho, alto, fps, contenedor, bitrate, audio: conSonido, audioBitrate }), motor = motorDe(proyecto, ancho);
  const codificador = { ...cod, cerrar: async () => {   // el sonido se añade justo antes de cerrar, en trozos, para no tener toda la mezcla en memoria
    if(conSonido) for(let t = 0; t < dur; t += TROZO){ if(senal?.aborted) throw Object.assign(new Error("Exportación cancelada"), { cancelado: true }); const m = await mezclarVentana({ proyecto, lectorDe, desde: t, hasta: Math.min(dur, t + TROZO), tasa: TASA }); await cod.anadirAudio(m.canales, m.tasa); }
    return cod.cerrar();
  } };
  try{
    const blob = await renderizar({ motor, codificador, ancho, alto, fps, desde: 0, hasta: dur, alProgreso, senal });
    return { blob, ancho, alto, codec: cod.codec, codecAudio: cod.codecAudio, nombre: `${(proyecto.nombre || "video").replace(/[^\w\- ]+/g, "").trim() || "video"}.${contenedor}` };
  }finally{ await motor.cerrar(); }
}
