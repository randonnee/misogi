import { RUN_MODE } from "../config/run-mode";

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

  // Parse time string (e.g., "7:45 PM") and return a Date in PST/PDT
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

    // Build an ISO string with the date and time, then append PST timezone
    // We need to determine if the date falls in PST (-08:00) or PDT (-07:00)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hoursStr24 = String(hours).padStart(2, '0');
    const minutesStr2 = String(minutes).padStart(2, '0');

    // Determine if DST is in effect for this date in America/Los_Angeles
    // DST starts 2nd Sunday of March, ends 1st Sunday of November
    const offset = DateManager.getPacificOffset(date);

    const isoString = `${year}-${month}-${day}T${hoursStr24}:${minutesStr2}:00${offset}`;
    return new Date(isoString);
  }

  // Parse an ISO datetime string (e.g., "2026-01-19T16:30" or "2026-01-19T16:30:00")
  // that doesn't have timezone info and interpret it as PST/PDT
  static parseISOAsPacific(isoString: string): Date {
    // If the string already has timezone info, parse it directly
    if (isoString.includes('+') || isoString.includes('Z') || isoString.match(/-\d{2}:\d{2}$/)) {
      return new Date(isoString);
    }

    // Normalize the string to have seconds if missing
    let normalized = isoString;
    if (isoString.match(/T\d{2}:\d{2}$/)) {
      normalized = isoString + ':00';
    }

    // Parse the date parts to determine DST
    const datePart = normalized.split('T')[0];
    const tempDate = new Date(datePart + 'T12:00:00Z'); // Use noon UTC to get the right date
    const offset = DateManager.getPacificOffset(tempDate);

    return new Date(normalized + offset);
  }

  // Get the UTC offset for Pacific timezone on a given date
  // Returns "-08:00" for PST or "-07:00" for PDT
  private static getPacificOffset(date: Date): string {
    // Create a date formatter that outputs the timezone offset
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    
    // tzPart.value will be like "GMT-8" or "GMT-7"
    if (tzPart?.value?.includes('-8')) {
      return '-08:00';
    } else if (tzPart?.value?.includes('-7')) {
      return '-07:00';
    }
    
    // Fallback to PST if we can't determine
    return '-08:00';
  }
}
