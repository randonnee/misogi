import type { Record } from "effect"
import type { Showtime } from "../scrapers/models/showtime"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import * as cheerio from 'cheerio'

export class SiteGenerator {
  static generateTheaterFilters($: cheerio.CheerioAPI) {
    const theaterFiltersHtml = `
      <button class="theater-filter active" data-theater="all">All Theaters</button>
      ${ALL_THEATERS.map(theater =>
      `<button class="theater-filter" data-theater="${theater.id}">${theater.name}</button>`
    ).join('')}
    `
    $(".theater-filters").html(theaterFiltersHtml)
  }

  static groupShowtimesByDate(showtimes: Showtime[]): Record<string, Showtime[]> {
    const showtimesByDay = showtimes.reduce((acc, showtime) => {
      const date = new Date(showtime.datetime)
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

      if (!acc[dayKey]) {
        acc[dayKey] = []
      }
      acc[dayKey].push(showtime)
      return acc
    }, {} as Record<string, Showtime[]>)

    return showtimesByDay
  }

  static groupShowtimesByMovieAndTheater(showtimes: Showtime[]): Record<string, Showtime[]> {
    const showtimesByMovieAndTheater = showtimes.reduce((acc, showtime) => {
      const theaterId = showtime.theater.id
      const movieTitle = showtime.movie.title
      const key = `${movieTitle}~${theaterId}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(showtime)
      return acc
    }, {} as Record<string, Showtime[]>)
    return showtimesByMovieAndTheater
  }

  static generateCalendar($: cheerio.CheerioAPI, showtimesByDay: Record<string, Showtime[]>) {
    const dayGrid = $("#day-grid")
    Object.entries(showtimesByDay).forEach(([dayKey, dayShowtimes]) => {
      const dayItem = `
        <div class="day-item">
          <div class="day-header">${dayKey}</div>
          <ul class="day-showtimes">
      `

      // Group showtimes by movie and theater
      const movieTheaterGroups = dayShowtimes.reduce((acc, showtime) => {
        const key = `${showtime.movie.title}@${showtime.theater.name}`
        if (!acc[key]) {
          acc[key] = {
            movie: showtime.movie,
            theater: showtime.theater,
            times: []
          }
        }
        const time = new Date(showtime.datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        acc[key].times.push(time)
        return acc
      }, {} as Record<string, { movie: Showtime['movie'], theater: Showtime['theater'], times: string[] }>)

      // Generate HTML for each movie-theater group
      const movieItems = Object.values(movieTheaterGroups).map(group => {
        const timesStr = group.times.join(', ')
        // Find theater ID from ALL_THEATERS array
        const theaterId = ALL_THEATERS.find(t => t.name === group.theater.name)?.id || 'unknown'
        return `
          <li class="movie-item" data-theater-id="${theaterId}">
            <div class="movie-title"><a href="${group.movie.url}" target="_blank">${group.movie.title}</a></div>
            <div class="movie-times"><a href="${group.theater.url}" target="_blank">${group.theater.name}</a> @ ${timesStr}</div>
          </li>
        `
      }).join('')

      const dayItemClose = `
          </ul>
        </div>
      `

      dayGrid.append(dayItem + movieItems + dayItemClose)
    })
  }

  static generateMovieGrid($: cheerio.CheerioAPI, showtimesByMovieAndTheater: Record<string, Showtime[]>) {
    const movieGrid = $("#movie-grid")

    // Group by movie title to combine theaters showing the same movie
    const movieGroups: Record<string, { movie: Showtime['movie'], theaters: Record<string, { theater: Showtime['theater'], showtimes: Showtime[] }> }> = {}

    Object.entries(showtimesByMovieAndTheater).forEach(([key, showtimes]) => {
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

    // Generate HTML for each movie
    Object.values(movieGroups).forEach(({ movie, theaters }) => {
      const theaterItemsHtml = Object.values(theaters).map(({ theater, showtimes }) => {
        // Group showtimes by date
        const showtimesByDate: Record<string, string[]> = {}
        showtimes.forEach(showtime => {
          const dateKey = showtime.datetime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          if (!showtimesByDate[dateKey]) {
            showtimesByDate[dateKey] = []
          }
          const time = showtime.datetime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          showtimesByDate[dateKey].push(time)
        })

        const dateTimesHtml = Object.entries(showtimesByDate).map(([date, times]) => {
          return `<div class="showtime-date-row"><span class="showtime-date">${date}</span><span class="showtime-times">${times.join(', ')}</span></div>`
        }).join('')

        return `
          <div class="theater-showtimes">
            <div class="theater-name"><a href="${theater.url}" target="_blank">${theater.name}</a></div>
            <div class="showtime-dates">${dateTimesHtml}</div>
          </div>
        `
      }).join('')

      const movieCard = `
        <div class="movie-card">
          <div class="movie-card-title"><a href="${movie.url}" target="_blank">${movie.title}</a></div>
          <div class="movie-theaters">
            ${theaterItemsHtml}
          </div>
        </div>
      `
      movieGrid.append(movieCard)
    })
  }

  static filterShowtimesFromToday(showtimes: Showtime[]): Showtime[] {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    return showtimes.filter(showtime => showtime.datetime >= startOfToday)
  }

  static filterShowtimesForNextDays(showtimes: Showtime[], days: number): Showtime[] {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endDate = new Date(startOfToday.getTime() + days * 24 * 60 * 60 * 1000)

    return showtimes.filter(showtime => {
      return showtime.datetime >= startOfToday && showtime.datetime < endDate
    })
  }

  static async generateSite(showtimes: Showtime[]): Promise<void> {
    const template = await Bun.file("./generator/template.html").text()
    const $ = cheerio.load(template)

    // Sort showtimes chronologically
    showtimes.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

    // Filter to only include showtimes from today onwards
    const upcomingShowtimes = this.filterShowtimesFromToday(showtimes)

    // Generate theater filters for calendar view
    this.generateTheaterFilters($)

    // Generate calendar view content (from today onwards)
    const showtimesByDay = this.groupShowtimesByDate(upcomingShowtimes)
    this.generateCalendar($, showtimesByDay)

    // Generate now-playing view content (only next 7 days)
    const nowPlayingShowtimes = this.filterShowtimesForNextDays(showtimes, 7)
    const showtimesByMovieAndTheater = this.groupShowtimesByMovieAndTheater(nowPlayingShowtimes)
    this.generateMovieGrid($, showtimesByMovieAndTheater)

    await Bun.write("./out/index.html", $.html())
  }
}
