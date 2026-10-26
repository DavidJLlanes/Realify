/* Servidor local para probar la web:  npm run serve   (o  node tools/serve.mjs [puerto])
   Sirve la carpeta del proyecto tal cual, con los tipos MIME correctos y gzip, como producción. No compila nada.
   Equivale a `python -m http.server`, pero con los tipos de archivo que la app necesita (wasm, mjs, webmanifest).
   El service worker y la instalación como app necesitan HTTPS; en localhost el navegador los permite igualmente. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./verify/lib/server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = +process.argv[2] || 8080;
const { port: p } = await serve(root, { port });
console.log(`Realify en http://localhost:${p}/   (Ctrl+C para parar)`);
