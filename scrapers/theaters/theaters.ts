import type { Theater } from "../models/theater"

export const SiffUptown: Theater = {
  name: "SIFF Uptown",
  url: "https://www.siff.net/cinema/cinema-venues/siff-cinema-uptown",
  id: "siff-uptown"
}
export const SiffDowntown: Theater = {
  name: "SIFF Downtown",
  url: "https://www.siff.net/cinema/cinema-venues/siff-cinema-downtown",
  id: "siff-downtown"
}
export const SiffCenter: Theater = {
  name: "SIFF Film Center",
  url: "https://www.siff.net/cinema/cinema-venues/siff-film-center",
  id: "siff-center"
}
export const TheBeacon: Theater = {
  name: "The Beacon",
  url: "https://thebeacon.film",
  id: "beacon"
}


export const ALL_THEATERS = [TheBeacon, SiffUptown, SiffDowntown, SiffCenter]
