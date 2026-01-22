import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { OUT_IMAGES_DIR } from "../mocks/mock-utils";

// Track all image files used during this run (shared across all scraper instances)
const usedImageFiles = new Set<string>();

/**
 * Records an image file path as used during this run.
 * Call this for every image that is cached or downloaded.
 */
export function trackImageUsed(filePath: string): void {
  usedImageFiles.add(filePath);
}

/**
 * Cleans up unused images from the out/images directory.
 * Deletes any image files that weren't accessed during the current run.
 * Should be called after all scraping is complete.
 */
export async function cleanupUnusedImages(): Promise<void> {
  try {
    const files = await readdir(OUT_IMAGES_DIR);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = join(OUT_IMAGES_DIR, file);
      if (!usedImageFiles.has(filePath)) {
        await unlink(filePath);
        deletedCount++;
        console.log(`Deleted unused image: ${filePath}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} unused image(s)`);
    } else {
      console.log("No unused images to clean up");
    }
  } catch (error) {
    // Directory might not exist on first run
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Error cleaning up unused images:", error);
    }
  }
}
