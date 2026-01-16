import { Effect, Either } from "effect"
import { BeaconScraper } from "./scrapers/theater_scrapers/beacon_scraper"
import { SiffScraper } from "./scrapers/theater_scrapers/siff_scraper"
import { SiteGenerator } from "./generator/generator"

const beaconScraper = new BeaconScraper()
const siffScraper = new SiffScraper()

const getAllShowtimes = Effect.all([beaconScraper.getShowtimes(), siffScraper.getShowtimes()], { mode: "either" })

Effect.runPromise(getAllShowtimes).then((theaterShowtimeResult) => {
  const showtimes = theaterShowtimeResult.filter(Either.isRight).flatMap(result => result.right)
  console.log("flattened length: ", showtimes.length)
  SiteGenerator.generateIndexHtml(showtimes)
})

const server = Bun.serve({
  routes: {
    // Landing page
    "/": Bun.file("./out/index.html"),

    // Serve static files
    "/style.css": Bun.file("./style.css"),
    "/script.js": Bun.file("./script.js"),
  },
});

console.log(`Server running at ${server.url}`);
