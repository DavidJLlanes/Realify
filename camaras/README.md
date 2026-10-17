# Cámaras

Galería a pantalla completa de **cámaras de todas las épocas** (del daguerrotipo a la compacta digital de
CCD de 2005, pasando por instantáneas, juguete, vídeo doméstico…). Mismo armazón que el collage y Estilos
(`js/ui/fsshell.js`); al aplicar crea una capa de filtro reeditable (`camaras` en
`js/editor/filterregistry.js`). Se abre desde **Filtro › Especiales › Cámaras…**, **Filtro › Filtros (como en
el móvil) › Cámaras…** y, en el móvil, desde la pestaña **Filtros** del cajón «Herramientas».

## Archivos

| Archivo | Papel |
|---|---|
| `index.js` | Entrada: `openCamaras()` y `renderCamaras()` para el registro de filtros |
| `state.js` | Los 61 modificadores (0-100) en 7 grupos y el estado de la capa (`preset`, `intensity`, `seed`, `date`, `premium`, `values`) |
| `presets.js` | El catálogo: `CATS` (las 19 familias previstas) y `PRESETS` (cada cámara = una receta de modificadores). Nombres genéricos, sin marcas |
| `engine.js` | Motor WebGL2: un único shader para miniaturas, vista previa y resultado final (por teselas) |
| `ui.js` | Ventana: escritorio con buscador, desplegable de familia, miniaturas, intensidad y variación; móvil con dos desplegables y hoja de miniaturas |
| `camaras.css` | Complementos de `css/fsplugin.css` |

## Cómo funciona

Cada cámara es una **receta**: unos pocos modificadores con su cantidad. `intensity` los escala todos, así
que «a medias» es la misma cámara con menos efecto. Las miniaturas son un recorte cuadrado de la foto
activa con cada receta aplicada por el mismo motor que la vista previa; se recalculan al cambiar Premium, la
variación o el historial.

El shader tiene dos etapas:

1. **Óptica y luz**: muestreo (cinta, tubo, ojo de pez, baja resolución), color de borde, enfoque,
   desenfoques, resplandor, flash, rayas de luz, halación, fugas, viñeteado.
2. **Revelado**: curvas, color, virados, trama de semitono, grano, daños, marcos y rotulación.

**Premium 👑**: la etapa 1 se calcula en **luz lineal** (los desenfoques también), con un hombro suave en las
luces en vez de recorte duro, y la salida lleva **tramado triangular**. Apagado, todo se calcula sobre el valor
codificado. El interruptor se recuerda por navegador (`premiumPref`, clave `camaras`) y se guarda en la capa.

## Coherencia vista previa / resultado

Todo efecto espacial se expresa en **coordenadas de la imagen completa**, no de la miniatura o la vista previa.
El polvo, las fugas, la trama y el sello caen en el mismo sitio en una miniatura, en la vista previa y en cada
tesela del resultado. Lo aleatorio sale de `seed`: la misma semilla da el mismo resultado al arrastrar, al
aplicar y al reabrir. El resultado a resolución completa se calcula por teselas con un margen de vecindad
(`marginFrac`, `geomMap` en `engine.js`).

## Añadir cámaras o una familia

Basta con añadir entradas a `PRESETS` en `presets.js`: `P(id, familia, nombre, { modificador: cantidad, … })`.
La interfaz sólo enseña las familias de `CATS` que ya tienen cámaras, así que meter una familia entera no exige
tocar nada más. Si hace falta un efecto nuevo: un modificador en `CONTROLS` (`state.js`, **al final de su grupo
y respetando el orden**, que es el de la matriz `A[]` del shader) y su bloque en `engine.js`.

## Estado del catálogo

**150 cámaras en las 19 familias** (procesos del siglo XIX 8, cajón y fuelle 7, película en color 13, blanco y
negro 8, instantáneas 6, juguete 7, compactas analógicas 7, compactas digitales CCD 14, móviles y webcams 8,
vídeo y vigilancia 6, ópticas especiales 6, cine y fotogramas 10, científica y técnica 8, espía y acción 6,
prensa e impresión 8, pantallas y capturas 7, digitalización de época 6, lentes y accesorios 8, luz y clima 7).
Las recetas se afinaron a ojo sobre una escena sintética; con fotos reales pueden pedir un retoque de cantidades.

## Límites

- No conserva el origen de 16 bits de la capa (como hace el Filtro Vintage): el resultado es de 8 bits con
  tramado en Premium.
- Los efectos de pantalla (máscara de tubo, líneas de barrido) dependen del tamaño de la imagen: se definen
  en fracciones del lado de la imagen, no en píxeles reales.
- Es una **simulación estética**: «compacta digital de 2005» evoca el aspecto, no clona un modelo concreto.
