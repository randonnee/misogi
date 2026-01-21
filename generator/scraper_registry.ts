import type { TheaterScraper } from "../scrapers/models/theater_scraper"
import { BeaconScraper } from "../scrapers/theater_scrapers/beacon_scraper"
import { SiffScraper } from "../scrapers/theater_scrapers/siff_scraper"
import { NWFFScraper } from "../scrapers/theater_scrapers/nwff_scraper"

interface ScraperEntry {
  theaterIds: string[]
  scraper: TheaterScraper
}

// Registry mapping theater IDs to their scrapers
// Note: Some scrapers handle multiple venues (e.g., SIFF handles siff-uptown, siff-downtown, siff-center)
const SCRAPER_REGISTRY: ScraperEntry[] = [
  { theaterIds: ["beacon"], scraper: new BeaconScraper() },
  { theaterIds: ["siff"], scraper: new SiffScraper() },
  { theaterIds: ["nwff"], scraper: new NWFFScraper() },
]

export function getAllScrapers(): TheaterScraper[] {
  return SCRAPER_REGISTRY.map(entry => entry.scraper)
}

export function getScrapersForTheaters(theaterIds: string[]): TheaterScraper[] {
  const selectedScrapers = new Set<TheaterScraper>()

  for (const entry of SCRAPER_REGISTRY) {
    if (entry.theaterIds.some(id => theaterIds.includes(id))) {
      selectedScrapers.add(entry.scraper)
    }
  }

  if (selectedScrapers.size === 0) {
    const validIds = SCRAPER_REGISTRY.flatMap(entry => entry.theaterIds)
    console.warn(`Warning: No valid theater IDs found. Valid IDs are: ${validIds.join(", ")}`)
    return getAllScrapers()
  }

  return [...selectedScrapers]
}

export function getValidTheaterIds(): string[] {
  return SCRAPER_REGISTRY.flatMap(entry => entry.theaterIds)
}
