#!/usr/bin/env python3
"""
Informe de errores de Realify · /api/informe
============================================

Receptor mínimo (sólo biblioteca estándar de Python) que reenvía por correo los informes que
el usuario decide enviar desde Ayuda › «Informar de un error…». nginx le pasa sólo POST /api/informe;
escucha únicamente en 127.0.0.1.

Envía con el `sendmail` de Postfix (sin credenciales SMTP). Seguridad:
  · destinatario FIJO (INFORME_TO): nunca sale de la petición;
  · asunto FIJO; nada de lo que escribe el usuario entra en una cabecera salvo el correo, y sólo en Reply-To
    (validado y sin saltos de línea);
  · tamaño máximo (INFORME_MAX_KB, 700 por defecto) y campos recortados;
  · campo trampa «sitio»: si viene relleno se responde 200 y se descarta (un bot lo rellena, una persona no);
  · límite por IP en memoria (INFORME_POR_HORA, 5) además del limit_req de nginx;
  · la imagen adjunta, si la hay, debe ser un JPEG real y de tamaño acotado.

Variables de entorno:
  INFORME_TO        destinatario (obligatorio)
  INFORME_FROM      remitente (por defecto informes@realify.es: el dominio con SPF/DKIM)
  INFORME_PORT      puerto local (8766)
  INFORME_SENDMAIL  ruta de sendmail (/usr/sbin/sendmail)
  INFORME_MAX_KB    tamaño máximo del cuerpo en KB (700)
  INFORME_POR_HORA  informes por IP y hora (5)
"""
import base64, json, os, re, subprocess, sys, time, threading
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TO = os.environ.get("INFORME_TO", "")
FROM = os.environ.get("INFORME_FROM", "informes@realify.es")
PORT = int(os.environ.get("INFORME_PORT", "8766"))
SENDMAIL = os.environ.get("INFORME_SENDMAIL", "/usr/sbin/sendmail")
MAX_BODY = int(os.environ.get("INFORME_MAX_KB", "700")) * 1024
PER_HOUR = int(os.environ.get("INFORME_POR_HORA", "5"))
MAX_IMG = 450 * 1024
EMAIL_RE = re.compile(r"^[^\s@<>\",;:\\]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$")
CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

_hits, _lock = {}, threading.Lock()


def limited(ip):
    now = time.time()
    with _lock:
        v = [t for t in _hits.get(ip, []) if now - t < 3600]
        if len(v) >= PER_HOUR:
            _hits[ip] = v
            return True
        v.append(now)
        _hits[ip] = v
        if len(_hits) > 5000:                      # no crecer sin límite
            for k in [k for k, x in _hits.items() if not x or now - x[-1] > 3600]:
                _hits.pop(k, None)
    return False


def clean(s, n):
    return CTRL.sub("", str(s or ""))[:n]


def build(data, ip):
    """Devuelve el EmailMessage, o lanza ValueError con el motivo (sin datos sensibles)."""
    msg_text = clean(data.get("mensaje"), 4000).strip()
    if len(msg_text) < 5:
        raise ValueError("mensaje vacío")
    correo = clean(data.get("correo"), 254).strip()
    if correo and not EMAIL_RE.match(correo):
        correo = ""                                # un correo mal escrito no impide el informe
    diag = clean(data.get("diag"), 24000)
    version = clean(data.get("version"), 40)
    m = EmailMessage()
    m["From"] = FROM
    m["To"] = TO
    m["Subject"] = "[Realify] Informe de error"
    m["Date"] = formatdate(localtime=False)
    m["Message-ID"] = make_msgid(domain=FROM.split("@")[-1])
    if correo:
        m["Reply-To"] = correo
    cuerpo = ["Qué ha pasado:", msg_text, "", f"Correo para responder: {correo or '(no indicado)'}",
              f"Versión: {version or '?'}", f"Diagnóstico adjunto: {'sí' if diag else 'no'}",
              f"Imagen adjunta: {'sí' if data.get('imagen') else 'no'}"]
    if diag:
        cuerpo += ["", "── Diagnóstico ──", diag]
    m.set_content("\n".join(cuerpo))
    img = data.get("imagen")
    if img:
        try:
            raw = base64.b64decode(str(img), validate=True)
        except Exception:
            raise ValueError("imagen no válida")
        if len(raw) > MAX_IMG or raw[:3] != b"\xff\xd8\xff":
            raise ValueError("imagen no válida")
        m.add_attachment(raw, maintype="image", subtype="jpeg", filename="imagen.jpg")
    return m


class H(BaseHTTPRequestHandler):
    server_version = "informe"
    sys_version = ""

    def log_message(self, *a):                     # sin IPs ni contenido en los registros
        pass

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split("?")[0] != "/api/informe":
            return self.reply(404, {"ok": False})
        ip = (self.headers.get("X-Real-IP") or self.client_address[0])[:64]
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = -1
        if n <= 0 or n > MAX_BODY:
            return self.reply(413, {"ok": False, "error": "tamaño"})
        try:
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError
        except Exception:
            return self.reply(400, {"ok": False, "error": "formato"})
        if data.get("sitio"):                      # campo trampa
            return self.reply(200, {"ok": True})
        if limited(ip):
            return self.reply(429, {"ok": False, "error": "demasiados"})
        try:
            m = build(data, ip)
        except ValueError as e:
            return self.reply(400, {"ok": False, "error": str(e)})
        try:
            p = subprocess.run([SENDMAIL, "-t", "-i", "-f", FROM], input=m.as_bytes(), capture_output=True, timeout=20)
            if p.returncode != 0:
                raise RuntimeError(p.stderr[:200])
        except Exception as e:
            sys.stderr.write(f"informe: fallo al enviar: {e}\n")
            return self.reply(502, {"ok": False, "error": "envío"})
        self.reply(200, {"ok": True})

    def do_GET(self):
        self.reply(200 if self.path == "/api/informe/salud" else 404, {"ok": self.path == "/api/informe/salud"})


if __name__ == "__main__":
    if not TO:
        sys.exit("Falta INFORME_TO (destinatario de los informes)")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
