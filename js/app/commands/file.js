/* ═══════════════════════════════════════════════════════════════
   APP · comandos de Archivo
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { registerAll } from "../../core/commands.js";
import { promptOpen, promptCamera, promptLoadStack, promptPasteImage, promptStartBatch, revertToOriginal } from "../../io/open.js";
import { promptOpenProject, openRecentProject, saveProject } from "../../io/project.js";
import { exportDialog, quickPng } from "../../io/export/export.js?v=82";
import { doc } from "../../core/doc.js";
import { closeActiveTab, closeAllTabs } from "../../editor/documents.js";
import { needsDoc, newDialog, photoTool } from "./helpers.js";

registerAll({
  "file.open":      () => promptOpen(),
  "file.openFiles": () => import("../../io/open.js").then(m => m.promptOpenFiles()),
  "file.camera":    () => promptCamera(),
  "file.openStack": () => promptLoadStack(),
  "file.pasteImage": () => promptPasteImage(),
  "file.openProject": () => promptOpenProject(),
  "file.openRecent": () => openRecentProject(),
  "file.saveProject": { run: saveProject, enabled: needsDoc },
  "file.new":       () => newDialog(),
  "file.export":    { run: exportDialog, enabled: needsDoc },
  "file.exportAs":  { run: async () => (await import("../../io/export/professional-export.js")).professionalExport(), enabled: needsDoc },
  "file.exportPng": { run: quickPng, enabled: needsDoc },
  "file.socialPreview": { run: photoTool("socialPreview"), enabled: needsDoc },
  /* Misma edición en varias fotos (plugins/batch/) */
  "file.batchEdit":  { run: async () => (await import("../../../plugins/batch/index.js")).openBatchEdit(), enabled: needsDoc },
  "file.startBatch": () => promptStartBatch(),
  "actions.open":   { run: async () => (await import("../../features/actions.js")).openActions() },
  "file.exportPdf": { run: async () => (await import("../../io/export/pdfexport.js")).exportPdf(), enabled: needsDoc },
  "file.exportGif":  { run: async () => (await import("../../io/export/gifexport.js")).exportGif(), enabled: needsDoc },
  "file.contactSheet": { run: async () => (await import("../../../plugins/contact-sheet/index.js")).openContacts() },
  "file.revert":    { run: revertToOriginal, enabled: () => doc.open && !!doc.source?.file },
  /* Cierra la pestaña activa (editor/documents.js): activa la vecina si
     queda alguna, o vuelve al estado «sin documento» si era la
     última — lo mismo que hacía este comando antes de que existieran
     las pestañas, ahora con el resto de la sesión intacto. */
  "file.close":     { run: closeActiveTab, enabled: needsDoc },
  "file.closeAll":  { run: () => closeAllTabs(), enabled: needsDoc },
  /* Collage / History / Post (plugins/social-post/): no necesita documento;
     el resultado se abre en una pestaña nueva. */
  "file.socialPost": { run: async () => (await import("../../../plugins/social-post/index.js")).openSocialPost() }
});
