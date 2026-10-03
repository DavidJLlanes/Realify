import { createShell, resultToLayer } from "../../js/ui/fsshell.js";
import { toast } from "../../js/ui/toast.js";
import { docSizeLimit } from "../../js/core/device.js";
import {
  probeLocalService, startUpscale, waitForJob, fetchJobResult,
  resultBlobToCanvas, cancelJob
} from "../client/local-service.js";

const CONTROLS = [
  ["Exposición", "-2", "2", "0", "0.01"],
  ["Contraste", "-100", "100", "0", "1"],
  ["Altas luces", "-100", "100", "0", "1"],
  ["Sombras", "-100", "100", "0", "1"],
  ["Blancos", "-100", "100", "0", "1"],
  ["Negros", "-100", "100", "0", "1"],
  ["Temperatura", "-100", "100", "0", "1"],
  ["Matiz", "-100", "100", "0", "1"],
  ["Saturación", "-100", "100", "0", "1"],
  ["Vibrancia", "-100", "100", "0", "1"],
  ["Claridad", "-100", "100", "0", "1"],
  ["Textura", "-100", "100", "0", "1"],
  ["Borrar neblina", "-100", "100", "0", "1"],
  ["Enfoque", "0", "100", "0", "1"],
  ["Reducción de ruido IA", "0", "100", "0", "1"]
];

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function controlsMarkup(){
  return CONTROLS.map(function(c){
    return '<label class="aai-control is-future"><span>' + esc(c[0]) + ' <b>' + c[3] +
      '</b></span><input type="range" min="' + c[1] + '" max="' + c[2] +
      '" step="' + c[4] + '" value="' + c[3] + '" disabled></label>';
  }).join("");
}

function statusMarkup(s){
  if(!s){
    return '<div class="aai-status checking"><i></i><div><b>Comprobando motor local…</b><span>Buscando Realify AI Local en este equipo.</span></div></div>';
  }
  if(!s.online){
    return '<div class="aai-status offline"><i></i><div><b>Motor local no detectado</b><span>' +
      esc(s.reason || "Realify AI Local no está disponible.") + '</span></div></div>';
  }
  if(!s.ready){
    return '<div class="aai-status warn"><i></i><div><b>Motor encontrado, GPU no preparada</b><span>' +
      esc(s.reason || "CUDA no está disponible.") + '</span></div></div>';
  }
  var gpu = esc(s.gpu || "GPU NVIDIA");
  var vram = s.vramGB == null ? "" : " · " + esc(s.vramGB) + " GB VRAM";
  var cuda = s.cudaVersion ? "CUDA " + esc(s.cudaVersion) : "CUDA";
  var torch = s.torch ? " · PyTorch " + esc(s.torch) : "";
  return '<div class="aai-status ready"><i></i><div><b>' + gpu + vram +
    '</b><span>' + cuda + torch + ' · motor listo</span></div></div>';
}

function scaledForOutput(source, scale){
  const wantedW = source.width * scale, wantedH = source.height * scale;
  const lim = docSizeLimit(wantedW, wantedH, { highQuality:true });
  if(lim[0] === wantedW && lim[1] === wantedH) return { canvas:source, limited:false };
  const inputW = Math.max(8, Math.floor(lim[0] / scale));
  const inputH = Math.max(8, Math.floor(lim[1] / scale));
  const c = document.createElement("canvas");
  c.width = inputW; c.height = inputH;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(source, 0, 0, inputW, inputH);
  return { canvas:c, limited:true };
}

export function openAdvancedAIEditor(opts){
  var source = opts.source, name = opts.name, width = opts.width, height = opts.height;
  var shell, status = null, activeJob = null, aborter = null;
  var resultCanvas = null, resultScale = 2, closed = false;

  async function close(){
    if(closed) return;
    closed = true;
    aborter?.abort();
    if(activeJob) await cancelJob(activeJob);
    shell?.close();
  }

  async function applyResult(){
    if(!resultCanvas) return;
    shell.setBusy("Aplicando resultado…");
    try{
      await resultToLayer(resultCanvas, {
        name: "Ampliada ×" + resultScale + " · Real-ESRGAN",
        docName: name + " ×" + resultScale,
        newDocument: true
      });
      toast("Upscale ×" + resultScale + " aplicado", "ok");
      await close();
    }catch(err){
      shell.setBusy("");
      toast("No se pudo aplicar el resultado: " + err.message, "err");
    }
  }

  shell = createShell({
    title: "IA avanzada",
    subtitle: name + " · " + width + " × " + height + " · Fase 2",
    applyLabel: "Aplicar",
    cls: "aai-shell",
    onApply: applyResult,
    onCancel: close
  });

  shell.setApplyEnabled(false);
  shell.setView(source, false);
  shell.setOriginal(source);

  shell.left.innerHTML =
    '<div class="aai-panel-head"><b>Ajustes fotográficos</b>' +
    '<span>Los ajustes clásicos se activarán en las siguientes fases. Upscale IA ya usa CUDA local.</span></div>' +
    '<div class="aai-controls">' + controlsMarkup() + '</div>' +
    '<section class="aai-upscale">' +
      '<div class="aai-panel-head"><b>Upscale IA</b><span>Real-ESRGAN · CUDA · resultado en pestaña nueva.</span></div>' +
      '<label><span>Escala</span><select data-upscale-scale><option value="2">×2 · alta calidad</option><option value="4">×4 · máxima ampliación</option></select></label>' +
      '<button type="button" data-upscale-run disabled>Procesar con GPU</button>' +
      '<button type="button" data-upscale-cancel disabled>Cancelar proceso</button>' +
      '<div class="aai-progress" hidden><div><i></i></div><span>Preparando…</span></div>' +
    '</section>';

  shell.right.innerHTML =
    '<section class="aai-engine"><div class="aai-panel-head"><b>Motor IA local</b><span>CUDA/PyTorch en este PC.</span></div>' +
    '<div data-engine-status>' + statusMarkup(null) + '</div>' +
    '<button type="button" class="aai-retry">Volver a comprobar</button></section>' +
    '<section class="aai-prompt"><div class="aai-panel-head"><b>Prompt</b>' +
    '<span>Edición generativa se activará en las fases posteriores.</span></div>' +
    '<textarea rows="6" placeholder="Ej.: cambia el pelo a rubio, pon una montaña de fondo, añade una cabra a mi lado…"></textarea>' +
    '<div class="aai-prompt-actions"><button type="button" disabled>Generar</button><span>Fase 6</span></div></section>' +
    '<section class="aai-plan"><b>Estado del proyecto</b><span>Fase 2 · upscale CUDA operativo</span>' +
    '<small>Pesos: advanced-ai/models/upscale/. Se descargan solo al primer uso.</small></section>';

  shell.mobile.innerHTML =
    '<div class="aai-mobile-status" data-mobile-status>' + statusMarkup(null) + '</div>' +
    '<div class="aai-mobile-upscale"><select data-mobile-scale><option value="2">Upscale ×2</option><option value="4">Upscale ×4</option></select>' +
    '<button type="button" data-mobile-run disabled>Procesar</button><button type="button" data-mobile-cancel disabled>Cancelar</button></div>' +
    '<div class="aai-mobile-progress" hidden>Preparando…</div>';

  const statusHost = shell.right.querySelector("[data-engine-status]");
  const mobileStatus = shell.mobile.querySelector("[data-mobile-status]");
  const runBtn = shell.left.querySelector("[data-upscale-run]");
  const cancelBtn = shell.left.querySelector("[data-upscale-cancel]");
  const scaleSel = shell.left.querySelector("[data-upscale-scale]");
  const progress = shell.left.querySelector(".aai-progress");
  const progressBar = progress.querySelector("i");
  const progressText = progress.querySelector("span");
  const mobileRun = shell.mobile.querySelector("[data-mobile-run]");
  const mobileCancel = shell.mobile.querySelector("[data-mobile-cancel]");
  const mobileScale = shell.mobile.querySelector("[data-mobile-scale]");
  const mobileProgress = shell.mobile.querySelector(".aai-mobile-progress");
  var checking = false;

  function setReady(on){
    const supported = !!on && status?.features?.some(f => f === "upscale-x2");
    runBtn.disabled = !supported || !!activeJob;
    mobileRun.disabled = !supported || !!activeJob;
  }

  function setRunning(on){
    runBtn.disabled = on || !status?.ready;
    mobileRun.disabled = on || !status?.ready;
    cancelBtn.disabled = !on;
    mobileCancel.disabled = !on;
    scaleSel.disabled = on;
    mobileScale.disabled = on;
    progress.hidden = !on;
    mobileProgress.hidden = !on;
  }

  function showProgress(job){
    const pct = Math.round((job.progress || 0) * 100);
    progressBar.style.width = pct + "%";
    progressText.textContent = pct + "% · " + (job.stage || "Procesando");
    mobileProgress.textContent = pct + "% · " + (job.stage || "Procesando");
    shell.setSubtitle(name + " · " + pct + "% · " + (job.stage || "Procesando"));
  }

  async function check(){
    if(checking || shell.closed) return;
    checking = true;
    statusHost.innerHTML = statusMarkup(null);
    mobileStatus.innerHTML = statusMarkup(null);
    status = await probeLocalService();
    if(shell.closed) return;
    const html = statusMarkup(status);
    statusHost.innerHTML = html;
    mobileStatus.innerHTML = html;
    checking = false;
    setReady(status.ready);
  }

  async function process(scale){
    if(activeJob || !status?.ready) return;
    resultCanvas = null;
    shell.setApplyEnabled(false);
    shell.setView(source, false);
    resultScale = scale;
    const prep = scaledForOutput(source, scale);
    if(prep.limited) toast("La entrada se ha ajustado al límite de documento de Realify antes del upscale.");
    const tile = status.vramGB >= 11 ? 640 : status.vramGB >= 8 ? 512 : 384;
    aborter = new AbortController();
    setRunning(true);
    shell.setBusy("Enviando imagen al motor CUDA…");
    try{
      const job = await startUpscale(prep.canvas, { scale, tile });
      activeJob = job.id;
      shell.setBusy("");
      await waitForJob(activeJob, {
        signal: aborter.signal,
        onProgress: showProgress
      });
      const blob = await fetchJobResult(activeJob);
      resultCanvas = await resultBlobToCanvas(blob);
      shell.setView(resultCanvas, false);
      shell.setOriginal(source);
      shell.setApplyEnabled(true);
      shell.setSubtitle(name + " · resultado ×" + scale + " · " + resultCanvas.width + " × " + resultCanvas.height);
      toast("Upscale ×" + scale + " terminado. Revisa y pulsa Aplicar.", "ok");
    }catch(err){
      if(!err.cancelled) toast("Upscale IA: " + err.message, "err");
      shell.setView(source, false);
      shell.setOriginal(source);
      shell.setSubtitle(name + " · " + width + " × " + height + " · Fase 2");
    }finally{
      activeJob = null;
      aborter = null;
      setRunning(false);
      progress.hidden = true;
      mobileProgress.hidden = true;
      setReady(status?.ready);
      shell.setBusy("");
    }
  }

  async function cancelActive(){
    if(!activeJob && !aborter) return;
    aborter?.abort();
    if(activeJob) await cancelJob(activeJob);
  }

  runBtn.addEventListener("click", () => process(+scaleSel.value));
  mobileRun.addEventListener("click", () => process(+mobileScale.value));
  cancelBtn.addEventListener("click", cancelActive);
  mobileCancel.addEventListener("click", cancelActive);
  scaleSel.addEventListener("change", () => { mobileScale.value = scaleSel.value; });
  mobileScale.addEventListener("change", () => { scaleSel.value = mobileScale.value; });
  shell.right.querySelector(".aai-retry").addEventListener("click", check);

  check();
  return { close };
}
