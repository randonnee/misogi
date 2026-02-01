import type { Theater } from "../models/theater"

export const SiffUptown: Theater = {
  name: "SIFF Uptown",
  url: "https://www.siff.net/cinema/cinema-venues/siff-cinema-uptown",
  id: "siff-uptown",
  about: "SIFF Cinema Uptown offers the best in arthouse cinema, week-long festivals, and special events on the Uptown's three screens.",
  address: "511 Queen Anne Ave N, Seattle, WA 98109",
  addressLink: "https://maps.app.goo.gl/AsvzoiDEjXjm9ps97"
}
export const SiffDowntown: Theater = {
  name: "SIFF Downtown",
  url: "https://www.siff.net/cinema/cinema-venues/siff-cinema-downtown",
  id: "siff-downtown",
  about: "SIFF Cinema Downtown features a mix of blockbuster studio films, specialty festivals and events, and first-run arthouse cinema, plus reserved seating selection and premium concessions such as local craft beer and chocolate popcorn.",
  address: "2100 4th Ave, Seattle, WA 98121",
  addressLink: "https://maps.app.goo.gl/QdqXTkkNLoH2hhXR6"
}
export const SiffCenter: Theater = {
  name: "SIFF Film Center",
  url: "https://www.siff.net/cinema/cinema-venues/siff-film-center",
  id: "siff-center",
  about: "SIFF Film Center is a state-of-the-art 90-seat jewelbox cinema, with seats rescued from the balcony of the former Seattle Cinerama Theatre (now SIFF Cinema Downtown).",
  address: "511 Queen Anne Ave N, Seattle, WA 98109",
  addressLink: "https://maps.app.goo.gl/Yrrya3PZUqVyrewY9"
}
export const TheBeacon: Theater = {
  name: "The Beacon",
  url: "https://thebeacon.film",
  id: "beacon",
  about: "We desire to re-see the possibilities of cinema and think again about the relationality of art, life, struggle and pleasure. We call upon our community to gather together, in the real world, and experience cinema collectively.",
  address: "4405 Rainier Ave S, Seattle, WA 98118",
  addressLink: "https://maps.app.goo.gl/HwUq1xmYBEfcFEJYA"
}
export const NWFilmForum: Theater = {
  name: "NW Film Forum",
  url: "https://nwfilmforum.org",
  id: "nwff",
  about: "Northwest Film Forum incites public dialogue and creative action through collective cinematic experiences. A nonprofit film and arts center located in Seattle, Northwest Film Forum presents hundreds of films, festivals, community events, multidisciplinary performances, and public discussions each year",
  address: "1515 12th Ave, Seattle, WA 98122",
  addressLink: "https://maps.app.goo.gl/tZwKa1uAvcJjEgDH9"
}
export const GrandIllusion: Theater = {
  name: "The Grand Illusion",
  url: "https://grandillusioncinema.org",
  id: "grand-illusion",
  about: "The Grand Illusion Cinema is the longest continually running movie theater in Seattle, and a landmark of the film community. We screen films from around the world and that inherent diversity is a core of our film programming philosophy.",
  address: "Searching for a new home",
  addressLink: "https://grandillusioncinema.org/moving/"
}
export const CentralCinema: Theater = {
  name: "Central Cinema",
  url: "https://www.central-cinema.com",
  id: "central-cinema",
  about: "Central Cinema is a modern-day Repertory Movie House showing a wide range of Classic Films, Cult Favorites, Indie and Foreign Films for every taste",
  address: "1411 21st Ave, Seattle, WA 98122",
  addressLink: "https://maps.app.goo.gl/NMCw6SrFojkw4DWs9"
}


export const ALL_THEATERS = [TheBeacon, SiffUptown, SiffDowntown, SiffCenter, NWFilmForum, GrandIllusion, CentralCinema]
