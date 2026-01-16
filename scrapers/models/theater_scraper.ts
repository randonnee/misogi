import type { Effect } from "effect";
import type { Showtime } from "./showtime";

export interface TheaterScraper {
  getShowtimes(): Effect.Effect<Showtime[], Error>
}
