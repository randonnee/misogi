
import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio'
import type { Element } from "domhandler";
import { NWFilmForum } from "../theaters/theaters";
import { ScrapeClientImpl } from "../network/scrape-client";
import { MockNWFFClient } from "../mocks/mock-nwff-scrape-client";


export class NWFFScraper implements TheaterScraper {
  private static readonly isMock = process.argv.includes('--mock');
  private static readonly scrapeClient = NWFFScraper.isMock
    ? new MockNWFFClient()
    : new ScrapeClientImpl();

  getUrls(): string[] {
    const dates: string[] = [];
    const now = new Date();

    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i * 7);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    return dates.map((date) => `https://nwfilmforum.org/calendar/?start=${date}&type=film`)
  }

  getScreeningEvents($: cheerio.CheerioAPI): ({ $: cheerio.CheerioAPI, events: cheerio.Cheerio<Element> }) {
    const events = $(`div[itemtype="http://schema.org/ScreeningEvent"]`)
    return { $, events }
  }

  eventElementToShowtime(_: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first()
    const url = link.attr("href")
    const title = event.find('[itemprop="name"]').attr("content")?.trim();
    const time = event.find('[itemprop="startDate"]').attr("content")?.trim();
    console.log({ url, title, time })
    if (!time || !title) {
      return null
    }

    return {
      movie: {
        title: title,
        url: url,
      },
      datetime: new Date(time),
      theater: NWFilmForum
    }
  }

  getShowtimes(): Effect.Effect<Showtime[], Error> {
    const urls = this.getUrls()

    return Effect.forEach(urls, (url) =>
      pipe(
        NWFFScraper.scrapeClient.get(url),
        Effect.andThen((calendar) => cheerio.load(calendar)),
        Effect.andThen(($) => this.getScreeningEvents($)),
        Effect.map(({ $, events }) => events.map((_, event) => this.eventElementToShowtime($, $(event))).get()),
      )
    ).pipe(
      Effect.map((arraysOfShowtimes) => arraysOfShowtimes.flat()),
    );
  }
}
