# Fusión HDR

Plugin a pantalla completa (escritorio y móvil) que fusiona de 1 a 11 fotos de
la misma escena con distinta exposición.

| Archivo | Qué hace |
|---|---|
| `index.js` | Entrada: abre el editor y lleva el resultado a una capa nueva. |
| `ui.js` | Ventana (sobre `js/ui/fsshell.js`): fotos, estilos y ajustes. |
| `worker.js` | Todo el cálculo, fuera del hilo de la interfaz. |
| `engine.js` | Funciones puras: exposición, alineación, fusión y mapeo tonal. |
| `presets.js` | Ajustes por defecto y los 17 estilos. |
| `exif.js` | Lee tiempo, diafragma, ISO y compensación de JPEG/TIFF. |

## Proceso

1. **Horquillado**: EV relativo de cada foto desde el EXIF (JPEG, TIFF/DNG,
   HEIC, PNG y WebP); si falta (fotos reenviadas…), se estima por la razón de
   los valores lineales entre fotos vecinas de brillo y, si los saltos se
   parecen, se igualan (un horquillado suele ir a pasos iguales). Se corrige
   en **Foto elegida**, el primer grupo: la exposición de cada foto en tercios
   de paso (deslizador con − / +, la vista cambia mientras se arrastra) o
   **Pasos entre fotos** para poner todo el horquillado a ⅓…4 EV de golpe.
2. **Alineación**: cada foto se alinea con su vecina de exposición (en cadena
   hasta la intermedia) probando dos métodos —gradientes del logaritmo de la
   luminancia con la exposición igualada, y mapas de umbral mediano de Ward— y
   quedándose con el de menor error. Después se pueden recortar los bordes.
3. **Fusión**:
   - *Mapa de radiancia* (Debevec, curva sRGB) con pesos en sombrero y
     **antifantasmas** (suave, medio, fuerte) con foto de referencia elegible.
   - *Fusión de exposición* (Mertens): contraste, saturación y buena
     exposición, mezcladas con pirámides laplacianas.
4. **Mapeo tonal**: *Detalles realzados* (base/detalle con filtro guiado: fuerza,
   saturación, luminosidad, contraste de detalle, suavizado de iluminación,
   microsuavizado, suavizar altas luces), *Compresor de tonos* (Reinhard) y
   *Fotográfico* (Drago).
5. **Ajustes finales**: exposición, contraste, puntos negro y blanco, gamma,
   sombras, altas luces, saturación, intensidad, saturación en luces y en
   sombras, temperatura, tinte y nitidez.

Orden de los grupos, el del trabajo: Foto elegida → Fusión de las fotos →
Estilo → Método → mandos del método → Tono → Color → Detalle. Mientras se
arrastra una exposición, el worker fusiona un borrador más pequeño (55 % de
la vista previa) y sólo se calcula la última posición, sin cola.

Tamaño de trabajo: 4096 px de lado en el ordenador y 2400 px en el móvil.
