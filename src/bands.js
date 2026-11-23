// Fit labels shown on the result cards and the map, from highest to lowest.
// Thresholds were set in November 2026 so the labels appear about as often as
// before the scoring change: the best match is "Excellent" in about 60% of
// searches (66% before), and about half of results are "Strong" or better.
// See SCORING.md.
export const FIT_BANDS = [
  { min: 92, label: "Excellent fit", color: "#059669" },
  { min: 82, label: "Strong fit", color: "#2563eb" },
  { min: 65, label: "Good fit", color: "#d97706" },
  { min: 0, label: "Worth a look", color: "#94a3b8" },
];

export function fitBand(score) {
  return FIT_BANDS.find((band) => score >= band.min);
}
