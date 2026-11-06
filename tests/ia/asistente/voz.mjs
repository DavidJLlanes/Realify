/* ═════════════════════════════════════════════════
   PRUEBA · voz con Whisper tiny (F14.4; decodificador remoto simulado con tu archivo)
   Transcribe una frase sintética en inglés (ffmpeg + flite) por js/ai/voz.js y comprueba que salen palabras clave. Uso: node tests/ia/asistente/voz.mjs
   (se salta si falta ffmpeg con flite o el decodificador de Whisper)
   ═════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { abrir } from "../lib/navegador.mjs";
import { servirRemotos, aceptarDescargas } from "../lib/remotos.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const sv = await servirRemotos(); if (!sv.ids.includes("whisper_dec")) { console.log("SALTADA: falta el decodificador de Whisper"); process.exit(0); }
let pcm; try { pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "flite=text='make the photo warmer and add more contrast':voice=slt", "-ar", "16000", "-ac", "1", "-f", "f32le", "-"], { maxBuffer: 1e8 }); }
catch { console.log("SALTADA: ffmpeg sin flite"); process.exit(0); }
const m = await abrir("escritorio", { args: sv.args }); aceptarDescargas(m.page);
const r = await m.page.evaluate(async b64 => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const { transcribir } = await import("/js/ai/voz.js"); return transcribir(new Float32Array(u.buffer), "en");
}, pcm.toString("base64")).catch(e => ({ err: String(e) }));
console.log(JSON.stringify(r));
if (r.err) ok(false, r.err); else ok(/photo/i.test(r) && /(warm|contrast)/i.test(r), "no reconoce la frase: " + r);
ok(m.errs.length === 0, "errores: " + m.errs.join("; "));
await m.cerrar(); sv.cerrar(); console.log(fallos ? `${fallos} FALLOS` : "OK"); process.exit(fallos ? 1 : 0);
