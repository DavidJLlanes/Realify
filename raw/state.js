export const RAW_VERSION = 2;

export const GROUPS = [
  ["motor", "Motor RAW"], ["perfil", "Perfil"], ["luz", "Luz"], ["color", "Color"],
  ["detalle", "Detalle"], ["optica", "Óptica"], ["efectos", "Efectos"]
];

export const CONTROLS = [
  { group:"motor", key:"bright", label:"Brillo del motor", type:"range", engine:true, min:0, max:4, step:.01, unit:"" },
  { group:"motor", key:"threshold", label:"Umbral de ruido RAW", type:"range", engine:true, min:0, max:100, step:1, unit:"" },
  { group:"motor", key:"autoBrightThr", label:"Umbral de brillo automático", type:"range", engine:true, min:0, max:1, step:.01, unit:"" },
  { group:"motor", key:"adjustMaximumThr", label:"Ajuste de máximo", type:"range", engine:true, min:0, max:1, step:.01, unit:"" },
  { group:"motor", key:"expShift", label:"Exposición del motor", type:"range", engine:true, min:.25, max:4, step:.01, unit:"×" },
  { group:"motor", key:"expPreser", label:"Conservar altas luces RAW", type:"range", engine:true, min:0, max:1, step:.01, unit:"" },
  { group:"motor", key:"halfSize", label:"Media resolución", type:"toggle", engine:true },
  { group:"motor", key:"fourColorRgb", label:"RGB de cuatro colores", type:"toggle", engine:true },
  { group:"motor", key:"highlight", label:"Modo de altas luces RAW", type:"choice", engine:true, options:[[0,"0 · Recortar"],[1,"1 · Clip"],[2,"2 · Blend"],[3,"3 · Reconstruct"],[4,"4 · Reconstruct"],[5,"5 · Reconstruct"],[6,"6 · Reconstruct"],[7,"7 · Reconstruct"],[8,"8 · Reconstruct"],[9,"9 · Reconstruct"]] },
  { group:"motor", key:"useCameraMatrix", label:"Matriz de cámara", type:"choice", engine:true, options:[[0,"Desactivada"],[1,"Si hay balance"],[3,"Siempre"]] },
  { group:"motor", key:"outputColor", label:"Espacio de salida", type:"choice", engine:true, options:[[0,"RAW"],[1,"sRGB"],[2,"Adobe RGB"],[3,"Wide Gamut"],[4,"ProPhoto"],[5,"XYZ"],[6,"ACES"],[7,"DCI-P3"],[8,"Rec.2020"]] },
  { group:"motor", key:"outputBps", label:"Bits por canal", type:"choice", engine:true, options:[[8,"8 bits"],[16,"16 bits"]] },
  { group:"motor", key:"outputTiff", label:"Salida TIFF RAW", type:"toggle", engine:true },
  { group:"motor", key:"outputFlags", label:"Flags de salida", type:"range", engine:true, min:0, max:255, step:1, unit:"" },
  { group:"motor", key:"userFlip", label:"Orientación LibRaw", type:"choice", engine:true, options:[[-1,"Usar orientación RAW"],[0,"Sin rotación"],[1,"Normal"],[2,"Espejo horizontal"],[3,"180°"],[4,"Espejo vertical"],[5,"90° antihorario"],[6,"90° horario"],[7,"Espejo + 90°"]] },
  { group:"motor", key:"userQual", label:"Calidad de interpolación", type:"range", engine:true, min:0, max:12, step:1, unit:"" },
  { group:"motor", key:"userBlack", label:"Nivel negro", type:"range", engine:true, min:-1, max:65535, step:1, unit:"" },
  { group:"motor", key:"userCblack", label:"Negro por canal (r,g,b,g2)", type:"text", engine:true },
  { group:"motor", key:"userSat", label:"Saturación del motor", type:"range", engine:true, min:0, max:8, step:.01, unit:"×" },
  { group:"motor", key:"medPasses", label:"Pasadas de mediana", type:"range", engine:true, min:0, max:10, step:1, unit:"" },
  { group:"motor", key:"useFujiRotate", label:"Rotación Fuji", type:"choice", engine:true, options:[[-1,"Usar valor RAW"],[0,"Desactivada"],[1,"Activada"]] },
  { group:"motor", key:"greenMatching", label:"Igualar canales verdes", type:"toggle", engine:true },
  { group:"motor", key:"dcbIterations", label:"Pasadas DCB", type:"range", engine:true, min:-1, max:4, step:1, unit:"" },
  { group:"motor", key:"dcbEnhanceFl", label:"Mejora de color DCB", type:"toggle", engine:true },
  { group:"motor", key:"fbddNoiserd", label:"Reducción FBDD", type:"choice", engine:true, options:[[0,"Desactivada"],[1,"Ligera"],[2,"Completa"]] },
  { group:"motor", key:"expCorrec", label:"Corrección de exposición LibRaw", type:"toggle", engine:true },
  { group:"motor", key:"noAutoScale", label:"Desactivar escalado automático", type:"toggle", engine:true },
  { group:"motor", key:"noInterpolation", label:"Sin interpolación (mosaico)", type:"toggle", engine:true },
  { group:"motor", key:"noAutoBright", label:"Desactivar brillo automático", type:"toggle", engine:true },
  { group:"motor", key:"greybox", label:"Rectángulo de balance (x,y,w,h)", type:"text", engine:true },
  { group:"motor", key:"cropbox", label:"Recorte RAW (x,y,w,h)", type:"text", engine:true },
  { group:"motor", key:"aber", label:"Aberración RAW (r,g,b)", type:"text", engine:true },
  { group:"motor", key:"gamm", label:"Gamma (potencia, curva) ", type:"text", engine:true },
  { group:"motor", key:"userMul", label:"Multiplicadores WB (r,g,b,g2)", type:"text", engine:true },
  { group:"motor", key:"outputProfile", label:"Perfil ICC de salida", type:"text", engine:true },
  { group:"motor", key:"cameraProfile", label:"Perfil ICC de cámara", type:"text", engine:true },
  { group:"motor", key:"badPixels", label:"Mapa de píxeles defectuosos", type:"text", engine:true },
  { group:"motor", key:"darkFrame", label:"Fotograma oscuro (PGM)", type:"text", engine:true },
  { group:"perfil", key:"wb", label:"Balance de blancos", type:"choice", options:[["camera","Como se tomó"],["auto","Automático"],["daylight","Luz día"],["cloudy","Nublado"],["shade","Sombra"],["tungsten","Tungsteno"],["fluorescent","Fluorescente"],["flash","Flash"]] },
  { group:"perfil", key:"temperature", label:"Temperatura", min:-100, max:100, step:1, unit:"" },
  { group:"perfil", key:"tint", label:"Matiz", min:-100, max:100, unit:"" },
  { group:"luz", key:"exposure", label:"Exposición", min:-5, max:5, step:.05, unit:" EV" },
  { group:"luz", key:"contrast", label:"Contraste", min:-100, max:100, unit:"" },
  { group:"luz", key:"highlights", label:"Altas luces", min:-100, max:100, unit:"" },
  { group:"luz", key:"shadows", label:"Sombras", min:-100, max:100, unit:"" },
  { group:"luz", key:"whites", label:"Blancos", min:-100, max:100, unit:"" },
  { group:"luz", key:"blacks", label:"Negros", min:-100, max:100, unit:"" },
  { group:"color", key:"vibrance", label:"Intensidad", min:-100, max:100, unit:"" },
  { group:"color", key:"saturation", label:"Saturación", min:-100, max:100, unit:"" },
  { group:"color", key:"hue", label:"Tono global", min:-180, max:180, unit:"°" },
  { group:"color", key:"space", label:"Espacio de color", type:"choice", engine:true, options:[["srgb","sRGB"],["display-p3","Display P3 (gama amplia)"]] },
  { group:"detalle", key:"sharpen", label:"Enfoque", min:0, max:100, unit:"" },
  { group:"detalle", key:"noise", label:"Reducir ruido", min:0, max:100, unit:"" },
  { group:"detalle", key:"colorNoise", label:"Ruido de color", min:0, max:100, unit:"" },
  { group:"optica", key:"ca", label:"Aberración cromática", min:-100, max:100, unit:"" },
  { group:"optica", key:"lensVignette", label:"Viñeteado de lente", min:-100, max:100, unit:"" },
  { group:"efectos", key:"clarity", label:"Claridad", min:-100, max:100, unit:"" },
  { group:"efectos", key:"texture", label:"Textura", min:-100, max:100, unit:"" },
  { group:"efectos", key:"dehaze", label:"Borrar neblina", min:-100, max:100, unit:"" },
  { group:"efectos", key:"vignette", label:"Viñeteado posterior", min:-100, max:100, unit:"" },
  { group:"efectos", key:"grain", label:"Grano", min:0, max:100, unit:"" }
];

export const defaults = () => ({
  version: RAW_VERSION, wb:"camera", temperature:0, tint:0,
  bright:1, threshold:0, autoBrightThr:.01, adjustMaximumThr:.75, expShift:1, expPreser:0,
  halfSize:false, fourColorRgb:false, highlight:5, useCameraMatrix:1, outputColor:1,
  outputBps:16, outputTiff:false, outputFlags:0, userFlip:-1, userQual:3, userBlack:-1,
  userCblack:"-1,-1,-1,-1", userSat:0,
  medPasses:0, useFujiRotate:-1, greenMatching:false, dcbIterations:-1, dcbEnhanceFl:false,
  fbddNoiserd:0, expCorrec:false, noAutoScale:false, noInterpolation:false, noAutoBright:true,
  greybox:"", cropbox:"", aber:"", gamm:"1,1", userMul:"",
  outputProfile:"", cameraProfile:"", badPixels:"", darkFrame:"",
  exposure:0, contrast:0, highlights:0, shadows:0, whites:0, blacks:0,
  vibrance:0, saturation:0, hue:0, sharpen:0, noise:0, colorNoise:0,
  ca:0, lensVignette:0, clarity:0, texture:0, dehaze:0, vignette:0, grain:0,
  premium:false, space:"srgb"
});

export const normalize = value => {
  const state={...defaults(),...(value||{}),version:RAW_VERSION};
  state.premium=!!state.premium;
  if(state.temperature>100)state.temperature=(state.temperature-5500)/65;
  for(const item of CONTROLS){
    if(item.type==='choice'){if(!item.options.some(([key])=>key===state[item.key]))state[item.key]=defaults()[item.key];}
    else if(item.type==='toggle')state[item.key]=!!state[item.key];
    else if(item.type==='text')state[item.key]=typeof state[item.key]==='string'?state[item.key]:'';
    else state[item.key]=Math.max(item.min,Math.min(item.max,Number.isFinite(+state[item.key])?+state[item.key]:0));
  }
  return state;
};
export const control = key => CONTROLS.find(item => item.key === key);
export const controlsFor = group => CONTROLS.filter(item => item.group === group);
export const valueText = (item, value) => item.type === "choice"
  ? (item.options.find(option => option[0] === value)?.[1] || value)
  : item.type === "toggle" ? (value ? "Activado" : "Desactivado")
  : item.type === "text" ? (value || "Vacío")
  : `${Number(value).toFixed(item.step && item.step < 1 ? 2 : 0)}${item.unit || ""}`;
