"""Valida con PyMuPDF los PDF de tests/pdf.mjs: páginas, tamaños, sangrado, metadatos, imágenes y no recompresión."""
import sys
import pymupdf as fitz
d = sys.argv[1] if len(sys.argv) > 1 else "/tmp"; bad = 0
def chk(c, m):
    global bad
    if not c: bad += 1; print("FALLO:", m)
mm = lambda v: float(v) / 72 * 25.4
def imgs(page): return [(i[2], i[3]) for i in page.parent.get_page_images(page.number)]
a = fitz.open(f"{d}/p_a4.pdf")
chk(len(a) == 6, f"a4: {len(a)} páginas (portada + 5)")
chk(all(abs(mm(p.rect.width) - 210) < .5 and abs(mm(p.rect.height) - 297) < .5 or abs(mm(p.rect.width) - 297) < .5 and abs(mm(p.rect.height) - 210) < .5 for p in a), "a4: tamaño")
m = a.metadata; chk(m["title"] == "Prueba ñ" and m["author"] == "Realify" and m["subject"] == "Test" and m["producer"] == "Realify" and "a" in m["keywords"], f"a4: metadatos {m}")
chk("Portada" in a[0].get_text() and "sub" in a[0].get_text(), f"a4: portada {a[0].get_text()!r}")
chk("2 / 6" in a[1].get_text(), f"a4: numeración {a[1].get_text()!r}")
chk(len(imgs(a[1])) == 1, "a4: imagen en la página 2")
w = imgs(a[1])[0][0]; chk(1500 < w < 1700, f"a4: reducida a 150 ppp, ancho {w}")
chk(imgs(a[2])[0] == (600, 400), f"a4: JPEG original sin recomprimir {imgs(a[2])}")
chk(a.extract_image(a.get_page_images(2)[0][0])["ext"] == "jpeg", "a4: sigue siendo JPEG")
g = fitz.open(f"{d}/p_grid.pdf"); chk(len(g) == 2 and len(imgs(g[0])) == 4 and len(imgs(g[1])) == 1, "grid: 4 + 1")
chk("cuatro" in g[0].get_text() and "1 / 2" in g[0].get_text(), f"grid: pie y número {g[0].get_text()!r}")
f = fitz.open(f"{d}/p_free.pdf"); p0 = f[0]
chk(abs(mm(p0.trimbox.width) - 3000 / 300 * 25.4) < .5, f"free: trim {mm(p0.trimbox.width)}")
chk(abs(mm(p0.mediabox.width) - mm(p0.trimbox.width) - 6) < .05, f"free: sangrado 3 mm {mm(p0.mediabox.width) - mm(p0.trimbox.width)}")
chk(abs(mm(p0.bleedbox.width) - mm(p0.mediabox.width)) < .05, "free: BleedBox")
l = fitz.open(f"{d}/p_lossless.pdf"); chk(len(l) == 1 and abs(mm(l[0].rect.width) - 279.4) < .5, "lossless: carta horizontal")
chk(len(imgs(l[0])) == 2 and all(l.extract_image(x[0])["ext"] == "png" for x in l.get_page_images(0)), "lossless: 2 imágenes PNG")
for n in ("a4", "grid", "free", "lossless"):
    chk(fitz.open(f"{d}/p_{n}.pdf")[0].get_pixmap(dpi=40).width > 10, f"{n}: se dibuja")
print("pdf_check:", "FALLO" if bad else "OK"); sys.exit(1 if bad else 0)
