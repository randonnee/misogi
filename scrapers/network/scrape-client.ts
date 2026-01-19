import { Effect } from "effect";
import { getMockFilePath, MOCK_HTML_DIR } from "../mocks/mock-utils";
import { MockScrapeClient } from "../mocks/mock-scrape-client";

export interface ScrapeClient {
  get(url: string): Effect.Effect<string, Error>;
}

export type RunMode = "mock" | "prod" | "update_mocks";

export const RUN_MODE: RunMode = (process.env.RUN_MODE as RunMode) || "mock";

/**
 * Returns the appropriate ScrapeClient based on RUN_MODE.
 * - "mock": Uses MockScrapeClient (reads from mocks/html folder)
 * - "prod": Uses ScrapeClientImpl (real HTTP requests)
 * - "update_mocks": Uses ScrapeClientImpl and saves responses to mocks/html folder
 */
export function getScrapeClient(): ScrapeClient {
  if (RUN_MODE === "mock") {
    console.log("Using MockScrapeClient (RUN_MODE=mock)");
    return new MockScrapeClient();
  } else {
    console.log(`Using ScrapeClientImpl (RUN_MODE=${RUN_MODE})`);
    return new ScrapeClientImpl();
  }
}

export class ScrapeClientImpl implements ScrapeClient {
  private static readonly DEFAULT_DELAY_MS = 1000;
  private static readonly USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  private lastRequestTime = 0;
  private readonly delayMs: number;

  constructor(delayMs: number = ScrapeClientImpl.DEFAULT_DELAY_MS) {
    this.delayMs = delayMs;
    if (RUN_MODE === "update_mocks") {
      console.log("update_mocks mode enabled - will save HTML responses to mocks/html folder");
    }
  }

  private async enforceDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.delayMs) {
      const delayNeeded = this.delayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    this.lastRequestTime = Date.now();
  }

  private async saveMock(url: string, html: string): Promise<void> {
    const filePath = getMockFilePath(url);

    await Bun.write(filePath, html);
    console.log(`Saved mock for ${url} to ${filePath}`);
  }

  get(url: string): Effect.Effect<string, Error> {
    return Effect.tryPromise({
      try: async () => {
        await this.enforceDelay();

        const response = await fetch(url, {
          headers: {
            "User-Agent": ScrapeClientImpl.USER_AGENT,
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        if (RUN_MODE === "update_mocks") {
          await this.saveMock(url, html);
        }

        return html;
      },
      catch: (error): Error => {
        return error instanceof Error
          ? error
          : new Error(String(error));
      },
    });
  }
}
