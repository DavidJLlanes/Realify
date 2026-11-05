# Pruebas con fotos y modelos reales

Resultados de ejecutar las funciones de IA con los modelos incluidos en `assets/models` sobre fotos reales (en un entorno sin GPU: tiempos de CPU,
bastante mayores que en un móvil con WebGPU). Las fotos no se suben al repositorio: se usan con `REALIFY_FOTOS=<carpeta>`.

| Prueba | Qué hace |
|---|---|
| `tests/ia/reales/sam.mjs` | Pincel inteligente con MobileSAM: un trazo sobre un objeto → selección. |
| `tests/ia/reales/funciones.mjs` | Cielo, neblina, realzar por tipo, profundidad, unificar iluminación, texto en zona libre, zonas lisas, balance por zonas. |
| `tests/ia/retrato/piel-editor.mjs` (con `REALIFY_FOTO`) | Las trece funciones de cara con los modelos de cara reales. |
| `tests/ia/estilo/pestanas.mjs` | «Mis estilos» aplicado a todas las pestañas abiertas. |

## Resultado (5 nov 2026)
- **Pincel inteligente**: sobre un perro blanco en hierba, un trazo de 6 puntos da una máscara limpia del animal (17 s de análisis en CPU).
- **Quitar neblina**: **fallo hallado y arreglado**. En una foto sin neblina (edificio con sombras profundas) quemaba negros (cambio medio 40/255).
  Ahora la neblina solo se da por presente si hasta el 10 % más oscuro del canal oscuro está velado; el mismo caso cambia 0,6/255. Prueba añadida al motor.
- **Realzar por tipo** (DeepLab), **aberración por distancia** y **luz con relieve** (profundidad), **unificar iluminación**, **zonas lisas** y
  **balance de blancos por zonas**: producen su capa nueva sin errores. «Realzar por tipo» con un tipo ausente avisa «No he encontrado eso en la foto».
- **Texto en zona libre**: sobre un retrato doble, el texto cae en el hueco vacío de la esquina, en claro, sin tocar ninguna cara.
- **Manos y dientes**: sobre una foto de autobús con personas, detecta 2 manos y no da avisos falsos.
- **Funciones de cara** (13): todas aplican con la cara real; «Dientes» no cambia nada cuando la boca está cerrada (correcto).
- **Mis estilos › todas las pestañas**: tres pestañas, cada una recibe su capa y pasa de azulada a cálida.

## Sin probar aquí
Ver `docs/PENDIENTE_TITULAR.md`.
