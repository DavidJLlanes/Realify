# Despliegue en realify.es

Cada push a `main` se publica automáticamente en [realify.es](https://realify.es)
con GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

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

nginx bloquea `.git`, `server/` y el resto de archivos internos con la
configuración de
[`server/nginx-realify.conf.example`](server/nginx-realify.conf.example).

## Antes de publicar

Si cambian archivos de la app, sube la versión para que los usuarios reciban la
nueva y no la guardada por el service worker:

- `VERSION` en `sw.js`
- el `?v=` de `js/main.js` en `index.html`

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
3. **nginx**: añadir el contenido de `server/nginx-realify.conf.example` al
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
