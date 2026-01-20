import { Effect, Either } from "effect"
import { BeaconScraper } from "../scrapers/theater_scrapers/beacon_scraper"
import { SiffScraper } from "../scrapers/theater_scrapers/siff_scraper"
import { SiteGenerator } from "./generator"
import { NWFFScraper } from "../scrapers/theater_scrapers/nwff_scraper"
import type { TheaterScraper } from "../scrapers/models/theater_scraper"

// Parse --theaters argument (comma-separated list of theater IDs)
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

// Scraper registry mapping theater IDs to their scrapers
// Note: SIFF scraper handles multiple venues (siff-uptown, siff-downtown, siff-center)
const SCRAPER_REGISTRY: { theaterIds: string[], scraper: TheaterScraper }[] = [
  { theaterIds: ["beacon"], scraper: new BeaconScraper() },
  { theaterIds: ["siff"], scraper: new SiffScraper() },
  { theaterIds: ["nwff"], scraper: new NWFFScraper() },
]

function getScrapersForTheaters(theaterIds: string[] | null): TheaterScraper[] {
  if (theaterIds === null) {
    // No filter specified, return all scrapers
    return SCRAPER_REGISTRY.map(entry => entry.scraper)
  }

  const selectedScrapers = new Set<TheaterScraper>()
  for (const entry of SCRAPER_REGISTRY) {
    if (entry.theaterIds.some(id => theaterIds.includes(id))) {
      selectedScrapers.add(entry.scraper)
    }
  }

  if (selectedScrapers.size === 0) {
    const validIds = SCRAPER_REGISTRY.flatMap(entry => entry.theaterIds)
    console.warn(`Warning: No valid theater IDs found. Valid IDs are: ${validIds.join(", ")}`)
    return SCRAPER_REGISTRY.map(entry => entry.scraper)
  }

  return [...selectedScrapers]
}

const requestedTheaters = parseTheatersArg()
const scrapers = getScrapersForTheaters(requestedTheaters)

if (requestedTheaters) {
  console.log(`Running scrapers for theaters: ${requestedTheaters.join(", ")}`)
}

const getAllShowtimes = Effect.all(scrapers.map(s => s.getShowtimes()), { mode: "either" })

Effect.runPromise(getAllShowtimes).then((theaterShowtimeResult) => {
  const showtimes = theaterShowtimeResult.filter(Either.isRight).flatMap(result => result.right)
  console.log("flattened length: ", showtimes.length)
  SiteGenerator.generateSite(showtimes)
})
