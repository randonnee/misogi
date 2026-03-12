import type { Showtime } from "../models/showtime";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { NWFilmForum } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { DateManager } from "../utils/date-manager";
import { BaseScraper, type CalendarPage, type MoviePageDetails } from "./base_scraper";

export class NWFFScraper extends BaseScraper<void> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();
  protected override readonly scraperName = "NWFF Scraper";

  getCalendarPages(): CalendarPage<void>[] {
    const dates = DateManager.getNextNDays(4, 7)
    const pages: CalendarPage<void>[] = dates.map((date) => ({
      url: `https://nwfilmforum.org/calendar/?start=${date}&type=film`,
      context: undefined
    }))
    return pages;
  }

  getEventSelector(): string {
    return `div[itemtype="http://schema.org/ScreeningEvent"]`;
  }

  /**
   * Parses ISO 8601 duration (e.g., "PT119M", "PT95M") to minutes.
   * Returns undefined for malformed values like "PT<120M".
   */
  private parseDuration(duration: string): number | undefined {
    const match = duration.match(/^PT(\d+)M$/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }

  parseEvent(_$: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first();
    const url = link.attr("href");
    const title = event.find('[itemprop="name"]').attr("content")?.trim();
    const time = event.find('[itemprop="startDate"]').attr("content")?.trim();
    if (!time || !title) {
      return null;
    }

    // Extract runtime from the calendar page's duration meta tag
    const durationStr = event.find('meta[itemprop="duration"]').attr("content")?.trim();
    const runtime = durationStr ? this.parseDuration(durationStr) : undefined;

    return {
      movie: {
        title: title,
        url: url,
        runtime: runtime,
      },
      datetime: new Date(time),
      theater: NWFilmForum
    };
  }

  /**
   * Extracts movie details from an NWFF detail page.
   * Uses schema.org microdata: itemprop="director", "copyrightYear", "duration".
   * Also extracts og:image for poster.
   */
  protected override extractMovieDetails(html: string): MoviePageDetails {
    const $ = cheerio.load(html);
    const details: MoviePageDetails = {};

    // Image: og:image meta tag
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      details.imageUrl = ogImage;
    }

    // Director: schema.org meta tag (direct child of Movie scope to avoid ScreeningEvent dupes)
    const directorStr = $('div[itemtype="http://schema.org/Movie"] > meta[itemprop="director"]').attr("content")?.trim();
    if (directorStr) {
      // Split on " & " or ", " for multiple directors (e.g. "Jon Moritsugu & Amy Davis")
      const directors = directorStr.split(/\s*[&,]\s*/).map(d => d.trim()).filter(d => d.length > 0);
      if (directors.length > 0) {
        details.directors = directors;
      }
    }

    // Year: schema.org copyrightYear
    const yearStr = $('div[itemtype="http://schema.org/Movie"] > meta[itemprop="copyrightYear"]').attr("content")?.trim();
    if (yearStr) {
      const year = parseInt(yearStr, 10);
      if (!isNaN(year)) {
        details.releaseYear = year;
      }
    }

    // Runtime: schema.org duration (direct child to avoid ScreeningEvent dupes)
    const durationStr = $('div[itemtype="http://schema.org/Movie"] > meta[itemprop="duration"]').attr("content")?.trim();
    if (durationStr) {
      const match = durationStr.match(/^PT(\d+)M$/);
      if (match?.[1]) {
        details.runtime = parseInt(match[1], 10);
      }
    }

    // Description: og:description
    const description = $('meta[property="og:description"]').attr("content")?.trim();
    if (description) {
      details.description = description;
    }

    return details;
  }
}
