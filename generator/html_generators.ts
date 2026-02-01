import type * as cheerio from 'cheerio'
import type { Showtime } from "../scrapers/models/showtime"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import { imageUrlToFilename } from "../scrapers/mocks/mock-utils"
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
      <div class="movie-title"><a href="${movie.url}" target="_blank">${movie.title}</a></div>
      <div class="movie-times"><a href="${theater.url}" target="_blank">${theater.name}</a> @ ${timesStr}</div>
    </li>
  `
}

function generateDayItemHtml(dayKey: string, movieItemsHtml: string): string {
  return `
    <div class="day-item">
      <div class="day-header">${dayKey}</div>
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
    .map(([date, times]) =>
      `<div class="showtime-date-row"><span class="showtime-date">${date}</span><span class="showtime-times">${times.join(', ')}</span></div>`
    )
    .join('')
}

function generateTheaterShowtimesHtml(
  theater: Showtime['theater'],
  showtimes: Showtime[]
): string {
  const dateTimesHtml = generateShowtimeDatesHtml(showtimes)
  return `
    <div class="theater-showtimes">
      <div class="theater-name"><a href="${theater.url}" target="_blank">${theater.name}</a></div>
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
    ? `<img class="movie-poster" src="images/${imageUrlToFilename(movie.imageUrl)}" alt="${movie.title}">`
    : ''

  return `
    <div class="movie-card">
      <div class="movie-card-title"><a href="${movie.url}" target="_blank">${movie.title}</a></div>
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
    ? `<a href="${theater.addressLink}" target="_blank">${theater.address}</a>`
    : theater.address

  return `
    <div class="theater-about-card">
      <div class="theater-about-name"><a href="${theater.url}" target="_blank">${theater.name}</a></div>
      <div class="theater-about-address">${addressHtml}</div>
      <blockquote class="theater-about-description">"${theater.about}"</blockquote>
    </div>
  `
}

export function generateTheatersAbout($: cheerio.CheerioAPI): void {
  const theatersAbout = $("#theaters-about")
  ALL_THEATERS.forEach(theater => {
    console.log("generating theater about")
    theatersAbout.append(generateTheaterAboutCardHtml(theater))
  })
}
