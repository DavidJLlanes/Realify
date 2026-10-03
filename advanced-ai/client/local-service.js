const DEFAULT_URL = "http://127.0.0.1:17834";
const FALLBACK_URL = "http://localhost:17834";
const TIMEOUT_MS = 12000;
let ACTIVE_URL = DEFAULT_URL;
const AUTH_HEADERS = { "X-Realify-Client":"web" };

async function loopbackPermissionState(){
  try{
    if(!navigator?.permissions?.query) return "unknown";
    const p = await navigator.permissions.query({ name:"loopback-network" });
    return p?.state || "unknown";
  }catch{
    try{
      const p = await navigator.permissions.query({ name:"local-network" });
      return p?.state || "unknown";
    }catch{
      return "unknown";
    }
  }
}

async function localFetch(url, init = {}){
  return fetch(url, { ...init, targetAddressSpace:"loopback" });
}

export async function probeLocalService(base = null){
  const permission = await loopbackPermissionState();
  const candidates = base ? [base] : [DEFAULT_URL, FALLBACK_URL];
  let lastError = null;

  for(const candidate of candidates){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try{
      const res = await localFetch(candidate + "/status", {
        method:"GET",
        mode:"cors",
        cache:"no-store",
        credentials:"omit",
        signal:ctrl.signal
      });
      if(!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      ACTIVE_URL = candidate;
      return {
        online:true,
        ready:!!data.ready,
        serviceVersion:data.serviceVersion || "?",
        phase:data.phase || 1,
        features:Array.isArray(data.features) ? data.features : [],
        torchAvailable:!!data.torchAvailable,
        cuda:!!data.cuda,
        gpu:data.gpu || null,
        vramGB:Number.isFinite(+data.vramGB) ? +data.vramGB : null,
        computeCapability:data.computeCapability || null,
        torch:data.torch || null,
        cudaVersion:data.cudaVersion || null,
        reason:data.reason || null,
        loopbackPermission:permission,
        baseUrl:candidate
      };
    }catch(err){
      lastError = err;
    }finally{
      clearTimeout(timer);
    }
  }

  return {
    online:false,
    ready:false,
    loopbackPermission:permission,
    reason:lastError?.name === "AbortError"
      ? "El servicio local respondió directamente, pero Realify no ha podido acceder a él desde esta pestaña."
      : permission === "denied"
        ? "El navegador ha bloqueado el acceso de Realify al motor local."
        : "El servicio local está instalado, pero el navegador no permite todavía que realify.es acceda al loopback."
  };
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

async function postJob(path, form, { base = ACTIVE_URL, signal } = {}){
  const res = await localFetch(base + path, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: AUTH_HEADERS,
    body: form,
    signal
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  return data.job;
}

export async function startUpscale(source, { scale = 2, tile = 512, base = ACTIVE_URL, signal } = {}){
  const form = new FormData();
  await appendImage(form, source);
  form.append("scale", String(scale));
  form.append("tile", String(tile));
  return postJob("/jobs/upscale", form, { base, signal });
}

export async function interpretPrompt(prompt, { base = ACTIVE_URL, signal } = {}){
  const res = await localFetch(base + "/prompt/adjust", {
    method:"POST",
    mode:"cors",
    cache:"no-store",
    credentials:"omit",
    headers:{ ...AUTH_HEADERS, "Content-Type":"application/json" },
    body:JSON.stringify({ prompt:String(prompt || "") }),
    signal
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function startRestore(source, { mode = "denoise", tile = 512, base = ACTIVE_URL, signal } = {}){
  if(mode !== "denoise" && mode !== "deblur") throw new Error("Modo de restauración no válido.");
  const form = new FormData();
  await appendImage(form, source);
  form.append("mode", mode);
  form.append("tile", String(tile));
  return postJob("/jobs/restore", form, { base, signal });
}

export async function startSegment(source, { points = [], labels = [], invert = false, base = ACTIVE_URL, signal } = {}){
  const form = new FormData();
  await appendImage(form, source);
  form.append("points_json", JSON.stringify(points));
  form.append("labels_json", JSON.stringify(labels));
  form.append("invert", invert ? "true" : "false");
  return postJob("/jobs/segment", form, { base, signal });
}

export async function fetchMaskResult(jobId, base = ACTIVE_URL){
  const res = await localFetch(base + "/jobs/" + encodeURIComponent(jobId) + "/mask", {
    mode:"cors", cache:"no-store", credentials:"omit", headers:AUTH_HEADERS
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

export async function startGenerativeEdit(source, maskData, {
  prompt, guidance = 30, steps = 50, seed = 0, padding = 128, feather = 8, maxSide = 1024,
  base = ACTIVE_URL, signal
} = {}){
  if(!(maskData?.data instanceof Uint8Array) || !maskData.w || !maskData.h)
    throw new Error("La edición generativa necesita una máscara válida.");
  const form = new FormData();
  await appendImage(form, source);
  const bytes = maskData.data.buffer.slice(maskData.data.byteOffset, maskData.data.byteOffset + maskData.data.byteLength);
  form.append("mask", new Blob([bytes], { type:"application/octet-stream" }), "realify-edit.mask8");
  form.append("prompt", String(prompt || ""));
  form.append("guidance", String(guidance));
  form.append("steps", String(steps));
  form.append("seed", String(seed));
  form.append("padding", String(padding));
  form.append("feather", String(feather));
  form.append("max_side", String(maxSide));
  return postJob("/jobs/generative-edit", form, { base, signal });
}

export async function startAdvancedControl(source, {
  task, prompt, reference = null, negativePrompt = "", steps = 28, guidance = 4,
  seed = 0, identityWeight = 1, identityStart = 2, referenceWeight = .8,
  controlMode = "depth", controlStrength = .6, maxSide = 1024,
  base = ACTIVE_URL, signal
} = {}){
  const form = new FormData();
  await appendImage(form, source);
  if(reference){
    const blob = reference instanceof Blob ? reference : await canvasBlob(reference);
    form.append("reference", blob, "reference.png");
  }
  form.append("task", String(task || ""));
  form.append("prompt", String(prompt || ""));
  form.append("negative_prompt", String(negativePrompt || ""));
  form.append("steps", String(steps));
  form.append("guidance", String(guidance));
  form.append("seed", String(seed));
  form.append("identity_weight", String(identityWeight));
  form.append("identity_start", String(identityStart));
  form.append("reference_weight", String(referenceWeight));
  form.append("control_mode", String(controlMode));
  form.append("control_strength", String(controlStrength));
  form.append("max_side", String(maxSide));
  return postJob("/jobs/advanced-control", form, { base, signal });
}

export async function getJob(jobId, base = ACTIVE_URL){
  const res = await localFetch(base + "/jobs/" + encodeURIComponent(jobId), {
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: AUTH_HEADERS
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function cancelJob(jobId, base = ACTIVE_URL){
  if(!jobId) return;
  try{
    await localFetch(base + "/jobs/" + encodeURIComponent(jobId), {
      method: "DELETE",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      
    });
  }catch{}
}

export async function fetchJobResult(jobId, base = ACTIVE_URL){
  const res = await localFetch(base + "/jobs/" + encodeURIComponent(jobId) + "/result", {
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: AUTH_HEADERS
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

export async function waitForJob(jobId, { onProgress, signal, interval = 350, base = ACTIVE_URL } = {}){
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
