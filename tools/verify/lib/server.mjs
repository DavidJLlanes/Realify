/* Servidor estático mínimo, solo lectura, para probar una copia de la web.
   Se parece al de producción en lo que importa: tipos MIME correctos (wasm, mjs, webmanifest), compresión gzip de los
   mismos tipos que server/nginx/nginx-realify.conf.example, y sin reescritura a index.html para archivos que no existen
   (un 404 es un 404). */
import http from "node:http";
import http2 from "node:http2";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".otf": "font/otf", ".onnx": "application/octet-stream", ".ort": "application/octet-stream", ".cube": "text/plain",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".md": "text/markdown; charset=utf-8"
};
/* como `gzip_types` de nginx: texto, JSON, SVG, wasm, XML */
const GZIP = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".wasm", ".txt", ".xml"]);

/* Con h2 = true (o la variable VERIFY_CERT_DIR apuntando a una carpeta con key.pem y cert.pem autofirmados) se sirve por
   HTTP/2 sobre TLS, que es lo que usa producción (nginx): con HTTP/1.1 hay un máximo de 6 conexiones y cada archivo
   paga su latencia, lo que castiga injustamente a una web de muchos módulos. */
export function serve(root, { gzip = process.env.VERIFY_NO_GZIP ? false : true, h2 = !!process.env.VERIFY_CERT_DIR, index = null, port = 0 } = {}) {
  const base = path.resolve(root);
  const gz = new Map();                       // archivo+mtime → Buffer comprimido
  const handler = (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      /* `index`: sirve otro index.html en su lugar (para comparar variantes sin tocar la web) */
      const file = index && p === "/index.html" ? path.resolve(index) : path.resolve(base, "." + p);
      if (!file.startsWith(base) && !(index && file === path.resolve(index))) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end("no encontrado"); return; }
      const ext = path.extname(file).toLowerCase(), st = fs.statSync(file);
      const headers = { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" };
      if (gzip && GZIP.has(ext) && st.size >= 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
        const key = file + ":" + st.mtimeMs;
        if (!gz.has(key)) gz.set(key, zlib.gzipSync(fs.readFileSync(file), { level: 6 }));
        const buf = gz.get(key);
        res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": buf.length, Vary: "Accept-Encoding" });
        res.end(buf); return;
      }
      res.writeHead(200, { ...headers, "Content-Length": st.size });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(500).end(); }
  };
  const server = h2
    ? http2.createSecureServer({ key: fs.readFileSync(path.join(process.env.VERIFY_CERT_DIR, "key.pem")), cert: fs.readFileSync(path.join(process.env.VERIFY_CERT_DIR, "cert.pem")), allowHTTP1: true }, handler)
    : http.createServer(handler);
  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port, scheme: h2 ? "https" : "http" })));
}
