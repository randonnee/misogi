import sharp from "sharp";

const TARGET_WIDTH = 600;
const WEBP_QUALITY = 80;

/**
 * Processes a raw image by resizing it to TARGET_WIDTH pixels wide
 * (maintaining aspect ratio) and converting to WebP format.
 */
export async function processImage(data: Uint8Array): Promise<Uint8Array> {
  const result = await sharp(data)
    .resize(TARGET_WIDTH, null, {
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return new Uint8Array(result);
}

/**
 * Converts an image filename to its WebP equivalent.
 * e.g., "thebeacon.film_image.png" -> "thebeacon.film_image.webp"
 */
export function toWebpFilename(filename: string): string {
  return filename.replace(/\.[a-zA-Z0-9]+$/, ".webp");
}
