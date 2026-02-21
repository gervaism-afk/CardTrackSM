import type { CardCreate } from "./api";

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function guessYear(text: string): number | null {
  const m = text.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function guessCardNumber(text: string): string | null {
  const m =
    text.match(/(?:#|NO\.?\s*)\s*([A-Z]?\d{1,5})\b/i) ||
    text.match(/\b(\d{1,5})\/\d{1,5}\b/);
  return m ? m[1] : null;
}

function guessBrand(text: string): string | null {
  const t = text.toLowerCase();
  const brands: Array<[string, string]> = [
    ["upper deck", "Upper Deck"],
    ["o-pee-chee", "O-Pee-Chee"],
    ["opc", "O-Pee-Chee"],
    ["topps chrome", "Topps Chrome"],
    ["topps", "Topps"],
    ["panini prizm", "Panini Prizm"],
    ["prizm", "Panini Prizm"],
    ["select", "Panini Select"],
    ["panini", "Panini"],
    ["donruss optic", "Donruss Optic"],
    ["donruss", "Donruss"],
    ["bowman chrome", "Bowman Chrome"],
    ["bowman", "Bowman"],
    ["score", "Score"],
    ["fleer", "Fleer"],
    ["leaf", "Leaf"],
  ];
  for (const [needle, label] of brands) {
    if (t.includes(needle)) return label;
  }
  return null;
}

function guessSport(text: string): string | null {
  const t = text.toLowerCase();
  const sports: Array<[RegExp, string]> = [
    [/\bnhl\b|\bhockey\b/, "Hockey"],
    [/\bnba\b|\bbasketball\b/, "Basketball"],
    [/\bmlb\b|\bbaseball\b/, "Baseball"],
    [/\bnfl\b|\bfootball\b/, "Football"],
    [/\bsoccer\b|\buefa\b|\bfifa\b/, "Soccer"],
  ];
  for (const [rx, label] of sports) if (rx.test(t)) return label;
  return null;
}

function guessPlayer(text: string): string | null {
  const m = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/);
  return m ? m[1].trim() : null;
}

/**
 * Parse a listing/title string into best-effort card fields.
 * This is "smart matching" without API keys: user pastes a listing URL, we read the title and parse it.
 */
export function parseFromListingTitle(title: string, ocrText?: string): Partial<CardCreate> {
  const t = clean(title);
  const mix = clean([t, ocrText || ""].join(" "));
  const year = guessYear(mix);
  const brand = guessBrand(mix);
  const card_number = guessCardNumber(mix);
  const player = guessPlayer(mix);
  const sport = guessSport(mix);

  return {
    year,
    brand,
    card_number,
    player,
    sport,
    notes: "Auto-filled from Smart Match (URL title). Please verify."
  };
}

export function buildEbaySearchQuery(fields: { player?: string; year?: number | null; brand?: string | null; card_number?: string | null }) {
  const parts = [
    fields.year ? String(fields.year) : "",
    fields.brand || "",
    fields.player || "",
    fields.card_number ? `#${fields.card_number}` : ""
  ].filter(Boolean);
  return parts.join(" ").trim();
}