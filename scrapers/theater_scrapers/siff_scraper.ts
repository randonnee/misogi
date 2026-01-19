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

  getNextSevenDays(): Date[] {
    return DateManager.getNextNDays(7)
  }

  getCalendar(date: Date): Effect.Effect<string, Error> {
    const dateString = DateManager.getDateYYYYMMDD(date)
    const calendarUrl = `https://www.siff.net/calendar?view=list&date=${dateString}`;

    return SiffScraper.scrapeClient.get(calendarUrl);
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
    );
  }
}
