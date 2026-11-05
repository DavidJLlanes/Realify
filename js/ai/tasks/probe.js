/* ═══════════════════════════════════════════════════════════════
   IA · TAREA · SONDA
   Comprueba que un modelo arranca y con qué backend, sin procesar ninguna imagen.
   Entradas: modelo e id. Salida: confirmación.
   ═══════════════════════════════════════════════════════════════ */

import { getSession } from "../engine/sessions.js";

export async function probe({ model, id }){
  const { session, backend } = await getSession(id, model);
  return { backend, inputs: session.inputMetadata || session.inputNames,
           outputs: session.outputMetadata || session.outputNames };
}
