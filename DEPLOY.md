# Despliegue automático en VPS

Este repositorio tiene configurado **GitHub Actions** para desplegar automáticamente en tu VPS cada vez que hagas push a `main`.

## ¿Cómo funciona?

```
git push origin main  →  GitHub Actions  →  SSH al VPS  →  git pull  →  realify.es actualizado
```

Sin intervención manual, sin esperas, en menos de 1 minuto.

## Configuración inicial (una sola vez)

### 1. Crear una clave SSH en tu VPS

En tu VPS, como el usuario que corre el servidor (ej. `www-data`, `realify`, etc.):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Copia el contenido de la **clave privada**:

```bash
cat ~/.ssh/github_deploy
```

### 2. Agregar secretos en GitHub

En tu repositorio: **Settings → Secrets and variables → Actions → New repository secret**.

Crea estos 3 secretos:

| Nombre | Valor | Ejemplo |
|---|---|---|
| `VPS_SSH_KEY` | Contenido de `~/.ssh/github_deploy` (la clave privada completa) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_HOST` | IP o dominio del VPS | `1.2.3.4` o `vps.example.com` |
| `VPS_USER` | Usuario SSH del VPS | `root` o `realify` |
| `VPS_PATH` | Carpeta de la web | `/var/www/realify` o `/home/realify/www` |

### 3. Preparar el VPS

En tu VPS, en la carpeta de la web, clona el repositorio:

```bash
cd /var/www
git clone https://github.com/DavidJLlanes/Realify.git realify
cd realify
git checkout main
```

O si ya existe:

```bash
cd /var/www/realify
git remote set-url origin https://github.com/DavidJLlanes/Realify.git
git fetch origin
git checkout main
```

## Usar

### Desde tu PC

```powershell
git subir "Descripción del cambio"
```

Eso hace push a `main` en GitHub. En menos de 1 minuto, el workflow:
- Se ejecuta automáticamente
- Se conecta a tu VPS por SSH
- Hace `git pull origin main`
- La web se actualiza

### Ver el estado

En GitHub, ve a **Actions** y verás cada despliegue en tiempo real. Si algo falla, aparece un aviso.

## Troubleshooting

**"Permission denied (publickey)"**
- Asegúrate de que `VPS_SSH_KEY` es la **clave privada** (comienza con `-----BEGIN`), no la pública.
- Comprueba que en el VPS la clave pública está en `~/.ssh/authorized_keys`.

**El repositorio en el VPS no existe**
- Clonalo manualmente (ver «Preparar el VPS» arriba).

**El workflow no se ejecuta**
- Verifica que está en `.github/workflows/deploy.yml`.
- Comprueba que los secretos están configurados (sin espacios ni saltos de línea extra).

**Quiero desplegar manualmente**
- En GitHub, ve a **Actions → Deploy a realify.es → Run workflow → Run workflow** (botón verde).

## Seguridad

- La clave SSH solo tiene permiso para hacer `git pull` en esa carpeta, nada más.
- Los secretos no se ven en el repositorio.
- Cada despliegue queda registrado en GitHub Actions.

## Desactivar o cambiar

Si quieres cambiar el usuario, la carpeta o desactivar el despliegue automático:
- Edita `.github/workflows/deploy.yml` o elimina el archivo.
- Los cambios se aplicarán en el siguiente push.
