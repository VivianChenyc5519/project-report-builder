export function fileToImageUrl(file: File): string {
  return URL.createObjectURL(file);
}