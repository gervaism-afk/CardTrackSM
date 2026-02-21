from __future__ import annotations

import re
from typing import Optional, Dict, Any, Tuple

YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")
CARDNO_RE = re.compile(r"(?:#\s*|No\.?\s*)([A-Z]*\d+[A-Z]*)", re.IGNORECASE)

# Very lightweight heuristics. The idea is:
# - we OCR everything
# - we extract obvious year / card number
# - we guess player name from the largest 'name-like' line (simple)
# - user confirms if needed

def normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def extract_fields(ocr_text: str) -> Tuple[Dict[str, Any], float]:
    lines = [normalize_space(x) for x in ocr_text.splitlines() if normalize_space(x)]
    joined = "\n".join(lines)

    year: Optional[int] = None
    m = YEAR_RE.search(joined)
    if m:
        year = int(m.group(1))

    card_number: Optional[str] = None
    m2 = CARDNO_RE.search(joined)
    if m2:
        card_number = m2.group(1).strip()

    # Player heuristic: pick a line that looks like a name (mostly letters, 1-3 words)
    player: Optional[str] = None
    name_candidates = []
    for ln in lines:
        if 3 <= len(ln) <= 40 and re.fullmatch(r"[A-Za-z\.'\- ]+", ln):
            words = ln.split()
            if 1 <= len(words) <= 4:
                # avoid common non-name words
                bad = {"rookie", "upper", "deck", "panini", "topps", "score", "donruss", "prizm", "select", "stadium"}
                if not any(w.lower() in bad for w in words):
                    name_candidates.append(ln)

    if name_candidates:
        # choose the longest (often full name)
        player = sorted(name_candidates, key=len, reverse=True)[0]

    # Brand/set heuristic: look for known makers keywords
    brand = None
    set_name = None
    lower = " ".join(lines).lower()
    for b in ["upper deck", "panini", "topps", "donruss", "score", "fleer", "opc", "o-pee-chee", "bowman"]:
        if b in lower:
            brand = b.title()
            break

    # Set hints
    for s in ["prizm", "select", "optic", "donruss optic", "young guns", "series 1", "series 2", "mvp", "artifacts"]:
        if s in lower:
            set_name = s.title()
            break

    # Confidence is conservative: increase if we got multiple fields.
    found = sum(1 for x in [year, card_number, player, brand, set_name] if x)
    confidence = min(0.9, 0.35 + found * 0.12)

    return {
        "year": year,
        "card_number": card_number,
        "player": player,
        "brand": brand,
        "set_name": set_name,
        "ocr_text": joined
    }, confidence
