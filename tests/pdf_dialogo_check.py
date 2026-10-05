"""Verificación de tests/pdf-dialogo.mjs (pypdf + PIL)."""
import sys
from pypdf import PdfReader
D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc/out"
ok = True
def check(n, c, e=""):
    global ok; print(("OK    " if c else "FALLO ") + n, e); ok = ok and bool(c)
def dom(pg):
    im = pg.images[0].image.convert("RGB").resize((1, 1)); return im.getpixel((0, 0))
close = lambda a, b, t=40: all(abs(x - y) <= t for x, y in zip(a, b))
r = PdfReader(f"{D}/dlg1.pdf")
check("dlg1: 4 páginas (imagen añadida + 3 capas visibles; la oculta no)", len(r.pages) == 4, len(r.pages))
cols = [dom(p) for p in r.pages]
check("dlg1: orden elegido: primero la imagen morada reordenada", close(cols[0], (200, 0, 200)), cols[0])
check("dlg1: capa Fondo (blanca)", close(cols[1], (255, 255, 255), 10), cols[1])
check("dlg1: capa Roja a toda página", close(cols[2], (220, 38, 38)), cols[2])
check("dlg1: capa Azul con el fondo elegido bajo la transparencia", cols[3][2] > 100 and cols[3][0] > 150 and cols[3][1] > 150, cols[3])
check("dlg1: marcas de recorte (TrimBox ≠ MediaBox)", all(float(p.trimbox[0]) > 10 for p in r.pages), [float(p.trimbox[0]) for p in r.pages])
r = PdfReader(f"{D}/dlg2.pdf"); cols = [dom(p) for p in r.pages]
check("dlg2 (Exportar…): 3 páginas, una por capa visible", len(r.pages) == 3, len(r.pages))
check("dlg2: Fondo, Roja, Azul", close(cols[0], (255, 255, 255), 10) and close(cols[1], (220, 38, 38)), cols)
print("RESULTADO:", "OK" if ok else "FALLO"); sys.exit(0 if ok else 1)
