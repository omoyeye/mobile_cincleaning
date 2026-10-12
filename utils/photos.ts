import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest side for job photos: sharp on any screen, about 250 KB each. */
const MAX_SIDE = 1600;

/**
 * Shrinks a camera photo and returns it as a data URL ready to upload.
 * Full-size phone photos are 3 to 5 MB each and a handful would exceed the upload limit.
 */
export async function photoToDataUrl(uri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${saved.base64 ?? ''}`;
}
