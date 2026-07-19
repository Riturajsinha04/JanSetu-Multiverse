/**
 * imageCompressor.ts — Expo/React Native only
 * Uses expo-image-manipulator to resize and compress images to JPEG base64.
 * Only the IMAGE is encoded. Voice transcript stays as plain text.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface CompressedImage {
  base64Data: string;       // raw base64 string (no data: prefix) — sent as image_base64 in POST
  dataUri: string;          // data:image/jpeg;base64,... — used for <Image> preview
  uri: string;              // local file URI after manipulation
  mimeType: 'image/jpeg';
  originalSize: number;     // bytes (approximate from picker asset)
  compressedSize: number;   // bytes (approximate from base64 length)
  width: number;
  height: number;
}

const MAX_DIMENSION = 1024; // max width or height in px
const JPEG_QUALITY = 0.65;  // 65% quality

/**
 * Compresses a local image URI (from expo-image-picker) to a JPEG base64 string.
 * Resizes so neither dimension exceeds MAX_DIMENSION, preserving aspect ratio.
 *
 * @param uri        Local URI from ImagePicker asset (e.g. file:///...)
 * @param origWidth  Original image width in px
 * @param origHeight Original image height in px
 * @param origSize   Original file size in bytes (from picker's fileSize, optional)
 */
export async function compressImage(
  uri: string,
  origWidth: number,
  origHeight: number,
  origSize?: number
): Promise<CompressedImage> {
  // Calculate target dimensions preserving aspect ratio
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  if (origWidth > MAX_DIMENSION || origHeight > MAX_DIMENSION) {
    if (origWidth > origHeight) {
      targetWidth = MAX_DIMENSION;
      targetHeight = Math.round((origHeight / origWidth) * MAX_DIMENSION);
    } else {
      targetHeight = MAX_DIMENSION;
      targetWidth = Math.round((origWidth / origHeight) * MAX_DIMENSION);
    }
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: targetWidth, height: targetHeight } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true, // get base64 directly
    }
  );

  const base64Data = result.base64 ?? '';

  // Approximate compressed size from base64 length (base64 encodes 3 bytes → 4 chars)
  const compressedSize = Math.round((base64Data.length * 3) / 4);

  return {
    base64Data,
    dataUri: `data:image/jpeg;base64,${base64Data}`,
    uri: result.uri,
    mimeType: 'image/jpeg',
    originalSize: origSize ?? 0,
    compressedSize,
    width: result.width,
    height: result.height,
  };
}

/** Formats bytes into a human-readable string e.g. "1.2 MB", "180 KB" */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
