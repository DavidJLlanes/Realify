/* ═════════════════════════════════════════════════
   PRUEBA · registro con respaldo y protocolo del worker (Node). Uso: node tests/video/registro.mjs
   ═════════════════════════════════════════════════ */
import { crearRegistro } from "../../plugins/video/media/registro.js";
import { peticion, respuesta, validarPeticion, VERSION } from "../../plugins/video/workers/protocolo.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const r = crearRegistro();
r.registrar({ id: "lento", prioridad: 1, soporta: async d => d.x }); r.registrar({ id: "roto", prioridad: 50, soporta: () => { throw new Error("explota"); } }); r.registrar({ id: "bueno", prioridad: 10, soporta: async d => d.x > 0 });
ok(r.ids().join() === "roto,bueno,lento", "orden por prioridad");
let e = await r.elegir({ x: 1 }); ok(e.proveedor.id === "bueno" && e.motivos[0].includes("explota"), "salta el que lanza error y usa el siguiente");
e = await r.elegir({ x: 1 }, { excluir: ["bueno"] }); ok(e.proveedor.id === "lento", "respeta excluir");
e = await r.elegir({ x: 0 }); ok(e.proveedor === null && e.motivos.length === 3, "ninguno sirve → null con motivos: " + e.motivos);
try { r.registrar({ id: "bueno", soporta: () => 1 }); ok(false, "id repetido"); } catch { ok(true); }
ok(validarPeticion(peticion(1, "abrir")) === null && /versión/.test(validarPeticion({ v: 99, id: 1, tipo: "abrir" })) && /desconocida/.test(validarPeticion(peticion(1, "borrar-todo"))) && /id/.test(validarPeticion({ v: VERSION, tipo: "abrir" })) && validarPeticion(null), "validar peticiones");
ok(respuesta(3, "ok", { a: 1 }).v === VERSION && respuesta(3, "ok", { a: 1 }).a === 1, "respuesta");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · registro y protocolo"); process.exit(fallos ? 1 : 0);
