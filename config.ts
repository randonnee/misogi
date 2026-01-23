import configJson from "./config.json"

export const NOW_PLAYING_DAYS: number = configJson.nowPlayingDays

// Fixed date for mock mode to ensure consistent mock file lookups
export const MOCK_DATE = new Date(configJson.mockDate)
