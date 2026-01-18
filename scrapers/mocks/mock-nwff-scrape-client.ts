import { Effect } from "effect";
import type { ScrapeClient } from "../network/scrape-client";

const mockFiles = [
  "scrapers/mocks/nwff1.html",
  "scrapers/mocks/nwff2.html",
  "scrapers/mocks/nwff3.html",
  "scrapers/mocks/nwff4.html",
];

const mockContents: string[] = await Promise.all(
  mockFiles.map(async (path) => {
    const content = await Bun.file(path).text();
    return content || "";
  })
);

export class MockNWFFClient implements ScrapeClient {
  private callCount = 0;

  get(_: string): Effect.Effect<string, Error> {
    const content = mockContents[this.callCount % mockContents.length];
    this.callCount++;
    return Effect.succeed(content || "");
  }
}
