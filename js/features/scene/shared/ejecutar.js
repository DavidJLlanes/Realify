/* ═══════════════════════════════════════════════════════════════
   ESCENA · FLUJO COMÚN DE LAS FUNCIONES SIMPLES
   Imagen visible → panel simple (ai-kit/simple-host.js) → datos que pide la función (máscara, profundidad…) → copia de trabajo en luz lineal →
   motor (puro) → resultado en una capa nueva con «mezcla». Cada función sólo declara su panel, qué datos necesita y su motor; así el flujo no
   se copia. `lado()` (opcional) da el lado largo de trabajo; los patrones finos (moiré) piden la resolución completa. `datos(src, prep, valores)` devuelve el contexto del motor o { aviso } si no hay nada que hacer.
   Entradas: { panel, nombre, datos, motor }. Salida: promesa.
   ═══════════════════════════════════════════════════════════════ */
import { visibleImage } from "../../ai-kit/visible-image.js";
import { openSimple } from "../../ai-kit/simple-host.js";
import { toNewLayer } from "../../ai-kit/new-layer.js";
import { aiSession } from "../../ai-kit/session.js";
import { WORK } from "../../ai-kit/preview.js";
import { toast } from "../../../core/toast.js";
import { trabajar, aLienzo } from "./trabajo.js";

export async function ejecutarEscena({ panel, nombre, datos = null, motor, lado = WORK }){
  const src = await visibleImage(); if(!src) return;
  const r = await openSimple(panel); if(!r.ok) return;
  try{
    const prep = trabajar(src, lado());
    const ctx = datos ? await datos(src, prep, r.values) : {};
    if(ctx && ctx.fin) return;                       // la función ya hizo lo suyo (p. ej. mostrar un informe): nada más que hacer
    if(ctx && ctx.aviso){ toast(ctx.aviso, "err"); return; }
    await aiSession(nombre, async () => { await motor(prep.planes, ctx || {}, r.values); }, { unit: "paso" });
    await toNewLayer(aLienzo(prep, src), nombre);
  } catch(err){ if(!err.cancelled) toast("No se pudo completar: " + (err.message || err), "err"); }
}

/** Mapa de profundidad (1 = cerca) a la escala de trabajo, ajustado a los bordes de la foto */
export async function profundidadTrabajo(src, prep){
  const { depthMap, depthAt } = await import("../../../ai/depth.js");
  return depthAt(await depthMap(src), prep.W, prep.H, prep.rgba);
}
