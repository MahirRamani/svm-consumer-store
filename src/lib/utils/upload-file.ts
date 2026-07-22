export interface UploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width?: number;
  height?: number;
}

export type UploadContext = 'product' | 'bill';

// ============================================================
// VALIDATION
// ============================================================
const ALLOWED_TYPES: Record<UploadContext, string[]> = {
  product: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  bill: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
};

const MAX_SIZES: Record<UploadContext, number> = {
  product: 5 * 1024 * 1024,
  bill: 10 * 1024 * 1024,
};

const ERROR_MESSAGES: Record<UploadContext, string> = {
  product: 'Please select JPEG, PNG or WebP image (max 5MB)',
  bill: 'Please select JPEG, PNG, WebP image or PDF (max 10MB)',
};

export const validateFile = (
  file: File,
  context: UploadContext,
): { isValid: boolean; error?: string } => {
  if (!ALLOWED_TYPES[context].includes(file.type)) {
    return { isValid: false, error: ERROR_MESSAGES[context] };
  }
  if (file.size > MAX_SIZES[context]) {
    return { isValid: false, error: ERROR_MESSAGES[context] };
  }
  return { isValid: true };
};

// ============================================================
// UPLOAD
// ============================================================
export const uploadFile = async ({
  file,
  context,
  fileName,
}: {
  file: File;
  context: UploadContext;
  fileName?: string;
}): Promise<UploadResult> => {
  const fd = new globalThis.FormData();
  fd.append("file", file);
  fd.append("context", context);
  if (fileName?.trim()) fd.append("fileName", fileName.trim());

  const response = await fetch("/api/upload-file", {
    method: "POST",
    body: fd,
  });

  const result = await response.json();
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error || "Upload failed");
  }

  return result.data;
};

// ============================================================
// DELETE
// ============================================================
export const deleteFile = async (
  publicId: string,
  resourceType: "image" | "raw" = "image",
): Promise<void> => {
  await fetch("/api/upload-file", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId, resourceType }),
  });
};