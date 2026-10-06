"""Verifica con c2pa-python (el verificador de referencia) lo que firma js/exif/c2pasign.js: usa el venv de /tmp/sc/venv. Uso: python3 tests/c2pa_firma_check.py [carpeta]"""
import sys, json
import c2pa
D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc/out"
ok = True
def check(name, cond, extra=""):
    global ok
    print(("OK    " if cond else "FALLO ") + name, extra)
    ok = ok and bool(cond)
UI = len(sys.argv) > 2 and sys.argv[2] == "ui"            # lo exportado por el diálogo (escritorio «d» y móvil «m»)
lista = [(f"ui{v}.{e}", e) for v in "dm" for e in ("jpg", "png", "avif")] if UI else [(f"firma.{e}", e) for e in ("jpg", "png", "avif", "heic", "big.jpg")]
for ext, _ in lista:
    path = f"{D}/{ext}"
    try:
        with c2pa.Reader(path) as r:
            j = json.loads(r.json())
    except Exception as e:
        check(f"{ext}: se lee", False, str(e)[:200]); continue
    st = j.get("validation_state"); res = j.get("validation_results", {}).get("activeManifest", {})
    codes = [x.get("code") for x in res.get("success", [])]; fails = [x.get("code") for x in res.get("failure", [])]
    m = j["manifests"][j["active_manifest"]]
    # el emisor de prueba no está en la lista de confianza de C2PA: «signingCredential.untrusted» es lo esperado; lo demás debe ir bien
    other = [f for f in fails if f != "signingCredential.untrusted"]
    check(f"{ext}: sin fallos de validación (salvo emisor desconocido)", not other, (st, fails))
    check(f"{ext}: firma y hash de datos válidos", "claimSignature.validated" in codes and any(c.startswith("assertion.dataHash.match") or c.startswith("assertion.bmffHash.match") for c in codes), codes[:6])
    check(f"{ext}: autor" + ("" if UI else " y título"), (UI or m.get("title") == "Foto firmada") and any("Ana Firmante" in json.dumps(a) for a in m["assertions"]), m.get("title"))
    act = [a for a in m["assertions"] if a["label"].startswith("c2pa.actions")]
    check(f"{ext}: acción c2pa.created", act and act[0]["data"]["actions"][0]["action"] == "c2pa.created", act and act[0]["data"]["actions"][0].get("digitalSourceType"))
print("RESULTADO:", "OK" if ok else "FALLO"); sys.exit(0 if ok else 1)
