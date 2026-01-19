/**
 * Converts a URL to a safe filename for mock storage.
 * The filename is deterministic so the same URL always produces the same filename.
 * Preserves existing file extensions, only appends .html if no extension is present.
 */
function urlToFilename(url: string, preserveQueryParams: boolean = true): string {
  // Remove protocol
  let filename = url.replace(/^https?:\/\//, "");

  // Handle query parameters based on preserveQueryParams flag
  if (!preserveQueryParams) {
    const queryIndex = filename.indexOf("?");
    if (queryIndex !== -1) {
      filename = filename.substring(0, queryIndex);
    }
  }

  // Replace unsafe characters with underscores (including ? to preserve query params in filename)
  filename = filename.replace(/[\/\\%*:|"<>?]/g, "_");

  // Check if filename has an extension (looking for .something at the end)
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(filename);

  // Add .html extension only if no extension is present
  if (!hasExtension) {
    filename += ".html";
  }

  return filename;
}

export function htmlUrlToFilename(url: string): string {
  return urlToFilename(url, true)
}

export function imageUrlToFilename(url: string): string {
  return urlToFilename(url, false)
}

/**
 * Gets the full path to a mock file for a given URL.
 */
export function getMockHtmlFilePath(url: string): string {
  return `scrapers/mocks/html/${htmlUrlToFilename(url)}`;
}

/**
 * The directory where mock HTML files are stored.
 */
export const MOCK_HTML_DIR = "scrapers/mocks/html";

/**
 * The directory where mock image files are stored.
 */
export const MOCK_IMAGES_DIR = "scrapers/mocks/images";

/**
 * Gets the full path to a mock image file for a given URL.
 * Strips query parameters since they're not meaningful for image caching.
 */
export function getMockImageFilePath(url: string): string {
  return `${MOCK_IMAGES_DIR}/${imageUrlToFilename(url)}`;
}

/**
 * The directory where output image files are stored for serving.
 */
export const OUT_IMAGES_DIR = "out/images";

/**
 * Gets the full path to an output image file for a given URL.
 * Strips query parameters since they're not meaningful for image caching.
 */
export function getOutImageFilePath(url: string): string {
  return `${OUT_IMAGES_DIR}/${imageUrlToFilename(url)}`;
}
