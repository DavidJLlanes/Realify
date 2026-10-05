# Informe de errores (`/api/informe`)

Recibe lo que el usuario decide enviar desde **Ayuda › Informar de un error…** (o desde el botón «Enviar informe» del
panel «Realify no ha podido arrancar») y lo reenvía por correo con el `sendmail` de Postfix. Nada se guarda en disco.
Sólo biblioteca estándar de Python 3.

```
navegador ── POST https://realify.es/api/informe ──▶ nginx (limit_req) ──▶ informe.py (127.0.0.1:8766) ──▶ sendmail ──▶ tu buzón
```

## Qué se envía
Sólo lo que el usuario ve y confirma en el diálogo: su mensaje, su correo (opcional; va **sólo** en `Reply-To`), el
diagnóstico técnico (casilla marcada por defecto, con vista previa del texto exacto) y, sólo si la marca, una copia
reducida de la imagen abierta (casilla desmarcada). Nunca la foto original, ni EXIF, ni nada sin preguntar.

## Instalación (en el VPS)
1. Postfix instalado y enviando correo (`echo test | mail -s prueba tu@correo.es`).
2. Usuario y script:
   ```bash
   sudo useradd --system --home /opt/informe --shell /usr/sbin/nologin informe
   sudo mkdir -p /opt/informe && sudo cp server/informe/informe.py /opt/informe/
   sudo cp server/informe/informe.service /etc/systemd/system/
   sudo systemctl edit informe      # o editar el .service: INFORME_TO=tu@correo.es
   sudo systemctl daemon-reload && sudo systemctl enable --now informe
   curl -s http://127.0.0.1:8766/api/informe/salud      # {"ok": true}
   ```
3. nginx: pegar `server/informe/nginx.conf.example` (la zona `limit_req_zone` en `http {}`, el `location` en el
   `server {}` de realify.es) y `sudo nginx -t && sudo systemctl reload nginx`.
4. **SPF y DKIM de realify.es** (para que el correo no caiga en spam; el remitente es `informes@realify.es`):
   - SPF, registro TXT de `realify.es`: `v=spf1 mx ip4:IP_DEL_VPS ~all` (añade `a` si ya lo usas).
   - DKIM con OpenDKIM: `sudo apt install opendkim opendkim-tools`; `opendkim-genkey -s mail -d realify.es`;
     publicar `mail._domainkey.realify.es` (TXT con la clave pública) y enlazar OpenDKIM con Postfix
     (`smtpd_milters`/`non_smtpd_milters = inet:localhost:8891`).
   - DMARC, TXT `_dmarc.realify.es`: `v=DMARC1; p=none; rua=mailto:tu@correo.es` (endurecer después).
5. Prueba: Ayuda › Informar de un error… en realify.es, o
   `curl -s -X POST https://realify.es/api/informe -H 'Content-Type: application/json' -d '{"mensaje":"prueba del informe"}'`.

## Salvaguardas
Destinatario y asunto fijos · cabeceras sin datos del usuario (el correo sólo en `Reply-To`, validado) · 700 KB como
máximo (nginx y script) · `limit_req` de nginx (2/min por IP, ráfaga 3) y 5 informes/hora por IP en el script · campo
trampa `sitio` · imagen sólo si es un JPEG real de ≤ 450 KB · el script no registra IPs ni contenido · `/api/` no
sirve nada más.
