/** iOS kan lämna tom MIME för HEIC; kameran använder ibland filändelse istället. */
export function isLikelyImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const name = (file.name || '').toLowerCase();
  return /\.(heic|heif|jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(name);
}
