from __future__ import annotations

from sqlalchemy import String, Integer, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from .db import Base

class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Canonical fields
    sport: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    set_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    player: Mapped[str | None] = mapped_column(String(200), nullable=True)
    team: Mapped[str | None] = mapped_column(String(200), nullable=True)
    card_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parallel: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # User fields
    condition: Mapped[str | None] = mapped_column(String(120), nullable=True)  # raw/graded
    grader: Mapped[str | None] = mapped_column(String(50), nullable=True)      # PSA/BGS/SGC
    grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Image paths (relative to backend/data)
    image_front_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_cropped_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Extraction metadata
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ChecklistEntry(Base):
    __tablename__ = "checklist_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sport: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    set_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    player: Mapped[str | None] = mapped_column(String(200), nullable=True)
    team: Mapped[str | None] = mapped_column(String(200), nullable=True)
    card_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parallel: Mapped[str | None] = mapped_column(String(200), nullable=True)
