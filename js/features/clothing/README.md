# Ropa y tejidos (Fase 7)

Cuatro funciones Premium 👑 que comparten un motor y un editor: `iron/` (Planchar arrugas de ropa, `ai.clothesWrinkles`), `fabric/` (Arrugas de telas y fondos,
`ai.fabricWrinkles`), `recolor/` (Cambiar color de prendas, `ai.recolorClothes`) y `texture/` (Textura de tejido, `ai.fabricTexture`). Cada una abre el editor
`plugins/clothing-editor/` en su grupo; los mandos están en `params.js`.

- `shared/mascara.js`: máscara de la prenda con las partes del modelo de personas (ajustada con filtro guiado). `shared/region.js`: zona de tela por toque (crecimiento por color sin saltos de luz).
- `engine/` (sin DOM, luz lineal): `planchar.js`, `recolor.js`, `textura.js`, `clases.js` (clases de color para no confundir rayas con arrugas) e `index.js` (`etapas`: planchar → textura → color).
- Resultado: una capa nueva con alfa (sólo la tela). Pruebas: `tests/ia/ropa/`.

Límites: una prenda con estampado muy denso puede quedar partida en varias clases de color; la tela por toque no cruza una costura o un cambio de luz brusco (se vuelve a tocar).
