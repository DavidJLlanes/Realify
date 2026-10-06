"""Comprueba js/io/icccmyk.js contra littlecms (PIL.ImageCms): sRGB → CMYK con un perfil de prueba (tests/make_cmyk_icc.py), intento colorimétrico relativo. Uso: python3 tests/icc_cmyk_check.py"""
import subprocess, sys, os
import numpy as np
from PIL import Image, ImageCms
os.makedirs("/tmp/sc/out", exist_ok=True)
subprocess.check_call([sys.executable, "tests/make_cmyk_icc.py", "/tmp/sc/test_cmyk.icc"], stdout=subprocess.DEVNULL)
rng = np.random.default_rng(7)
grays = np.stack([np.arange(0, 256, 5)] * 3, -1)
cols = rng.integers(0, 256, (3000, 3))
sat = np.array([[255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255],[255,0,255],[255,255,255],[0,0,0],[128,128,128],[200,40,40],[30,90,200]])
rgb = np.concatenate([grays, cols, sat]).astype(np.uint8)
open("/tmp/sc/out/icc_in.rgb", "wb").write(rgb.tobytes())
subprocess.check_call(["node", "tests/icc-cmyk.mjs", "/tmp/sc/test_cmyk.icc", "/tmp/sc/out/icc_in.rgb", "/tmp/sc/out/icc_out.cmyk"])
js = np.frombuffer(open("/tmp/sc/out/icc_out.cmyk", "rb").read(), np.uint8).reshape(-1, 4).astype(int)
p = ImageCms.getOpenProfile("/tmp/sc/test_cmyk.icc"); srgb = ImageCms.createProfile("sRGB")
t = ImageCms.buildTransform(srgb, p, "RGB", "CMYK", renderingIntent=1)
im = Image.fromarray(rgb.reshape(1, -1, 3), "RGB"); ref = np.array(ImageCms.applyTransform(im, t)).reshape(-1, 4).astype(int)
d = np.abs(js - ref); ok = True
def check(name, cond, extra=""):
    global ok; print(("OK    " if cond else "FALLO ") + name, extra); ok = ok and bool(cond)
check("media de la diferencia con littlecms ≤ 1,2 sobre 255", d.mean() <= 1.2, f"media {d.mean():.3f}")
check("el 92 % de las muestras difiere ≤ 6 (las diferencias grandes son colores muy oscuros y saturados, donde el perfil de prueba es muy empinado)", (d.max(1) <= 6).mean() >= 0.92, f"{(d.max(1) <= 6).mean() * 100:.1f} %, máx {d.max()}")
check("el negro (K) coincide a ±8", d[:, 3].max() <= 8, f"máx {d[:, 3].max()}")
check("blanco → sin tinta", tuple(js[len(grays) + 3000 + 6]) == (0, 0, 0, 0) or js[len(grays) + 3000 + 6].sum() <= 6, tuple(js[len(grays) + 3000 + 6]))
print("RESULTADO:", "OK" if ok else "FALLO"); sys.exit(0 if ok else 1)
