export interface CompressedImage {
  base64: string;         // data:image/jpeg;base64,... (full data URL)
  base64Data: string;     // just the base64 string without the data: prefix
  mimeType: string;
  blob: Blob;
  originalSize: number;   // bytes
  compressedSize: number; // bytes
  width: number;
  height: number;
}

const MAX_DIMENSION = 1024; // px — max width or height after resize
const JPEG_QUALITY = 0.65;  // 65% quality

/**
 * Compresses a File or Blob using an off-screen canvas.
 * Resizes to at most MAX_DIMENSION × MAX_DIMENSION, then encodes as JPEG.
 */
export async function compressImage(file: File | Blob): Promise<CompressedImage> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate new dimensions keeping aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas 2D context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.split(',')[1];
            resolve({
              base64: dataUrl,
              base64Data,
              mimeType: 'image/jpeg',
              blob,
              originalSize,
              compressedSize: blob.size,
              width,
              height,
            });
          };
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/** Formats bytes to a human-readable string e.g. "1.2 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
