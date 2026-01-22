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
    const pages = [{ url: "https://thebeacon.film/calendar", context: undefined }];
    console.log(`[${this.scraperName}] Calendar pages to fetch:`, pages.map(p => p.url));
    return pages;
  }

  getEventSelector(): string {
    return "section.showtime[itemscope]";
  }

  parseEvent(_$: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first();
    const url = link.attr("href");
    const title = link.find('[itemprop="name"]').text().trim();
    const time = link.find('[itemprop="startDate"]').attr("content")?.trim();
    
    console.log(`[${this.scraperName}] Parsing event: title="${title}", url="${url}", time="${time}"`);
    
    if (!time) {
      console.log(`[${this.scraperName}] Skipping event - no time found for "${title}"`);
      return null;
    }
    
    const datetime = new Date(time);
    console.log(`[${this.scraperName}] Parsed datetime: ${datetime.toISOString()} for "${title}"`);
    
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
      console.log(`[${this.scraperName}] Found main_image: ${mainImage}`);
      return mainImage;
    }

    // Fallback to default implementation 
    const fallbackUrl = super.extractImageUrl(html);
    console.log(`[${this.scraperName}] Using fallback image URL: ${fallbackUrl}`);
    return fallbackUrl;
  }

  protected override filterShowtimes(showtimes: Showtime[]): Showtime[] {
    const filtered = showtimes.filter((showtime) => showtime.movie.title !== "RENT THE BEACON");
    console.log(`[${this.scraperName}] Filtered showtimes: ${showtimes.length} -> ${filtered.length} (removed ${showtimes.length - filtered.length} "RENT THE BEACON" entries)`);
    return filtered;
  }
}
