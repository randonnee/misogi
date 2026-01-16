import { Effect } from "effect";
import type { ScrapeClient } from "../network/scrape-client";

const mockFiles = [
  "scrapers/mocks/siff1.html",
  "scrapers/mocks/siff2.html",
  "scrapers/mocks/siff3.html",
  "scrapers/mocks/siff4.html",
  "scrapers/mocks/siff5.html",
  "scrapers/mocks/siff6.html",
  "scrapers/mocks/siff7.html",
  "scrapers/mocks/siff8.html",
  "scrapers/mocks/siff9.html",
];

const mockContents: string[] = await Promise.all(
  mockFiles.map(async (path) => {
    const content = await Bun.file(path).text();
    return content || "";
  })
);

export class MockSiffScrapeClient implements ScrapeClient {
  private callCount = 0;

  get(_: string): Effect.Effect<string, Error> {
    const content = mockContents[this.callCount % mockContents.length];
    this.callCount++;
    return Effect.succeed(content || "");
  }
}
