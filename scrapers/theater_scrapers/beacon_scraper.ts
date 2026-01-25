import type { Showtime } from "../models/showtime";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { TheBeacon } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { BaseScraper, type CalendarPage } from "./base_scraper";

export class BeaconScraper extends BaseScraper<void> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();
  protected override readonly scraperName = "BeaconScraper";

  getCalendarPages(): CalendarPage<void>[] {
    return [{ url: "https://thebeacon.film/calendar", context: undefined }];
  }

  getEventSelector(): string {
    return "section.showtime[itemscope]";
  }

  parseEvent(_$: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first();
    const url = link.attr("href");
    const title = link.find('[itemprop="name"]').text().trim();
    const time = link.find('[itemprop="startDate"]').attr("content")?.trim();

    if (!time) {
      console.log(`[${this.scraperName}] Skipping event - no time found for "${title}"`);
      return null;
    }

    const datetime = new Date(time);

    return {
      movie: {
        title: title,
        url: url,
      },
      datetime: datetime,
      theater: TheBeacon
    };
  }

  /**
   * Extracts the movie image URL from a movie page HTML.
   * Looks for the main_image img element or og:image meta tag.
   */
  protected override extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // First try the main_image class
    const mainImage = $("img.main_image").attr("src");
    if (mainImage) {
      return mainImage;
    }

    return null
  }

  protected override filterShowtimes(showtimes: Showtime[]): Showtime[] {
    const filtered = showtimes.filter((showtime) => showtime.movie.title !== "RENT THE BEACON");
    return filtered;
  }
}
