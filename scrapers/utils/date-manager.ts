import { RUN_MODE } from "../network/scrape-client";

export class DateManager {
  // Fixed date for mock mode to ensure consistent mock file lookups
  private static readonly MOCK_DATE = new Date("2026-01-19T12:00:00");

  static getNow(): Date {
    if (RUN_MODE === "mock") {
      return new Date(DateManager.MOCK_DATE);
    }
    return new Date();
  }

  static getDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  static getNextNDays(n: number): Date[] {
    const nDays: Date[] = [];

    const now = DateManager.getNow();
    for (let i = 0; i < n; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      nDays.push(date)
    }
    return nDays
  }

  // Parse time string (e.g., "7:45 PM")
  static parseDateTime(date: Date, timeString: string): Date {
    const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) {
      throw new Error(`Invalid time format: ${timeString}`);
    }

    const [, hoursStr, minutesStr, periodStr] = timeMatch;
    let hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const period = periodStr?.toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    date.setHours(hours, minutes, 0, 0);
    return new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  }
}
