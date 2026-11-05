# Cuerpo (`js/features/body/`)

Editor de cuerpo (Fase 6): silueta, proporciones, cabeza y cuello, torso, brazos, piernas, postura, definición y piel del cuerpo, para hombre, mujer, niño y niña.

| Carpeta | Qué hace |
|---|---|
| `engine/` | De los mandos al campo de deformación (`js/features/warp/`): esqueleto desde la pose, secciones del cuerpo sobre la máscara de la persona, mandos de ancho (`ops-ancho.js`) y de largo/cabeza/postura (`ops-largo.js`). Sin DOM. |
| `definition/` | Relieve de luz y sombra (tono, musculatura) y piel (suavizar, uniformar, bronceado) sobre planos lineales y una máscara de piel sin cara ni pelo. No genera piel. |
| `params.js` | Grupos, mandos (de `js/ai/people/profiles.js`, con su perfil y su rango) y ajustes rápidos por perfil. |
| `editor/`, `shape/`, `posture/`, `tone/`, `skin/` | Las cinco funciones del menú (`ai.bodyEditor`, `ai.bodyShape`, `ai.bodyPosture`, `ai.bodyTone`, `ai.bodySkin`): accesos directos al mismo editor (`plugins/body-editor/`) abierto en su grupo. |

Seguridad (F6.9): el perfil infantil no tiene mandos de pecho, caderas, glúteos, cintura, abdomen, espalda ni definición; `sanitize` los descarta antes del motor.
Un retrato que acaba en el pecho se admite: las caderas se estiman a 1,4 anchos de hombros y sólo actúan los mandos de la parte alta.
Pruebas: `tests/ia/cuerpo/motor.mjs` (Node) y `tests/ia/cuerpo/editor.mjs` (navegador, móvil y escritorio).
