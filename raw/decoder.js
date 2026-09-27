import LibRaw from "./vendor/libraw-wasm/dist/index.js";
import { linearSource } from './source.js';
export { RAW_EXTENSIONS, isRawFile } from "./formats.js";

const drawData = image => {
  if(!image?.data || !image?.width || !image?.height) throw new Error("LibRaw no devolvió píxeles revelados");
  const pixels=image.width*image.height, source=image.data;
  /* LibRaw-Wasm devuelve RGB (3 componentes), mientras Canvas ImageData
     exige RGBA. Las miniaturas bitmap también pueden llegar con RGB. */
  const channels=image.colors || Math.round(source.length/pixels);
  if(![1,3,4].includes(channels) || source.length<pixels*channels) throw new Error("LibRaw devolvió un formato de píxel no compatible");
  const is16=source instanceof Uint16Array || image.bits>8;
  const rgba=new Uint8ClampedArray(pixels*4);
  for(let px=0,si=0,di=0;px<pixels;px++,si+=channels,di+=4){
    const value=at=>is16?Math.round(source[si+at]/257):source[si+at];
    if(channels===1) rgba[di]=rgba[di+1]=rgba[di+2]=value(0);
    else { rgba[di]=value(0);rgba[di+1]=value(1);rgba[di+2]=value(2); }
    rgba[di+3]=channels===4?value(3):255;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.width; canvas.height = image.height;
  canvas.getContext("2d", { willReadFrequently:true }).putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
  return canvas;
};

const listNumbers=value=>{
  if(Array.isArray(value))return value.map(Number);
  if(typeof value!=='string'||!value.trim())return null;
  const values=value.split(/[;,\s]+/).map(Number);
  return values.every(Number.isFinite)?values:null;
};
const optionalText=value=>typeof value==='string'&&value.trim()?value.trim():null;
const rawOptions = settings => ({
  bright: settings.bright,
  threshold: settings.threshold,
  autoBrightThr: settings.autoBrightThr,
  adjustMaximumThr: settings.adjustMaximumThr,
  expShift: settings.expShift,
  expPreser: settings.expPreser,
  halfSize: settings.halfSize,
  fourColorRgb: settings.fourColorRgb,
  useCameraWb: settings.wb === "camera",
  useAutoWb: settings.wb === "auto",
  useCameraMatrix: settings.useCameraMatrix,
  outputColor: settings.outputColor,
  outputBps: settings.outputBps,
  outputTiff: settings.outputTiff,
  outputFlags: settings.outputFlags,
  userFlip: settings.userFlip,
  userQual: settings.userQual,
  userBlack: settings.userBlack,
  userCblack: listNumbers(settings.userCblack),
  userSat: settings.userSat,
  medPasses: settings.medPasses,
  useFujiRotate: settings.useFujiRotate,
  greenMatching: settings.greenMatching,
  dcbIterations: settings.dcbIterations,
  dcbEnhanceFl: settings.dcbEnhanceFl,
  fbddNoiserd: settings.fbddNoiserd,
  expCorrec: settings.expCorrec,
  noAutoScale: settings.noAutoScale,
  noInterpolation: settings.noInterpolation,
  greybox: listNumbers(settings.greybox), cropbox:listNumbers(settings.cropbox),
  aber:listNumbers(settings.aber), gamm:listNumbers(settings.gamm), userMul:listNumbers(settings.userMul),
  outputProfile: optionalText(settings.outputProfile),
  cameraProfile: optionalText(settings.cameraProfile),
  badPixels: optionalText(settings.badPixels),
  darkFrame: optionalText(settings.darkFrame),
  noAutoBright: settings.noAutoBright ?? true,
  highlight: settings.highlight
});

export class RawDecoder {
  static async open(file, settings = {}) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const raw = new LibRaw();
    try {
      /* El worker transfiere el buffer que recibe: conservar la copia original
         permite volver a decodificar sin tocar el archivo del usuario. */
      await raw.open(bytes.slice(), rawOptions(settings));
      const [metadata, pixels] = await Promise.all([raw.metadata(true), raw.imageData()]);
      return new RawDecoder(file, bytes, raw, metadata || {}, linearSource(pixels));
    } catch(error) {
      raw.dispose();
      throw new Error(`No se pudo revelar este RAW: ${error?.message || error}`);
    }
  }

  constructor(file, bytes, raw, metadata, canvas) {
    this.file = file; this.bytes = bytes; this.raw = raw;
    this.metadata = metadata; this.source = canvas;
  }

  async renderBase(settings) {
    await this.raw.open(this.bytes.slice(), rawOptions(settings));
    return linearSource(await this.raw.imageData());
  }

  async thumbnail() {
    const image = await this.raw.thumbnailData();
    if (!image?.data) throw new Error("El archivo no incluye una previsualización");
    if (image.format === "bitmap") return drawData(image);
    if (image.format === "jpeg") {
      const bitmap = await createImageBitmap(new Blob([image.data], { type:"image/jpeg" }));
      const canvas = document.createElement("canvas");
      canvas.width = image.width || bitmap.width; canvas.height = image.height || bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      return canvas;
    }
    throw new Error("La previsualización incrustada no es JPEG ni bitmap");
  }

  dispose() { this.raw?.dispose(); this.raw = null; this.bytes = null; this.source = null; }
}
