# Despliegue en realify.es

Cada push a `main` se publica automáticamente en [realify.es](https://realify.es)
con GitHub Actions ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)).

```
git push origin main  →  GitHub Actions  →  SSH al VPS  →  copia idéntica a main  →  realify.es
```

Tarda menos de un minuto. El progreso se ve en la pestaña
[**Actions**](https://github.com/DavidJLlanes/Realify/actions) del repositorio.

## Cómo funciona

El VPS sirve la web con **nginx** desde un clon del repositorio en
`/var/www/realify.es`. El workflow entra por SSH y ejecuta:

```bash
git fetch origin main
git reset --hard origin/main
```

- La web queda **exactamente igual que `main`**, aunque `main` se haya
  reescrito con `push --force`.
- Cualquier cambio hecho a mano en los archivos del servidor **se pierde** en el
  siguiente despliegue: los cambios se hacen siempre en el repositorio.
- Los archivos no versionados (logs, etc.) no se tocan.

nginx bloquea `.git`, `log/`, `server/`, `tests/`, `tools/`, `docs/`, `design/` y el resto de archivos
internos con la configuración de
[`server/nginx/nginx-realify.conf.example`](../server/nginx/nginx-realify.conf.example).

## Antes de publicar

Si cambian archivos de la app, sube la versión para que los usuarios reciban la
nueva y no la guardada por el service worker:

- el contador de compilación (entero, sólo sube): `VERSION`, `version.json` (`version` y `build`), `VERSION` en `sw.js` y el `?v=` de `js/main.js` en `index.html`
- la versión pública (`1.0.0`, `1.0.1`, `1.1.0`…): `release` en `version.json`, `package.json` y `package-lock.json`

El contador es lo que compara la app para avisar de actualizaciones, así que nunca debe bajar; por eso la versión pública y el contador son números distintos.

## Secretos de GitHub

En **Settings › Secrets and variables › Actions**:

| Secreto | Contenido |
|---|---|
| `VPS_SSH_KEY` | Clave privada SSH completa (de `-----BEGIN` a `-----END`) |
| `VPS_HOST` | IP o dominio del VPS |
| `VPS_USER` | Usuario SSH |
| `VPS_PATH` | `/var/www/realify.es` |

## Configurar un servidor nuevo

1. **Clave para GitHub**, en el VPS:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   cat ~/.ssh/github_deploy      # → secreto VPS_SSH_KEY
   ```
2. **Clon del repositorio**:
   ```bash
   git clone https://github.com/DavidJLlanes/Realify.git /var/www/realify.es
   git config --global --add safe.directory /var/www/realify.es
   ```
3. **nginx**: añadir el contenido de `server/nginx/nginx-realify.conf.example` al
   bloque `server { … }` de realify.es (puerto 443) y aplicar:
   ```bash
   nginx -t && systemctl reload nginx
   ```
4. **Comprobar** que `.git` no es público (debe responder `404`):
   ```bash
   curl -I https://realify.es/.git/config
   ```

## Desplegar a mano

En GitHub: **Actions › Deploy a realify.es › Run workflow**.

## Problemas frecuentes

| Error | Solución |
|---|---|
| `Permission denied (publickey)` | `VPS_SSH_KEY` debe ser la clave **privada** y la pública debe estar en `~/.ssh/authorized_keys` del usuario de `VPS_USER`. |
| `detected dubious ownership` | En el VPS: `git config --global --add safe.directory /var/www/realify.es` |
| `not a git repository` | El clon no está en `VPS_PATH`; repetir el paso 2. |

## Seguridad

Ahora el despliegue entra como `root`. Es más seguro usar un usuario dedicado
que solo pueda escribir en `/var/www/realify.es`:

```bash
adduser --disabled-password --gecos "" deploy
chown -R deploy:deploy /var/www/realify.es
mkdir -p /home/deploy/.ssh
cat ~/.ssh/github_deploy.pub >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
sudo -u deploy git config --global --add safe.directory /var/www/realify.es
```

Después cambia el secreto `VPS_USER` a `deploy` y quita la clave de
`/root/.ssh/authorized_keys`.

## Migración desde la estructura anterior

Al publicar por primera vez la estructura reorganizada hay **dos pasos manuales en el VPS** (el despliegue por
`git reset --hard` mueve los archivos, pero no toca nginx ni el servicio de panorámicas):

1. **nginx**: copia al bloque `server { … }` de realify.es las líneas `location ^~ /tests/`, `/tools/`, `/docs/`,
   `/design/`, `/node_modules/` y `package.json` de [`server/nginx/nginx-realify.conf.example`](../server/nginx/nginx-realify.conf.example) y recarga
   (`sudo nginx -t && sudo systemctl reload nginx`). Hasta entonces esas carpetas internas quedarían visibles.
2. **Servicio de panorámicas (ya no existe)**: desde la v296 las panorámicas se unen sólo en el dispositivo. Si lo tenías instalado, retíralo:
   ```bash
   sudo systemctl disable --now realify-panorama
   sudo rm -f /etc/systemd/system/realify-panorama.service && sudo systemctl daemon-reload
   sudo rm -rf /var/www/realify.es/panorama /var/www/realify.es/server/panorama   # código y venv antiguos
   ```
   Y quita de nginx el bloque `location = /api/stitch { … }` (y su `client_max_body_size`), después `sudo nginx -t && sudo systemctl reload nginx`.
