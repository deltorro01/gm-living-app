// Keep the user's settings in the web address so results can be shared or
// bookmarked. Only values that differ from the defaults are written.
// Safe to import during prerendering: nothing touches `window` until called
// in the browser.

export const DEFAULTS = {
  lifeStage: "young-professional",
  budgetType: "rent",
  monthlyBudget: 1300,
  buyBudget: 325000,
  commutePreference: "city-centre",
  nightlife: 3,
  green: 3,
  value: 4,
  schools: 2,
  safety: 3,
  cycling: 3,
  needTram: false,
  needTrain: false,
  borough: "",
  withinBudget: false,
  tramOnly: false,
  trainOnly: false,
  compare: [],
};

// setting -> [url key, type, extra]
const FIELDS = {
  lifeStage: ["life", "enum", ["young-professional", "family", "first-time-buyer", "downsizer"]],
  budgetType: ["budget", "enum", ["rent", "buy"]],
  monthlyBudget: ["rent", "int", [700, 2500]],
  buyBudget: ["price", "int", [150000, 800000]],
  commutePreference: ["commute", "enum", ["city-centre", "balanced", "space"]],
  nightlife: ["nightlife", "int", [1, 5]],
  green: ["green", "int", [1, 5]],
  value: ["value", "int", [1, 5]],
  schools: ["schools", "int", [1, 5]],
  safety: ["safety", "int", [1, 5]],
  cycling: ["cycling", "int", [1, 5]],
  needTram: ["needtram", "bool"],
  needTrain: ["needtrain", "bool"],
  borough: ["borough", "text"],
  withinBudget: ["inbudget", "bool"],
  tramOnly: ["tramstop", "bool"],
  trainOnly: ["station", "bool"],
  compare: ["compare", "list"],
};

export function readSettings() {
  const settings = { ...DEFAULTS };
  if (typeof window === "undefined") return settings;
  const params = new URLSearchParams(window.location.search);
  for (const [name, [key, type, extra]] of Object.entries(FIELDS)) {
    const raw = params.get(key);
    if (raw === null) continue;
    if (type === "enum" && extra.includes(raw)) settings[name] = raw;
    if (type === "int") {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= extra[0] && n <= extra[1]) settings[name] = n;
    }
    if (type === "bool") settings[name] = raw === "1";
    if (type === "text") settings[name] = raw.slice(0, 60);
    if (type === "list") settings[name] = raw.split("|").filter(Boolean).slice(0, 3);
  }
  return settings;
}

export function writeSettings(settings) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const [name, [key, type]] of Object.entries(FIELDS)) {
    const value = settings[name];
    const isDefault = type === "list" ? value.length === 0 : value === DEFAULTS[name];
    if (isDefault) params.delete(key);
    else params.set(key, type === "bool" ? "1" : type === "list" ? value.join("|") : String(value));
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, "", url);
  }
}
