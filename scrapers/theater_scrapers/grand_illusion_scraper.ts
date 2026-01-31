import type { Showtime } from "../models/showtime";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { GrandIllusion } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { BaseScraper, type CalendarPage } from "./base_scraper";

export class GrandIllusionScraper extends BaseScraper<void> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();
  protected override readonly scraperName = "GrandIllusionScraper";

  getCalendarPages(): CalendarPage<void>[] {
    return [{ url: "https://grandillusioncinema.org", context: undefined }];
  }

  getEventSelector(): string {
    return ".film-card";
  }

  parseEvent(_$: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime[] | null {
    const titleLink = event.find(".film-card--title a.film-title").first();
    const title = titleLink.text().trim();
    const url = titleLink.attr("href");

    if (!title) {
      console.log(`[${this.scraperName}] Skipping event - no title found`);
      return null;
    }

    // Parse film info (director, year, runtime, format)
    const filmInfoDivs = event.find(".film-card--film-info div");
    let directors: string[] | undefined;
    let releaseYear: number | undefined;
    let runtime: number | undefined;

    filmInfoDivs.each((_, infoDiv) => {
      const text = _$(infoDiv).text().trim();

      // First div typically has "Director · Year" format
      if (text.includes("·") && !text.includes("min")) {
        const parts = text.split("·").map(p => p.trim());
        if (parts[0]) {
          directors = [parts[0]];
        }
        if (parts[1]) {
          const yearMatch = parts[1].match(/^\d{4}$/);
          if (yearMatch) {
            releaseYear = parseInt(yearMatch[0], 10);
          }
        }
      }

      // Second div typically has "Runtime · Format" (e.g., "127min · DCP")
      if (text.includes("min")) {
        const runtimeMatch = text.match(/(\d+)min/);
        if (runtimeMatch?.[1]) {
          runtime = parseInt(runtimeMatch[1], 10);
        }
      }
    });

    // Parse description
    const description = event.find(".film-card--description").text().trim() || undefined;

    // Parse poster image URL
    const posterImg = event.find(".film-card--poster img").first();
    const imageUrl = posterImg.attr("src") || undefined;

    // Parse all screening times
    const screeningElements = event.find(".screenings-list li.screening");
    const showtimes: Showtime[] = [];

    screeningElements.each((_, screeningEl) => {
      const screeningText = _$(screeningEl).text().trim();
      const datetime = this.parseScreeningDate(screeningText);

      if (datetime) {
        showtimes.push({
          movie: {
            title,
            url,
            imageUrl,
            directors,
            releaseYear,
            runtime,
            description,
          },
          datetime,
          theater: GrandIllusion,
        });
      } else {
        console.log(`[${this.scraperName}] Could not parse date from "${screeningText}" for "${title}"`);
      }
    });

    if (showtimes.length === 0) {
      console.log(`[${this.scraperName}] No valid showtimes found for "${title}"`);
      return null;
    }

    return showtimes;
  }

  /**
   * Parses a screening date string like "Friday, Jan 30, 2026, 7:00pm"
   */
  private parseScreeningDate(dateStr: string): Date | null {
    // Format: "Friday, Jan 30, 2026, 7:00pm"
    // Remove the day of week and parse the rest
    const match = dateStr.match(/\w+,\s+(\w+)\s+(\d+),\s+(\d{4}),\s+(\d+):(\d+)(am|pm)/i);
    if (!match) {
      return null;
    }

    const monthStr = match[1];
    const dayStr = match[2];
    const yearStr = match[3];
    const hourStr = match[4];
    const minuteStr = match[5];
    const ampm = match[6];

    if (!monthStr || !dayStr || !yearStr || !hourStr || !minuteStr || !ampm) {
      return null;
    }

    const monthMap: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    const month = monthMap[monthStr.toLowerCase()];
    if (month === undefined) {
      return null;
    }

    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    // Convert to 24-hour format
    if (ampm.toLowerCase() === 'pm' && hour !== 12) {
      hour += 12;
    } else if (ampm.toLowerCase() === 'am' && hour === 12) {
      hour = 0;
    }

    return new Date(year, month, day, hour, minute);
  }

  /**
   * Extracts the movie image URL from a movie page HTML.
   * The Grand Illusion uses wp-post-image class for posters.
   */
  protected override extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // Try the WordPress post image
    const postImage = $("img.wp-post-image").attr("src");
    if (postImage) {
      return postImage;
    }

    // Fall back to og:image
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return ogImage;
    }

    return null;
  }
}
