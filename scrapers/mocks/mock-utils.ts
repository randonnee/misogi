/**
 * Converts a URL to a safe filename for mock storage.
 * The filename is deterministic so the same URL always produces the same filename.
 */
export function urlToFilename(url: string): string {
  // Remove protocol
  let filename = url.replace(/^https?:\/\//, "");
  
  // Replace unsafe characters with underscores
  filename = filename.replace(/[\/\\?%*:|"<>]/g, "_");
  
  // Add .html extension if not present
  if (!filename.endsWith(".html")) {
    filename += ".html";
  }
  
  return filename;
}

/**
 * Gets the full path to a mock file for a given URL.
 */
export function getMockFilePath(url: string): string {
  return `scrapers/mocks/html/${urlToFilename(url)}`;
}

/**
 * The directory where mock HTML files are stored.
 */
export const MOCK_HTML_DIR = "scrapers/mocks/html";
