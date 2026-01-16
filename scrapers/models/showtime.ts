import type { Movie } from "./movie";
import type { Theater } from "./theater";

export interface Showtime {
  movie: Movie;
  theater: Theater;
  datetime: Date;
}
