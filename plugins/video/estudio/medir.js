/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · ESTUDIO DE VIABILIDAD (F15.1) · MEDIDOR DE WEBCODECS
   Página autónoma (no importa nada de Realify): mide en ESTE dispositivo qué códecs de vídeo puede codificar y decodificar, y cuánto tardan
   por fotograma a 720p, 1080p y 4K (con aceleración por hardware y por software), más la memoria de JavaScript usada si el navegador la da.
   Entradas: ninguna (botón «Medir»). Salidas: tabla en pantalla y JSON copiable; window.__medicion = { dispositivo, filas }.
   Límites: usa fotogramas sintéticos (no vídeo real) y 30 fotogramas por prueba; mide el códec, no los efectos de Realify.
   ═══════════════════════════════════════════════════════════════ */
const CODECS = [["h264", "avc1.640028"], ["vp9", "vp09.00.10.08"], ["av1", "av01.0.04M.08"]];
const TAMANOS = [["720p", 1280, 720], ["1080p", 1920, 1080], ["4K", 3840, 2160]];
const FRAMES = 30, HW = ["prefer-hardware", "prefer-software"];
const heap = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);

function lienzo(w, h){ return typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); }
function pintar(c, i){
  const x = c.getContext("2d"), w = c.width, h = c.height, g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${(i * 9) % 360},60%,45%)`); g.addColorStop(1, `hsl(${(i * 9 + 120) % 360},50%,30%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = "#fff"; for(let k = 0; k < 40; k++) x.fillRect(((k * 97 + i * 31) % w), ((k * 53 + i * 17) % h), w / 40, h / 40);
}

async function fila(nombre, codec, tn, w, h, hw){
  const f = { codec: nombre, tamano: tn, aceleracion: hw.replace("prefer-", ""), codifica: false, decodifica: false };
  const cfg = { codec, width: w, height: h, bitrate: w * h * 3, framerate: 30, hardwareAcceleration: hw };
  try{ f.codifica = !!(await VideoEncoder.isConfigSupported(cfg)).supported; }catch{}
  try{ f.decodifica = !!(await VideoDecoder.isConfigSupported({ codec, codedWidth: w, codedHeight: h, hardwareAcceleration: hw })).supported; }catch{}
  if(!f.codifica) return f;
  const trozos = []; let descripcion = null, error = null; const h0 = heap(); let pico = h0 || 0;
  try{
    const enc = new VideoEncoder({ output: (c, m) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); trozos.push({ d, tipo: c.type, ts: c.timestamp }); if(m?.decoderConfig?.description) descripcion = m.decoderConfig.description; }, error: e => { error = e.message; } });
    enc.configure(cfg); const cv = lienzo(w, h), t0 = performance.now();
    for(let i = 0; i < FRAMES && !error; i++){
      pintar(cv, i); const fr = new VideoFrame(cv, { timestamp: i * 33333 }); enc.encode(fr, { keyFrame: i === 0 }); fr.close();
      if(enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 0));
      pico = Math.max(pico, heap() || 0);
    }
    await enc.flush(); f.codificar_ms_fotograma = +((performance.now() - t0) / FRAMES).toFixed(1); enc.close();
    f.kb_por_fotograma = +(trozos.reduce((s, t) => s + t.d.length, 0) / FRAMES / 1024).toFixed(1);
  }catch(e){ error = e.message; }
  if(error){ f.error = error; return f; }
  if(f.decodifica && trozos.length){
    try{
      let n = 0, err2 = null; const dec = new VideoDecoder({ output: fr => { n++; fr.close(); }, error: e => { err2 = e.message; } });
      dec.configure({ codec, codedWidth: w, codedHeight: h, hardwareAcceleration: hw, ...(descripcion ? { description: descripcion } : {}) });
      const t1 = performance.now(); for(const t of trozos) dec.decode(new EncodedVideoChunk({ type: t.tipo, timestamp: t.ts, data: t.d }));
      await dec.flush(); f.decodificar_ms_fotograma = +((performance.now() - t1) / Math.max(1, n)).toFixed(1); f.fotogramas_decodificados = n; dec.close(); if(err2) f.error = err2;
    }catch(e){ f.error = e.message; }
  }
  f.heap_mb_pico = pico || null; return f;
}

export async function medir(alProgreso = () => {}){
  if(typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return { dispositivo: dispositivo(), filas: [], sinWebCodecs: true };
  const filas = []; let n = 0; const total = CODECS.length * TAMANOS.length * HW.length;
  for(const [tn, w, h] of TAMANOS) for(const [nombre, codec] of CODECS) for(const hw of HW){ alProgreso(++n, total, `${nombre} ${tn} ${hw}`); filas.push(await fila(nombre, codec, tn, w, h, hw)); }
  return { dispositivo: dispositivo(), filas };
}

function dispositivo(){
  return { agente: navigator.userAgent, nucleos: navigator.hardwareConcurrency || null, memoria_gb: navigator.deviceMemory || null, pantalla: `${screen.width}x${screen.height}@${devicePixelRatio}`, webgpu: !!navigator.gpu, fecha: new Date().toISOString() };
}

if(typeof document !== "undefined" && document.getElementById("medir")){
  const b = document.getElementById("medir"), out = document.getElementById("salida"), est = document.getElementById("estado");
  b.addEventListener("click", async () => {
    b.disabled = true; const r = await medir((n, t, txt) => { est.textContent = `Midiendo ${n}/${t}: ${txt}…`; });
    window.__medicion = r; est.textContent = r.sinWebCodecs ? "Este navegador no tiene WebCodecs." : "Listo. Copia el texto de abajo y envíaselo a Claude.";
    out.textContent = JSON.stringify(r, null, 1); b.disabled = false;
  });
  window.__medir = medir;
}
