import { RUN_MODE } from "../config/run-mode";
import { MOCK_DATE } from "../../config";

export class DateManager {

  static getNow(): Date {
    if (RUN_MODE === "mock") {
      return new Date(MOCK_DATE);
    }
    return new Date();
  }

  static getDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  static getNextNDays(n: number): string[] {
    const nDays: string[] = [];

    const now = DateManager.getNow();
    for (let i = 0; i < n; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      nDays.push(`${year}-${month}-${day}`)
    }
    return nDays
  }

  // Parse time string (e.g., "7:45 PM") and return a Date in PST/PDT
  static parseDateTime(date: string, timeString: string): Date {
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

    // Build an ISO string with the date and time, then append PST timezone
    // We need to determine if the date falls in PST (-08:00) or PDT (-07:00)
    const hoursStr24 = String(hours).padStart(2, '0');
    const minutesStr2 = String(minutes).padStart(2, '0');

    const isoString = `${date}T${hoursStr24}:${minutesStr2}`;
    return new Date(isoString);
  }
}
