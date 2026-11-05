/* ═══════════════════════════════════════════════════════════════
   FASE 0 DEL PLAN DE IA · división de js/ai/worker.js
   Reparte worker.js con el divisor de módulos (tools/migrate/lib/splitter.mjs) sin cambiar su código:
     · js/ai/engine/  → infraestructura del worker (mensajes, almacén de modelos, sesiones, tensores, teselas)
     · js/ai/tasks/   → una tarea por archivo (matte, inpaint, restore, upscale, colorize, probe, sam, faces, parse,
                        depth, face-restore, classify, sky, person, clipseg)
     · js/ai/worker.js se queda de despachador: configura ONNX Runtime, la tabla TASKS y onmessage.
   Uso: node tools/migrate/ia-fase0-worker.mjs [--dry]
   Comprobación después: node tools/verify/units-equal.mjs <copia del original> <archivos nuevos…>
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitFile } from "./lib/splitter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINEA = "   ═══════════════════════════════════════════════════════════════";
const cab = (titulo, ...lineas) => `/*${LINEA.slice(2)}\n   ${titulo}\n${lineas.map(l => "   " + l).join("\n")}\n${LINEA} */`;

const groups = [
  { file: "engine/post.js", names: ["post"],
    header: cab("IA · WORKER · MENSAJES", "Envía mensajes desde el worker al hilo de la interfaz (con objetos transferibles).", "Entradas: el mensaje y la lista de buffers a transferir. Salida: ninguna.") },
  { file: "engine/model-store.js", names: ["DB_NAME", "STORE", "openDb", "dbGet", "dbPut", "dbHas", "fetchModel", "listStored", "deleteStored"],
    header: cab("IA · WORKER · ALMACÉN DE MODELOS", "Descarga cada modelo una sola vez y lo guarda en IndexedDB (no en la Cache API: el service worker la vacía en cada versión).", "Entradas: id y descriptor del modelo. Salidas: bytes del modelo; lista y borrado de lo guardado.", "Límite: los modelos servidos por la propia web no se guardan, se leen de su URL.") },
  { file: "engine/sessions.js", names: ["sessions", "gpuFailed", "gpuAdapter", "hasGpuAdapter", "getSession", "runSession", "release"],
    header: cab("IA · WORKER · SESIONES DE ONNX RUNTIME", "Crea y reutiliza las sesiones: WebGPU si hay adaptador real; si no, o si el modelo no arranca con ella, WebAssembly.", "Entradas: id y descriptor del modelo; los tensores de entrada. Salidas: la sesión y su backend; el resultado de la inferencia.", "Límite: un modelo que falla en GPU se recuerda (gpuFailed) y no vuelve a intentarlo en esa sesión del worker.") },
  { file: "engine/tensors.js", names: ["f32", "u32", "toHalf", "fromHalf", "makeTensor", "readFloats", "inputType", "rgbaToPlanar"],
    header: cab("IA · WORKER · TENSORES", "Conversión entre píxeles RGBA, planos normalizados y tensores float32 o float16.", "Entradas: píxeles, tipo de entrada del modelo, dimensiones. Salidas: tensores o Float32Array.", "Sin acceso al DOM: sólo cálculo.") },
  { file: "engine/tiling.js", names: ["starts", "mirror"],
    header: cab("IA · WORKER · TESELAS", "Posiciones de las teselas solapadas y reflejo de bordes para procesar imágenes grandes por bloques.", "Entradas: longitud, tamaño de tesela y solape. Salidas: lista de inicios; índice reflejado.") },
  { file: "tasks/matte.js", names: ["matte"], header: cab("IA · TAREA · MATTE", "Alfa de un modelo de segmentación (eliminar fondo, selección con un toque).", "Entradas: modelo, imagen RGBA y tamaño. Salida: máscara alfa.") },
  { file: "tasks/inpaint.js", names: ["inpaint"], header: cab("IA · TAREA · RELLENO (LaMa)", "Rellena un hueco sobre un recorte ya preparado a 512×512.", "Entradas: modelo, imagen RGBA y máscara del hueco. Salida: imagen rellenada.") },
  { file: "tasks/restore.js", names: ["restore"], header: cab("IA · TAREA · RESTAURAR (SCUNet / FBCNN)", "Reducción de ruido y de artefactos JPEG por teselas sobre la imagen entera.", "Entradas: modelo, imagen RGBA, tamaño y fuerza. Salida: imagen restaurada.") },
  { file: "tasks/upscale.js", names: ["upscale"], header: cab("IA · TAREA · AMPLIAR", "Amplía la imagen con un modelo de superresolución, por teselas.", "Entradas: modelo, imagen RGBA y tamaño. Salida: imagen ampliada.") },
  { file: "tasks/colorize.js", names: ["colorize"], header: cab("IA · TAREA · COLOREAR", "Colorea una imagen en blanco y negro: predice los canales a y b del espacio Lab.", "Entradas: modelo, imagen RGBA y tamaño. Salida: canales ab.") },
  { file: "tasks/probe.js", names: ["probe"], header: cab("IA · TAREA · SONDA", "Comprueba que un modelo arranca y con qué backend, sin procesar ninguna imagen.", "Entradas: modelo e id. Salida: confirmación.") },
  { file: "tasks/sam.js", names: ["samCache", "clearSamCache", "samEncode", "samDecode"],
    header: cab("IA · TAREA · MobileSAM", "El codificador corre una vez por foto (samEncode) y su resultado se guarda aquí; cada toque sólo ejecuta el decodificador (samDecode).", "Entradas: foto, puntos y etiquetas. Salida: máscara. clearSamCache() la vacía al olvidar modelos.", "Límite: una sola foto codificada a la vez, identificada por `key`.") },
  { file: "tasks/faces.js", names: ["faces"], header: cab("IA · TAREA · DETECCIÓN DE CARAS (YuNet)", "Detecta caras y sus puntos.", "Entradas: modelo, imagen RGBA, tamaño y umbral. Salida: cajas y puntos.") },
  { file: "tasks/parse.js", names: ["PARSE_GROUPS", "parse"], header: cab("IA · TAREA · PARTES DE LA CARA (BiSeNet)", "Segmenta pelo, ojos, labios, orejas, cuello, gafas y sombrero.", "Entradas: modelo, imagen RGBA y partes pedidas. Salida: máscaras por grupo.") },
  { file: "tasks/depth.js", names: ["depth"], header: cab("IA · TAREA · PROFUNDIDAD (Depth Anything V2)", "Estima la profundidad relativa de la escena.", "Entradas: modelo e imagen RGBA. Salida: mapa de profundidad.") },
  { file: "tasks/face-restore.js", names: ["faceRestore"], header: cab("IA · TAREA · RESTAURAR CARAS (GFPGAN)", "Restaura caras recortadas con el codificador y el decodificador en dos mitades para ahorrar memoria.", "Entradas: recortes de caras y modelos. Salida: caras restauradas.") },
  { file: "tasks/classify.js", names: ["classify"], header: cab("IA · TAREA · CLASIFICAR", "Clasifica la imagen con un modelo pequeño (por ejemplo, el de la lente).", "Entradas: modelo e imagen RGBA. Salida: probabilidades.") },
  { file: "tasks/sky.js", names: ["segSky"], header: cab("IA · TAREA · CIELO (DeepLab ADE20K)", "Segmenta el cielo y otras clases de ADE20K.", "Entradas: modelo, imagen RGBA, tamaño y clases. Salida: probabilidad de cielo.") },
  { file: "tasks/person.js", names: ["segPerson"], header: cab("IA · TAREA · PERSONAS (BodyPix)", "Segmenta personas.", "Entradas: modelo, imagen RGBA y tamaño. Salida: máscara de persona.") },
  { file: "tasks/clipseg.js", names: ["clipseg"], header: cab("IA · TAREA · CLIPSeg", "Segmentación por descripción libre: una o varias vistas de 352×352 de la misma foto con el mismo texto.", "Entradas: vistas, ids y máscara del texto. Salida: logits de cada vista.") }
];

const dry = process.argv.includes("--dry");
const res = splitFile(root, "js/ai/worker.js", groups, { dry, importAllGroups: false });
console.log(res.files.map(f => `${String(f.lines).padStart(5)}  ${f.file}`).join("\n"));
console.log(res.cycles.length ? "CICLOS: " + JSON.stringify(res.cycles) : "sin ciclos", dry ? "(simulación)" : "(escrito)");
