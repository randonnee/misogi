import { Effect } from "effect";
import type { ScrapeClient } from "../network/scrape-client";

const calendar_mock_path = "scrapers/mocks/beacon.html";
const calendar_mock = await Bun.file(calendar_mock_path).text();

export class MockBeaconScrapeClient implements ScrapeClient {
  get(_: string): Effect.Effect<string, Error> {
    return Effect.succeed(calendar_mock);
  }
}
