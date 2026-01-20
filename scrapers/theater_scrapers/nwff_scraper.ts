import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio'
import type { Element } from "domhandler";
import { NWFilmForum } from "../theaters/theaters";
import { getScrapeClient } from "../network/scrape-client";
import { DateManager } from "../utils/date-manager";


export class NWFFScraper implements TheaterScraper {
  private static readonly scrapeClient = getScrapeClient();
  private fetchedMovieUrls = new Set<string>();

  getUrls(): string[] {
    const dates: string[] = [];
    const now = DateManager.getNow()

    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i * 7);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    return dates.map((date) => `https://nwfilmforum.org/calendar/?start=${date}&type=film`)
  }

  getScreeningEvents($: cheerio.CheerioAPI): ({ $: cheerio.CheerioAPI, events: cheerio.Cheerio<Element> }) {
    const events = $(`div[itemtype="http://schema.org/ScreeningEvent"]`)
    return { $, events }
  }

  /**
   * Extracts the movie image URL from a movie page HTML.
   * Looks for the og:image meta tag or other image elements.
   */
  private extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // Try og:image meta tag first
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return ogImage;
    }

    // Fallback to twitter:image
    const twitterImage = $('meta[name="twitter:image"]').attr("content");
    if (twitterImage) {
      return twitterImage;
    }

    return null;
  }

  /**
   * Fetches a movie page if it hasn't been fetched before.
   * Returns the image URL extracted from the page, or null if already fetched or no image found.
   */
  private fetchMoviePage(url: string): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> {
    if (this.fetchedMovieUrls.has(url)) {
      return Effect.succeed({ movieUrl: url, imageUrl: null });
    }

    this.fetchedMovieUrls.add(url);

    return pipe(
      NWFFScraper.scrapeClient.get(url),
      Effect.flatMap((html): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> => {
        const imageUrl = this.extractImageUrl(html);
        if (imageUrl) {
          return pipe(
            NWFFScraper.scrapeClient.getImage(imageUrl),
            Effect.map(() => ({ movieUrl: url, imageUrl: imageUrl as string | null }))
          );
        }
        return Effect.succeed({ movieUrl: url, imageUrl: null });
      })
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

  eventElementToShowtime(_: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first()
    const url = link.attr("href")
    const title = event.find('[itemprop="name"]').attr("content")?.trim();
    const time = event.find('[itemprop="startDate"]').attr("content")?.trim();
    if (!time || !title) {
      return null
    }

    return {
      movie: {
        title: title,
        url: url,
      },
      datetime: new Date(time),
      theater: NWFilmForum
    }
  }

  getShowtimes(): Effect.Effect<Showtime[], Error> {
    const urls = this.getUrls()
    console.log(urls)

    return Effect.forEach(urls, (url) =>
      pipe(
        NWFFScraper.scrapeClient.get(url),
        Effect.andThen((calendar) => cheerio.load(calendar)),
        Effect.andThen(($) => this.getScreeningEvents($)),
        Effect.map(({ $, events }) => events.map((_, event) => this.eventElementToShowtime($, $(event))).get()),
      )
    ).pipe(
      Effect.map((arraysOfShowtimes) => arraysOfShowtimes.flat()),
      Effect.map((showtimes) => showtimes.filter((s): s is Showtime => s !== null)),
      Effect.flatMap((showtimes) => this.fetchAllMoviePagesAndUpdateShowtimes(showtimes)),
    );
  }
}
