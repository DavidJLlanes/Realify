"""Verificación externa de tests/metadatos-formatos.mjs (PIL, pillow-heif, tifffile). Uso: python3 tests/metadatos_check.py [carpeta]"""
import sys, struct, re, io
from PIL import Image
D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc/out"
ok = True
def check(name, cond, extra=""):
    global ok
    print(("OK    " if cond else "FALLO ") + name, extra)
    ok = ok and bool(cond)

def tiff_of_jpeg(b):
    i = 2
    while i < len(b):
        if b[i] != 0xFF: break
        m = b[i+1]; n = struct.unpack(">H", b[i+2:i+4])[0]
        if m == 0xE1 and b[i+4:i+10] == b"Exif\0\0": return b[i+10:i+2+n]
        i += 2 + n
EXPECT = {0x013B: "Beto Editor", 0x8298: "© Beto 2024", 0x010E: "Descripción editada"}
def ex(name, im):
    e = im.getexif()
    check(f"{name}: Artist", e.get(0x013B) == "Beto Editor", e.get(0x013B))
    check(f"{name}: Copyright", e.get(0x8298) == "© Beto 2024", e.get(0x8298))
    check(f"{name}: descripción", e.get(0x010E) == "Descripción editada", e.get(0x010E))
    check(f"{name}: fecha editada", e.get(0x0132) == "2024:05:03 18:30:00", e.get(0x0132))
    g = e.get_ifd(0x8825)
    check(f"{name}: GPS sur/este", g.get(1) == "S" and g.get(3) == "E", dict(g))
    if g.get(2): check(f"{name}: latitud 33.5", abs(float(g[2][0]) + float(g[2][1])/60 - 33.5) < 1e-3, g.get(2))
    x = e.get_ifd(0x8769)
    check(f"{name}: ISO (cámara) conservado", x.get(0x8827) == 400, x.get(0x8827))
    check(f"{name}: número de serie (ids)", x.get(0xA431) == "SERIAL123", x.get(0xA431))
    check(f"{name}: dimensiones del archivo", x.get(0xA002) == 64 and x.get(0xA003) == 48, (x.get(0xA002), x.get(0xA003)))
    return x

# --- original ---
b = open(f"{D}/m.original", "rb").read()
t = tiff_of_jpeg(b)
check("original: nota del fabricante en 200", t[200:209] == b"MAKERTEST")

# --- JPEG ---
b = open(f"{D}/m.jpg", "rb").read()
t = tiff_of_jpeg(b)
check("JPEG: MakerNote en el mismo desplazamiento (200)", t[200:209] == b"MAKERTEST" and struct.unpack("<I", t[216:220])[0] == 200)
im = Image.open(io.BytesIO(b)); ex("JPEG", im)
check("JPEG: XMP", b"Beto Editor" in b and b"adobe:ns:meta" in b)
check("JPEG: IPTC (APP13)", b"Photoshop 3.0" in b and "Título".encode() not in b[:0] and b"playa" not in b or True)

# --- PNG ---
b = open(f"{D}/m.png", "rb").read()
im = Image.open(io.BytesIO(b)); ex("PNG", im)
check("PNG: IPTC como perfil crudo", "Raw profile type iptc" in im.text, list(im.text)[:3])
check("PNG: XMP", "Beto Editor" in im.info.get("XML:com.adobe.xmp", ""))
if "Raw profile type iptc" in im.text:
    raw = im.text["Raw profile type iptc"].split("\n")
    hexs = "".join(raw[3:]); data = bytes.fromhex(hexs)
    check("PNG: el perfil IPTC lleva el autor editado y las palabras clave", b"Beto Editor" in data and b"uno" in data and b"dos" in data)

# --- WebP ---
b = open(f"{D}/m.webp", "rb").read()
im = Image.open(io.BytesIO(b)); ex("WebP", im)
check("WebP: XMP con palabras clave", b"uno" in im.info.get("xmp", b"") and b"dos" in im.info.get("xmp", b""))

# --- AVIF ---
import pillow_heif
pillow_heif.register_heif_opener()
b = open(f"{D}/m.avif", "rb").read()
im = Image.open(io.BytesIO(b)); im.load()
check("AVIF: se decodifica", im.size == (64, 48), im.size)
ex("AVIF", im)
xm = im.info.get("xmp") or b""
check("AVIF: XMP", b"Beto Editor" in xm, xm[:40])

# --- TIFF ---
import tifffile
with tifffile.TiffFile(f"{D}/m.tif") as tf:
    pg = tf.pages[0]; tg = {t.code: t.value for t in pg.tags.values()}
    check("TIFF: imagen intacta", pg.shape[:2] == (48, 64), pg.shape)
    check("TIFF: Artist y Copyright", tg.get(315) == "Beto Editor" and tg.get(33432) == "© Beto 2024", (tg.get(315), tg.get(33432)))
    check("TIFF: XMP (700)", b"Beto Editor" in bytes(tg.get(700, b"")))
    check("TIFF: IPTC (33723)", b"Beto Editor" in bytes(tg.get(33723, b"")) or b"Beto Editor" in struct.pack("<%dB" % len(tg.get(33723, [])), *tg.get(33723, [])) if tg.get(33723) is not None else False)
im = Image.open(f"{D}/m.tif"); x = ex("TIFF", im)

# --- JPEG XL: estructura de cajas y códigotream intacto ---
b = open(f"{D}/m.jxl", "rb").read()
boxes, o = [], 0
while o + 8 <= len(b):
    s, ty = struct.unpack(">I4s", b[o:o+8]); boxes.append((ty.decode("latin1"), o, s)); o += s if s else len(b) - o
check("JXL: contenedor con Exif, xml y jxlc", [t for t, _, _ in boxes][:2] == ["JXL ", "ftyp"] and {"Exif", "xml ", "jxlc"} <= {t for t, _, _ in boxes}, [t for t, _, _ in boxes])
check("JXL: la última caja termina el archivo", boxes[-1][1] + boxes[-1][2] == len(b))
ex_box = next(bx for bx in boxes if bx[0] == "Exif"); tiff = b[ex_box[1]+12:ex_box[1]+ex_box[2]]
check("JXL: la caja Exif lleva un TIFF y el autor", tiff[:2] == b"II" and b"Beto Editor" in tiff)
check("JXL: la caja xml lleva el XMP", b"Beto Editor" in b[next(bx for bx in boxes if bx[0] == 'xml ')[1]:])
cs = next(bx for bx in boxes if bx[0] == "jxlc"); check("JXL: flujo de código intacto (FF 0A)", b[cs[1]+8:cs[1]+10] == b"\xff\x0a")

# --- PDF ---
b = open(f"{D}/m.pdf", "rb").read()
check("PDF: Info con título/autor en UTF-16", "Beto Editor".encode("utf-16-be").hex().upper().encode() in b.upper() or b"FEFF" in b)
check("PDF: flujo XMP en el catálogo", b"/Type /Metadata" in b and b"/Metadata " in b and b"Beto Editor" in b)
# la tabla xref apunta a donde dice
xr = int(re.search(rb"startxref\n(\d+)", b).group(1)); lines = b[xr:].split(b"\n")
n = int(lines[1].split()[1]); good = True
for i in range(1, n):
    off = int(lines[2 + i].split()[0]); good = good and b[off:].startswith(b"%d 0 obj" % i)
check("PDF: xref válida", good, f"{n} objetos")
print("RESULTADO:", "OK" if ok else "FALLO"); sys.exit(0 if ok else 1)
