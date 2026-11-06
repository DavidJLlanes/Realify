/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · IMPORTAR Y EXPORTAR MEDIOS
   Registros de decodificadores y codificadores (con respaldo) y las dos puertas que usa el resto del editor: abrirMedio(archivo) y crearCodificador(config).
   Un decodificador que falla al abrir se descarta y se prueba el siguiente. Si ninguno sirve, el Error explica por qué.
   Entradas: File/Blob o { ancho, alto, fps, contenedor }. Salidas: { medio (para el proyecto), lector } / codificador.
   ═══════════════════════════════════════════════════════════════ */
import { crearRegistro } from "./registro.js";
import * as dMediabunny from "./decoders/mediabunny.js";
import * as dElemento from "./decoders/elemento-video.js";
import * as eMediabunny from "./encoders/mediabunny.js";
import { crearMedio, huella } from "../project/modelo.js";

export const decodificadores = crearRegistro(), codificadores = crearRegistro();
[dMediabunny, dElemento].forEach(d => decodificadores.registrar(d));
codificadores.registrar(eMediabunny);

export async function abrirMedio(archivo, { ancho = 0, excluir = [] } = {}){
  const usados = [...excluir];
  for(;;){
    const { proveedor, motivos } = await decodificadores.elegir(archivo, { excluir: usados });
    if(!proveedor) throw new Error("No puedo abrir este vídeo en este dispositivo. " + motivos.join(" · "));
    try{
      const lector = await proveedor.abrir(archivo, { ancho }), i = lector.info;
      return { lector, decodificador: proveedor.id, medio: crearMedio({ nombre: archivo.name || "vídeo", tipo: "video", duracion: i.duracion, ancho: i.ancho, alto: i.alto, fps: i.fps, huella: huella(archivo) }) };
    }catch(e){ usados.push(proveedor.id); if(!(await decodificadores.elegir(archivo, { excluir: usados })).proveedor) throw e; }
  }
}

export async function crearCodificador(cfg){
  const { proveedor, motivos } = await codificadores.elegir(cfg);
  if(!proveedor) throw new Error(`Este dispositivo no puede codificar ${cfg.contenedor?.toUpperCase() || "vídeo"} a ${cfg.ancho}×${cfg.alto}. Prueba con ${cfg.contenedor === "webm" ? "MP4" : "WebM"} o una resolución menor. ${motivos.join(" · ")}`);
  return proveedor.crear(cfg);
}
