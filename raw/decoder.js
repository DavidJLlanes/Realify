import LibRaw from "./vendor/libraw-wasm/dist/index.js";
import { linearSource } from './source.js';
import { premiumEngine, PREMIUM_OUTPUT_COLOR, RAW_BASE_EV, outSpaceOf } from './premium/core.js';
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
/* Premium: Rec.2020, demosaico DHT y margen de altas luces (ver
   premium/core.js › premiumEngine). */
/* Revelado de siempre en Display P3: LibRaw entrega Rec.2020 (sin recortar a sRGB) y el revelado lo pasa a P3 (raw/pipeline.js, raw/source.js) */
const wideStandard = settings => !settings.premium && outSpaceOf(settings) === 'display-p3';
const engineSettings = settings => settings.premium ? { ...settings, ...premiumEngine(settings) } : wideStandard(settings) ? { ...settings, outputColor: PREMIUM_OUTPUT_COLOR } : settings;
const sourceMeta = settings => {
  const e = engineSettings(settings);
  return { space: e.outputColor === PREMIUM_OUTPUT_COLOR && (settings.premium || wideStandard(settings)) ? 'rec2020' : 'srgb',
           gain: settings.premium && e.expCorrec && !settings.expCorrec ? 1 / e.expShift : 1,
           base: 2 ** RAW_BASE_EV };
};
const rawOptions = settings => rawOptionsFor(engineSettings(settings));
const rawOptionsFor = settings => ({
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
  static async open(file, settings = {}, { thumbnailOnly = false } = {}) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const raw = new LibRaw();
    try {
      /* Transfer directly; reread the File for subsequent engine changes.
         Terminate WASM after decoding instead of retaining its large heap. */
      await raw.open(bytes, rawOptions(settings));
      const metadata = await raw.metadata(true);
      if(thumbnailOnly) return new RawDecoder(file, null, raw, metadata || {}, null);
      const source = linearSource(await raw.imageData(), sourceMeta(settings));
      raw.dispose();
      return new RawDecoder(file, null, null, metadata || {}, source);
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
    if(this.closed) throw new Error('Decodificador cerrado');
    const raw = this.raw = new LibRaw();
    try {
      const bytes = new Uint8Array(await this.file.arrayBuffer());
      if(this.closed) throw new Error('Decodificador cerrado');
      await raw.open(bytes, rawOptions(settings));
      return linearSource(await raw.imageData(), sourceMeta(settings));
    } finally {
      raw.dispose();
      if(this.raw === raw) this.raw = null;
    }
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

  dispose() { this.closed = true; this.raw?.dispose(); this.raw = null; this.bytes = null; this.source = null; }
}
