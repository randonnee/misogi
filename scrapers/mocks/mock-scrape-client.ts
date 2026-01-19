import { Effect } from "effect";
import type { ScrapeClient } from "../network/scrape-client";
import { getMockFilePath } from "./mock-utils";

/**
 * A mock scrape client that reads HTML from the mocks/html folder.
 * Files are stored with filenames derived from the URL.
 * Use `bun run start:update-mocks` to populate the mock files.
 */
export class MockScrapeClient implements ScrapeClient {
  get(url: string): Effect.Effect<string, Error> {
    return Effect.tryPromise({
      try: async () => {
        const filePath = getMockFilePath(url);
        const file = Bun.file(filePath);
        
        if (!(await file.exists())) {
          throw new Error(`Mock file not found for URL: ${url}. Expected at: ${filePath}. Run 'bun run start:update-mocks' to generate mock files.`);
        }
        
        return await file.text();
      },
      catch: (error): Error => {
        return error instanceof Error
          ? error
          : new Error(String(error));
      },
    });
  }
}
