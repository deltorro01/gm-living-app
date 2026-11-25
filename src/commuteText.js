// How a commute time is shown. Areas whose map point is in the city centre
// itself (e.g. the Northern Quarter) have a commute of 0-2 minutes, which
// reads oddly as "About 0 mins", so they say "In the city centre" instead.

export const IN_CENTRE_MAX_MINUTES = 2;

export const isInCentre = (minutes) => minutes <= IN_CENTRE_MAX_MINUTES;

// "About 12 mins to the city centre" / "In the city centre"
export function commuteLabel(minutes) {
  return isInCentre(minutes) ? "In the city centre" : `About ${minutes} mins to the city centre`;
}

// "About 12 mins" / "In the centre" (short form for facts and tables)
export function commuteShort(minutes) {
  return isInCentre(minutes) ? "In the centre" : `About ${minutes} mins`;
}
