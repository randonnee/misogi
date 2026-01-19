import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { Theater } from "../models/theater";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio'
import type { Element } from "domhandler";
import { SiffCenter, SiffDowntown, SiffUptown } from "../theaters/theaters";
import { getScrapeClient } from "../network/scrape-client";
import { DateManager } from "../utils/date-manager";

export class SiffScraper implements TheaterScraper {
  private static readonly scrapeClient = getScrapeClient();
  private fetchedMovieUrls = new Set<string>();

  getNextSevenDays(): Date[] {
    return DateManager.getNextNDays(7)
  }

  getCalendar(date: Date): Effect.Effect<string, Error> {
    const dateString = DateManager.getDateYYYYMMDD(date)
    const calendarUrl = `https://www.siff.net/calendar?view=list&date=${dateString}`;

    return SiffScraper.scrapeClient.get(calendarUrl);
  }

  /**
   * Extracts the movie image URL from a movie page HTML.
   * Looks for the og:image meta tag or the main image in the page.
   */
  private extractImageUrl(html: string): string | null {
    const $ = cheerio.load(html);

    // Try og:image meta tag first
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      return ogImage;
    }

    // Fallback to the main image in the page
    const mainImage = $("p.img-wrap.full-width img").first().attr("src");
    if (mainImage) {
      // Make sure to return absolute URL
      if (mainImage.startsWith("/")) {
        return "https://www.siff.net" + mainImage;
      }
      return mainImage;
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
      SiffScraper.scrapeClient.get(url),
      Effect.flatMap((html): Effect.Effect<{ movieUrl: string; imageUrl: string | null }, Error> => {
        const imageUrl = this.extractImageUrl(html);
        if (imageUrl) {
          return pipe(
            SiffScraper.scrapeClient.getImage(imageUrl),
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

  eventElementToShowtime($: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>, date: Date): Showtime[] | null {
    const link = event.find("h3 > a").first()
    const url = "https://siff.net" + link.attr("href")
    const title = link.text().trim();
    const times = event.find("div.times")
    const theaterEl = times.find("h3 > a").first().attr("href")
    var theater: Theater | null = null;
    switch (theaterEl) {
      case "/cinema/cinema-venues/siff-cinema-uptown":
        theater = SiffUptown
        break;
      case "/cinema/cinema-venues/siff-film-center":
        theater = SiffCenter
        break;
      case "/cinema/cinema-venues/siff-cinema-downtown":
        theater = SiffDowntown
        break;
    }

    if (!theater) {
      console.log("couldn't find theater: ", theaterEl)
      return null
    }


    const actual_times = times.find("div.button-group > a").map((_, el) => $(el).text()).get()
    return actual_times.map((time) => {
      const dateTime = DateManager.parseDateTime(date, time)
      return {
        movie: {
          title: title,
          url: url,
        },
        datetime: dateTime,
        theater: theater!
      }
    })
  }

  getShowtimes(): Effect.Effect<Showtime[], Error> {
    const dates = this.getNextSevenDays();

    return Effect.forEach(dates, (date) =>
      pipe(
        this.getCalendar(date),
        Effect.andThen((calendar) => cheerio.load(calendar)),
        Effect.andThen(($) => ({ $, events: $("div.item") })),
        Effect.map(({ $, events }) => events.map((_, event) => this.eventElementToShowtime($, $(event), date)).get()),
      )
    ).pipe(
      Effect.map((arraysOfShowtimes) => arraysOfShowtimes.flat()),
      Effect.flatMap((showtimes) => this.fetchAllMoviePagesAndUpdateShowtimes(showtimes)),
    );
  }
}
