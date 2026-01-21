import type { Showtime } from "../scrapers/models/showtime"
import { DateManager } from "../scrapers/utils/date-manager"

// Type aliases for grouped showtime structures
export type ShowtimesByDate = Record<string, Showtime[]>
export type ShowtimesByMovieTheater = Record<string, Showtime[]>

export interface MovieTheaterGroup {
  movie: Showtime['movie']
  theater: Showtime['theater']
  times: string[]
}

export interface MovieGroup {
  movie: Showtime['movie']
  theaters: Record<string, {
    theater: Showtime['theater']
    showtimes: Showtime[]
  }>
}

// Grouping functions

export function groupShowtimesByDate(showtimes: Showtime[]): ShowtimesByDate {
  return showtimes.reduce((acc, showtime) => {
    const date = new Date(showtime.datetime)
    const dayKey = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    if (!acc[dayKey]) {
      acc[dayKey] = []
    }
    acc[dayKey].push(showtime)
    return acc
  }, {} as ShowtimesByDate)
}

export function groupShowtimesByMovieAndTheater(showtimes: Showtime[]): ShowtimesByMovieTheater {
  return showtimes.reduce((acc, showtime) => {
    const theaterId = showtime.theater.id
    const movieTitle = showtime.movie.title
    const key = `${movieTitle}~${theaterId}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(showtime)
    return acc
  }, {} as ShowtimesByMovieTheater)
}

export function groupDayShowtimesByMovieTheater(
  showtimes: Showtime[]
): Record<string, MovieTheaterGroup> {
  return showtimes.reduce((acc, showtime) => {
    const key = `${showtime.movie.title}@${showtime.theater.name}`
    if (!acc[key]) {
      acc[key] = {
        movie: showtime.movie,
        theater: showtime.theater,
        times: []
      }
    }
    const time = new Date(showtime.datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    acc[key].times.push(time)
    return acc
  }, {} as Record<string, MovieTheaterGroup>)
}

export function groupShowtimesByMovie(
  showtimesByMovieTheater: ShowtimesByMovieTheater
): Record<string, MovieGroup> {
  const movieGroups: Record<string, MovieGroup> = {}

  Object.entries(showtimesByMovieTheater).forEach(([key, showtimes]) => {
    const parts = key.split('~')
    const movieTitle = parts[0]
    const theaterId = parts[1]
    if (!movieTitle || !theaterId) return

    const firstShowtime = showtimes[0]
    if (!firstShowtime) return

    if (!movieGroups[movieTitle]) {
      movieGroups[movieTitle] = {
        movie: firstShowtime.movie,
        theaters: {}
      }
    }

    movieGroups[movieTitle].theaters[theaterId] = {
      theater: firstShowtime.theater,
      showtimes: showtimes.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
    }
  })

  return movieGroups
}

// Filtering functions

export function filterShowtimesFromToday(showtimes: Showtime[]): Showtime[] {
  const now = DateManager.getNow()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return showtimes.filter(showtime => showtime.datetime >= startOfToday)
}

export function filterShowtimesForNextDays(showtimes: Showtime[], days: number): Showtime[] {
  const now = DateManager.getNow()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endDate = new Date(startOfToday.getTime() + days * 24 * 60 * 60 * 1000)

  return showtimes.filter(showtime => {
    return showtime.datetime >= startOfToday && showtime.datetime < endDate
  })
}

export function sortShowtimesChronologically(showtimes: Showtime[]): Showtime[] {
  return [...showtimes].sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
}
