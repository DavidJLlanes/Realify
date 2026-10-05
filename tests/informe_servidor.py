"""Prueba del receptor server/informe/informe.py con un sendmail falso: envío correcto, inyección de cabeceras, campo
trampa, límite por IP, tamaño e imagen falsa. Uso: python3 tests/informe_servidor.py"""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
d = tempfile.mkdtemp(); out = os.path.join(d, "out.eml"); fake = os.path.join(d, "sendmail")
open(fake, "w").write(f'#!/bin/sh\ncat > "{out}"\n'); os.chmod(fake, 0o755)
env = dict(os.environ, INFORME_TO="dest@example.org", INFORME_PORT="8798", INFORME_SENDMAIL=fake, INFORME_POR_HORA="3")
srv = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), "..", "server", "informe", "informe.py")], env=env)
time.sleep(1.2); bad = 0
def post(body, ip="1.1.1.1", raw=False):
    req = urllib.request.Request("http://127.0.0.1:8798/api/informe", data=body if raw else json.dumps(body).encode(), headers={"X-Real-IP": ip, "Content-Type": "application/json"})
    try: return urllib.request.urlopen(req).status
    except urllib.error.HTTPError as e: return e.code
def chk(c, m):
    global bad
    if not c: bad += 1; print("FALLO:", m)
try:
    chk(post({"mensaje": "No abre el PSD", "correo": "yo@example.com", "diag": "x"}, "1.0.0.1") == 200, "envío correcto")
    eml = open(out).read(); chk("Reply-To: yo@example.com" in eml and "To: dest@example.org" in eml and "Subject: [Realify] Informe de error" in eml, "cabeceras")
    os.remove(out); chk(post({"mensaje": "correo con inyección", "correo": "a@b.com\r\nBcc: z@z.com"}, "1.0.0.2") == 200, "inyección aceptada sin efecto")
    eml = open(out).read().split("\n\n")[0].lower(); chk("bcc" not in eml and "reply-to" not in eml, "sin Bcc ni Reply-To con correo malo")
    chk(post({"mensaje": "x"}, "1.0.0.3") == 400, "mensaje corto")
    os.remove(out); chk(post({"mensaje": "soy un bot", "sitio": "x"}, "1.0.0.4") == 200 and not os.path.exists(out), "campo trampa descarta sin enviar")
    chk(post(b"no json", "1.0.0.5", raw=True) == 400, "no JSON")
    chk(post({"mensaje": "imagen falsa", "imagen": "aGVsbG8="}, "1.0.0.6") == 400, "imagen falsa")
    chk(post(b"a" * 800000, "1.0.0.7", raw=True) == 413, "demasiado grande")
    codes = [post({"mensaje": "informe repetido"}, "2.2.2.2") for _ in range(4)]; chk(codes == [200, 200, 200, 429], f"límite por IP {codes}")
finally:
    srv.terminate()
print("informe_servidor:", "FALLO" if bad else "OK"); sys.exit(1 if bad else 0)
