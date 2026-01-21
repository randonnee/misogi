import { Effect, Either } from "effect"
import * as cheerio from 'cheerio'
import type { Showtime } from "../scrapers/models/showtime"
import { getAllScrapers, getScrapersForTheaters } from "./scraper_registry"
import {
  sortShowtimesChronologically,
  filterShowtimesFromToday,
  filterShowtimesForNextDays,
  groupShowtimesByDate,
  groupShowtimesByMovieAndTheater
} from "./showtime_utils"
import {
  generateTheaterFilters,
  generateCalendar,
  generateMovieGrid
} from "./html_generators"

const TEMPLATE_PATH = "./generator/template.html"
const OUTPUT_PATH = "./out/index.html"
const NOW_PLAYING_DAYS = 7

function parseTheatersArg(): string[] | null {
  const theatersArgIndex = process.argv.findIndex(arg => arg === "--theaters")
  if (theatersArgIndex === -1 || theatersArgIndex === process.argv.length - 1) {
    return null
  }
  const theatersValue = process.argv[theatersArgIndex + 1]
  if (!theatersValue || theatersValue.startsWith("--")) {
    return null
  }
  return theatersValue.split(",").map(t => t.trim().toLowerCase())
}

async function generateSite(showtimes: Showtime[]): Promise<void> {
  const template = await Bun.file(TEMPLATE_PATH).text()
  const $ = cheerio.load(template)

  const sortedShowtimes = sortShowtimesChronologically(showtimes)

  // Generate theater filters for calendar view
  generateTheaterFilters($)

  // Generate calendar view content (from today onwards)
  const upcomingShowtimes = filterShowtimesFromToday(sortedShowtimes)
  const showtimesByDay = groupShowtimesByDate(upcomingShowtimes)
  generateCalendar($, showtimesByDay)

  // Generate now-playing view content (only next N days)
  const nowPlayingShowtimes = filterShowtimesForNextDays(sortedShowtimes, NOW_PLAYING_DAYS)
  const showtimesByMovieAndTheater = groupShowtimesByMovieAndTheater(nowPlayingShowtimes)
  generateMovieGrid($, showtimesByMovieAndTheater)

  await Bun.write(OUTPUT_PATH, $.html())
}

async function main(): Promise<void> {
  const requestedTheaters = parseTheatersArg()

  const scrapers = requestedTheaters
    ? getScrapersForTheaters(requestedTheaters)
    : getAllScrapers()

  if (requestedTheaters) {
    console.log(`Running scrapers for theaters: ${requestedTheaters.join(", ")}`)
  }

  const getAllShowtimes = Effect.all(
    scrapers.map(s => s.getShowtimes()),
    { mode: "either" }
  )

  const theaterShowtimeResult = await Effect.runPromise(getAllShowtimes)
  const showtimes = theaterShowtimeResult
    .filter(Either.isRight)
    .flatMap(result => result.right)

  console.log(`Total showtimes: ${showtimes.length}`)
  await generateSite(showtimes)
}

main()
