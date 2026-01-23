import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import type { ScrapeClient } from "../network/scrape-client";

/**
 * Represents a calendar page to scrape, with optional context data
 * that will be passed to the parseEvent method.
 */
export interface CalendarPage<TContext> {
  url: string;
  context: TContext;
}

/**
 * Abstract base class for theater scrapers.
 * Provides shared infrastructure for:
 * - Fetching calendar pages
 * - Parsing events into showtimes
 * - Fetching movie pages for images (with deduplication)
 * - Updating showtimes with image URLs
 *
 * Subclasses must implement:
 * - scrapeClient: The HTTP client for scraping
 * - getCalendarPages(): Returns URLs to scrape with optional context
 * - getEventSelector(): CSS selector for event elements
 * - parseEvent(): Parses a single event element into Showtime(s)
 *
 * Subclasses may override:
 * - extractImageUrl(): Custom image extraction logic
 * - filterShowtimes(): Post-processing filter for showtimes
 */
export abstract class BaseScraper<TContext = void> implements TheaterScraper {
  protected abstract readonly scrapeClient: ScrapeClient;
  protected readonly scraperName: string = "BaseScraper";
  private fetchedMovieUrls = new Set<string>();

  // === ABSTRACT METHODS (must be implemented by subclasses) ===

  /**
   * Returns an array of calendar pages to scrape.
   * Each page has a URL and optional context data that will be
   * passed to parseEvent for that page's events.
   */
  abstract getCalendarPages(): CalendarPage<TContext>[];

  /**
   * Returns the selector used to find event elements on calendar pages.
   */
  abstract getEventSelector(): string;

  /**
   * Parses a single event element into one or more Showtime objects.
   * @param $ - Cheerio API for the page
   * @param event - The event element to parse
   * @param context - Context data from getCalendarPages (e.g., date)
   * @returns Showtime, array of Showtimes, or null if invalid
   */
  abstract parseEvent(
    $: cheerio.CheerioAPI,
    event: cheerio.Cheerio<Element>,
    context: TContext
  ): Showtime | Showtime[] | null;

  // === OVERRIDABLE METHODS (with sensible defaults) ===

  /**
   * Extracts the movie image URL from a movie page HTML.
   * Default implementation checks og:image and twitter:image meta tags.
   * Override this method to add theater-specific image extraction logic.
   */
  protected extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // Try og:image meta tag first
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return ogImage;
    }

    return null;
  }

  /**
   * Filters showtimes after parsing.
   * Default implementation returns all showtimes unchanged.
   * Override to filter out unwanted showtimes (e.g., private events).
   */
  protected filterShowtimes(showtimes: Showtime[]): Showtime[] {
    return showtimes;
  }

  // === SHARED IMPLEMENTATION (not intended for override) ===

  /**
   * Fetches a movie page if it hasn't been fetched before.
   * Returns the image URL extracted from the page, or null if already fetched or no image found.
   */
  private fetchMoviePage(url: string): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> {
    if (this.fetchedMovieUrls.has(url)) {
      console.log(`[${this.scraperName}] Skipping already fetched movie page: ${url}`);
      return Effect.succeed({ movieUrl: url, imageUrl: null });
    }

    this.fetchedMovieUrls.add(url);
    console.log(`[${this.scraperName}] Fetching movie page: ${url}`);

    return pipe(
      this.scrapeClient.get(url),
      Effect.flatMap((html): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> => {
        const imageUrl = this.extractImageUrl(html);
        if (imageUrl) {
          return pipe(
            this.scrapeClient.getImage(imageUrl),
            Effect.map(() => ({ movieUrl: url, imageUrl: imageUrl as string | null }))
          );
        }
        return Effect.succeed({ movieUrl: url, imageUrl: null });
      }),
      Effect.tapError((error) => Effect.sync(() => console.error(`[${this.scraperName}] Error fetching movie page ${url}:`, error)))
    );
  }

  /**
   * Fetches all unique movie pages from the showtimes and updates showtimes with image URLs.
   * Each URL is only fetched once.
   */
  private fetchAllMoviePagesAndUpdateShowtimes(showtimes: Showtime[]): Effect.Effect<Showtime[], Error> {
    const uniqueUrls = [...new Set(
      showtimes
        .map(s => s.movie.url)
        .filter((url): url is string => url !== undefined)
    )];

    console.log(`[${this.scraperName}] Fetching ${uniqueUrls.length} unique movie pages from ${showtimes.length} showtimes`);

    const fetchEffects = uniqueUrls.map(url =>
      this.fetchMoviePage(url)
    );

    return pipe(
      Effect.all(fetchEffects, { concurrency: 1 }),
      Effect.map((results) => {
        // Build a map of movie URL -> image URL
        const imageUrlMap = new Map<string, string>();
        results.forEach(({ movieUrl, imageUrl }) => {
          if (imageUrl) {
            imageUrlMap.set(movieUrl, imageUrl);
          }
        });


        // Update showtimes with image URLs
        return showtimes.map(showtime => {
          const movieUrl = showtime.movie.url;
          if (movieUrl && imageUrlMap.has(movieUrl)) {
            return {
              ...showtime,
              movie: {
                ...showtime.movie,
                imageUrl: imageUrlMap.get(movieUrl)
              }
            };
          }
          return showtime;
        });
      })
    );
  }

  /**
   * Main entry point - fetches all calendar pages, parses events,
   * fetches movie images, and returns complete showtimes.
   */
  getShowtimes(): Effect.Effect<Showtime[], Error> {
    const pages = this.getCalendarPages();
    console.log(`[${this.scraperName}] Starting getShowtimes with ${pages.length} calendar pages`);

    return Effect.forEach(pages, ({ url, context }) =>
      pipe(
        Effect.sync(() => console.log(`[${this.scraperName}] Fetching calendar page: ${url}`)),
        Effect.andThen(() => this.scrapeClient.get(url)),
        Effect.andThen((html) => cheerio.load(html)),
        Effect.andThen(($) => {
          const events = $(this.getEventSelector());
          return { $, events };
        }),
        Effect.map(({ $, events }) =>
          events.map((_, event) => this.parseEvent($, $(event as Element), context)).get()
        ),
        Effect.tapError((error) => Effect.sync(() => console.error(`[${this.scraperName}] Error fetching calendar page ${url}:`, error)))
      )
    ).pipe(
      // Flatten arrays - parseEvent can return Showtime, Showtime[], or null
      Effect.map((arraysOfResults) => arraysOfResults.flat()),
      Effect.map((results) => results.flat() as (Showtime | null)[]),
      Effect.map((showtimes) => showtimes.filter((s): s is Showtime => s !== null)),
      Effect.map((showtimes) => this.filterShowtimes(showtimes)),
      Effect.flatMap((showtimes) => this.fetchAllMoviePagesAndUpdateShowtimes(showtimes)),
      Effect.tap((showtimes) => Effect.sync(() => console.log(`[${this.scraperName}] Completed getShowtimes with ${showtimes.length} final showtimes`))),
    );
  }
}
