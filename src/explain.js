// Plain-English reasons behind an area's match score.
// Reads the same inputs the score uses; it does not change any scores.

const LIFE_STAGE_NAMES = {
  "young-professional": "a young professional",
  family: "a family",
  "first-time-buyer": "a first-time buyer",
  downsizer: "a downsizer",
};

// "Meets or beats" sliders, in order of their weight in the score.
const AT_LEAST = [
  { key: "safety", field: "safety", label: "safety" },
  { key: "green", field: "greenSpace", label: "green space" },
  { key: "value", field: "value", label: "value for money" },
  { key: "schools", field: "schools", label: "schools" },
  { key: "cycling", field: "cycling", label: "cycling" },
];

function money(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

export function explainMatch(area, settings) {
  const good = [];
  const watch = [];

  // Budget
  const isRent = settings.budgetType === "rent";
  const cost = isRent ? area.averageRent : area.averageHousePrice;
  const budget = isRent ? settings.monthlyBudget : settings.buyBudget;
  const costText = isRent ? `${money(cost)} pcm` : money(cost);
  if (budget > 0) {
    const ratio = cost / budget;
    if (ratio <= 0.85) good.push(`Well within budget (${isRent ? "rent" : "typical price"} ${costText})`);
    else if (ratio <= 1) good.push(`Within budget (${isRent ? "rent" : "typical price"} ${costText})`);
    else {
      const over = Math.round((ratio - 1) * 100);
      watch.push(`${over <= 10 ? "Slightly over" : "Over"} budget: about ${over}% more (${costText})`);
    }
  }

  // Life stage
  const fit = area.breakdown.lifestyle;
  const who = LIFE_STAGE_NAMES[settings.lifeStage] ?? "you";
  if (fit >= 85) good.push(`Strong fit for ${who}`);
  else if (fit < 65) watch.push(`Weaker fit for ${who}`);

  // Commute
  if (settings.commutePreference === "city-centre") {
    const mins = area.commuteCityMinutes;
    if (mins <= 20) good.push(`Quick to the city centre (about ${mins} mins)`);
    else if (mins > 40) watch.push(`Long trip to the city centre (about ${mins} mins)`);
  }

  // Sliders: shortfalls first (they cost points), then clear strengths
  for (const s of AT_LEAST) {
    const wanted = settings[s.key];
    const rating = area[s.field];
    if (rating < wanted) watch.push(`Below what you asked for on ${s.label} (${rating}/5, you asked for ${wanted})`);
  }
  for (const s of AT_LEAST) {
    const wanted = settings[s.key];
    const rating = area[s.field];
    if (rating >= 4 && rating >= wanted) good.push(`Good for ${s.label} (${rating}/5)`);
  }

  // Nightlife: closest match
  const nightDiff = area.nightlife - settings.nightlife;
  if (nightDiff === 0) good.push("Nightlife matches what you asked for");
  else if (Math.abs(nightDiff) >= 2) watch.push(nightDiff > 0 ? "Livelier than you asked for" : "Quieter than you asked for");

  return { good: good.slice(0, 4), watch: watch.slice(0, 3) };
}
