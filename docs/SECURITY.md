# Política de seguridad

## Versiones con soporte

Realify se publica de forma continua en [realify.es](https://realify.es). Solo
la versión desplegada en la web recibe correcciones de seguridad.

| Versión | Soporte |
|---|---|
| Última versión en [realify.es](https://realify.es) (rama `main`) | ✅ |
| Versiones anteriores | ❌ |

## Informar de una vulnerabilidad

**No abras un issue público** para informar de un problema de seguridad.

Usa el aviso privado de GitHub:

1. Entra en la pestaña [**Security**](https://github.com/DavidJLlanes/Realify/security)
   del repositorio.
2. Pulsa **Report a vulnerability**.
3. Describe el problema, cómo reproducirlo y su posible impacto.

Recibirás una respuesta lo antes posible. Te mantendremos informado del
progreso y, si quieres, se te reconocerá el hallazgo cuando se publique la
corrección.

## Alcance

Nos interesan especialmente:

- Cualquier forma de que una imagen o dato del usuario **salga del navegador**
  sin su consentimiento.
- Ejecución de código mediante archivos manipulados (PSD, TIFF, HEIC, RAW,
  SVG, proyectos, LUT `.cube`, pinceles `.abr`…).
- Saltos de la política de seguridad de contenido (CSP) o XSS.
- Problemas en el service worker o la caché que permitan servir contenido
  alterado.

Quedan fuera del alcance los fallos en librerías de terceros ya corregidos en
su proyecto original (infórmanos igualmente para actualizar la copia
incluida) y los ataques que requieren acceso físico al dispositivo.

## Modelo de privacidad

Todo el procesado de imágenes ocurre en el dispositivo del usuario. La app solo
se conecta a la red para:

- Cargar la propia aplicación desde [realify.es](https://realify.es).
- Descargar modelos de IA bajo demanda (Hugging Face), que quedan guardados en
  el navegador.
- Enviar la imagen a un servidor **propio del usuario**, solo si configura
  expresamente el servidor opcional de Unmark.

Las tipografías (todo el catálogo libre de Google Fonts) se sirven desde el
propio sitio, en `/fonts/`: el navegador no se conecta con Google.

La app no carga analítica ni cookies de seguimiento.
