/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · CLIENTE DEL WORKER DE MEDIOS (hilo principal)
   Envuelve el worker en una API de promesas: abrir(file), fotograma(t) → ImageBitmap (quien lo recibe lo cierra), y la codificación (iniciar, anadir, terminar → Blob).
   Cada petición lleva un id; si el worker muere, todas las pendientes se rechazan. cerrar() libera el worker. Entradas: ninguna (el worker se crea al construir).
   ═══════════════════════════════════════════════════════════════ */
import { peticion } from "./protocolo.js";

export function crearTrabajador(){
  const w = new Worker(new URL("./medios.worker.js", import.meta.url), { type: "module" }), pend = new Map(); let n = 0, muerto = null;
  const fallar = e => { muerto = e; for(const p of pend.values()) p.no(e); pend.clear(); };
  w.onmessage = ({ data: m }) => { const p = pend.get(m.id); if(!p) return; pend.delete(m.id); m.tipo === "error" ? p.no(Object.assign(new Error(m.mensaje), { cancelado: !!m.cancelado })) : p.ok(m); };
  w.onerror = ev => fallar(new Error("El proceso de vídeo se detuvo: " + (ev.message || "error desconocido")));
  const pedir = (tipo, datos, tr = []) => new Promise((ok, no) => { if(muerto) return no(muerto); const id = ++n; pend.set(id, { ok, no }); w.postMessage(peticion(id, tipo, datos), tr); });
  return {
    abrir: (archivo, ancho = 0) => pedir("abrir", { archivo, ancho }),
    async fotograma(t){ const r = await pedir("fotograma", { t }); return r.vacio ? null : { imagen: r.imagen, t: r.t }; },
    iniciarCodificacion: config => pedir("codificar-inicio", { config }),
    anadir: (imagen, t, duracion) => pedir("codificar-fotograma", { imagen, t, duracion }, [imagen]),
    async terminar(){ return (await pedir("codificar-fin", {})).blob; },
    cancelar: () => pedir("cancelar", {}),
    async cerrar(){ try{ await pedir("cerrar", {}); }catch{} w.terminate(); }
  };
}
