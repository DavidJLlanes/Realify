#!/usr/bin/env python3
"""
Relevo de fotos entre Realify y Realify Basic · /api/traspaso
=============================================================

En el iPhone, cada app web instalada en la pantalla de inicio tiene su PROPIO almacenamiento aunque las dos sean de realify.es,
así que una no puede dejarle la foto a la otra en el dispositivo. Este servicio hace de buzón de paso:

  · Emparejar (una vez): la app A guarda aquí una clave aleatoria bajo un código de 6 cifras; la app B, con ese código escrito
    por la persona, la recoge. El registro se borra al canjearlo (o a los 30 min). El servidor no guarda la clave después.
  · Enviar: A cifra la foto en el dispositivo (AES-GCM) y la deja en el buzón de B (identificador derivado de la clave).
  · Recibir: B, al abrirse o volver a primer plano, pide su buzón; la foto se borra al entregarla (o a los 15 min).

Todo vive en memoria (nada en disco) y con topes. Sólo biblioteca estándar de Python 3. Escucha en 127.0.0.1; nginx le pasa
/api/traspaso/ y pone X-Real-IP.

Rutas (todas bajo /api/traspaso):
  GET  /salud                      {"ok": true}
  PUT  /buzon/<id>                 cuerpo binario (foto cifrada) → 204
  GET  /buzon/<id>                 200 + cuerpo (y se borra) · 204 si está vacío
  POST /par                        {"clave": b64, "de": app, "para": app} → {"codigo": "123456"}
  GET  /par?para=<app>             {"de": app} si hay un emparejamiento esperando desde la misma red (IPv4 o /64) · 204 si no
  POST /par/canjear                {"codigo": "123456", "para": app} → {"clave": b64, "de": app} · 404 si no vale
  GET  /par/<codigo>               {"canjeado": true|false} · 404 si caducó

Variables de entorno:
  TRASPASO_PORT        puerto local (8767)
  TRASPASO_MAX_MB      tamaño máximo de una foto cifrada (40)
  TRASPASO_TOTAL_MB    memoria total para fotos (600); si se pasa, se borran las más antiguas
  TRASPASO_FOTO_MIN    minutos que espera una foto (15)
"""
import base64, ipaddress, json, os, re, secrets, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TRASPASO_PORT", "8767"))
MAX_FOTO = int(os.environ.get("TRASPASO_MAX_MB", "40")) * 1024 * 1024
MAX_TOTAL = int(os.environ.get("TRASPASO_TOTAL_MB", "600")) * 1024 * 1024
FOTO_TTL = int(os.environ.get("TRASPASO_FOTO_MIN", "15")) * 60
PAR_TTL, CANJE_TTL = 30 * 60, 24 * 3600
APPS = {"realify", "basic"}
ID_RE = re.compile(r"^[0-9a-f]{32}$")
COD_RE = re.compile(r"^[0-9]{6}$")
LIMITES = {"subir": (60, 3600), "par": (10, 3600), "fallo": (10, 3600),   # acciones por IP: (máximo, ventana en s)
           "fallo_total": (300, 3600)}   # códigos fallidos de TODAS las IP juntas: frena probar códigos desde muchas direcciones

buzones = {}      # id → (bytes, t)
pares = {}        # codigo → {"clave", "de", "para", "ip", "t"}
canjeados = {}    # codigo → t  (para que A sepa que B ya se emparejó)
golpes = {}       # (accion, ip) → [t…]
cerrojo = threading.Lock()


def limpiar(ahora):
    for k in [k for k, (_, t) in buzones.items() if ahora - t > FOTO_TTL]:
        buzones.pop(k, None)
    for k in [k for k, p in pares.items() if ahora - p["t"] > PAR_TTL]:
        pares.pop(k, None)
    for k in [k for k, t in canjeados.items() if ahora - t > CANJE_TTL]:
        canjeados.pop(k, None)
    total = sum(len(b) for b, _ in buzones.values())
    for k, (b, _) in sorted(buzones.items(), key=lambda x: x[1][1]):
        if total <= MAX_TOTAL:
            break
        total -= len(b)
        buzones.pop(k, None)
    if len(golpes) > 20000:
        for k in [k for k, v in golpes.items() if not v or ahora - v[-1] > 3600]:
            golpes.pop(k, None)


def pasado(accion, ip, ahora, sumar=True):
    """¿Ha superado esta IP el límite de la acción? (y si no, anota el intento)."""
    maximo, ventana = LIMITES[accion]
    v = [t for t in golpes.get((accion, ip), []) if ahora - t < ventana]
    if len(v) >= maximo:
        golpes[(accion, ip)] = v
        return True
    if sumar:
        v.append(ahora)
    golpes[(accion, ip)] = v
    return False


class Relevo(BaseHTTPRequestHandler):
    server_version = "realify-traspaso"
    sys_version = ""
    timeout = 60                        # una conexión lenta o colgada no retiene un hilo para siempre

    def log_message(self, *a):          # sin registros: ni IPs ni contenido
        pass

    def ip(self):
        """La red de quien llama: la IPv4 entera o el prefijo /64 de la IPv6 (iOS cambia a menudo su dirección IPv6 temporal)."""
        bruta = self.headers.get("X-Real-IP") or self.client_address[0]
        try:
            ip = ipaddress.ip_address(bruta)
        except ValueError:
            return bruta
        if ip.version == 6:
            if ip.ipv4_mapped:
                return str(ip.ipv4_mapped)
            return str(ipaddress.ip_network(f"{ip}/64", strict=False))
        return str(ip)

    def ruta(self):
        p = self.path.split("?", 1)[0]
        return p[len("/api/traspaso"):] if p.startswith("/api/traspaso") else None

    def consulta(self):
        q = self.path.split("?", 1)[1] if "?" in self.path else ""
        return dict(x.split("=", 1) for x in q.split("&") if "=" in x)

    def responder(self, codigo, cuerpo=None, tipo="application/json"):
        datos = b"" if cuerpo is None else (cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo).encode())
        self.send_response(codigo)
        self.send_header("Cache-Control", "no-store")
        if datos:
            self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        if datos:
            self.wfile.write(datos)

    def leer(self, maximo):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:              # cabecera no numérica: 400, no una excepción en el hilo
            return None
        if n <= 0 or n > maximo:
            return None
        return self.rfile.read(n)

    def leer_json(self):
        datos = self.leer(4096)
        try:
            return json.loads(datos) if datos else None
        except ValueError:
            return None

    # ── GET ────────────────────────────────────────────────────────
    def do_GET(self):
        r, ahora = self.ruta(), time.time()
        if r == "/salud":
            return self.responder(200, {"ok": True})
        if r and r.startswith("/buzon/") and ID_RE.match(r[7:]):
            with cerrojo:
                limpiar(ahora)
                foto = buzones.pop(r[7:], None)
            return self.responder(200, foto[0], "application/octet-stream") if foto else self.responder(204)
        if r == "/par":
            para = self.consulta().get("para")
            with cerrojo:
                limpiar(ahora)
                hay = [p for p in pares.values() if p["ip"] == self.ip() and p["para"] == para]
            return self.responder(200, {"de": max(hay, key=lambda p: p["t"])["de"]}) if hay else self.responder(204)
        if r and r.startswith("/par/") and COD_RE.match(r[5:]):
            c = r[5:]
            with cerrojo:
                limpiar(ahora)
                if c in canjeados:
                    return self.responder(200, {"canjeado": True})
                if c in pares:
                    return self.responder(200, {"canjeado": False})
            return self.responder(404, {"error": "caducado"})
        return self.responder(404, {"error": "no existe"})

    # ── PUT (foto cifrada) ─────────────────────────────────────────
    def do_PUT(self):
        r, ahora = self.ruta(), time.time()
        if not (r and r.startswith("/buzon/") and ID_RE.match(r[7:])):
            return self.responder(404, {"error": "no existe"})
        with cerrojo:
            if pasado("subir", self.ip(), ahora):
                return self.responder(429, {"error": "demasiados envíos"})
        datos = self.leer(MAX_FOTO)
        if not datos or len(datos) < 32:
            largo = self.headers.get("Content-Length") or "0"
            return self.responder(413 if datos is None and largo.isdigit() and int(largo) > MAX_FOTO else 400, {"error": "tamaño"})
        with cerrojo:
            buzones[r[7:]] = (datos, ahora)
            limpiar(ahora)
        return self.responder(204)

    # ── POST (emparejar) ───────────────────────────────────────────
    def do_POST(self):
        r, ahora, ip = self.ruta(), time.time(), self.ip()
        d = self.leer_json()
        if not isinstance(d, dict):
            return self.responder(400, {"error": "json"})
        if r == "/par":
            clave, de, para = d.get("clave"), d.get("de"), d.get("para")
            try:
                ok = isinstance(clave, str) and len(base64.b64decode(clave, validate=True)) == 48
            except ValueError:
                ok = False
            if not ok or de not in APPS or para not in APPS or de == para:
                return self.responder(400, {"error": "datos"})
            with cerrojo:
                if pasado("par", ip, ahora):
                    return self.responder(429, {"error": "demasiados"})
                limpiar(ahora)
                for k in [k for k, p in pares.items() if p["ip"] == ip and p["de"] == de]:
                    pares.pop(k, None)              # un solo emparejamiento pendiente por app y red
                codigo = f"{secrets.randbelow(10**6):06d}"
                while codigo in pares or codigo in canjeados:
                    codigo = f"{secrets.randbelow(10**6):06d}"
                pares[codigo] = {"clave": clave, "de": de, "para": para, "ip": ip, "t": ahora}
            return self.responder(200, {"codigo": codigo})
        if r == "/par/canjear":
            codigo, para = str(d.get("codigo", "")), d.get("para")
            with cerrojo:
                if pasado("fallo", ip, ahora, sumar=False) or pasado("fallo_total", "*", ahora, sumar=False):
                    return self.responder(429, {"error": "demasiados intentos"})
                limpiar(ahora)
                p = pares.get(codigo) if COD_RE.match(codigo) else None
                if not p or p["para"] != para:
                    pasado("fallo", ip, ahora)
                    pasado("fallo_total", "*", ahora)
                    return self.responder(404, {"error": "código no válido"})
                pares.pop(codigo, None)
                canjeados[codigo] = ahora
            return self.responder(200, {"clave": p["clave"], "de": p["de"]})
        return self.responder(404, {"error": "no existe"})


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Relevo)
    srv.daemon_threads = True
    print(f"traspaso escuchando en 127.0.0.1:{PORT}", file=sys.stderr, flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
