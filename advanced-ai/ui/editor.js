import { createShell, resultToLayer } from "../../js/ui/fsshell.js";
import { toast } from "../../js/ui/toast.js";
import { docSizeLimit } from "../../js/core/device.js";
import { renderPrecise } from "../../js/core/precision-stack.js";
import { canvasFromHi, attachHi } from "../../js/core/hisrc.js";
import { emit } from "../../js/core/bus.js";
import {
  probeLocalService, startUpscale, startRestore, interpretPrompt,
  waitForJob, fetchJobResult, cancelJob
} from "../client/local-service.js";
import { renderAdjustments, sanitizeAdjustments, isNeutral } from "./prompt-adjustments.js";

const CONTROLS = [
  ["exposure","Exposición","-5","5","0","0.05"," EV"],
  ["brightness","Brillo","-100","100","0","1",""],
  ["contrast","Contraste","-100","100","0","1",""],
  ["highlights","Altas luces","-100","100","0","1",""],
  ["shadows","Sombras","-100","100","0","1",""],
  ["whites","Blancos","-100","100","0","1",""],
  ["blacks","Negros","-100","100","0","1",""],
  ["temperature","Temperatura","-100","100","0","1",""],
  ["tint","Matiz","-100","100","0","1",""],
  ["saturation","Saturación","-100","100","0","1",""],
  ["vibrance","Vibrancia","-100","100","0","1",""],
  ["clarity","Claridad","-100","100","0","1",""],
  ["texture","Textura","-100","100","0","1",""],
  ["dehaze","Borrar neblina","-100","100","0","1",""],
  ["sharpen","Enfoque","0","100","0","1",""]
];

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function controlsMarkup(){
  return CONTROLS.map(function(c){
    return '<label class="aai-control"><span>' + esc(c[1]) + ' <b data-control-value="' + c[0] + '">' +
      c[4] + esc(c[6]) + '</b></span><input type="range" data-control="' + c[0] +
      '" min="' + c[2] + '" max="' + c[3] + '" step="' + c[5] + '" value="' + c[4] + '"></label>';
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

function maxHiPixels(){
  const coarse = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
  const mem = navigator.deviceMemory || 8;
  return (coarse || mem <= 4) ? 12e6 : 32e6;
}

function targetUpscaleInput(source, scale){
  let [outW, outH, limitedSide] = docSizeLimit(source.width * scale, source.height * scale, { highQuality:true });
  const maxPixels = maxHiPixels();
  let limitedPixels = false;
  if(outW * outH > maxPixels){
    const k = Math.sqrt(maxPixels / (outW * outH));
    outW = Math.max(1, Math.floor(outW * k));
    outH = Math.max(1, Math.floor(outH * k));
    limitedPixels = true;
  }
  return {
    w:Math.max(8, Math.floor(outW / scale)),
    h:Math.max(8, Math.floor(outH / scale)),
    limited:limitedSide || limitedPixels
  };
}

function scaledCanvas(source, w, h){
  if(source.width === w && source.height === h) return source;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(source, 0, 0, w, h);
  return c;
}

async function preparePreciseSource(source, w, h){
  try{
    const precise = await renderPrecise({
      w, h, bits16:true, alpha:false, layersOnly:false, srgb:true
    });
    if(precise?.data16?.data instanceof Uint16Array){
      return {
        payload:precise.data16,
        precision:16,
        reason:precise.reason || "RGB16"
      };
    }
  }catch(err){
    console.warn("IA avanzada: no se pudo preparar RGB16; se usa canvas compatible", err);
  }
  return {
    payload:scaledCanvas(source, w, h),
    precision:8,
    reason:"Composición compatible de 8 bits"
  };
}

function blendPreview(source, restored, strength, reuse){
  const c = reuse || document.createElement("canvas");
  if(c.width !== restored.width || c.height !== restored.height){
    c.width = restored.width; c.height = restored.height;
  }
  const x = c.getContext("2d");
  x.clearRect(0, 0, c.width, c.height);
  x.globalAlpha = 1;
  x.drawImage(source, 0, 0, c.width, c.height);
  x.globalAlpha = Math.max(0, Math.min(1, strength / 100));
  x.drawImage(restored, 0, 0, c.width, c.height);
  x.globalAlpha = 1;
  return c;
}

export function openAdvancedAIEditor(opts){
  var source = opts.source, name = opts.name, width = opts.width, height = opts.height;
  var shell, status = null, activeJob = null, aborter = null, runningKind = null;
  var resultCanvas = null, result16 = null, resultKind = null, resultScale = 2;
  var restoreMode = "denoise", restoreStrength = 100, restorePreview = null;
  var adjustmentState = sanitizeAdjustments({}), adjustmentPreview = null, promptInfo = null;
  var closed = false;

  async function close(){
    if(closed) return;
    closed = true;
    aborter?.abort();
    if(activeJob) await cancelJob(activeJob);
    shell?.close();
  }

  async function applyResult(){
    if(!resultCanvas || !result16 || !resultKind) return;
    shell.setBusy("Aplicando resultado…");
    try{
      if(resultKind === "prompt-adjust"){
        await resultToLayer(resultCanvas, { name:"Ajustes por prompt IA", mix:true });
        const { doc } = await import("../../js/core/doc.js");
        const layer = doc.layers.find(l => l.id === doc.activeId);
        if(layer){
          layer.aiPromptAdjustments = structuredClone(adjustmentState);
          layer.aiPromptSummary = promptInfo?.summary || "";
          layer.thumbDirty = true;
          emit("doc:change"); emit("doc:structure");
        }
        toast("Ajustes por prompt aplicados", "ok");
      }else if(resultKind === "upscale"){
        await resultToLayer(resultCanvas, {
          name:"Ampliada ×" + resultScale + " · Real-ESRGAN",
          docName:name + " ×" + resultScale,
          newDocument:true
        });
        const { doc } = await import("../../js/core/doc.js");
        const layer = doc.layers[0];
        const kept16 = attachHi(layer, result16.data, result16.w, result16.h);
        if(kept16){
          layer.thumbDirty = true;
          emit("doc:change"); emit("doc:structure");
        }
        toast("Upscale ×" + resultScale + " aplicado" + (kept16 ? " · 16 bits conservados" : ""), "ok");
      }else{
        const label = resultKind === "denoise" ? "Reducción de ruido IA · NAFNet" : "Deblur IA · NAFNet";
        await resultToLayer(resultCanvas, { name:label, mix:true });
        const { doc } = await import("../../js/core/doc.js");
        const layer = doc.layers.find(l => l.id === doc.activeId);
        if(layer){
          attachHi(layer, result16.data, result16.w, result16.h);
          layer.opacity = restoreStrength / 100;
          layer.thumbDirty = true;
          emit("doc:change"); emit("doc:structure");
        }
        toast(label + " aplicado · " + restoreStrength + "%", "ok");
      }
      await close();
    }catch(err){
      shell.setBusy("");
      toast("No se pudo aplicar el resultado: " + err.message, "err");
    }
  }

  shell = createShell({
    title:"IA avanzada",
    subtitle:name + " · " + width + " × " + height + " · Fase 4",
    applyLabel:"Aplicar",
    cls:"aai-shell",
    onApply:applyResult,
    onCancel:close
  });

  shell.setApplyEnabled(false);
  shell.setView(source, false);
  shell.setOriginal(source);

  shell.left.innerHTML =
    '<div class="aai-panel-head"><b>Ajustes fotográficos</b>' +
    '<span>Controles manuales activos. La caja de prompt puede rellenarlos automáticamente.</span></div>' +
    '<div class="aai-controls">' + controlsMarkup() + '</div>' +

    '<section class="aai-restore">' +
      '<div class="aai-panel-head"><b>Restauración IA</b><span>NAFNet width64 · máxima calidad · CUDA.</span></div>' +
      '<label><span>Tipo</span><select data-restore-mode>' +
        '<option value="denoise">Reducir ruido · NAFNet SIDD width64</option>' +
        '<option value="deblur">Recuperar desenfoque · NAFNet GoPro width64</option>' +
      '</select></label>' +
      '<label class="aai-strength"><span>Intensidad <b data-strength-value>100%</b></span>' +
        '<input type="range" min="0" max="100" value="100" step="1" data-restore-strength></label>' +
      '<button type="button" data-restore-run disabled>Restaurar con GPU</button>' +
      '<button type="button" data-restore-cancel disabled>Cancelar proceso</button>' +
      '<div class="aai-progress aai-restore-progress" hidden><div><i></i></div><span>Preparando…</span></div>' +
      '<p class="aai-quality" data-restore-quality>El modelo se descarga en el primer uso y permanece en advanced-ai/models/.</p>' +
    '</section>' +

    '<section class="aai-upscale">' +
      '<div class="aai-panel-head"><b>Upscale IA</b><span>Real-ESRGAN · CUDA FP16 · transporte RGB16 cuando es posible.</span></div>' +
      '<label><span>Escala</span><select data-upscale-scale><option value="2">×2 · alta calidad</option><option value="4">×4 · máxima ampliación</option></select></label>' +
      '<button type="button" data-upscale-run disabled>Procesar con GPU</button>' +
      '<button type="button" data-upscale-cancel disabled>Cancelar proceso</button>' +
      '<div class="aai-progress aai-upscale-progress" hidden><div><i></i></div><span>Preparando…</span></div>' +
      '<p class="aai-quality" data-upscale-quality>Los pesos se descargan y verifican en el primer uso.</p>' +
    '</section>';

  shell.right.innerHTML =
    '<section class="aai-engine"><div class="aai-panel-head"><b>Motor IA local</b><span>CUDA/PyTorch en este PC.</span></div>' +
    '<div data-engine-status>' + statusMarkup(null) + '</div>' +
    '<button type="button" class="aai-retry">Volver a comprobar</button></section>' +
    '<section class="aai-prompt"><div class="aai-panel-head"><b>Prompt</b>' +
    '<span>Qwen2.5 interpreta instrucciones y sólo puede devolver ajustes permitidos. Edición generativa llegará en la Fase 6.</span></div>' +
    '<textarea rows="6" data-prompt placeholder="Ej.: aclara un poco la foto, recupera sombras, baja altas luces y haz el color algo más cálido."></textarea>' +
    '<div class="aai-prompt-actions"><button type="button" data-prompt-run disabled>Interpretar y previsualizar</button><button type="button" data-prompt-reset>Restablecer</button></div>' +
    '<div class="aai-prompt-result" data-prompt-result hidden></div></section>' +
    '<section class="aai-plan"><b>Estado del proyecto</b><span>Fase 4 · Prompt → ajustes operativo</span>' +
    '<small>Qwen2.5 1.5B local · JSON validado · sin comandos arbitrarios.</small></section>';

  shell.mobile.innerHTML =
    '<div class="aai-mobile-status" data-mobile-status>' + statusMarkup(null) + '</div>' +
    '<div class="aai-mobile-tools">' +
      '<select data-mobile-action><option value="denoise">Denoise IA</option><option value="deblur">Deblur IA</option><option value="upscale2">Upscale ×2</option><option value="upscale4">Upscale ×4</option></select>' +
      '<button type="button" data-mobile-run disabled>Procesar</button><button type="button" data-mobile-cancel disabled>Cancelar</button>' +
    '</div>' +
    '<label class="aai-mobile-strength"><span>Intensidad <b data-mobile-strength-value>100%</b></span><input type="range" min="0" max="100" value="100" data-mobile-strength></label>' +
    '<div class="aai-mobile-progress" hidden>Preparando…</div>';

  const statusHost = shell.right.querySelector("[data-engine-status]");
  const mobileStatus = shell.mobile.querySelector("[data-mobile-status]");
  const promptBox = shell.right.querySelector("[data-prompt]");
  const promptRun = shell.right.querySelector("[data-prompt-run]");
  const promptReset = shell.right.querySelector("[data-prompt-reset]");
  const promptResult = shell.right.querySelector("[data-prompt-result]");
  const controlInputs = [...shell.left.querySelectorAll("[data-control]")];

  const upscaleRun = shell.left.querySelector("[data-upscale-run]");
  const upscaleCancel = shell.left.querySelector("[data-upscale-cancel]");
  const upscaleScale = shell.left.querySelector("[data-upscale-scale]");
  const upscaleProgress = shell.left.querySelector(".aai-upscale-progress");
  const upscaleProgressBar = upscaleProgress.querySelector("i");
  const upscaleProgressText = upscaleProgress.querySelector("span");
  const upscaleQuality = shell.left.querySelector("[data-upscale-quality]");

  const restoreRun = shell.left.querySelector("[data-restore-run]");
  const restoreCancel = shell.left.querySelector("[data-restore-cancel]");
  const restoreModeSel = shell.left.querySelector("[data-restore-mode]");
  const restoreStrengthInput = shell.left.querySelector("[data-restore-strength]");
  const restoreStrengthValue = shell.left.querySelector("[data-strength-value]");
  const restoreProgress = shell.left.querySelector(".aai-restore-progress");
  const restoreProgressBar = restoreProgress.querySelector("i");
  const restoreProgressText = restoreProgress.querySelector("span");
  const restoreQuality = shell.left.querySelector("[data-restore-quality]");

  const mobileAction = shell.mobile.querySelector("[data-mobile-action]");
  const mobileRun = shell.mobile.querySelector("[data-mobile-run]");
  const mobileCancel = shell.mobile.querySelector("[data-mobile-cancel]");
  const mobileStrengthInput = shell.mobile.querySelector("[data-mobile-strength]");
  const mobileStrengthValue = shell.mobile.querySelector("[data-mobile-strength-value]");
  const mobileProgress = shell.mobile.querySelector(".aai-mobile-progress");
  var checking = false;

  function featureReady(feature){
    return !!status?.ready && status?.features?.includes(feature);
  }

  function setReady(){
    const busy = !!activeJob || !!runningKind;
    upscaleRun.disabled = busy || !(featureReady("upscale-x2") && featureReady("upscale-x4"));
    restoreRun.disabled = busy || !(featureReady("denoise-nafnet") && featureReady("deblur-nafnet"));
    mobileRun.disabled = busy || !status?.ready;
    promptRun.disabled = busy || !featureReady("prompt-adjustments");
  }

  function setRunning(kind, on){
    runningKind = on ? kind : null;
    const busy = !!runningKind;
    upscaleRun.disabled = busy || !status?.ready;
    restoreRun.disabled = busy || !status?.ready;
    mobileRun.disabled = busy || !status?.ready;
    promptRun.disabled = busy || !featureReady("prompt-adjustments");
    upscaleCancel.disabled = !(busy && kind === "upscale");
    restoreCancel.disabled = !(busy && kind === "restore");
    mobileCancel.disabled = !busy;
    upscaleScale.disabled = busy;
    restoreModeSel.disabled = busy;
    mobileAction.disabled = busy;
    upscaleProgress.hidden = !(busy && kind === "upscale");
    restoreProgress.hidden = !(busy && kind === "restore");
    mobileProgress.hidden = !busy;
  }

  function showProgress(job){
    const pct = Math.round((job.progress || 0) * 100);
    const stage = job.stage || "Procesando";
    const isUpscale = runningKind === "upscale";
    const bar = isUpscale ? upscaleProgressBar : restoreProgressBar;
    const text = isUpscale ? upscaleProgressText : restoreProgressText;
    bar.style.width = pct + "%";
    text.textContent = pct + "% · " + stage;
    mobileProgress.textContent = pct + "% · " + stage;
    shell.setSubtitle(name + " · " + pct + "% · " + stage);
  }

  function updateRestorePreview(){
    restoreStrength = +restoreStrengthInput.value;
    mobileStrengthInput.value = String(restoreStrength);
    restoreStrengthValue.textContent = restoreStrength + "%";
    mobileStrengthValue.textContent = restoreStrength + "%";
    if(resultKind !== "denoise" && resultKind !== "deblur") return;
    restorePreview = blendPreview(source, resultCanvas, restoreStrength, restorePreview);
    shell.setView(restorePreview, true);
  }

  function syncControlsFromState(){
    for(const input of controlInputs){
      const key = input.dataset.control;
      const value = adjustmentState[key] ?? 0;
      input.value = String(value);
      const out = shell.left.querySelector('[data-control-value="' + key + '"]');
      if(out){
        const meta = CONTROLS.find(c => c[0] === key);
        out.textContent = value + (meta?.[6] || "");
      }
    }
  }

  function renderAdjustmentPreview(){
    if(isNeutral(adjustmentState)){
      adjustmentPreview = null;
      resultCanvas = null; resultKind = null;
      shell.setView(source, true);
      shell.setApplyEnabled(false);
      return;
    }
    adjustmentPreview = renderAdjustments(source, adjustmentState, adjustmentPreview);
    resultCanvas = adjustmentPreview;
    result16 = null;
    resultKind = "prompt-adjust";
    shell.setView(adjustmentPreview, true);
    shell.setOriginal(source);
    shell.setApplyEnabled(true);
  }

  function resetAdjustments(){
    adjustmentState = sanitizeAdjustments({});
    promptInfo = null;
    syncControlsFromState();
    promptResult.hidden = true;
    promptResult.innerHTML = "";
    renderAdjustmentPreview();
  }

  async function runPrompt(){
    const prompt = promptBox.value.trim();
    if(!prompt || runningKind || activeJob) return;
    aborter = new AbortController();
    setRunning("prompt", true);
    shell.setBusy("Interpretando prompt en la GPU local…");
    try{
      const parsed = await interpretPrompt(prompt, { signal:aborter.signal });
      adjustmentState = sanitizeAdjustments(parsed.adjustments || {});
      promptInfo = parsed;
      syncControlsFromState();
      renderAdjustmentPreview();

      const unsupported = Array.isArray(parsed.unsupported) ? parsed.unsupported : [];
      const changes = Object.entries(adjustmentState).filter(([,v]) => Math.abs(v) > 1e-6);
      promptResult.hidden = false;
      promptResult.innerHTML =
        '<b>' + esc(parsed.summary || (changes.length ? "Ajustes interpretados" : "Sin ajustes fotográficos")) + '</b>' +
        (changes.length ? '<span>' + changes.map(([k,v]) => esc(k) + ': ' + esc(v)).join(' · ') + '</span>' : '') +
        (unsupported.length ? '<em>No disponible todavía: ' + unsupported.map(esc).join(' · ') + '</em>' : '');
      if(unsupported.length) toast("Parte del prompt requiere edición generativa de la Fase 6.");
      if(changes.length) toast("Prompt interpretado. Revisa los controles y la previsualización.", "ok");
    }catch(err){
      if(err?.name !== "AbortError") toast("Prompt IA: " + err.message, "err");
    }finally{
      aborter = null;
      setRunning("prompt", false);
      setReady();
      shell.setBusy("");
    }
  }

  for(const input of controlInputs){
    input.addEventListener("input", () => {
      adjustmentState[input.dataset.control] = +input.value;
      const out = shell.left.querySelector('[data-control-value="' + input.dataset.control + '"]');
      const meta = CONTROLS.find(c => c[0] === input.dataset.control);
      if(out) out.textContent = input.value + (meta?.[6] || "");
      promptInfo = null;
      renderAdjustmentPreview();
    });
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
    setReady();
  }

  async function runUpscale(scale){
    if(activeJob || runningKind || !status?.ready) return;
    resultCanvas = null; result16 = null; resultKind = null;
    shell.setApplyEnabled(false);
    shell.setView(source, false);
    resultScale = scale;
    aborter = new AbortController();
    setRunning("upscale", true);
    shell.setBusy("Preparando imagen a máxima precisión…");

    try{
      const size = targetUpscaleInput(source, scale);
      const prepared = await preparePreciseSource(source, size.w, size.h);
      if(size.limited) toast("El resultado se limita al máximo seguro de Realify manteniendo alta precisión.");
      upscaleQuality.textContent =
        (prepared.precision === 16 ? "Entrada RGB16" : "Entrada compatible 8-bit") + " · " + prepared.reason;

      const tile = status.vramGB >= 11 ? 640 : status.vramGB >= 8 ? 512 : 384;
      shell.setBusy("Enviando imagen al motor CUDA…");
      const job = await startUpscale(prepared.payload, { scale, tile, signal:aborter.signal });
      activeJob = job.id;
      shell.setBusy("");

      await waitForJob(activeJob, { signal:aborter.signal, onProgress:showProgress });
      const result = await fetchJobResult(activeJob);
      result16 = result;
      resultCanvas = canvasFromHi(result.data, result.w, result.h);
      resultKind = "upscale";
      shell.setView(resultCanvas, false);
      shell.setOriginal(source);
      shell.setApplyEnabled(true);
      upscaleQuality.textContent =
        "Resultado RGB16 · " + result.w + " × " + result.h +
        " · entrada del motor: " + result.inputPrecision + " bits";
      shell.setSubtitle(name + " · resultado ×" + scale + " · " + result.w + " × " + result.h);
      toast("Upscale ×" + scale + " terminado. Revisa y pulsa Aplicar.", "ok");
    }catch(err){
      if(!err.cancelled && err?.name !== "AbortError") toast("Upscale IA: " + err.message, "err");
      shell.setView(source, false);
      shell.setOriginal(source);
    }finally{
      activeJob = null; aborter = null;
      setRunning("upscale", false);
      setReady();
      shell.setBusy("");
    }
  }

  async function runRestore(mode){
    if(activeJob || runningKind || !status?.ready) return;
    resultCanvas = null; result16 = null; resultKind = null; restorePreview = null;
    restoreMode = mode;
    shell.setApplyEnabled(false);
    shell.setView(source, false);
    aborter = new AbortController();
    setRunning("restore", true);
    shell.setBusy("Preparando imagen a máxima precisión…");

    try{
      const prepared = await preparePreciseSource(source, source.width, source.height);
      restoreQuality.textContent =
        (prepared.precision === 16 ? "Entrada RGB16" : "Entrada compatible 8-bit") + " · " + prepared.reason;

      let tile;
      if(mode === "denoise") tile = status.vramGB >= 11 ? 512 : status.vramGB >= 8 ? 384 : 256;
      else tile = status.vramGB >= 11 ? 384 : status.vramGB >= 8 ? 320 : 224;

      shell.setBusy("Enviando imagen a NAFNet…");
      const job = await startRestore(prepared.payload, { mode, tile, signal:aborter.signal });
      activeJob = job.id;
      shell.setBusy("");

      await waitForJob(activeJob, { signal:aborter.signal, onProgress:showProgress });
      const result = await fetchJobResult(activeJob);
      result16 = result;
      resultCanvas = canvasFromHi(result.data, result.w, result.h);
      resultKind = mode;
      updateRestorePreview();
      shell.setOriginal(source);
      shell.setApplyEnabled(true);
      restoreQuality.textContent =
        (mode === "denoise" ? "NAFNet SIDD width64" : "NAFNet GoPro width64") +
        " · RGB16 · " + result.w + " × " + result.h +
        " · entrada: " + result.inputPrecision + " bits";
      shell.setSubtitle(name + " · " + (mode === "denoise" ? "ruido reducido" : "desenfoque recuperado"));
      toast((mode === "denoise" ? "Reducción de ruido" : "Deblur") + " terminado. Ajusta intensidad y pulsa Aplicar.", "ok");
    }catch(err){
      if(!err.cancelled && err?.name !== "AbortError")
        toast((mode === "denoise" ? "Denoise" : "Deblur") + " IA: " + err.message, "err");
      shell.setView(source, false);
      shell.setOriginal(source);
    }finally{
      activeJob = null; aborter = null;
      setRunning("restore", false);
      setReady();
      shell.setBusy("");
    }
  }

  async function cancelActive(){
    if(!activeJob && !aborter) return;
    aborter?.abort();
    if(activeJob) await cancelJob(activeJob);
  }

  upscaleRun.addEventListener("click", () => runUpscale(+upscaleScale.value));
  upscaleCancel.addEventListener("click", cancelActive);
  restoreRun.addEventListener("click", () => runRestore(restoreModeSel.value));
  restoreCancel.addEventListener("click", cancelActive);

  restoreStrengthInput.addEventListener("input", updateRestorePreview);
  mobileStrengthInput.addEventListener("input", () => {
    restoreStrengthInput.value = mobileStrengthInput.value;
    updateRestorePreview();
  });

  restoreModeSel.addEventListener("change", () => {
    restoreMode = restoreModeSel.value;
    if(restoreMode === "denoise" || restoreMode === "deblur") mobileAction.value = restoreMode;
  });

  mobileAction.addEventListener("change", () => {
    if(mobileAction.value === "denoise" || mobileAction.value === "deblur")
      restoreModeSel.value = mobileAction.value;
  });

  mobileRun.addEventListener("click", () => {
    const action = mobileAction.value;
    if(action === "denoise" || action === "deblur") runRestore(action);
    else runUpscale(action === "upscale4" ? 4 : 2);
  });
  mobileCancel.addEventListener("click", cancelActive);
  promptRun.addEventListener("click", runPrompt);
  promptReset.addEventListener("click", resetAdjustments);
  promptBox.addEventListener("keydown", e => {
    if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); runPrompt(); }
  });
  shell.right.querySelector(".aai-retry").addEventListener("click", check);

  check();
  return { close };
}
