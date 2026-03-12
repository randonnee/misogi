import type * as cheerio from 'cheerio'
import type { Showtime } from "../scrapers/models/showtime"
import type { Theater } from "../scrapers/models/theater"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import { outImageFilename } from "../scrapers/mocks/mock-utils"
import {
  groupDayShowtimesByMovieTheater,
  groupShowtimesByMovie,
  type ShowtimesByDate,
  type ShowtimesByMovieTheater,
  type MovieGroup
} from "./showtime_utils"

// HTML generation functions for the site

export function generateTheaterFiltersHtml(): string {
  return `
    <button class="theater-filter active" data-theater="all">All Theaters</button>
    ${ALL_THEATERS.map(theater =>
    `<button class="theater-filter" data-theater="${theater.id}">${theater.name}</button>`
  ).join('')}
  `
}

export function generateTheaterFilters($: cheerio.CheerioAPI): void {
  $(".theater-filters").html(generateTheaterFiltersHtml())
}

function generateMovieItemHtml(
  movie: Showtime['movie'],
  theater: Showtime['theater'],
  times: string[]
): string {
  const timesStr = times.join(', ')
  const theaterId = ALL_THEATERS.find(t => t.name === theater.name)?.id || 'unknown'
  return `
    <li class="movie-item" data-theater-id="${theaterId}">
      <div class="movie-title"><a href="${movie.url}" target="_blank" rel="noopener noreferrer">${movie.title}</a></div>
      <div class="movie-times"><a href="${theater.url}" target="_blank" rel="noopener noreferrer">${theater.name}</a> @ ${timesStr}</div>
    </li>
  `
}

function generateDayItemHtml(dayKey: string, movieItemsHtml: string): string {
  return `
    <div class="day-item">
      <h3 class="day-header">${dayKey}</h3>
      <ul class="day-showtimes">
        ${movieItemsHtml}
      </ul>
    </div>
  `
}

export function generateCalendar($: cheerio.CheerioAPI, showtimesByDay: ShowtimesByDate): void {
  const dayGrid = $("#day-grid")

  Object.entries(showtimesByDay).forEach(([dayKey, dayShowtimes]) => {
    const movieTheaterGroups = groupDayShowtimesByMovieTheater(dayShowtimes)

    const movieItemsHtml = Object.values(movieTheaterGroups)
      .map(group => generateMovieItemHtml(group.movie, group.theater, group.times))
      .join('')

    dayGrid.append(generateDayItemHtml(dayKey, movieItemsHtml))
  })
}

function generateShowtimeDatesHtml(showtimes: Showtime[]): string {
  const showtimesByDate: Record<string, string[]> = {}

  showtimes.forEach(showtime => {
    const dateKey = showtime.datetime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
    if (!showtimesByDate[dateKey]) {
      showtimesByDate[dateKey] = []
    }
    const time = showtime.datetime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    showtimesByDate[dateKey].push(time)
  })

  return Object.entries(showtimesByDate)
    .map(([date, times]) => {
      const timeSpans = times.map(t => `<span class="showtime-time">${t}</span>`).join('')
      return `<div class="showtime-date-row"><span class="showtime-date">${date}</span><span class="showtime-times">${timeSpans}</span></div>`
    })
    .join('')
}

function generateTheaterShowtimesHtml(
  theater: Showtime['theater'],
  showtimes: Showtime[]
): string {
  const dateTimesHtml = generateShowtimeDatesHtml(showtimes)
  return `
    <div class="theater-showtimes">
      <div class="theater-name"><a href="${theater.url}" target="_blank" rel="noopener noreferrer">${theater.name}</a></div>
      <div class="showtime-dates">${dateTimesHtml}</div>
    </div>
  `
}

function generateMovieCardHtml(movieGroup: MovieGroup): string {
  const { movie, theaters } = movieGroup

  const theaterItemsHtml = Object.values(theaters)
    .map(({ theater, showtimes }) => generateTheaterShowtimesHtml(theater, showtimes))
    .join('')

  const movieImageHtml = movie.imageUrl
    ? `<img class="movie-poster" src="images/${outImageFilename(movie.imageUrl)}" alt="${movie.title}">`
    : ''

  return `
    <div class="movie-card">
      <h3 class="movie-card-title"><a href="${movie.url}" target="_blank" rel="noopener noreferrer">${movie.title}</a></h3>
      <div class="movie-card-body">
        ${movieImageHtml}
        <div class="movie-theaters">
          ${theaterItemsHtml}
        </div>
      </div>
    </div>
  `
}

export function generateMovieGrid(
  $: cheerio.CheerioAPI,
  showtimesByMovieAndTheater: ShowtimesByMovieTheater
): void {
  const movieGrid = $("#movie-grid")
  const movieGroups = groupShowtimesByMovie(showtimesByMovieAndTheater)

  Object.values(movieGroups).forEach(movieGroup => {
    movieGrid.append(generateMovieCardHtml(movieGroup))
  })
}

function generateTheaterAboutCardHtml(theater: typeof ALL_THEATERS[number]): string {
  const addressHtml = theater.addressLink
    ? `<a href="${theater.addressLink}" target="_blank" rel="noopener noreferrer">${theater.address}</a>`
    : theater.address

  return `
    <div class="theater-about-card">
      <h3 class="theater-about-name"><a href="${theater.url}" target="_blank" rel="noopener noreferrer">${theater.name}</a></h3>
      <div class="theater-about-address">${addressHtml}</div>
      <blockquote class="theater-about-description">"${theater.about}"</blockquote>
    </div>
  `
}

export function generateTheatersAbout($: cheerio.CheerioAPI): void {
  const theatersAbout = $("#theaters-about")
  ALL_THEATERS.forEach(theater => {
    theatersAbout.append(generateTheaterAboutCardHtml(theater))
  })
}

// Structured data (JSON-LD) generation for SEO

function theaterToJsonLd(theater: Theater): object {
  const jsonLd: Record<string, unknown> = {
    "@type": "MovieTheater",
    "name": theater.name,
    "url": theater.url,
    "description": theater.about
  }
  if (theater.address && theater.address !== "Searching for a new home") {
    jsonLd["address"] = {
      "@type": "PostalAddress",
      "streetAddress": theater.address.split(",")[0]?.trim(),
      "addressLocality": "Seattle",
      "addressRegion": "WA",
      "addressCountry": "US"
    }
  }
  return jsonLd
}

function showtimeToScreeningEvent(showtime: Showtime): object {
  const event: Record<string, unknown> = {
    "@type": "ScreeningEvent",
    "name": showtime.movie.title,
    "startDate": showtime.datetime.toISOString(),
    "location": theaterToJsonLd(showtime.theater),
    "workPresented": {
      "@type": "Movie",
      "name": showtime.movie.title,
      ...(showtime.movie.url ? { "url": showtime.movie.url } : {}),
      ...(showtime.movie.imageUrl ? { "image": showtime.movie.imageUrl } : {}),
      ...(showtime.movie.directors && showtime.movie.directors.length > 0 ? {
        "director": showtime.movie.directors.map(d => ({ "@type": "Person", "name": d }))
      } : {}),
      ...(showtime.movie.description ? { "description": showtime.movie.description } : {}),
      ...(showtime.movie.runtime ? { "duration": `PT${showtime.movie.runtime}M` } : {}),
      ...(showtime.movie.releaseYear ? { "dateCreated": String(showtime.movie.releaseYear) } : {})
    }
  }
  if (showtime.movie.url) {
    event["url"] = showtime.movie.url
  }
  return event
}

export function generateStructuredData(
  $: cheerio.CheerioAPI,
  showtimes: Showtime[]
): void {
  // Build the combined JSON-LD with WebSite + MovieTheaters + ScreeningEvents
  const theatersJsonLd = ALL_THEATERS.map(theaterToJsonLd)

  // Limit screening events to avoid excessive JSON-LD size
  // Group by unique movie+theater+date to deduplicate
  const seen = new Set<string>()
  const screeningEvents: object[] = []
  for (const showtime of showtimes) {
    const dateStr = showtime.datetime.toISOString().split('T')[0]
    const key = `${showtime.movie.title}~${showtime.theater.id}~${dateStr}`
    if (!seen.has(key)) {
      seen.add(key)
      screeningEvents.push(showtimeToScreeningEvent(showtime))
    }
    // Cap at 50 events to keep the page size reasonable
    if (screeningEvents.length >= 50) break
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "SeattleIndie.club",
        "url": "https://seattleindie.club/",
        "description": "Aggregates showtimes from independent movie theaters in Seattle"
      },
      ...theatersJsonLd,
      ...screeningEvents
    ]
  }

  // Replace the existing JSON-LD script tag
  $('script[type="application/ld+json"]').html(JSON.stringify(structuredData, null, 2))
}
