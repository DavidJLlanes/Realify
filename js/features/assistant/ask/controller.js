/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · FLUJO
   Orden en español → plan (intérprete de reglas o Qwen local con WebGPU, F14.1) → validación contra el esquema → confirmación → aplicar.
   El plan nunca ejecuta código: sólo herramientas de la lista cerrada. Entradas: ninguna. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { confirmarPlan } from "../../ai-kit/plan-host.js";
import { toast } from "../../../core/toast.js";
import { construirEsquema } from "../engine/esquema.js";
import { interpretar } from "../engine/interprete.js";
import { validarPlan, describirPaso } from "../engine/validar.js";
import { aplicarPasos } from "../shared/aplicar.js";
import { anadirDictado } from "../shared/dictado.js";
import { PARAMS } from "./params.js";

export async function ejecutar(){
  const src = await visibleImage(); if(!src) return;
  const r = await openSimple({ title: "Asistente 👑", subtitle: "Ej.: «más luminosa y con contraste», «quita la neblina», «en blanco y negro».", params: PARAMS, applyLabel: "Ver el plan", extra: anadirDictado });
  if(!r.ok) return;
  const { MANIFESTS } = await import("../../../ui/menu/ia/manifests.js"), esquema = construirEsquema(MANIFESTS), pedido = String(r.values.pedido || "").trim();
  let plan = null;
  if(r.values.motor === "qwen"){
    const { puedeLLM, preguntar } = await import("../../../ai/llm.js"), puede = puedeLLM();
    if(!puede.ok) await (await import("../../ai-kit/aviso-host.js")).avisoSoloOrdenador({ texto: `La IA «Qwen» sólo funciona en un ordenador con WebGPU y memoria suficiente: ${puede.motivo}. Se usarán las reglas del asistente, que funcionan en cualquier dispositivo.` });
    else try{
      const { construirMensajes, leerPlan } = await import("../engine/prompt.js");
      plan = leerPlan(await preguntar(construirMensajes(esquema, pedido)));
      if(!plan) toast("La IA no devolvió un plan válido; uso las reglas.", "err");
      else plan.sinEntender = [];
    } catch(err){ if(err && err.cancelled) return; toast("Qwen: " + (err.message || err) + ". Uso las reglas.", "err"); }
  }
  if(!plan) plan = interpretar(pedido);
  const v = validarPlan(plan, esquema);
  if(!v.pasos.length){ toast(plan.sinEntender.length ? `No he entendido «${plan.sinEntender[0]}». Prueba con «más cálida», «más contraste» o «en blanco y negro».` : "Escribe qué quieres hacer con la foto.", "err"); return; }
  const avisos = [...v.ajustes, ...v.rechazados.map(x => `${x.texto}: ${x.motivo}`), ...plan.sinEntender.map(x => `No he entendido «${x}»`)];
  if(!await confirmarPlan({ pedido, lineas: v.pasos.map(p => describirPaso(p, esquema)), avisos })) return;
  const { hechos, fallos } = await aplicarPasos(v.pasos, esquema);
  toast(fallos.length ? `Hechos ${hechos} de ${v.pasos.length}. ${fallos[0]}` : `Listo: ${hechos} paso(s) aplicados`, fallos.length ? "err" : "ok");
}
