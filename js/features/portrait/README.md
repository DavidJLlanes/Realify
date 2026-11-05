# Retrato (`js/features/portrait/`)

Funciones de retrato de la IA local (Fase 3 y siguientes). Cada función tiene su carpeta con la plantilla del plan (`manifest`,
`index`, `ui`, `controller`, `analysis`, `engine`, `params`); lo común está en `shared/`:

- `landmarks.js` · índices de la malla de 478 puntos · `geometry.js` · escala, inclinación y recorte de la cara
- `zones.js` · máscaras de frente, entrecejo, ojos, ojeras, surcos, comisuras y cuello · `skin.js` · máscara de piel del recorte
- `blur.js`, `raster.js`, `ridges.js`, `planes.js` · desenfoques, trazado de máscaras, filtro de crestas y planos en luz lineal
- `analysis.js` · análisis de caras (puntos + partes) con progreso

Funciones: `skin-wrinkles`, `skin-dark-circles`, `skin-shine`, `skin-texture`, `skin-even`. Todas abren el editor de cara
(`plugins/face-editor/`). Pendiente: las manos como zona de arrugas.
