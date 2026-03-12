import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import type { ScrapeClient } from "../network/scrape-client";
import { filterShowtimesForNextDays } from "../../generator/showtime_utils";
import { NOW_PLAYING_DAYS } from "../../config";

/**
 * Represents a calendar page to scrape, with optional context data
 * that will be passed to the parseEvent method.
 */
export interface CalendarPage<TContext> {
  url: string;
  context: TContext;
}

/**
 * Metadata extracted from a movie's detail page.
 * Returned by extractMovieDetails() and merged into Showtime.movie.
 */
export interface MoviePageDetails {
  imageUrl?: string;
  directors?: string[];
  actors?: string[];
  runtime?: number;
  description?: string;
  releaseYear?: number;
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
 * - extractMovieDetails(): Custom metadata extraction from detail pages
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
   * Extracts movie details (image URL, director, runtime, year, etc.) from a movie detail page.
   * Default implementation only extracts og:image.
   * Override this method to add theater-specific metadata extraction logic.
   */
  protected extractMovieDetails(html: string): MoviePageDetails {
    const $ = cheerio.load(html);

    // Try og:image meta tag first
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return { imageUrl: ogImage };
    }

    return {};
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
   * Returns the movie details extracted from the page, or empty details if already fetched.
   */
  private fetchMoviePage(url: string): Effect.Effect<{ movieUrl: string; details: MoviePageDetails }, Error> {
    if (this.fetchedMovieUrls.has(url)) {
      console.log(`[${this.scraperName}] Skipping already fetched movie page: ${url}`);
      return Effect.succeed({ movieUrl: url, details: {} });
    }

    this.fetchedMovieUrls.add(url);
    console.log(`[${this.scraperName}] Fetching movie page: ${url}`);

    return pipe(
      this.scrapeClient.get(url),
      Effect.flatMap((html): Effect.Effect<{ movieUrl: string; details: MoviePageDetails }, Error> => {
        const details = this.extractMovieDetails(html);
        if (details.imageUrl) {
          return pipe(
            this.scrapeClient.getImage(details.imageUrl),
            Effect.map(() => ({ movieUrl: url, details }))
          );
        }
        return Effect.succeed({ movieUrl: url, details });
      }),
      Effect.tapError((error) => Effect.sync(() => console.error(`[${this.scraperName}] Error fetching movie page ${url}:`, error)))
    );
  }

  /**
   * Fetches movie pages for showtimes in the now-playing window and updates all showtimes with movie details.
   * Only fetches details for movies showing in the next NOW_PLAYING_DAYS days.
   * Each URL is only fetched once.
   */
  private fetchAllMoviePagesAndUpdateShowtimes(showtimes: Showtime[]): Effect.Effect<Showtime[], Error> {
    // Only fetch details for movies in the now-playing window
    const nowPlayingShowtimes = filterShowtimesForNextDays(showtimes, NOW_PLAYING_DAYS);
    const uniqueUrls = [...new Set(
      nowPlayingShowtimes
        .map(s => s.movie.url)
        .filter((url): url is string => url !== undefined)
    )];

    console.log(`[${this.scraperName}] Fetching ${uniqueUrls.length} unique movie pages for now-playing (${nowPlayingShowtimes.length}/${showtimes.length} showtimes)`);

    const fetchEffects = uniqueUrls.map(url =>
      this.fetchMoviePage(url)
    );

    return pipe(
      Effect.all(fetchEffects, { concurrency: 1 }),
      Effect.map((results) => {
        // Build a map of movie URL -> movie details
        const detailsMap = new Map<string, MoviePageDetails>();
        results.forEach(({ movieUrl, details }) => {
          if (Object.keys(details).length > 0) {
            detailsMap.set(movieUrl, details);
          }
        });

        // Update showtimes with details from movie pages
        // Only overwrite fields that are not already set on the showtime
        return showtimes.map(showtime => {
          const movieUrl = showtime.movie.url;
          if (movieUrl && detailsMap.has(movieUrl)) {
            const details = detailsMap.get(movieUrl)!;
            return {
              ...showtime,
              movie: {
                ...showtime.movie,
                imageUrl: showtime.movie.imageUrl ?? details.imageUrl,
                directors: showtime.movie.directors ?? details.directors,
                actors: showtime.movie.actors ?? details.actors,
                runtime: showtime.movie.runtime ?? details.runtime,
                description: showtime.movie.description ?? details.description,
                releaseYear: showtime.movie.releaseYear ?? details.releaseYear,
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
