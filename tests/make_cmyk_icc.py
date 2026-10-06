"""Crea un perfil ICC de salida CMYK de PRUEBA (v2, lut16: A2B0/A2B1 y B2A0/B2A1) a partir de un modelo de tinta sencillo (ganancia de punto, papel tintado, límite de tinta
del 300 %), para comprobar js/io/icccmyk.js contra littlecms (PIL.ImageCms). No es un perfil de imprenta. Uso: python3 tests/make_cmyk_icc.py [salida.icc]"""
import struct, sys, math
import numpy as np
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc/test_cmyk.icc"
GAIN = 1.15; PAPER = np.array([0.96, 0.95, 0.91]); LIMIT = 3.0
# sRGB → XYZ D50 (Bradford) y D50
M = np.array([[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]]); MI = np.linalg.inv(M)
WP = np.array([0.9642, 1.0, 0.8249])
def lin(c): c = np.clip(c, 0, 1); return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def enc(l): l = np.clip(l, 0, 1); return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055)
def f(t): return np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)
def finv(t): return np.where(t > 6 / 29, t ** 3, 108 / 841 * (t - 4 / 29))
def rgb2lab(rgb):
    xyz = lin(rgb) @ M.T; fx, fy, fz = f(xyz[..., 0] / WP[0]), f(xyz[..., 1] / WP[1]), f(xyz[..., 2] / WP[2])
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)
def lab2rgb(lab):
    fy = (lab[..., 0] + 16) / 116; fx = fy + lab[..., 1] / 500; fz = fy - lab[..., 2] / 200
    xyz = np.stack([finv(fx) * WP[0], finv(fy) * WP[1], finv(fz) * WP[2]], -1)
    return enc(xyz @ MI.T), lin  # (rgb codificado sin recortar, ...)
def cmyk2rgb(c):                                   # c: (...,4) 0..1 → sRGB codificado
    d = np.clip(c, 0, 1) ** GAIN
    r = (1 - d[..., 0]) * (1 - d[..., 3]); g = (1 - d[..., 1]) * (1 - d[..., 3]); b = (1 - d[..., 2]) * (1 - d[..., 3])
    return np.stack([r, g, b], -1) * PAPER
def rgb2cmyk(rgb):                                 # inverso aproximado con negro y límite de tinta
    x = np.clip(rgb / PAPER, 0, 1); k = 1 - x.max(-1); den = np.maximum(1 - k, 1e-6)
    c = (1 - x[..., 0] - k) / den; m = (1 - x[..., 1] - k) / den; y = (1 - x[..., 2] - k) / den
    out = np.clip(np.stack([c, m, y, k], -1), 0, 1) ** (1 / GAIN)
    tot = out.sum(-1, keepdims=True); s = np.where(tot > LIMIT, LIMIT / np.maximum(tot, 1e-9), 1); return out * s
def lab16(lab):                                    # codificación Lab de 16 bits de ICC v2
    return np.stack([np.clip(lab[..., 0] * 652.8, 0, 65535), np.clip((lab[..., 1] + 128) * 256, 0, 65535), np.clip((lab[..., 2] + 128) * 256, 0, 65535)], -1).round().astype(">u2")
def unlab16(v): v = v.astype(float); return np.stack([v[..., 0] / 652.8, v[..., 1] / 256 - 128, v[..., 2] / 256 - 128], -1)
def lut16(sig, nin, nout, grid, table):
    data = bytearray(sig); data += b"\0" * 4 + bytes([nin, nout, grid, 0])
    data += struct.pack(">9i", 65536, 0, 0, 0, 65536, 0, 0, 0, 65536)
    ramp = np.linspace(0, 65535, 2).round().astype(">u2")
    data += struct.pack(">HH", 2, 2)
    for _ in range(nin): data += ramp.tobytes()
    data += table.astype(">u2").tobytes()
    for _ in range(nout): data += ramp.tobytes()
    return bytes(data)
def build():
    # A2B: CMYK (9^4 nodos) → Lab ; B2A: Lab (17^3) → CMYK
    g4 = 9; idx = np.stack(np.meshgrid(*[np.linspace(0, 1, g4)] * 4, indexing="ij"), -1).reshape(-1, 4)
    a2b = lab16(rgb2lab(cmyk2rgb(idx)))
    g3 = 17
    codes = np.linspace(0, 65535, g3)                 # los nodos del CLUT son fracciones de 0…65535 del Lab codificado (ICC v2): así el neutro (a=b=0) cae en un nodo
    L = codes / 652.8; ab = codes / 256 - 128
    grid = np.stack(np.meshgrid(L, ab, ab, indexing="ij"), -1).reshape(-1, 3)
    rgb_raw, _ = lab2rgb(grid); rgb = np.clip(rgb_raw, 0, 1)
    b2a = (np.clip(rgb2cmyk(rgb), 0, 1) * 65535).round()
    # los nodos de Lab se codifican en ICC v2: el nodo i de L va de 0 a 65280 (100), el de a/b de 0 a 65535 (−128…+127)·(entrada lineal 0…65535)
    tags = {}
    def text(s): return b"mluc" if False else b"desc" + b"\0\0\0\0" + struct.pack(">I", len(s) + 1) + s.encode() + b"\0" + b"\0" * (4 + 4 + 2 + 1 + 67)
    tags[b"desc"] = text("Realify prueba CMYK")
    tags[b"cprt"] = b"text" + b"\0\0\0\0" + b"Prueba, sin copyright\0"
    xyz = lambda v: b"XYZ " + b"\0\0\0\0" + b"".join(struct.pack(">i", int(round(x * 65536))) for x in v)
    tags[b"wtpt"] = xyz(WP)
    tags[b"A2B0"] = tags[b"A2B1"] = lut16(b"mft2", 4, 3, g4, a2b)
    # B2A: la entrada del CLUT va de 0..65535 ↔ Lab codificado v2: L en 0..65280 → el nodo i de L es i/16·65280
    b2a_t = lut16(b"mft2", 3, 4, g3, b2a.reshape(-1, 4))
    tags[b"B2A0"] = tags[b"B2A1"] = b2a_t
    return tags
def icc(tags):
    names = list(tags); pos = 128 + 4 + 12 * len(names); body = b""; table = b""
    for n in names:
        d = tags[n]; pad = (-len(d)) % 4; table += n + struct.pack(">II", pos + len(body), len(d)); body += d + b"\0" * pad
    size = pos + len(body)
    h = struct.pack(">I4sI4s4s4s", size, b"lcms", 0x02400000, b"prtr", b"CMYK", b"Lab ") + b"\0" * 12 + b"acsp" + b"\0" * 4 + b"\0" * 4 + b"\0" * 4 + b"\0" * 8 + b"\0" * 4
    h += struct.pack(">3i", int(0.9642 * 65536), 65536, int(0.8249 * 65536)) + b"\0" * 4 + b"\0" * 44
    h = h[:128].ljust(128, b"\0")
    return h + struct.pack(">I", len(names)) + table + body
open(out, "wb").write(icc(build())); print("perfil escrito:", out)
