export const IMAGE_FILE_ACCEPT = "image/jpeg,image/png,image/webp";
export const IMAGE_FILE_HINT = "JPEG, PNG, or WebP up to 5 MB.";

const ALLOWED_IMAGE_TYPES = new Set(IMAGE_FILE_ACCEPT.split(","));
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

export function validateImageFile(file: Pick<File, "size" | "type">): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Invalid file type. Allowed: JPEG, PNG, WebP";
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return "File too large. Maximum size: 5MB";
  }

  return null;
}
