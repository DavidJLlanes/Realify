/** Extensiones que se envían al decodificador RAW local. */
export const RAW_EXTENSIONS = new Set([
  "3fr", "ari", "arw", "bay", "cap", "cr2", "cr3", "crw", "dcr", "dcs", "dng",
  "drf", "eip", "erf", "fff", "gpr", "iiq", "k25", "kdc", "mdc", "mef", "mos",
  "mrw", "nef", "nrw", "obm", "orf", "pef", "ptx", "pxn", "r3d", "raf", "raw",
  "rwl", "rw2", "rwz", "sr2", "srf", "srw", "x3f"
]);

export const isRawFile = file => RAW_EXTENSIONS.has((file?.name || "").split(".").pop().toLowerCase());
