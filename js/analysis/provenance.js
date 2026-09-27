/* ═══════════════════════════════════════════════════════════════
   MARCAS DE PROCEDENCIA
   Qué declara un archivo sobre su propio origen. Son tres cosas
   distintas que suelen confundirse:

   · CREDENCIALES DE CONTENIDO (C2PA). Un manifiesto firmado
     criptográficamente que va en una caja JUMBF: en JPEG dentro de un
     segmento APP11, en PNG dentro de un trozo `caBX`. Lo escriben
     varios generadores y ya algunas cámaras. Va aparte del EXIF, así
     que limpiar EXIF no lo toca.

   · TIPO DE FUENTE DIGITAL (IPTC `digitalSourceType`). Una etiqueta
     dentro del XMP que dice literalmente si el material salió de un
     modelo entrenado. Es la declaración más explícita que existe y la
     más fácil de pasar por alto, porque viaja en texto plano dentro de
     otro bloque de metadatos.

   · XMP en general, que puede llevar herramienta y autoría.

   Este módulo sólo MIRA. Quitarlas ya lo hacían los limpiadores de
   io/strip.js, que funcionan por lista blanca: cualquier bloque que no
   esté en la lista de lo imprescindible se cae, y ni `caBX` ni APP11
   están en ella. Lo que faltaba era poder decir qué había antes de
   quitarlo, porque «caBX» en un informe no le dice nada a nadie.

   Aviso que conviene no perder de vista: la ausencia de estas marcas
   NO acredita que una imagen sea una fotografía real, y su presencia
   tampoco prueba lo contrario. Son declaraciones que alguien escribió
   en el archivo, no evidencia de la captura. Además existen marcas
   invisibles incrustadas en los propios píxeles que esto no ve ni
   puede quitar.
   ═══════════════════════════════════════════════════════════════ */

const ascii = (u8, from, len) => {
  let out = "";
  const end = Math.min(u8.length, from + len);
  for(let i = from; i < end; i++) out += String.fromCharCode(u8[i]);
  return out;
};

/* Busca una cadena ASCII dentro de un tramo de bytes. Se compara byte
   a byte en vez de decodificar el tramo entero a texto: un manifiesto
   puede ocupar megas y llevar binario que rompería el decodificado. */
function contains(u8, from, to, needle){
  const n = needle.length, limit = Math.min(to, u8.length) - n;
  for(let i = Math.max(0, from); i <= limit; i++){
    let k = 0;
    while(k < n && u8[i + k] === needle.charCodeAt(k)) k++;
    if(k === n) return true;
  }
  return false;
}

const AI_SOURCE_TYPES = ["trainedAlgorithmicMedia", "compositeWithTrainedAlgorithmicMedia",
                         "algorithmicMedia"];

function inspectXmp(u8, from, to, found){
  found.xmp = true;
  for(const type of AI_SOURCE_TYPES){
    if(contains(u8, from, to, type)){
      found.aiDeclared = true;
      found.sourceType = type;
      break;
    }
  }
  if(!found.sourceType && contains(u8, from, to, "digitalSourceType")) found.sourceType = "declarado";
}

/** @returns {{container:string|null, c2pa:boolean, xmp:boolean, exif:boolean,
 *             aiDeclared:boolean, sourceType:string|null, markers:string[]}} */
export function detectProvenance(bytes){
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  const found = { container: null, c2pa: false, xmp: false, exif: false,
                  aiDeclared: false, sourceType: null, markers: [] };

  if(u8.length >= 3 && u8[0] === 0xFF && u8[1] === 0xD8){
    found.container = "jpeg";
    let i = 2;
    while(i < u8.length - 3){
      if(u8[i] !== 0xFF) break;
      let j = i;
      while(u8[j + 1] === 0xFF) j++;
      const marker = u8[j + 1];
      if(marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)){ i = j + 2; continue; }
      if(marker === 0xDA) break;                    // empieza el dato comprimido
      const len = (u8[j + 2] << 8) | u8[j + 3];
      if(len < 2) break;
      const start = j + 4, end = j + 2 + len;

      if(marker === 0xEB){                          // APP11: envoltorio JUMBF
        if(contains(u8, start, end, "jumb") || contains(u8, start, end, "c2pa")){
          found.c2pa = true; found.markers.push("APP11 · JUMBF/C2PA");
        }
      } else if(marker === 0xE1){                   // APP1: EXIF o XMP
        const tag = ascii(u8, start, 32);
        if(tag.startsWith("Exif")){ found.exif = true; found.markers.push("APP1 · EXIF"); }
        else if(tag.includes("ns.adobe.com/xap")){
          inspectXmp(u8, start, end, found);
          found.markers.push("APP1 · XMP");
        }
      }
      i = end;
    }
    return found;
  }

  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  if(u8.length >= 8 && PNG_SIG.every((b, k) => u8[k] === b)){
    found.container = "png";
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let i = 8;
    while(i + 8 <= u8.length){
      const len = dv.getUint32(i);
      const type = ascii(u8, i + 4, 4);
      const total = 12 + len;
      if(total < 12 || i + total > u8.length) break;
      const start = i + 8, end = start + len;

      if(type === "caBX"){ found.c2pa = true; found.markers.push("caBX · C2PA"); }
      else if(type === "iTXt" || type === "tEXt" || type === "zTXt"){
        if(contains(u8, start, end, "XML:com.adobe.xmp") || contains(u8, start, end, "ns.adobe.com/xap")){
          inspectXmp(u8, start, end, found);
          found.markers.push(`${type} · XMP`);
        } else if(contains(u8, start, end, "parameters") || contains(u8, start, end, "prompt")){
          // Varias herramientas guardan el prompt en un tEXt suelto.
          found.markers.push(`${type} · texto incrustado`);
        }
      } else if(type === "eXIf"){
        found.exif = true; found.markers.push("eXIf · EXIF");
      }
      i += total;
      if(type === "IEND") break;
    }
    return found;
  }

  return found;                                     // contenedor desconocido
}

/** Resumen legible, para enseñar en un diálogo. */
export function describeProvenance(found){
  if(!found.container) return "No se reconoce el formato del archivo.";
  const lines = [];
  if(found.aiDeclared){
    lines.push(`El archivo declara ser material generado o compuesto por un modelo (${found.sourceType}).`);
  } else if(found.sourceType){
    lines.push("El archivo declara un tipo de fuente digital.");
  }
  if(found.c2pa) lines.push("Lleva credenciales de contenido C2PA firmadas, que van aparte del EXIF.");
  if(found.xmp && !found.aiDeclared && !found.sourceType) lines.push("Lleva metadatos XMP.");
  if(found.exif) lines.push("Lleva EXIF.");
  if(!lines.length) return "No se ha encontrado ninguna marca de procedencia declarada.";
  return lines.join(" ");
}
