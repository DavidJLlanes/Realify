const DEFAULT_URL = "http://127.0.0.1:17834";
const TIMEOUT_MS = 1800;

export async function probeLocalService(base = DEFAULT_URL){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try{
    const res = await fetch(base + "/status", {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { "X-Realify-Client": "web" },
      signal: ctrl.signal
    });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return {
      online: true,
      ready: !!data.ready,
      serviceVersion: data.serviceVersion || "?",
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

export { DEFAULT_URL as LOCAL_AI_URL };
