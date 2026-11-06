/* ═══════════════════════════════════════════════════════════════
   PRUEBAS IA · HUGGING FACE SIMULADO
   Sin red: un servidor HTTPS local (certificado autofirmado, creado con openssl) hace de huggingface.co y sirve los ONNX remotos del
   catálogo desde una carpeta (REALIFY_MODELOS, por defecto /mnt/user-data/uploads), reconociéndolos por su sha256. La interceptación de
   Playwright no vale: el navegador se cae con archivos de más de ~100 MB.
   Entradas: nada. Salida: servirRemotos() → { args, ids, cerrar } (args = opciones de Chromium para abrir(tipo, { args })).
   Límite: un modelo que no esté en la carpeta no se sirve (la prueba debe saltarse).
   ═══════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { RAIZ } from "./navegador.mjs";

const DIR = process.env.REALIFY_MODELOS || "/mnt/user-data/uploads";
const sha = f => new Promise(r => { const h = crypto.createHash("sha256"); fs.createReadStream(f).on("data", d => h.update(d)).on("end", () => r(h.digest("hex"))); });

export async function servirRemotos() {
  const { MODELS } = await import(pathToFileURL(path.join(RAIZ, "js/ai/models.js")).href);
  const porSha = new Map();
  for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) { const p = path.join(DIR, f); if (fs.statSync(p).isFile() && f.endsWith(".onnx")) porSha.set(await sha(p), p); }
  const rutas = new Map(), ids = [];
  for (const [id, m] of Object.entries(MODELS)) {
    if (!/^https:/.test(m.url) || !m.sha256 || !porSha.has(m.sha256)) continue;
    rutas.set(new URL(m.url).pathname, porSha.get(m.sha256)); ids.push(id);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hf-")), key = path.join(tmp, "k.pem"), crt = path.join(tmp, "c.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "2", "-subj", "/CN=huggingface.co", "-addext", "subjectAltName=DNS:huggingface.co"], { stdio: "ignore" });
  const srv = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(crt) }, (q, r) => {
    const f = rutas.get(decodeURIComponent(q.url.split("?")[0]));
    if (!f) { r.writeHead(404, { "access-control-allow-origin": "*" }); r.end(); return; }
    r.writeHead(200, { "content-type": "application/octet-stream", "content-length": fs.statSync(f).size, "access-control-allow-origin": "*" });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise(res => srv.listen(0, "127.0.0.1", res));
  const port = srv.address().port;
  return { ids, args: ["--no-proxy-server", "--ignore-certificate-errors", `--host-resolver-rules=MAP huggingface.co 127.0.0.1:${port}`], cerrar: () => srv.close() };
}

/** Pulsa «Descargar» en el aviso de descarga cada vez que aparece. */
export function aceptarDescargas(page) {
  setInterval(() => page.evaluate(() => { const b = [...document.querySelectorAll(".modal-foot button.primary")].find(x => /Descargar/.test(x.textContent)); if (b) b.click(); }).catch(() => {}), 300).unref();
}
