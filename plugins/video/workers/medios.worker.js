/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · WORKER DE MEDIOS
   Decodifica y codifica fuera del hilo principal. Un worker lleva a la vez UNA lectura (abrir/fotograma) y UNA codificación. Los fotogramas viajan como ImageBitmap
   transferidos (sin copiar) y se cierran aquí en cuanto se usan. Protocolo: workers/protocolo.js. Un error de una petición se devuelve como respuesta «error» con su id y no mata al worker.
   ═══════════════════════════════════════════════════════════════ */
import { validarPeticion, respuesta } from "./protocolo.js";
import { abrirMedio, crearCodificador } from "../media/importar.js";

let lectura = null, codif = null, cancelado = false;
const enviar = (m, tr = []) => self.postMessage(m, tr);

async function atender(m){
  switch(m.tipo){
    case "abrir": { if(lectura) lectura.lector.cerrar(); lectura = await abrirMedio(m.archivo, { ancho: m.ancho || 0, excluir: ["elemento-video"] }); return enviar(respuesta(m.id, "ok", { medio: lectura.medio, decodificador: lectura.decodificador })); }
    case "fotograma": {
      if(!lectura) throw new Error("No hay ningún vídeo abierto");
      const f = await lectura.lector.fotograma(m.t); if(!f) return enviar(respuesta(m.id, "ok", { vacio: true }));
      const bmp = await createImageBitmap(f.lienzo); return enviar(respuesta(m.id, "fotograma", { t: f.t, imagen: bmp }), [bmp]);
    }
    case "codificar-inicio": { cancelado = false; if(codif) await codif.cancelar(); codif = await crearCodificador(m.config); return enviar(respuesta(m.id, "ok", { codec: codif.codec })); }
    case "codificar-fotograma": { if(!codif) throw new Error("La codificación no está iniciada"); try{ await codif.anadir(m.imagen, m.t, m.duracion); } finally { m.imagen.close(); } return enviar(respuesta(m.id, "ok")); }
    case "codificar-fin": { if(!codif) throw new Error("La codificación no está iniciada"); const c = codif; codif = null; const blob = await c.cerrar(); return enviar(respuesta(m.id, "ok", { blob })); }
    case "cancelar": { cancelado = true; if(codif){ await codif.cancelar(); codif = null; } return enviar(respuesta(m.id, "ok")); }
    case "cerrar": { if(lectura) lectura.lector.cerrar(); lectura = null; if(codif){ await codif.cancelar(); codif = null; } return enviar(respuesta(m.id, "ok")); }
  }
}

self.onmessage = async ({ data: m }) => {
  const e = validarPeticion(m); if(e){ enviar(respuesta(m?.id ?? -1, "error", { mensaje: e })); return; }
  try{ await atender(m); }catch(err){ enviar(respuesta(m.id, "error", { mensaje: err.message || String(err), cancelado })); }
};
