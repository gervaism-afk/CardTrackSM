from __future__ import annotations

from typing import List, Dict, Any
from rapidfuzz import fuzz

def score_candidate(extracted: Dict[str, Any], row: Dict[str, Any]) -> float:
    score = 0.0
    weight = 0.0

    def add(sim: float, w: float):
        nonlocal score, weight
        score += sim * w
        weight += w

    if extracted.get("year") and row.get("year"):
        add(100.0 if int(extracted["year"]) == int(row["year"]) else 0.0, 2.0)

    if extracted.get("card_number") and row.get("card_number"):
        add(fuzz.ratio(str(extracted["card_number"]), str(row["card_number"])), 2.0)

    if extracted.get("player") and row.get("player"):
        add(fuzz.token_set_ratio(extracted["player"], row["player"]), 2.5)

    if extracted.get("brand") and row.get("brand"):
        add(fuzz.token_set_ratio(extracted["brand"], row["brand"]), 1.5)

    if extracted.get("set_name") and row.get("set_name"):
        add(fuzz.token_set_ratio(extracted["set_name"], row["set_name"]), 1.5)

    if weight == 0:
        return 0.0
    return score / weight

def top_candidates(extracted: Dict[str, Any], checklist_rows: List[Dict[str, Any]], limit: int = 3) -> List[Dict[str, Any]]:
    scored = []
    for r in checklist_rows:
        s = score_candidate(extracted, r)
        if s > 40:
            scored.append((s, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    out = []
    for s, r in scored[:limit]:
        out.append({
            "checklist_id": r["id"],
            "score": float(round(s, 2)),
            "year": r.get("year"),
            "brand": r.get("brand"),
            "set_name": r.get("set_name"),
            "player": r.get("player"),
            "card_number": r.get("card_number"),
            "parallel": r.get("parallel"),
        })
    return out
