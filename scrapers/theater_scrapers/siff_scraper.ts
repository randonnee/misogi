import type { Showtime } from "../models/showtime";
import type { Theater } from "../models/theater";
import * as cheerio from 'cheerio';
import type { Element } from "domhandler";
import { SiffCenter, SiffDowntown, SiffUptown } from "../theaters/theaters";
import { getScrapeClient, type ScrapeClient } from "../network/scrape-client";
import { DateManager } from "../utils/date-manager";
import { BaseScraper, type CalendarPage } from "./base_scraper";

export class SiffScraper extends BaseScraper<Date> {
  protected readonly scrapeClient: ScrapeClient = getScrapeClient();

  getCalendarPages(): CalendarPage<Date>[] {
    return DateManager.getNextNDays(7).map(date => ({
      url: `https://www.siff.net/calendar?view=list&date=${DateManager.getDateYYYYMMDD(date)}`,
      context: date
    }));
  }

  getEventSelector(): string {
    return "div.item";
  }

  parseEvent($: cheerio.CheerioAPI, event: cheerio.Cheerio<Element>, date: Date): Showtime[] | null {
    const link = event.find("h3 > a").first();
    const url = "https://siff.net" + link.attr("href");
    const title = link.text().trim();
    const times = event.find("div.times");
    const theaterEl = times.find("h3 > a").first().attr("href");
    let theater: Theater | null = null;
    switch (theaterEl) {
      case "/cinema/cinema-venues/siff-cinema-uptown":
        theater = SiffUptown;
        break;
      case "/cinema/cinema-venues/siff-film-center":
        theater = SiffCenter;
        break;
      case "/cinema/cinema-venues/siff-cinema-downtown":
        theater = SiffDowntown;
        break;
    }

    if (!theater) {
      console.log("couldn't find theater: ", theaterEl);
      return null;
    }

    const actual_times = times.find("div.button-group > a").map((_, el) => $(el).text()).get();
    return actual_times.map((time) => {
      const dateTime = DateManager.parseDateTime(date, time);
      return {
        movie: {
          title: title,
          url: url,
        },
        datetime: dateTime,
        theater: theater!
      };
    });
  }
}
