/* ═══════════════════════════════════════════════════════════════
   IA · VOZ (dictado con Whisper tiny, F14.4)
   Graba del micrófono (sólo mientras se pide), lo pasa a mono 16 kHz, calcula el log-mel en el worker y devuelve el texto. El audio nunca sale del
   equipo ni se guarda. Entradas: duración máxima / muestras. Salidas: grabar() → { parar(), fin: Promise<Float32Array> }, transcribir(muestras, idioma) → texto.
   Límites: 30 s por dictado; el micrófono necesita HTTPS y el permiso del navegador (y «microphone=(self)» en Permissions-Policy).
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "./runtime.js";
import { logMel, SR, NSAMP } from "./engine/mel.js";

/** Empieza a grabar; `parar()` termina y `fin` entrega las muestras mono a 16 kHz. Rechaza si no hay micrófono o se niega el permiso. */
export async function grabar({ maxSeg = 30 } = {}){
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("este navegador no puede usar el micrófono");
  const flujo = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)(), fuente = ctx.createMediaStreamSource(flujo), trozos = [];
  const nodo = ctx.createScriptProcessor(4096, 1, 1);
  nodo.onaudioprocess = e => trozos.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  fuente.connect(nodo); nodo.connect(ctx.destination);
  let acaba; const fin = new Promise(res => { acaba = res; });
  const parar = () => {
    if(ctx.state === "closed") return;
    nodo.disconnect(); fuente.disconnect(); flujo.getTracks().forEach(t => t.stop());
    const n = trozos.reduce((a, t) => a + t.length, 0), todo = new Float32Array(n); let o = 0; for(const t of trozos){ todo.set(t, o); o += t.length; }
    const sr = ctx.sampleRate; ctx.close(); acaba(remuestrear(todo, sr));
  };
  setTimeout(parar, maxSeg * 1000);
  return { parar, fin };
}

/** Interpolación lineal a 16 kHz (la voz no necesita más). */
export function remuestrear(x, sr){
  if(sr === SR) return x;
  const n = Math.floor(x.length * SR / sr), o = new Float32Array(n), k = sr / SR;
  for(let i = 0; i < n; i++){ const p = i * k, a = Math.floor(p), f = p - a; o[i] = x[a] * (1 - f) + (x[Math.min(a + 1, x.length - 1)]) * f; }
  return o;
}

export async function transcribir(muestras, idioma = "es"){
  const mel = logMel(muestras.length > NSAMP ? muestras.subarray(0, NSAMP) : muestras);
  const r = await runModel("whisper", "whisper_dec", { mel, lang: idioma }, [mel.buffer], { title: "Entendiendo lo que dices" });
  return r.text;
}
