import Tesseract from "tesseract.js";

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function guessYear(text: string): number | null {
  const m = text.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function guessCardNumber(text: string): string | null {
  const m =
    text.match(/(?:#|NO\.?\s*)\s*([A-Z]?\d{1,4})\b/i) ||
    text.match(/\b(\d{1,4})\/\d{1,4}\b/);
  return m ? m[1] : null;
}

function guessBrand(text: string): string | null {
  const t = text.toLowerCase();
  const brands: Array<[string, string]> = [
    ["upper deck", "Upper Deck"],
    ["o-pee-chee", "O-Pee-Chee"],
    ["opc", "O-Pee-Chee"],
    ["topps", "Topps"],
    ["panini", "Panini"],
    ["donruss", "Donruss"],
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

function guessPlayer(text: string): string | null {
  const m = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/);
  return m ? m[1].trim() : null;
}

export async function ocrExtract(file: File) {
  const { data } = await Tesseract.recognize(file, "eng", { logger: () => {} });

  const raw = clean(data.text || "");
  const conf =
    typeof data.confidence === "number"
      ? Math.max(0, Math.min(1, data.confidence / 100))
      : 0;

  const year = guessYear(raw);
  const brand = guessBrand(raw);
  const card_number = guessCardNumber(raw);
  const player = guessPlayer(raw);

  return {
    year,
    brand,
    card_number,
    player,
    ocr_text: raw,
    confidence: conf,
    notes: "Auto-filled from OCR. Please verify."
  };
}