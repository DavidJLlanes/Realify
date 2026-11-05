/* ═══════════════════════════════════════════════════════════════
   IA · WORKER · MENSAJES
   Envía mensajes desde el worker al hilo de la interfaz (con objetos transferibles).
   Entradas: el mensaje y la lista de buffers a transferir. Salida: ninguna.
   ═══════════════════════════════════════════════════════════════ */

export function post(msg, transfer){ self.postMessage(msg, transfer || []); }
