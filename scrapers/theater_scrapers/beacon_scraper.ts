import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio'
import type { Element } from "domhandler";
import { TheBeacon } from "../theaters/theaters";

const calendar_mock_path = "scrapers/mocks/beacon_calendar.html"
const calendar_mock = await Bun.file(calendar_mock_path).text()

export class BeaconScraper implements TheaterScraper {
  getCalendar(): Effect.Effect<string, Error> {
    // return Effect.succeed(calendar_mock)

    const calendarUrl = "https://thebeacon.film/calendar";

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(calendarUrl);
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        return await response.text();
      },
      catch: (error): Error => {
        return error instanceof Error
          ? error
          : new Error(String(error))
      }
    })
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
      // Effect.tap((showtimes) => this.generateIndexHtml(showtimes))
    )
  }
}
