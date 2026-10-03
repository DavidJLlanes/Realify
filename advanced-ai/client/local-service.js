const DEFAULT_URL = "http://127.0.0.1:17834";
const TIMEOUT_MS = 1800;
const HEADERS = { "X-Realify-Client": "web" };

export async function probeLocalService(base = DEFAULT_URL){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try{
    const res = await fetch(base + "/status", {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: HEADERS,
      signal: ctrl.signal
    });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return {
      online: true,
      ready: !!data.ready,
      serviceVersion: data.serviceVersion || "?",
      phase: data.phase || 1,
      features: Array.isArray(data.features) ? data.features : [],
      torchAvailable: !!data.torchAvailable,
      cuda: !!data.cuda,
      gpu: data.gpu || null,
      vramGB: Number.isFinite(+data.vramGB) ? +data.vramGB : null,
      computeCapability: data.computeCapability || null,
      torch: data.torch || null,
      cudaVersion: data.cudaVersion || null,
      reason: data.reason || null
    };
  }catch(err){
    return {
      online: false,
      ready: false,
      reason: err?.name === "AbortError"
        ? "El servicio local no respondió a tiempo."
        : "Realify AI Local no está disponible."
    };
  }finally{
    clearTimeout(timer);
  }
}

function canvasBlob(canvas){
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo preparar la imagen.")), "image/png");
  });
}

/** source: HTMLCanvasElement o { data:Uint16Array, w, h, channels:3 }. */
async function appendImage(form, source){
  if(source?.data instanceof Uint16Array){
    const bytes = source.data.buffer.slice(
      source.data.byteOffset,
      source.data.byteOffset + source.data.byteLength
    );
    form.append("image", new Blob([bytes], { type:"application/octet-stream" }), "realify-input.rgb16");
    form.append("input_format", "raw16");
    form.append("width", String(source.w));
    form.append("height", String(source.h));
    form.append("channels", String(source.channels || 3));
    return;
  }

  const blob = await canvasBlob(source);
  form.append("image", blob, "realify-input.png");
  form.append("input_format", "png");
  form.append("width", String(source.width || 0));
  form.append("height", String(source.height || 0));
  form.append("channels", "4");
}

async function postJob(path, form, { base = DEFAULT_URL, signal } = {}){
  const res = await fetch(base + path, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: HEADERS,
    body: form,
    signal
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  return data.job;
}

export async function startUpscale(source, { scale = 2, tile = 512, base = DEFAULT_URL, signal } = {}){
  const form = new FormData();
  await appendImage(form, source);
  form.append("scale", String(scale));
  form.append("tile", String(tile));
  return postJob("/jobs/upscale", form, { base, signal });
}

export async function interpretPrompt(prompt, { base = DEFAULT_URL, signal } = {}){
  const res = await fetch(base + "/prompt/adjust", {
    method:"POST",
    mode:"cors",
    cache:"no-store",
    credentials:"omit",
    headers:{ ...HEADERS, "Content-Type":"application/json" },
    body:JSON.stringify({ prompt:String(prompt || "") }),
    signal
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function startRestore(source, { mode = "denoise", tile = 512, base = DEFAULT_URL, signal } = {}){
  if(mode !== "denoise" && mode !== "deblur") throw new Error("Modo de restauración no válido.");
  const form = new FormData();
  await appendImage(form, source);
  form.append("mode", mode);
  form.append("tile", String(tile));
  return postJob("/jobs/restore", form, { base, signal });
}

export async function startSegment(source, { points = [], labels = [], invert = false, base = DEFAULT_URL, signal } = {}){
  const form = new FormData();
  await appendImage(form, source);
  form.append("points_json", JSON.stringify(points));
  form.append("labels_json", JSON.stringify(labels));
  form.append("invert", invert ? "true" : "false");
  return postJob("/jobs/segment", form, { base, signal });
}

export async function fetchMaskResult(jobId, base = DEFAULT_URL){
  const res = await fetch(base + "/jobs/" + encodeURIComponent(jobId) + "/mask", {
    mode:"cors", cache:"no-store", credentials:"omit", headers:HEADERS
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  const w = +(res.headers.get("X-Realify-Width") || 0);
  const h = +(res.headers.get("X-Realify-Height") || 0);
  const dtype = res.headers.get("X-Realify-Dtype") || "";
  const model = res.headers.get("X-Realify-Model") || "";
  if(!w || !h || dtype !== "uint8") throw new Error("Metadatos de máscara no válidos.");
  const buffer = await res.arrayBuffer();
  if(buffer.byteLength !== w * h) throw new Error("El tamaño de la máscara no coincide con sus dimensiones.");
  return { data:new Uint8Array(buffer), w, h, model };
}

export async function getJob(jobId, base = DEFAULT_URL){
  const res = await fetch(base + "/jobs/" + encodeURIComponent(jobId), {
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: HEADERS
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function cancelJob(jobId, base = DEFAULT_URL){
  if(!jobId) return;
  try{
    await fetch(base + "/jobs/" + encodeURIComponent(jobId), {
      method: "DELETE",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: HEADERS
    });
  }catch{}
}

export async function fetchJobResult(jobId, base = DEFAULT_URL){
  const res = await fetch(base + "/jobs/" + encodeURIComponent(jobId) + "/result", {
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: HEADERS
  });
  if(!res.ok) throw new Error(await errorMessage(res));

  const w = +(res.headers.get("X-Realify-Width") || 0);
  const h = +(res.headers.get("X-Realify-Height") || 0);
  const channels = +(res.headers.get("X-Realify-Channels") || 3);
  const dtype = res.headers.get("X-Realify-Dtype") || "";
  const inputPrecision = +(res.headers.get("X-Realify-Input-Precision") || 8);
  const model = res.headers.get("X-Realify-Model") || "";
  const task = res.headers.get("X-Realify-Task") || "";

  if(!w || !h || channels !== 3 || dtype !== "uint16le")
    throw new Error("El motor local devolvió metadatos de imagen no válidos.");

  const buffer = await res.arrayBuffer();
  if(buffer.byteLength !== w * h * channels * 2)
    throw new Error("El tamaño del resultado no coincide con sus dimensiones.");

  return {
    data:new Uint16Array(buffer),
    w, h, channels, inputPrecision, model, task
  };
}

export async function waitForJob(jobId, { onProgress, signal, interval = 350, base = DEFAULT_URL } = {}){
  for(;;){
    if(signal?.aborted){
      await cancelJob(jobId, base);
      const err = new Error("Cancelado");
      err.cancelled = true;
      throw err;
    }

    const job = await getJob(jobId, base);
    onProgress?.(job);

    if(job.status === "completed") return job;
    if(job.status === "failed") throw new Error(job.error || "El procesamiento ha fallado.");
    if(job.status === "cancelled"){
      const err = new Error("Cancelado");
      err.cancelled = true;
      throw err;
    }

    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, interval);
      if(signal) signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(Object.assign(new Error("Cancelado"), { cancelled:true }));
      }, { once:true });
    }).catch(async err => {
      if(err.cancelled) await cancelJob(jobId, base);
      throw err;
    });
  }
}

async function errorMessage(res){
  try{
    const data = await res.json();
    return data.detail || data.error || ("HTTP " + res.status);
  }catch{
    return "HTTP " + res.status;
  }
}

export { DEFAULT_URL as LOCAL_AI_URL };
