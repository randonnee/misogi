import type { Showtime } from "../models/showtime";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { TheBeacon } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { BaseScraper, type CalendarPage, type MoviePageDetails } from "./base_scraper";

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
   * Extracts movie details from a Beacon detail page.
   * Looks for image (img.main_image), director (<h4>Director</h4>),
   * runtime (<h4>Runtime</h4>), year (<h3> after <h1>), and actors (<h4>Starring</h4>).
   */
  protected override extractMovieDetails(html: string): MoviePageDetails {
    const $ = cheerio.load(html);
    const details: MoviePageDetails = {};

    // Image: img.main_image
    const mainImage = $("img.main_image").attr("src");
    if (mainImage) {
      details.imageUrl = mainImage;
    }

    // Year: <h3> element containing a 4-digit year (appears after the <h1> title)
    const h3Text = $("h1").first().next("h3").text().trim();
    const yearMatch = h3Text.match(/^\d{4}$/);
    if (yearMatch) {
      details.releaseYear = parseInt(yearMatch[0], 10);
    }

    // Director: find <h4> with text "Director", then get sibling <p> elements
    $("h4").each((_, el) => {
      if ($(el).text().trim() === "Director") {
        const directorPs = $(el).parent().find("p");
        const directors = directorPs
          .map((_, p) => $(p).text().trim())
          .get()
          .filter(d => d.length > 0);
        if (directors.length > 0) {
          details.directors = directors;
        }
      }
    });

    // Runtime: find <h4> with text "Runtime", then get next <p> and parse "N minutes"
    $("h4").each((_, el) => {
      if ($(el).text().trim() === "Runtime") {
        const runtimeText = $(el).next("p").text().trim();
        const runtimeMatch = runtimeText.match(/(\d+)\s*minutes/);
        if (runtimeMatch?.[1]) {
          details.runtime = parseInt(runtimeMatch[1], 10);
        }
      }
    });

    // Actors: find <h4> with text "Starring", then get sibling <p> elements
    $("h4").each((_, el) => {
      if ($(el).text().trim() === "Starring") {
        const actorPs = $(el).parent().find("p");
        const actors = actorPs
          .map((_, p) => $(p).text().trim())
          .get()
          .filter(a => a.length > 0);
        if (actors.length > 0) {
          details.actors = actors;
        }
      }
    });

    // Description
    const description = $(".entry_description").text().trim();
    if (description) {
      details.description = description;
    }

    return details;
  }

  protected override filterShowtimes(showtimes: Showtime[]): Showtime[] {
    const filtered = showtimes.filter((showtime) => showtime.movie.title !== "RENT THE BEACON");
    return filtered;
  }
}
