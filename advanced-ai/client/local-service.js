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

export async function startUpscale(canvas, { scale = 2, tile = 512, base = DEFAULT_URL } = {}){
  const blob = await canvasBlob(canvas);
  const form = new FormData();
  form.append("image", blob, "realify-input.png");
  form.append("scale", String(scale));
  form.append("tile", String(tile));

  const res = await fetch(base + "/jobs/upscale", {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: HEADERS,
    body: form
  });
  if(!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  return data.job;
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
  return res.blob();
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
      if(signal) signal.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("Cancelado"), { cancelled:true })); }, { once:true });
    }).catch(async err => {
      if(err.cancelled) await cancelJob(jobId, base);
      throw err;
    });
  }
}

export async function resultBlobToCanvas(blob){
  const bmp = await createImageBitmap(blob);
  try{
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    return c;
  }finally{
    bmp.close?.();
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
