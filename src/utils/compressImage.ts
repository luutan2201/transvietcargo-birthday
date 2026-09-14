/**
 * Resizes and re-compresses an image entirely in the browser before
 * upload — a phone photo (3-8MB) typically shrinks to 150-300KB with no
 * visible quality loss for this use case (viewing a gift photo in the
 * app), which matters because Supabase Storage's free tier is 1GB total.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file; // fall back to the original file if canvas isn't available

  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}
