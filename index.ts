import { Effect, Either } from "effect"
import { BeaconScraper } from "./scrapers/theater_scrapers/beacon_scraper"
import { SiffScraper } from "./scrapers/theater_scrapers/siff_scraper"
import { SiteGenerator } from "./generator/generator"
import { NWFFScraper } from "./scrapers/theater_scrapers/nwff_scraper"

const beaconScraper = new BeaconScraper()
const siffScraper = new SiffScraper()
const nwffScraper = new NWFFScraper()

const getAllShowtimes = Effect.all([beaconScraper.getShowtimes(), siffScraper.getShowtimes(), nwffScraper.getShowtimes()], { mode: "either" })

Effect.runPromise(getAllShowtimes).then((theaterShowtimeResult) => {
  const showtimes = theaterShowtimeResult.filter(Either.isRight).flatMap(result => result.right)
  console.log("flattened length: ", showtimes.length)
  SiteGenerator.generateSite(showtimes)
})

const server = Bun.serve({
  routes: {
    // Landing page
    "/": Bun.file("./out/index.html"),

    // Serve static files
    "/style.css": Bun.file("./style.css"),
    "/script.js": Bun.file("./script.js"),
    "/favicon.svg": Bun.file("./favicon.svg"),
  },
});

console.log(`Server running at ${server.url}`);
