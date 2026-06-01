export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const ALLOWED_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const UPLOAD_ERROR_MESSAGE = "Solo se aceptan PDF e imágenes (máx. 10 MB).";

export function validateUpload(file: File): { ok: true } | { ok: false; error: string } {
  const name = file.name.toLowerCase();
  const extOk = /\.(pdf|jpg|jpeg|png)$/i.test(name);
  const typeOk = ALLOWED_UPLOAD_TYPES.includes(file.type) || extOk;
  if (!typeOk || !extOk) return { ok: false, error: UPLOAD_ERROR_MESSAGE };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: UPLOAD_ERROR_MESSAGE };
  return { ok: true };
}
