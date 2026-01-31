import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import type { Movie } from "../models/movie";
import * as cheerio from 'cheerio';
import { CentralCinema } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";

interface JsonLdMovie {
  "@type": string;
  name?: string;
  description?: string;
  duration?: string;
  director?: { name: string }[] | { name: string };
  actor?: { name: string }[] | { name: string };
  image?: string;
}

export class CentralCinemaScraper implements TheaterScraper {
  private readonly scrapeClient: ScrapeClient = getScrapeClient();
  private readonly scraperName = "CentralCinemaScraper";
  private readonly homeUrl = "https://www.central-cinema.com/home";

  getShowtimes(): Effect.Effect<Showtime[], Error> {
    return pipe(
      // 1. Fetch home page
      Effect.sync(() => console.log(`[${this.scraperName}] Fetching home page: ${this.homeUrl}`)),
      Effect.andThen(() => this.scrapeClient.get(this.homeUrl)),
      // 2. Extract movie URLs
      Effect.map((html) => this.extractMovieUrls(html)),
      Effect.tap((urls) => Effect.sync(() => console.log(`[${this.scraperName}] Found ${urls.length} movie URLs`))),
      // 3. Fetch each movie page sequentially and parse showtimes
      Effect.flatMap((urls) =>
        Effect.forEach(urls, (url) => this.fetchAndParseMoviePage(url), { concurrency: 1 })
      ),
      // 4. Flatten results
      Effect.map((results) => results.flat()),
      Effect.tap((showtimes) => Effect.sync(() => 
        console.log(`[${this.scraperName}] Completed with ${showtimes.length} total showtimes`)
      ))
    );
  }

  /**
   * Extracts movie URLs from the home page HTML.
   * Filters out private rental events.
   */
  private extractMovieUrls(html: string): string[] {
    const $ = cheerio.load(html);
    const urls = new Set<string>();

    $('a[href*="/movie/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('private-rental-event')) {
        // Normalize URL
        const url = href.startsWith('http') ? href : `https://www.central-cinema.com${href}`;
        urls.add(url);
      }
    });

    return [...urls];
  }

  /**
   * Fetches a movie page and parses showtimes from it.
   */
  private fetchAndParseMoviePage(url: string): Effect.Effect<Showtime[], Error> {
    return pipe(
      Effect.sync(() => console.log(`[${this.scraperName}] Fetching movie page: ${url}`)),
      Effect.andThen(() => this.scrapeClient.get(url)),
      Effect.flatMap((html) => {
        const showtimes = this.parseMoviePage(html, url);
        // Fetch and cache the image if available
        const imageUrl = this.extractImageUrl(html);
        if (imageUrl && showtimes.length > 0) {
          return pipe(
            this.scrapeClient.getImage(imageUrl),
            Effect.map(() => {
              // Update all showtimes with the image URL
              return showtimes.map(s => ({
                ...s,
                movie: { ...s.movie, imageUrl }
              }));
            }),
            Effect.catchAll(() => Effect.succeed(showtimes)) // If image fetch fails, continue without it
          );
        }
        return Effect.succeed(showtimes);
      }),
      Effect.catchAll((error) => {
        console.error(`[${this.scraperName}] Error fetching movie page ${url}:`, error);
        return Effect.succeed([] as Showtime[]);
      })
    );
  }

  /**
   * Parses a movie page to extract movie metadata and showtimes.
   */
  private parseMoviePage(html: string, url: string): Showtime[] {
    const $ = cheerio.load(html);
    
    // Parse movie metadata from JSON-LD
    const movie = this.parseJsonLdMovieData($, url);
    if (!movie.title) {
      console.log(`[${this.scraperName}] No title found for ${url}`);
      return [];
    }

    // Parse showtimes from <h2><a href="...checkout/showing..."> elements
    const showtimes: Showtime[] = [];
    
    $('h2 a[href*="/checkout/showing/"]').each((_, el) => {
      const dateText = $(el).text().trim();
      const datetime = this.parseShowtimeDate(dateText);
      
      if (datetime) {
        showtimes.push({
          movie,
          datetime,
          theater: CentralCinema
        });
      } else {
        console.log(`[${this.scraperName}] Could not parse date: "${dateText}"`);
      }
    });

    return showtimes;
  }

  /**
   * Parses JSON-LD movie data from the page.
   */
  private parseJsonLdMovieData($: cheerio.CheerioAPI, url: string): Movie {
    const movie: Movie = { title: "", url };

    // Find JSON-LD script with Movie type
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText) return;
        
        const data = JSON.parse(jsonText) as JsonLdMovie;
        if (data["@type"] !== "Movie") return;

        if (data.name) {
          movie.title = data.name;
        }
        if (data.description) {
          movie.description = data.description;
        }
        if (data.duration) {
          movie.runtime = this.parseDuration(data.duration);
        }
        if (data.director) {
          const directors = Array.isArray(data.director) ? data.director : [data.director];
          movie.directors = directors.map(d => d.name).filter(Boolean);
        }
        if (data.actor) {
          const actors = Array.isArray(data.actor) ? data.actor : [data.actor];
          movie.actors = actors.map(a => a.name).filter(Boolean);
        }
      } catch {
        // Ignore parse errors
      }
    });

    // Fallback to microdata if JSON-LD didn't have title
    if (!movie.title) {
      movie.title = $('[itemprop="name"]').first().text().trim();
    }

    return movie;
  }

  /**
   * Parses ISO 8601 duration (e.g., "PT1H41M") to minutes.
   */
  private parseDuration(duration: string): number | undefined {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return undefined;

    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    return hours * 60 + minutes;
  }

  /**
   * Parses a showtime date string like "January 30, 4:00 pm".
   * Infers the year: if date is more than 7 days in the past, assumes next year.
   */
  private parseShowtimeDate(dateStr: string): Date | null {
    // Format: "January 30, 4:00 pm" or "February 2, 4:00 pm"
    const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+):(\d+)\s*(am|pm)/i);
    if (!match) return null;

    const monthStr = match[1];
    const dayStr = match[2];
    const hourStr = match[3];
    const minuteStr = match[4];
    const ampmStr = match[5];

    if (!monthStr || !dayStr || !hourStr || !minuteStr || !ampmStr) return null;

    const day = parseInt(dayStr, 10);
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = ampmStr.toLowerCase();

    const monthMap: Record<string, number> = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    const month = monthMap[monthStr.toLowerCase()];
    if (month === undefined) return null;

    // Convert to 24-hour format
    if (ampm === 'pm' && hour !== 12) {
      hour += 12;
    } else if (ampm === 'am' && hour === 12) {
      hour = 0;
    }

    // Determine year - try current year first
    const now = new Date();
    let year = now.getFullYear();
    let date = new Date(year, month, day, hour, minute);

    // If date is more than 7 days in the past, assume next year
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (date < sevenDaysAgo) {
      year += 1;
      date = new Date(year, month, day, hour, minute);
    }

    return date;
  }

  /**
   * Extracts image URL from the page (og:image or JSON-LD).
   */
  private extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // Try og:image first
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) return ogImage;

    // Try JSON-LD
    let imageUrl: string | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText) return;
        const data = JSON.parse(jsonText) as JsonLdMovie;
        if (data["@type"] === "Movie" && data.image) {
          imageUrl = data.image;
        }
      } catch {
        // Ignore
      }
    });

    return imageUrl;
  }
}
