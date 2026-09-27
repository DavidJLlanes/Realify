export function sanitizeFilename(s){
  return String(s).replace(/[\\/:*?"<>|]/g, "").trim();
}

export function safeWebFilename(s){
  const normalized = String(s || "imagen").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "imagen";
}
