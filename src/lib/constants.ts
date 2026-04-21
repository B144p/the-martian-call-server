export const CONTINENT_IDS = ['na', 'sa', 'eu', 'af', 'as', 'oc'] as const;
export type ContinentId = (typeof CONTINENT_IDS)[number];

export const VALID_DIRECTIONS = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
] as const;
export type Direction = (typeof VALID_DIRECTIONS)[number];

/** 5 minutes in milliseconds — defines "online" for stats and cron signal_log */
export const RECENTLY_SEEN_WINDOW_MS = 5 * 60 * 1000;
