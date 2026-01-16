import type { Showtime } from "../scrapers/models/showtime"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import * as cheerio from 'cheerio'

export class SiteGenerator {
  static async generateIndexHtml(showtimes: Showtime[]): Promise<void> {
    const template = await Bun.file("./generator/index_template.html").text()
    const $ = cheerio.load(template)

    // Generate theater filters dynamically
    const theaterFiltersHtml = `
      <button class="theater-filter active" data-theater="all">All Theaters</button>
      ${ALL_THEATERS.map(theater =>
      `<button class="theater-filter" data-theater="${theater.id}">${theater.name}</button>`
    ).join('')}
    `
    $(".theater-filters").html(theaterFiltersHtml)

    const dayGrid = $("#day-grid")

    // Sort showtimes by date
    showtimes.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

    // Group showtimes by day
    const showtimesByDay = showtimes.reduce((acc, showtime) => {
      const date = new Date(showtime.datetime)
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      if (!acc[dayKey]) {
        acc[dayKey] = []
      }
      acc[dayKey].push(showtime)
      return acc
    }, {} as Record<string, Showtime[]>)

    // Generate HTML for each day
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

    await Bun.write("./out/index.html", $.html())
  }
}
