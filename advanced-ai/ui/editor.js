import { createShell, resultToLayer } from "../../js/ui/fsshell.js";
import { toast } from "../../js/ui/toast.js";
import { docSizeLimit } from "../../js/core/device.js";
import { renderPrecise } from "../../js/core/precision-stack.js";
import { canvasFromHi, attachHi } from "../../js/core/hisrc.js";
import { emit } from "../../js/core/bus.js";
import {
  probeLocalService, startUpscale, startRestore, startSegment, fetchMaskResult, startGenerativeEdit, startAdvancedControl, interpretPrompt,
  waitForJob, fetchJobResult, cancelJob
} from "../client/local-service.js";
import { renderAdjustments, sanitizeAdjustments, isNeutral } from "./prompt-adjustments.js";
import { addMask } from "../../js/editor/masks.js";

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
    const denied = s.loopbackPermission === "denied";
    return '<div class="aai-status offline"><i></i><div><b>' +
      (denied ? 'Acceso al motor local bloqueado' : 'Realify AI Local no está activo') +
      '</b><span>' + esc(s.reason || "Realify AI Local no está disponible.") + '</span>' +
      (denied
        ? '<span class="aai-local-help">En la configuración del sitio de realify.es, permite el acceso a la red/equipo local y pulsa Volver a comprobar.</span>'
        : '<a class="aai-install-local" href="/advanced-ai/install/windows/instalar-realify-ai-local.cmd" download>Instalar Realify AI Local para Windows</a>' +
          '<span class="aai-local-help">Instálalo una vez. Quedará arrancando con Windows y utilizará tu GPU NVIDIA local.</span>') +
      '</div></div>';
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
  var segmentPoints = [], segmentLabels = [], segmentMask = null, segmentInvert = false;
  var generativePrompt = "", generativeSeed = 0;
  var advancedPrompt = "", advancedTask = "identity", advancedSeed = 0;
  var closed = false;

  async function close(){
    if(closed) return;
    closed = true;
    aborter?.abort();
    if(activeJob) await cancelJob(activeJob);
    shell?.close();
  }

  async function applyResult(){
    if(!resultCanvas || !resultKind) return;
    if(resultKind !== "prompt-adjust" && resultKind !== "segment-mask" && !result16) return;
    shell.setBusy("Aplicando resultado…");
    try{
      if(resultKind === "segment-mask"){
        await resultToLayer(source, { name:"Selección IA · SAM2", mix:true });
        const { doc } = await import("../../js/core/doc.js");
        const layer = doc.layers.find(l => l.id === doc.activeId);
        if(!layer || !segmentMask) throw new Error("No se pudo crear la capa de máscara.");
        addMask(layer, false, true);
        const img = layer.mask.ctx.createImageData(segmentMask.w, segmentMask.h);
        for(let i=0;i<segmentMask.data.length;i++){
          const p=i*4, a=segmentMask.data[i];
          img.data[p]=img.data[p+1]=img.data[p+2]=255; img.data[p+3]=a;
        }
        layer.mask.ctx.putImageData(img,0,0);
        layer.maskEnabled=true; layer.thumbDirty=true;
        emit("doc:change"); emit("doc:structure");
        toast("Máscara SAM2 aplicada como máscara de capa editable","ok");
      }else if(resultKind === "prompt-adjust"){
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
      }else if(resultKind?.startsWith("advanced-")){
        const labels = {
          "advanced-identity":"Identidad preservada · PuLID-FLUX",
          "advanced-reference":"Referencia visual · FLUX IP-Adapter",
          "advanced-control":"Control estructural · FLUX ControlNet"
        };
        const label = labels[resultKind] || "Control avanzado IA";
        await resultToLayer(resultCanvas, { name:label, mix:true });
        const { doc } = await import("../../js/core/doc.js");
        const layer = doc.layers.find(l => l.id === doc.activeId);
        if(layer){
          layer.aiAdvancedTask = advancedTask;
          layer.aiAdvancedPrompt = advancedPrompt;
          layer.aiAdvancedSeed = advancedSeed;
          layer.aiAdvancedModel = result16?.model || "";
          layer.thumbDirty = true;
          emit("doc:change"); emit("doc:structure");
        }
        toast(label + " aplicado como capa nueva","ok");
      }else if(resultKind === "generative-edit"){
        await resultToLayer(resultCanvas, { name:"Edición generativa · FLUX Fill", mix:true });
        const { doc } = await import("../../js/core/doc.js");
        const layer = doc.layers.find(l => l.id === doc.activeId);
        if(layer){
          layer.aiGenerativeModel = result16?.model || "flux1-fill-dev-nf4";
          layer.aiGenerativePrompt = generativePrompt;
          layer.aiGenerativeSeed = generativeSeed;
          layer.thumbDirty = true;
          emit("doc:change"); emit("doc:structure");
        }
        toast("Edición generativa FLUX aplicada como capa nueva","ok");
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
    subtitle:name + " · " + width + " × " + height + " · Fase 7",
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

    '<section class="aai-segment">' +
      '<div class="aai-panel-head"><b>Selección IA · SAM2</b><span>Haz clic sobre el sujeto u objeto. Alt+clic añade puntos negativos para corregir la máscara.</span></div>' +
      '<label><span>Resultado</span><select data-segment-target><option value="object">Sujeto / objeto</option><option value="background">Fondo</option></select></label>' +
      '<button type="button" data-segment-start>Activar selección por clic</button>' +
      '<button type="button" data-segment-run disabled>Calcular / refinar máscara</button>' +
      '<button type="button" data-segment-cancel disabled>Cancelar proceso</button>' +
      '<button type="button" data-segment-clear>Limpiar puntos</button>' +
      '<div class="aai-progress aai-segment-progress" hidden><div><i></i></div><span>Preparando…</span></div>' +
      '<p class="aai-quality" data-segment-quality>SAM2.1 Hiera Large · máscara editable al aplicar.</p>' +
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
    '<section class="aai-prompt"><div class="aai-panel-head"><b>Ajustes por prompt</b>' +
    '<span>Qwen3 interpreta instrucciones fotográficas y las convierte en controles editables.</span></div>' +
    '<textarea rows="5" data-prompt placeholder="Ej.: aclara la foto, recupera sombras y haz el color algo más cálido."></textarea>' +
    '<div class="aai-prompt-actions"><button type="button" data-prompt-run disabled>Interpretar</button><button type="button" data-prompt-reset>Restablecer</button></div>' +
    '<div class="aai-prompt-result" data-prompt-result hidden></div></section>' +
    '<section class="aai-generative"><div class="aai-panel-head"><b>Edición generativa · FLUX Fill</b>' +
    '<span>Genera únicamente dentro de la máscara de SAM2. Ideal para cielo, fondo, pelo, ropa, escenarios u objetos.</span></div>' +
    '<textarea rows="6" data-generative-prompt placeholder="Ej.: cambia el pelo a rubio natural manteniendo el rostro y la iluminación."></textarea>' +
    '<div class="aai-gen-grid">' +
      '<label><span>Pasos</span><input type="number" min="20" max="80" value="50" data-gen-steps></label>' +
      '<label><span>Guidance</span><input type="number" min="1" max="60" step="1" value="30" data-gen-guidance></label>' +
      '<label><span>Semilla</span><input type="number" min="0" max="2147483647" value="0" data-gen-seed></label>' +
      '<label><span>Borde</span><input type="number" min="0" max="32" value="8" data-gen-feather></label>' +
    '</div>' +
    '<button type="button" data-generative-run disabled>Generar dentro de la máscara</button>' +
    '<button type="button" data-generative-cancel disabled>Cancelar generación</button>' +
    '<div class="aai-progress aai-generative-progress" hidden><div><i></i></div><span>Preparando FLUX…</span></div>' +
    '<p class="aai-quality" data-generative-quality>FLUX.1 Fill [dev] NF4 · BF16 · calidad alta · optimizado para 12 GB VRAM.</p>' +
    '</section>' +
    '<section class="aai-advanced"><div class="aai-panel-head"><b>Identidad y control avanzado</b>' +
    '<span>PuLID-FLUX para identidad, IP-Adapter para referencia visual y ControlNet Union Pro 2.0 para estructura.</span></div>' +
    '<label><span>Modo</span><select data-advanced-task>' +
      '<option value="identity">Preservar identidad · PuLID-FLUX</option>' +
      '<option value="reference">Referencia visual · FLUX IP-Adapter</option>' +
      '<option value="control">Control estructural · FLUX ControlNet</option>' +
    '</select></label>' +
    '<label data-reference-wrap><span>Imagen de referencia</span><input type="file" accept="image/*" data-advanced-reference></label>' +
    '<label data-control-wrap hidden><span>Estructura</span><select data-control-mode>' +
      '<option value="depth">Profundidad · Depth Anything V2 Large</option>' +
      '<option value="canny">Bordes Canny</option>' +
      '<option value="softedge">Soft Edge</option>' +
      '<option value="pose">Pose humana</option>' +
    '</select></label>' +
    '<textarea rows="5" data-advanced-prompt placeholder="Ej.: la misma persona en un yate de lujo al atardecer, fotografía realista."></textarea>' +
    '<div class="aai-gen-grid">' +
      '<label><span>Fuerza</span><input type="number" min="0" max="3" step=".05" value="1" data-advanced-strength></label>' +
      '<label><span>Pasos</span><input type="number" min="10" max="50" value="28" data-advanced-steps></label>' +
      '<label><span>Guidance</span><input type="number" min="1" max="10" step=".1" value="4" data-advanced-guidance></label>' +
      '<label><span>Semilla</span><input type="number" min="0" max="2147483647" value="0" data-advanced-seed></label>' +
    '</div>' +
    '<button type="button" data-advanced-run disabled>Generar con control avanzado</button>' +
    '<button type="button" data-advanced-cancel disabled>Cancelar proceso</button>' +
    '<div class="aai-progress aai-advanced-progress" hidden><div><i></i></div><span>Preparando Fase 7…</span></div>' +
    '<p class="aai-quality" data-advanced-quality>La primera ejecución prepara un runtime aislado y descarga los modelos necesarios dentro de advanced-ai/.</p>' +
    '</section>' +
    '<section class="aai-plan"><b>Estado del proyecto</b><span>Fase 7 · Identidad y control avanzado operativo</span>' +
    '<small>PuLID-FLUX v0.9.1 · IP-Adapter · ControlNet Union Pro 2.0 · 12 GB VRAM.</small></section>';

  shell.mobile.innerHTML =
    '<div class="aai-mobile-status" data-mobile-status>' + statusMarkup(null) + '</div>' +
    '<div class="aai-mobile-tools">' +
      '<select data-mobile-action><option value="segment">Selección SAM2</option><option value="denoise">Denoise IA</option><option value="deblur">Deblur IA</option><option value="upscale2">Upscale ×2</option><option value="upscale4">Upscale ×4</option></select>' +
      '<button type="button" data-mobile-run disabled>Procesar</button><button type="button" data-mobile-cancel disabled>Cancelar</button>' +
    '</div>' +
    '<label class="aai-mobile-strength"><span>Intensidad <b data-mobile-strength-value>100%</b></span><input type="range" min="0" max="100" value="100" data-mobile-strength></label>' +
    '<div class="aai-mobile-prompt"><textarea rows="3" data-mobile-prompt placeholder="Describe los ajustes o la edición que quieres…"></textarea>' +
    '<button type="button" data-mobile-prompt-run disabled>Ajustar</button><button type="button" data-mobile-generative-run disabled>Generar</button></div>' +
    '<div class="aai-mobile-prompt-result" data-mobile-prompt-result hidden></div>' +
    '<div class="aai-mobile-progress" hidden>Preparando…</div>';

  const statusHost = shell.right.querySelector("[data-engine-status]");
  const mobileStatus = shell.mobile.querySelector("[data-mobile-status]");
  const promptBox = shell.right.querySelector("[data-prompt]");
  const promptRun = shell.right.querySelector("[data-prompt-run]");
  const promptReset = shell.right.querySelector("[data-prompt-reset]");
  const promptResult = shell.right.querySelector("[data-prompt-result]");
  const generativePromptBox = shell.right.querySelector("[data-generative-prompt]");
  const generativeRun = shell.right.querySelector("[data-generative-run]");
  const generativeCancel = shell.right.querySelector("[data-generative-cancel]");
  const generativeSteps = shell.right.querySelector("[data-gen-steps]");
  const generativeGuidance = shell.right.querySelector("[data-gen-guidance]");
  const generativeSeedInput = shell.right.querySelector("[data-gen-seed]");
  const generativeFeather = shell.right.querySelector("[data-gen-feather]");
  const generativeProgress = shell.right.querySelector(".aai-generative-progress");
  const generativeProgressBar = generativeProgress.querySelector("i");
  const generativeProgressText = generativeProgress.querySelector("span");
  const generativeQuality = shell.right.querySelector("[data-generative-quality]");
  const advancedTaskSel = shell.right.querySelector("[data-advanced-task]");
  const advancedReference = shell.right.querySelector("[data-advanced-reference]");
  const advancedReferenceWrap = shell.right.querySelector("[data-reference-wrap]");
  const advancedControlWrap = shell.right.querySelector("[data-control-wrap]");
  const advancedControlMode = shell.right.querySelector("[data-control-mode]");
  const advancedPromptBox = shell.right.querySelector("[data-advanced-prompt]");
  const advancedStrength = shell.right.querySelector("[data-advanced-strength]");
  const advancedSteps = shell.right.querySelector("[data-advanced-steps]");
  const advancedGuidance = shell.right.querySelector("[data-advanced-guidance]");
  const advancedSeedInput = shell.right.querySelector("[data-advanced-seed]");
  const advancedRun = shell.right.querySelector("[data-advanced-run]");
  const advancedCancel = shell.right.querySelector("[data-advanced-cancel]");
  const advancedProgress = shell.right.querySelector(".aai-advanced-progress");
  const advancedProgressBar = advancedProgress.querySelector("i");
  const advancedProgressText = advancedProgress.querySelector("span");
  const advancedQuality = shell.right.querySelector("[data-advanced-quality]");
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

  const segmentStart = shell.left.querySelector("[data-segment-start]");
  const segmentRun = shell.left.querySelector("[data-segment-run]");
  const segmentCancel = shell.left.querySelector("[data-segment-cancel]");
  const segmentClear = shell.left.querySelector("[data-segment-clear]");
  const segmentTarget = shell.left.querySelector("[data-segment-target]");
  const segmentProgress = shell.left.querySelector(".aai-segment-progress");
  const segmentProgressBar = segmentProgress.querySelector("i");
  const segmentProgressText = segmentProgress.querySelector("span");
  const segmentQuality = shell.left.querySelector("[data-segment-quality]");

  const mobileAction = shell.mobile.querySelector("[data-mobile-action]");
  const mobileRun = shell.mobile.querySelector("[data-mobile-run]");
  const mobileCancel = shell.mobile.querySelector("[data-mobile-cancel]");
  const mobileStrengthInput = shell.mobile.querySelector("[data-mobile-strength]");
  const mobileStrengthValue = shell.mobile.querySelector("[data-mobile-strength-value]");
  const mobileProgress = shell.mobile.querySelector(".aai-mobile-progress");
  const mobilePrompt = shell.mobile.querySelector("[data-mobile-prompt]");
  const mobilePromptRun = shell.mobile.querySelector("[data-mobile-prompt-run]");
  const mobileGenerativeRun = shell.mobile.querySelector("[data-mobile-generative-run]");
  const mobilePromptResult = shell.mobile.querySelector("[data-mobile-prompt-result]");
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
    segmentRun.disabled = busy || !featureReady("segment-sam2") || !segmentPoints.some((_,i)=>segmentLabels[i]===1);
    mobilePromptRun.disabled = busy || !featureReady("prompt-adjustments");
    generativeRun.disabled = busy || !featureReady("generative-flux-fill") || !segmentMask;
    mobileGenerativeRun.disabled = busy || !featureReady("generative-flux-fill") || !segmentMask;
    if(advancedRun) advancedRun.disabled = busy;
    const advFeature = advancedTaskSel?.value === "identity" ? "identity-pulid-flux" :
      advancedTaskSel?.value === "reference" ? "reference-flux-ip-adapter" : "controlnet-flux-union";
    if(advancedRun) advancedRun.disabled = busy || !featureReady(advFeature) ||
      ((advancedTaskSel.value === "identity" || advancedTaskSel.value === "reference") && !advancedReference.files?.[0]);
  }

  function setRunning(kind, on){
    runningKind = on ? kind : null;
    const busy = !!runningKind;
    upscaleRun.disabled = busy || !status?.ready;
    restoreRun.disabled = busy || !status?.ready;
    segmentRun.disabled = busy || !featureReady("segment-sam2") || !segmentPoints.some((_,i)=>segmentLabels[i]===1);
    mobileRun.disabled = busy || !status?.ready;
    promptRun.disabled = busy || !featureReady("prompt-adjustments");
    generativeRun.disabled = busy || !featureReady("generative-flux-fill") || !segmentMask;
    mobileGenerativeRun.disabled = busy || !featureReady("generative-flux-fill") || !segmentMask;
    upscaleCancel.disabled = !(busy && kind === "upscale");
    restoreCancel.disabled = !(busy && kind === "restore");
    segmentCancel.disabled = !(busy && kind === "segment");
    generativeCancel.disabled = !(busy && kind === "generative");
    advancedCancel.disabled = !(busy && kind === "advanced");
    mobileCancel.disabled = !busy;
    upscaleScale.disabled = busy;
    restoreModeSel.disabled = busy;
    mobileAction.disabled = busy;
    upscaleProgress.hidden = !(busy && kind === "upscale");
    restoreProgress.hidden = !(busy && kind === "restore");
    segmentProgress.hidden = !(busy && kind === "segment");
    generativeProgress.hidden = !(busy && kind === "generative");
    advancedProgress.hidden = !(busy && kind === "advanced");
    mobileProgress.hidden = !busy;
  }

  function showProgress(job){
    const pct = Math.round((job.progress || 0) * 100);
    const stage = job.stage || "Procesando";
    const isUpscale = runningKind === "upscale";
    const isSegment = runningKind === "segment";
    const isGenerative = runningKind === "generative";
    const isAdvanced = runningKind === "advanced";
    const bar = isAdvanced ? advancedProgressBar : (isGenerative ? generativeProgressBar : (isSegment ? segmentProgressBar : (isUpscale ? upscaleProgressBar : restoreProgressBar)));
    const text = isAdvanced ? advancedProgressText : (isGenerative ? generativeProgressText : (isSegment ? segmentProgressText : (isUpscale ? upscaleProgressText : restoreProgressText)));
    bar.style.width = pct + "%";
    text.textContent = pct + "% · " + stage;
    mobileProgress.textContent = pct + "% · " + stage;
    shell.setSubtitle(name + " · " + pct + "% · " + stage);
  }

  function drawSegmentOverlay(ctx, t){
    if(segmentMask){
      const overlay = document.createElement("canvas");
      overlay.width = segmentMask.w; overlay.height = segmentMask.h;
      const ox = overlay.getContext("2d");
      const img = ox.createImageData(segmentMask.w, segmentMask.h);
      for(let i=0;i<segmentMask.data.length;i++){
        const p=i*4, a=segmentMask.data[i];
        img.data[p]=70; img.data[p+1]=150; img.data[p+2]=255; img.data[p+3]=Math.round(a*0.42);
      }
      ox.putImageData(img,0,0);
      ctx.drawImage(overlay,t.ox,t.oy,segmentMask.w*t.k,segmentMask.h*t.k);
    }
    ctx.lineWidth = Math.max(2, 2*t.dpr);
    for(let i=0;i<segmentPoints.length;i++){
      const p=segmentPoints[i], positive=segmentLabels[i]===1;
      ctx.beginPath();
      ctx.arc(t.ox+p[0]*t.k,t.oy+p[1]*t.k,Math.max(5,6*t.dpr),0,Math.PI*2);
      ctx.fillStyle=positive?"rgba(80,220,120,.95)":"rgba(255,90,90,.95)";
      ctx.fill();
      ctx.strokeStyle="#fff"; ctx.stroke();
    }
  }

  function setSegmentInteract(on){
    shell.setOverlay(on || segmentMask ? drawSegmentOverlay : null);
    shell.setInteract(on ? (type,p,e)=>{
      if(type!=="down") return type==="move" || type==="up";
      if(p.x<0 || p.y<0 || p.x>=source.width || p.y>=source.height) return true;
      segmentPoints.push([Math.round(p.x),Math.round(p.y)]);
      segmentLabels.push(e.altKey ? 0 : 1);
      segmentMask=null;
      segmentRun.disabled=!featureReady("segment-sam2") || !segmentLabels.includes(1);
      shell.redraw();
      return true;
    } : null);
    segmentStart.classList.toggle("on", !!on);
    segmentStart.textContent = on ? "Selección por clic activa" : "Activar selección por clic";
  }

  async function runSegment(){
    if(activeJob || runningKind || !featureReady("segment-sam2") || !segmentLabels.includes(1)) return;
    aborter=new AbortController();
    setRunning("segment",true);
    segmentInvert=segmentTarget.value==="background";
    shell.setBusy("Calculando máscara con SAM2…");
    try{
      const job=await startSegment(source,{points:segmentPoints,labels:segmentLabels,invert:segmentInvert,signal:aborter.signal});
      activeJob=job.id; shell.setBusy("");
      await waitForJob(activeJob,{signal:aborter.signal,onProgress:showProgress});
      segmentMask=await fetchMaskResult(activeJob);
      resultCanvas=source; result16=null; resultKind="segment-mask";
      shell.setOverlay(drawSegmentOverlay); shell.setApplyEnabled(true);
      generativeRun.disabled=!featureReady("generative-flux-fill");
      mobileGenerativeRun.disabled=!featureReady("generative-flux-fill");
      segmentQuality.textContent="SAM2.1 Hiera Large · "+segmentMask.w+" × "+segmentMask.h+" · "+segmentPoints.length+" puntos";
      toast("Máscara calculada. Añade puntos para refinar o pulsa Aplicar.","ok");
    }catch(err){
      if(!err.cancelled && err?.name!=="AbortError") toast("Segmentación IA: "+err.message,"err");
    }finally{
      activeJob=null; aborter=null; setRunning("segment",false); setReady(); shell.setBusy(""); shell.redraw();
    }
  }

  async function runGenerative(promptOverride){
    const prompt = String(promptOverride ?? generativePromptBox.value).trim();
    if(activeJob || runningKind || !featureReady("generative-flux-fill") || !segmentMask || !prompt) return;
    generativePrompt = prompt;
    generativeSeed = Math.max(0, Math.min(2147483647, +(generativeSeedInput.value || 0)));
    aborter = new AbortController();
    setRunning("generative", true);
    shell.setBusy("Preparando FLUX.1 Fill…");
    try{
      const prepared = await preparePreciseSource(source, source.width, source.height);
      const job = await startGenerativeEdit(prepared.payload, segmentMask, {
        prompt,
        guidance:Math.max(1, Math.min(60, +(generativeGuidance.value || 30))),
        steps:Math.max(20, Math.min(80, +(generativeSteps.value || 50))),
        seed:generativeSeed,
        padding:128,
        feather:Math.max(0, Math.min(32, +(generativeFeather.value || 8))),
        maxSide:status?.vramGB >= 11 ? 1024 : 896,
        signal:aborter.signal
      });
      activeJob = job.id;
      shell.setBusy("");
      await waitForJob(activeJob, { signal:aborter.signal, onProgress:showProgress });
      const result = await fetchJobResult(activeJob);
      result16 = result;
      resultCanvas = canvasFromHi(result.data, result.w, result.h);
      resultKind = "generative-edit";
      shell.setView(resultCanvas, false);
      shell.setOriginal(source);
      shell.setOverlay(null);
      shell.setApplyEnabled(true);
      generativeQuality.textContent =
        "FLUX.1 Fill NF4 · " + result.w + " × " + result.h +
        " · semilla " + generativeSeed + " · salida recompuesta a resolución completa";
      shell.setSubtitle(name + " · edición generativa terminada");
      toast("FLUX Fill ha terminado. Revisa el resultado y pulsa Aplicar.","ok");
    }catch(err){
      if(!err.cancelled && err?.name !== "AbortError") toast("FLUX Fill: " + err.message,"err");
      shell.setView(source, false);
      shell.setOverlay(segmentMask ? drawSegmentOverlay : null);
    }finally{
      activeJob=null; aborter=null; setRunning("generative",false); setReady(); shell.setBusy("");
    }
  }

  function syncAdvancedMode(){
    advancedTask = advancedTaskSel.value;
    const needsReference = advancedTask !== "control";
    advancedReferenceWrap.hidden = !needsReference;
    advancedControlWrap.hidden = advancedTask !== "control";
    advancedQuality.textContent = advancedTask === "identity"
      ? "PuLID-FLUX v0.9.1 · FP8 + aggressive offload · identidad facial de máxima calidad práctica para 12 GB."
      : advancedTask === "reference"
        ? "FLUX IP-Adapter · referencia visual para sujeto, estilo y concepto."
        : "FLUX ControlNet Union Pro 2.0 · profundidad, bordes, soft-edge o pose.";
    setReady();
  }

  async function runAdvanced(){
    const task = advancedTaskSel.value;
    const prompt = advancedPromptBox.value.trim();
    const reference = advancedReference.files?.[0] || null;
    if(activeJob || runningKind || !prompt) return;
    if((task === "identity" || task === "reference") && !reference){
      toast("Selecciona una imagen de referencia.","err"); return;
    }
    advancedTask = task;
    advancedPrompt = prompt;
    advancedSeed = Math.max(0, Math.min(2147483647, +(advancedSeedInput.value || 0)));
    aborter = new AbortController();
    setRunning("advanced", true);
    shell.setBusy("Preparando control avanzado…");
    try{
      const prepared = await preparePreciseSource(source, source.width, source.height);
      const strength = +(advancedStrength.value || 1);
      const job = await startAdvancedControl(prepared.payload, {
        task, prompt, reference,
        steps:Math.max(10, Math.min(50, +(advancedSteps.value || 28))),
        guidance:Math.max(1, Math.min(10, +(advancedGuidance.value || 4))),
        seed:advancedSeed,
        identityWeight:task === "identity" ? Math.max(0, Math.min(3, strength)) : 1,
        identityStart:2,
        referenceWeight:task === "reference" ? Math.max(0, Math.min(1.5, strength)) : .8,
        controlMode:advancedControlMode.value,
        controlStrength:task === "control" ? Math.max(.1, Math.min(1, strength)) : .6,
        maxSide:1024,
        signal:aborter.signal
      });
      activeJob = job.id;
      shell.setBusy("");
      await waitForJob(activeJob, { signal:aborter.signal, onProgress:showProgress, interval:500 });
      const result = await fetchJobResult(activeJob);
      result16 = result;
      resultCanvas = canvasFromHi(result.data, result.w, result.h);
      resultKind = "advanced-" + task;
      shell.setView(resultCanvas, false);
      shell.setOriginal(source);
      shell.setOverlay(null);
      shell.setApplyEnabled(true);
      advancedQuality.textContent = result.model + " · semilla " + advancedSeed + " · resultado RGB16";
      shell.setSubtitle(name + " · Fase 7 terminada");
      toast("Control avanzado terminado. Revisa y pulsa Aplicar.","ok");
    }catch(err){
      if(!err.cancelled && err?.name !== "AbortError") toast("Fase 7: " + err.message,"err");
      shell.setView(source, false);
    }finally{
      activeJob=null; aborter=null; setRunning("advanced",false); setReady(); shell.setBusy("");
    }
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
    mobilePromptResult.hidden = true;
    mobilePromptResult.innerHTML = "";
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
      const promptHtml =
        '<b>' + esc(parsed.summary || (changes.length ? "Ajustes interpretados" : "Sin ajustes fotográficos")) + '</b>' +
        (changes.length ? '<span>' + changes.map(([k,v]) => esc(k) + ': ' + esc(v)).join(' · ') + '</span>' : '') +
        (unsupported.length ? '<em>No disponible todavía: ' + unsupported.map(esc).join(' · ') + '</em>' : '');
      promptResult.hidden = false;
      promptResult.innerHTML = promptHtml;
      mobilePromptResult.hidden = false;
      mobilePromptResult.innerHTML = promptHtml;
      if(unsupported.length) toast("Parte del prompt es generativa. Selecciona una zona con SAM2 y usa FLUX Fill.");
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

  segmentStart.addEventListener("click",()=>setSegmentInteract(!segmentStart.classList.contains("on")));
  segmentRun.addEventListener("click",runSegment);
  segmentCancel.addEventListener("click",cancelActive);
  segmentClear.addEventListener("click",()=>{ segmentPoints=[]; segmentLabels=[]; segmentMask=null; resultKind=null; shell.setApplyEnabled(false); shell.setOverlay(segmentStart.classList.contains("on")?drawSegmentOverlay:null); setReady(); shell.redraw(); });
  segmentTarget.addEventListener("change",()=>{ if(segmentMask){ segmentMask.data = Uint8Array.from(segmentMask.data, a=>255-a); segmentInvert=!segmentInvert; shell.redraw(); setReady(); } });
  generativeRun.addEventListener("click",()=>runGenerative());
  generativeCancel.addEventListener("click",cancelActive);
  advancedTaskSel.addEventListener("change",syncAdvancedMode);
  advancedReference.addEventListener("change",setReady);
  advancedRun.addEventListener("click",runAdvanced);
  advancedCancel.addEventListener("click",cancelActive);

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
    if(action === "segment"){
      if(segmentLabels.includes(1)) runSegment();
      else { setSegmentInteract(true); toast("Toca el sujeto u objeto y pulsa Procesar otra vez para calcular la máscara."); }
    }
    else if(action === "denoise" || action === "deblur") runRestore(action);
    else runUpscale(action === "upscale4" ? 4 : 2);
  });
  mobileCancel.addEventListener("click", cancelActive);
  promptRun.addEventListener("click", runPrompt);
  mobilePromptRun.addEventListener("click", () => {
    promptBox.value = mobilePrompt.value;
    runPrompt();
  });
  mobileGenerativeRun.addEventListener("click", () => {
    generativePromptBox.value = mobilePrompt.value;
    runGenerative(mobilePrompt.value);
  });
  promptReset.addEventListener("click", resetAdjustments);
  promptBox.addEventListener("keydown", e => {
    if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); runPrompt(); }
  });
  shell.right.querySelector(".aai-retry").addEventListener("click", check);

  syncAdvancedMode();
  check();
  return { close };
}
