
import { Effect, pipe } from "effect";
import type { Showtime } from "../models/showtime";
import type { Theater } from "../models/theater";
import type { TheaterScraper } from "../models/theater_scraper";
import * as cheerio from 'cheerio'
import type { Element } from "domhandler";
import { SiffCenter, SiffDowntown, SiffUptown } from "../theaters/theaters";
import { ScrapeClientImpl } from "../network/scrape-client";
import { MockSiffScrapeClient } from "../mocks/mock-siff-scrape-client";


export class SiffScraper implements TheaterScraper {
  private static readonly isMock = process.argv.includes('--mock');
  private static readonly scrapeClient = SiffScraper.isMock
    ? new MockSiffScrapeClient()
    : new ScrapeClientImpl();

  getNextSevenDays(): string[] {
    const dates: string[] = [];
    const now = new Date();

    for (let i = 0; i < 9; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);

      const pstDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
      const year = pstDate.getFullYear();
      const month = String(pstDate.getMonth() + 1).padStart(2, '0');
      const day = String(pstDate.getDate()).padStart(2, '0');

      dates.push(`${year}-${month}-${day}`);
    }

    return dates;
  }

  static parseDateTime(dateString: string, timeString: string): Date {
    // Parse date components
    const dateParts = dateString.split('-');
    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);

    // Parse time string (e.g., "7:45 PM")
    const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) {
      throw new Error(`Invalid time format: ${timeString}`);
    }

    const [, hoursStr, minutesStr, periodStr] = timeMatch;
    let hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const period = periodStr?.toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    // Create date in PST timezone
    const date = new Date();
    date.setFullYear(year, month - 1, day);
    date.setHours(hours, minutes, 0, 0);

    // Convert to PST by using the timezone
    return new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  }

  getCalendar(dateString: String): Effect.Effect<string, Error> {
    const calendarUrl = `https://www.siff.net/calendar?view=list&date=${dateString}`;

    return SiffScraper.scrapeClient.get(calendarUrl);
  }

  eventElementToShowtime($: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>, dateString: string): Showtime[] | null {
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
      const date = SiffScraper.parseDateTime(dateString, time)
      return {
        movie: {
          title: title,
          url: url,
        },
        datetime: date,
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

  async generateIndexHtml(showtimes: Showtime[]): Promise<void> {
    const template = await Bun.file("./index_template.html").text()
    const $ = cheerio.load(template)

    const moviesList = $("#movies-list")

    showtimes.forEach(showtime => {
      const date = new Date(showtime.datetime)
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

      const movieItem = `
        <li class="movie-item">
          <div class="movie-title"><a href="${showtime.movie.url}" target="_blank">${showtime.movie.title}</a></div>
          <div class="movie-info">
            <span class="movie-meta"></span>
            <span class="movie-showtime">${showtime.theater.name} • ${dayName} ${time}</span>
          </div>
        </li>
      `
      moviesList.append(movieItem)
    })

    await Bun.write("./index.html", $.html())
  }
}
