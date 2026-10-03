import { createShell } from "../../js/ui/fsshell.js";
import { probeLocalService } from "../client/local-service.js";

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

export function openAdvancedAIEditor(opts){
  var source = opts.source, name = opts.name, width = opts.width, height = opts.height;
  var shell;
  var close = function(){ if(shell) shell.close(); };

  shell = createShell({
    title: "IA avanzada",
    subtitle: name + " · " + width + " × " + height + " · Fase 1",
    applyLabel: "Aplicar",
    cls: "aai-shell",
    onApply: function(){},
    onCancel: close
  });

  shell.setApplyEnabled(false);
  shell.setView(source, false);
  shell.setOriginal(source);

  shell.left.innerHTML =
    '<div class="aai-panel-head"><b>Ajustes fotográficos</b>' +
    '<span>La infraestructura está preparada; los motores se activarán por fases.</span></div>' +
    '<div class="aai-controls">' + controlsMarkup() + '</div>' +
    '<div class="aai-upscale is-future"><span>Upscale IA</span>' +
    '<select disabled><option>Desactivado</option><option>×2</option><option>×4</option></select></div>';

  shell.right.innerHTML =
    '<section class="aai-engine"><div class="aai-panel-head"><b>Motor IA local</b><span>CUDA/PyTorch en este PC.</span></div>' +
    '<div data-engine-status>' + statusMarkup(null) + '</div>' +
    '<button type="button" class="aai-retry">Volver a comprobar</button></section>' +
    '<section class="aai-prompt"><div class="aai-panel-head"><b>Prompt</b>' +
    '<span>Edición generativa se activará en las fases posteriores.</span></div>' +
    '<textarea rows="6" placeholder="Ej.: cambia el pelo a rubio, pon una montaña de fondo, añade una cabra a mi lado…"></textarea>' +
    '<div class="aai-prompt-actions"><button type="button" disabled>Generar</button><span>Fase 6</span></div></section>' +
    '<section class="aai-plan"><b>Estado del proyecto</b><span>Fase 1 · interfaz + detección del servicio local</span>' +
    '<small>Los modelos vivirán exclusivamente en advanced-ai/models/.</small></section>';

  shell.mobile.innerHTML =
    '<div class="aai-mobile-status" data-mobile-status>' + statusMarkup(null) + '</div>' +
    '<button type="button" class="aai-mobile-retry">Comprobar GPU local</button>' +
    '<div class="aai-mobile-note">Fase 1 · los controles y el prompt se activarán progresivamente.</div>';

  var statusHost = shell.right.querySelector("[data-engine-status]");
  var mobileStatus = shell.mobile.querySelector("[data-mobile-status]");
  var checking = false;

  async function check(){
    if(checking || shell.closed) return;
    checking = true;
    var wait = statusMarkup(null);
    statusHost.innerHTML = wait;
    mobileStatus.innerHTML = wait;
    var s = await probeLocalService();
    if(shell.closed) return;
    var html = statusMarkup(s);
    statusHost.innerHTML = html;
    mobileStatus.innerHTML = html;
    checking = false;
  }

  shell.right.querySelector(".aai-retry").addEventListener("click", check);
  shell.mobile.querySelector(".aai-mobile-retry").addEventListener("click", check);
  check();

  return { close: close };
}
