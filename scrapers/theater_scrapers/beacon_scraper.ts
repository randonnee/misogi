import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio'
import type { Element } from "domhandler";
import { TheBeacon } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";

export class BeaconScraper implements TheaterScraper {
  private static readonly scrapeClient: ScrapeClient = getScrapeClient();
  private fetchedMovieUrls = new Set<string>();

  getCalendar(): Effect.Effect<string, Error> {
    const calendarUrl = "https://thebeacon.film/calendar";

    return BeaconScraper.scrapeClient.get(calendarUrl);
  }

  /**
   * Extracts the movie image URL from a movie page HTML.
   * Looks for the main_image img element or og:image meta tag.
   */
  private extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // First try the main_image class
    const mainImage = $("img.main_image").attr("src");
    if (mainImage) {
      return mainImage;
    }

    // Fallback to og:image meta tag
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return ogImage;
    }

    return null;
  }

  /**
   * Fetches a movie page if it hasn't been fetched before.
   * Returns the image URL extracted from the page, or null if already fetched or no image found.
   * Also downloads and saves the movie image if found.
   */
  private fetchMoviePage(url: string): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> {
    if (this.fetchedMovieUrls.has(url)) {
      return Effect.succeed({ movieUrl: url, imageUrl: null });
    }

    this.fetchedMovieUrls.add(url);

    return pipe(
      BeaconScraper.scrapeClient.get(url),
      Effect.flatMap((html): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> => {
        const imageUrl = this.extractImageUrl(html);
        if (imageUrl) {
          return pipe(
            BeaconScraper.scrapeClient.getImage(imageUrl),
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
      pipe(
        this.fetchMoviePage(url),
        Effect.tap((result) => {
          if (result.imageUrl !== null) {
          }
        })
      )
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

  eventElementToShowtime(event: cheerio.Cheerio<Element>): Showtime | null {
    const link = event.find("a").first()
    const url = link.attr("href")
    const title = link.find('[itemprop="name"]').text().trim();
    const time = link.find('[itemprop="startDate"]').attr("content")?.trim();
    if (!time) {
      return null
    }
    return {
      movie: {
        title: title,
        url: url,
      },
      datetime: new Date(time),
      theater: TheBeacon
    }
  }

  filterShowtimes(showtimes: Showtime[]): Showtime[] {
    return showtimes.filter((showtime) => showtime.movie.title != "RENT THE BEACON")
  }



  getShowtimes(): Effect.Effect<Showtime[], Error> {
    return pipe(
      this.getCalendar(),
      // Effect.tap((calendar) => console.log(`got cal size: ${calendar.length}`)),
      Effect.andThen((calendar) => cheerio.load(calendar)),
      Effect.andThen(($) => ({ $, events: $("section.showtime[itemscope]") })),
      Effect.map(({ $, events }) => events.map((_, event) => this.eventElementToShowtime($(event))).get()),
      // Effect.tap((showtimes) => console.log(showtimes)),
      Effect.map(this.filterShowtimes),
      Effect.flatMap((showtimes) => this.fetchAllMoviePagesAndUpdateShowtimes(showtimes)),
    )
  }
}
