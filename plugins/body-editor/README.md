# Editor de cuerpo (`plugins/body-editor/`)

Editor a pantalla completa (sobre `js/ui/kit/ai-editor/`, que usa `fsshell`) para la silueta, las proporciones, la postura, la definición y la piel del cuerpo (Fase 6).

- `params.js` · grupos y mandos: salen de `js/ai/people/profiles.js` (cada mando con su perfil y su rango) más los ajustes rápidos por perfil.
- `render.js` · prepara cada persona (copia reducida, puntos y máscara), pinta la vista previa y calcula el resultado a resolución completa.
- `editor.js` · flujo: análisis → editor con un objetivo por persona y selector de perfil → vista previa en vivo → una capa por persona.

Motores: `js/features/body/engine/` (de los mandos al campo de deformación), `js/features/body/definition/` (relieve y piel) y `js/features/warp/`.
Los accesos directos del menú (`ai.bodyShape`, `ai.bodyPosture`, `ai.bodyTone`, `ai.bodySkin`) abren este mismo editor en su grupo.

Seguridad: el perfil infantil no tiene mandos de pecho, caderas, glúteos, cintura, abdomen, espalda ni definición (ni en la interfaz ni en los valores:
`sanitize` los descarta antes de llegar al motor). Prueba: `tests/ia/cuerpo/motor.mjs`.
