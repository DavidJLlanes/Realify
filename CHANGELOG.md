# Registro de cambios

Todos los cambios relevantes de [Realify](https://realify.es) se documentan en
este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Realify se publica de forma continua en [realify.es](https://realify.es), por lo
que las entradas se agrupan por fecha.

## [Sin publicar]

### Añadido
- **Cerrar todas las fotos**: en Archivo, en Herramientas y en la barra de pestañas;
  una sola confirmación.
- **Fusión HDR** (`hdr/`): hasta 11 fotos, horquillado detectado solo, alineación,
  antifantasmas, fusión de exposición y mapeo tonal con 17 estilos.
- **Unir imágenes** (`unir/`): panorámica automática y unión en fila, columna o
  cuadrícula.
- **Cortar en partes** (`cortar/`) y **Recortar en forma** (`formas/`, ~60 formas)
  a pantalla completa, sustituyen a «Dividir en trozos» y al diálogo anterior.
- **Antes y después** (`comparar/`) y **Hoja de contactos** (`hojacontactos/`).
- Exportar en **AVIF** y **PDF**; **GIF animado** a partir de las capas.
- **Paleta de colores** y **cuentagotas de pantalla**.
- **Acciones**: grabar y repetir secuencias de comandos, también en lote.
- **Editar en lote / Aplicar esta edición a otras fotos** (`lote/`): edita una
  foto y copia su edición (ajustes, filtros, textos, marcas de agua) a otras
  pestañas o fotos de la galería, con vista previa, **igualado de exposición**
  y resultado en sus pestañas (capas reeditables) o en un ZIP.
- Capa de ajuste **Exposición** (en pasos EV).
- IA: **ampliar** ×2/×4, **colorear** y **expandir** el lienzo.
- Zoom y desplazamiento de la imagen mientras se aplica cualquier efecto.
- Aviso visible con botón Cancelar mientras trabaja la IA; si un modelo pesado
  agota la memoria y la página se recarga, la imagen se recupera.

### Cambiado
- **Eliminar fondo** crea una capa nueva con el recorte y oculta la original.

### Eliminado
- «Procesar carpeta» (y el botón «Abrir lote» del inicio): sólo aplicaba el
  filtro Realify con variaciones; lo sustituye «Editar en lote».

### Corregido
- ISNet recibía la imagen sin normalizar y devolvía máscaras casi uniformes.
- Rasterizar un texto mientras se editaba dejaba un error al cerrar la edición.
- El despliegue reintenta la conexión SSH si el servidor la corta.

### Añadido
- **Aviso de versión nueva**: al volver a la app (y cada 30 minutos) se
  comprueba si hay una versión publicada; si la hay, una barra ofrece
  «Actualizar», que guarda todas las pestañas abiertas, recarga y las reabre.

### Cambiado
- **Tipografías sin Google**: todo el catálogo de Google Fonts (1908 familias)
  se sirve desde el propio sitio, en `/fonts/`. El navegador ya no se conecta
  con Google, desaparece el aviso de permiso y las fuentes funcionan sin
  conexión. La herramienta Texto tiene un buscador con vista previa
  («Más fuentes (buscar entre 1900)…»).

### Añadido
- Documentación del repositorio: guía de contribución, código de conducta,
  política de seguridad, plantillas de issues y pull requests, y este registro
  de cambios.

## 2026-09-27

### Añadido
- **Collage / History / Post**: collages, publicaciones e historias para redes
  sociales, con 40 diseños, formatos de más de 29 redes, proporciones y
  pantallas de móviles, zonas seguras, diseño «Libre» y 28 formas para las
  fotos.
- **Creador de memes**: 26 diseños, segunda foto, efectos de imagen y textos
  con 29 tipografías y 26 estilos rápidos.
- **Stickers**: 1.595 emojis de Fluent Emoji en cuatro estilos, con tonos de
  piel y búsqueda en español e inglés.
- **Filtro Vintage avanzado**: 41 parámetros en 7 grupos y 102 estilos.
- **Estilos**: 160 looks en 16 categorías, con buscador y miniaturas.
- **Curvas** con canal de luminosidad, vista R · G · B y 25 estilos.
- **Tonos del histograma** e **histograma interactivo** en el panel lateral.
- **Cuadrícula inteligente** con detección de sujeto, horizonte y rostros, y
  propuesta de recorte.
- **Pinceles especiales**: simétrico, con textura y de degradado.
- **Dividir en trozos** (carrusel e Instagram) y **recortar en forma**.
- Remuestreo Lanczos 3, Mitchell y Catmull-Rom.
- Tramado opcional a 8 bits al exportar.
- README con todas las funcionalidades de la web.

### Cambiado
- **Revelado RAW**: flujo lineal de 16 bits, nuevo modelo tonal y controles
  mejorados.
- Filtros con alternativa en CPU cuando falla la GPU.

### Corregido
- Correcciones en varios filtros.
