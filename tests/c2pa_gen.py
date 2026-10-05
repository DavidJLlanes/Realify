import json, datetime, io
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from PIL import Image
import c2pa
chain=open("/tmp/sc/es256_certs.pem").read(); keypem=open("/tmp/sc/es256_private.key").read()
im = Image.new("RGB", (64, 48), (200, 80, 40)); b = io.BytesIO(); im.save(b, "JPEG"); open("c2pa_in.jpg", "wb").write(b.getvalue()); im.save("c2pa_in.png")
manifest = {"claim_generator_info": [{"name": "Realify C2PA test", "version": "1.0"}], "title": "Foto de prueba",
  "assertions": [{"label": "c2pa.actions", "data": {"actions": [{"action": "c2pa.created", "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia", "softwareAgent": "Modelo X"}, {"action": "c2pa.edited", "softwareAgent": "Realify"}]}},
                 {"label": "stds.schema-org.CreativeWork", "data": {"@context": "http://schema.org/", "@type": "CreativeWork", "author": [{"@type": "Person", "name": "Ana Autora"}]}}]}
signer_info = c2pa.C2paSignerInfo(alg=b"es256", sign_cert=chain.encode(), private_key=keypem.encode(), ta_url=None)
for ext, mime in (("jpg", "image/jpeg"), ("png", "image/png")):
    with c2pa.Signer.from_info(signer_info) as signer, c2pa.Builder(manifest) as builder:
        builder.sign_file(f"c2pa_in.{ext}", f"c2pa_out.{ext}", signer) if hasattr(builder, "sign_file") else None
        print(ext, "ok")
