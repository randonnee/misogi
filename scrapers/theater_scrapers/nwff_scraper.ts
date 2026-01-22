import type { Showtime } from "../models/showtime";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { NWFilmForum } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { DateManager } from "../utils/date-manager";
import { BaseScraper, type CalendarPage } from "./base_scraper";

export class NWFFScraper extends BaseScraper<void> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();

  getCalendarPages(): CalendarPage<void>[] {
    const now = DateManager.getNow();

    const pages: CalendarPage<void>[] = [];
    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i * 7);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      pages.push({
        url: `https://nwfilmforum.org/calendar/?start=${dateString}&type=film`,
        context: undefined
      });
    }

    return pages;
  }

  getEventSelector(): string {
    return `div[itemtype="http://schema.org/ScreeningEvent"]`;
  }

  parseEvent(_$: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first();
    const url = link.attr("href");
    const title = event.find('[itemprop="name"]').attr("content")?.trim();
    const time = event.find('[itemprop="startDate"]').attr("content")?.trim();
    if (!time || !title) {
      return null;
    }

    return {
      movie: {
        title: title,
        url: url,
      },
      datetime: new Date(time),
      theater: NWFilmForum
    };
  }

  /**
   * Extracts the movie image URL from a movie page HTML.
   * Uses default implementation (og:image, twitter:image).
   */
  protected override extractImageUrl(html: string): string | null {
    // NWFF uses standard meta tags, so default implementation works
    return super.extractImageUrl(html);
  }
}
