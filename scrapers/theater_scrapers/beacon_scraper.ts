import type { Showtime } from "../models/showtime";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { TheBeacon } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { BaseScraper, type CalendarPage } from "./base_scraper";

export class BeaconScraper extends BaseScraper<void> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();

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
      return null;
    }
    return {
      movie: {
        title: title,
        url: url,
      },
      datetime: new Date(time),
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

    // Fallback to default implementation 
    return super.extractImageUrl(html);
  }

  protected override filterShowtimes(showtimes: Showtime[]): Showtime[] {
    return showtimes.filter((showtime) => showtime.movie.title !== "RENT THE BEACON");
  }
}
