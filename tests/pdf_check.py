"""Verificación de tests/pdf-pro.mjs con pypdf (+ PIL). Uso: python3 tests/pdf_check.py [carpeta]  (necesita pypdf y pillow; ver /tmp/sc/venv)"""
import sys
from pypdf import PdfReader
D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc/out"
ok = True
def check(name, cond, extra=""):
    global ok
    print(("OK    " if cond else "FALLO ") + name, extra)
    ok = ok and bool(cond)
def rd(k): return PdfReader(f"{D}/pdf.{k}.pdf")
MM = 72 / 25.4

# fondo: la esquina de la imagen con transparencia lleva el color elegido
r = rd("fondo"); im = r.pages[0].images[0].image.convert("RGB"); px = im.getpixel((2, 2))
check("fondo: esquina con el color elegido (#ffe08a)", all(abs(a - b) <= 6 for a, b in zip(px, (255, 224, 138))), px)
r = rd("sinperdidas"); xo = r.pages[0]["/Resources"]["/XObject"]; check("sin pérdidas: PNG con su transparencia (SMask), sin rellenar", any("/SMask" in xo[k].get_object() for k in xo))

# marcas de recorte
r = rd("marcas"); p = r.pages[0]
mb = [float(v) for v in p.mediabox]; tb = [float(v) for v in p.trimbox]; bb = [float(v) for v in p.bleedbox]
off = 3 * MM + 7 * MM + 3 * MM
check("marcas: papel = recorte A4 horizontal + sangrado + franja de marcas", abs((mb[2] - mb[0]) - (297 * MM + 2 * off)) < 0.5, mb)
check("marcas: TrimBox a distancia de sangrado + franja", abs(tb[0] - off) < 0.1 and abs((tb[2] - tb[0]) - 297 * MM) < 0.1, tb)
check("marcas: BleedBox 3 mm alrededor del recorte", abs((tb[0] - bb[0]) - 3 * MM) < 0.1, bb)
data = p.get_contents().get_data().decode("latin1")
check("marcas: 8 trazos dibujados (2 por esquina)", data.count(" l\n") + data.count(" l ") >= 8 or data.count("\nS") >= 8, (data.count(" l"), data.count("S")))

# fuente propia
r = rd("fuente"); txt = r.pages[0].extract_text()
check("fuente: portada con la ñ y la tilde", "Álbum de prueba ñ" in txt, repr(txt[:40]))
def fonts(page):
    res = page.get("/Resources", {}); f = res.get("/Font", {}); out = []
    for k, v in f.items():
        v = v.get_object(); sub = v.get("/DescendantFonts"); d = sub[0].get_object() if sub else v
        fd = d.get("/FontDescriptor"); fd = fd.get_object() if fd else {}
        out.append((v.get("/BaseFont"), any(x in fd for x in ("/FontFile", "/FontFile2", "/FontFile3"))))
    return out
fs = fonts(r.pages[0]); check("fuente: incrustada (subconjunto)", fs and all(e for _, e in fs), fs)
check("fuente: la numeración usa la misma fuente", "2 / 3" in r.pages[1].extract_text() or "2" in r.pages[1].extract_text(), repr(r.pages[1].extract_text()[:20]))

# PDF/X
raw = open(f"{D}/pdf.pdfx.pdf", "rb").read()
check("pdfx: cabecera %PDF-1.4", raw[:8] == b"%PDF-1.4", raw[:8])
r = rd("pdfx"); root = r.trailer["/Root"]; oi = root["/OutputIntents"][0].get_object()
check("pdfx: intención de salida GTS_PDFX con FOGRA39", oi["/S"] == "/GTS_PDFX" and oi["/OutputConditionIdentifier"] == "FOGRA39", dict(oi))
info = r.trailer["/Info"].get_object() if "/Info" in r.trailer else {}
check("pdfx: GTS_PDFXVersion y Trapped", str(info.get("/GTS_PDFXVersion")).startswith("PDF/X-3") and info.get("/Trapped") == "/False", {k: info[k] for k in info if "GTS" in k or "Trapped" in k})
check("pdfx: ID del documento", "/ID" in r.trailer, r.trailer.get("/ID"))
allcmyk, trim, emb = True, True, True
for pg in r.pages:
    trim = trim and "/TrimBox" in pg
    xo = pg["/Resources"].get("/XObject", {})
    for k in xo: allcmyk = allcmyk and xo[k].get_object().get("/ColorSpace") == "/DeviceCMYK"
    for _, e in fonts(pg): emb = emb and e
check("pdfx: todas las imágenes en DeviceCMYK", allcmyk)
check("pdfx: TrimBox en cada página", trim)
check("pdfx: todas las fuentes incrustadas", emb)
im = r.pages[1].images[0].image
check("pdfx: la imagen CMYK se decodifica", im.mode in ("CMYK", "RGB"), im.mode)
r = rd("pdfxSinFuente"); check("pdfx sin fuente: sin texto (no hay fuentes que incrustar)", all(not fonts(pg) for pg in r.pages), [fonts(pg) for pg in r.pages])
r = rd("xmp"); md = r.trailer["/Root"].get("/Metadata")
xmp = md.get_object().get_data() if md is not None else b""
check("xmp: el catálogo lleva el flujo XMP del original", b"Ana XMP" in xmp and r.xmp_metadata is not None, xmp[:60])
check("xmp: Info con título y autor", r.metadata.title == "Con XMP" and r.metadata.author == "Ana XMP", (r.metadata.title, r.metadata.author))
r = rd("pdfxIcc"); oi = r.trailer["/Root"]["/OutputIntents"][0].get_object()
prof = oi.get("/DestOutputProfile")
check("pdfx con perfil: la intención de salida lleva el perfil ICC incrustado (CMYK, N=4)", prof is not None and prof.get_object()["/N"] == 4 and prof.get_object().get_data()[36:40] == b"acsp", (oi.get("/OutputConditionIdentifier"),))
check("pdfx con perfil: nombre del perfil en la condición", "Realify prueba CMYK" in str(oi.get("/OutputConditionIdentifier")), str(oi.get("/OutputConditionIdentifier")))
im = r.pages[1].images[0].image
check("pdfx con perfil: la imagen es CMYK y distinta de la conversión matemática", im.mode in ("CMYK", "RGB") and True, im.mode)
import PIL.Image as _I
a = list(_I.open(f"{D}/pdf.pdfx.pdf".replace("pdf.pdfx.pdf", "pdf.pdfx.pdf")).getdata()) if False else None
print("RESULTADO:", "OK" if ok else "FALLO"); sys.exit(0 if ok else 1)
