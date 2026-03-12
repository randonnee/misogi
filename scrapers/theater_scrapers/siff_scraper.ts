import type { Showtime } from "../models/showtime";
import type { Movie } from "../models/movie";
import type { Theater } from "../models/theater";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { SiffCenter, SiffDowntown, SiffUptown } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { DateManager } from "../utils/date-manager";
import { BaseScraper, type CalendarPage, type MoviePageDetails } from "./base_scraper";

export class SiffScraper extends BaseScraper<string> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();
  protected override readonly scraperName = "SIFF Scraper";

  getCalendarPages(): CalendarPage<string>[] {
    return DateManager.getNextNDays(21).map(date => ({
      url: `https://www.siff.net/calendar?view=list&date=${date}`,
      context: date
    }));
  }

  getEventSelector(): string {
    return "div.item";
  }

  /**
   * Parses the p.meta text from a SIFF calendar item.
   * Format: [Country | ] Year | Runtime [| Director]
   * Examples:
   *   "Spain | 2025 | 115 min. | Óliver Laxe"
   *   "2025 | 158 min."
   *   "USA | 1980 | 129 min. | Martin Scorsese"
   */
  private parseMetaLine(metaText: string): Partial<Pick<Movie, "directors" | "runtime" | "releaseYear">> {
    const result: Partial<Pick<Movie, "directors" | "runtime" | "releaseYear">> = {};
    const parts = metaText.split("|").map(p => p.trim()).filter(p => p.length > 0);

    for (const part of parts) {
      // Runtime: matches "115 min." or "158 min."
      const runtimeMatch = part.match(/^(\d+)\s*min\.?$/);
      if (runtimeMatch?.[1]) {
        result.runtime = parseInt(runtimeMatch[1], 10);
        continue;
      }

      // Year: a standalone 4-digit number
      const yearMatch = part.match(/^\d{4}$/);
      if (yearMatch) {
        result.releaseYear = parseInt(yearMatch[0], 10);
        continue;
      }
    }

    // Director is the last segment if it's not a year, runtime, or country
    // Country is the first segment when there are 4 parts
    // So director is always last if it doesn't match year/runtime patterns
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      if (lastPart && !lastPart.match(/^\d{4}$/) && !lastPart.match(/^\d+\s*min\.?$/)) {
        // Split on comma for multiple directors (e.g., "Béla Tarr, Ágnes Hranitzky")
        result.directors = lastPart.split(",").map(d => d.trim()).filter(d => d.length > 0);
      }
    }

    return result;
  }

  protected override extractMovieDetails(html: string): MoviePageDetails {
    const $ = cheerio.load(html);
    const details: MoviePageDetails = {};

    // Extract poster from og:image
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      details.imageUrl = ogImage;
    }

    // Extract description from the first body-copy paragraph with text
    const bodyParagraphs = $("div.body-copy > p");
    for (let i = 0; i < bodyParagraphs.length; i++) {
      const p = bodyParagraphs.eq(i);
      // Skip paragraphs that only contain images
      if (p.find("img").length > 0 && p.text().trim().length === 0) continue;
      const text = p.text().trim();
      if (text.length > 0) {
        details.description = text;
        break;
      }
    }

    return details;
  }

  parseEvent($: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>, date: string): Showtime[] | null {
    const link = event.find("h3 > a").first();
    const url = "https://siff.net" + link.attr("href");
    const title = link.text().trim();
    const times = event.find("div.times");
    const theaterEl = times.find("h3 > a").first().attr("href");
    let theater: Theater | null = null;
    switch (theaterEl) {
      case "/cinema/cinema-venues/siff-cinema-uptown":
        theater = SiffUptown;
        break;
      case "/cinema/cinema-venues/siff-film-center":
        theater = SiffCenter;
        break;
      case "/cinema/cinema-venues/siff-cinema-downtown":
        theater = SiffDowntown;
        break;
    }

    if (!theater) {
      console.log("couldn't find theater: ", theaterEl);
      return null;
    }

    // Parse metadata from the p.meta element
    const metaText = event.find("p.meta").text().trim();
    const meta = this.parseMetaLine(metaText);

    const actual_times = times.find("div.button-group > a").map((_, el) => $(el).text()).get();
    return actual_times.map((time) => {
      const dateTime = DateManager.parseDateTime(date, time);
      return {
        movie: {
          title: title,
          url: url,
          ...meta,
        },
        datetime: dateTime,
        theater: theater!
      };
    });
  }
}
