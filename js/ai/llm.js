/* ═══════════════════════════════════════════════════════════════
   IA · MODELO DE LENGUAJE (cliente)
   Pide al worker una respuesta de Qwen2.5 1,5B. Antes comprueba que el equipo puede: hace falta WebGPU y memoria suficiente (el modelo ocupa ~1,2 GB +
   la caché de atención). Entradas: mensajes [{ role, content }]. Salida: texto. Si el equipo no puede, lanza un error claro y el asistente usa sus reglas.
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "./runtime.js";
import { rellenoLigero } from "./relleno.js";

export function puedeLLM(){
  if(!navigator.gpu) return { ok: false, motivo: "este navegador no tiene WebGPU" };
  if(rellenoLigero()) return { ok: false, motivo: "este dispositivo tiene poca memoria para un modelo de 1,2 GB" };
  return { ok: true };
}

export async function preguntar(mensajes, maxTokens = 300){
  const c = puedeLLM(); if(!c.ok) throw new Error(c.motivo);
  return (await runModel("llm", "qwen15", { id: "qwen15", mensajes, maxTokens }, [], { title: "Pensando con IA" })).text;
}
