from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List

class CardCreate(BaseModel):
    sport: Optional[str] = None
    year: Optional[int] = None
    brand: Optional[str] = None
    set_name: Optional[str] = None
    player: Optional[str] = None
    team: Optional[str] = None
    card_number: Optional[str] = None
    parallel: Optional[str] = None
    condition: Optional[str] = None
    grader: Optional[str] = None
    grade: Optional[str] = None
    notes: Optional[str] = None
    image_front_path: Optional[str] = None
    image_cropped_path: Optional[str] = None
    ocr_text: Optional[str] = None
    confidence: Optional[float] = None

class CardOut(CardCreate):
    id: int

class MatchCandidate(BaseModel):
    checklist_id: int
    score: float
    year: Optional[int] = None
    brand: Optional[str] = None
    set_name: Optional[str] = None
    player: Optional[str] = None
    card_number: Optional[str] = None
    parallel: Optional[str] = None

class ScanResult(BaseModel):
    extracted: CardCreate
    candidates: List[MatchCandidate] = Field(default_factory=list)
