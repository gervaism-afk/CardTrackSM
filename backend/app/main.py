from __future__ import annotations

import os
import uuid
from typing import List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
import numpy as np
import cv2

from .db import engine, Base, get_session, DATA_DIR
from .models import Card, ChecklistEntry
from .schemas import CardCreate, CardOut, ScanResult, MatchCandidate
from .vision import auto_crop_card
from .ocr import run_ocr
from .extract import extract_fields
from .match import top_candidates

IMAGES_DIR = os.path.join(DATA_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

app = FastAPI(title="CardTrack AI Service", version="0.1.0")

# Allow local PWA dev + LAN usage. Tighten in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

def _save_image(image_bgr: np.ndarray, filename: str) -> str:
    path = os.path.join(IMAGES_DIR, filename)
    cv2.imwrite(path, image_bgr)
    # store as relative to backend/data
    rel = os.path.relpath(path, DATA_DIR).replace("\\", "/")
    return rel

def _read_upload_to_bgr(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Use jpg/png.")
    return img



def _get_local_ip() -> str:
    """Best-effort local LAN IP (not perfect, but good for home Wi‑Fi)."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't need to be reachable
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        try:
            s.close()
        except Exception:
            pass
    return ip

@app.get("/info")
async def info():
    ip = _get_local_ip()
    return {
        "ok": True,
        "service": "cardtrack-backend",
        "port": 8000,
        "lan_url": f"http://{ip}:8000"
    }

@app.get("/qr")
async def qr():
    """Returns a PNG QR code that encodes the LAN URL."""
    from fastapi.responses import Response
    import qrcode
    ip = _get_local_ip()
    url = f"http://{ip}:8000"
    img = qrcode.make(url)
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")

@app.get("/health")
async def health():
    return {"ok": True, "service": "cardtrack-backend"}

@app.post("/scan", response_model=ScanResult)
async def scan_card(image: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    raw = await image.read()
    img = _read_upload_to_bgr(raw)

    cropped, crop_conf = auto_crop_card(img)
    ocr_text, ocr_conf = run_ocr(cropped)

    extracted_fields, parse_conf = extract_fields(ocr_text)
    confidence = float(min(0.95, (crop_conf * 0.25 + ocr_conf * 0.45 + parse_conf * 0.30)))

    # load checklist for candidate matching (keep it simple for MVP)
    rows = (await session.execute(select(ChecklistEntry))).scalars().all()
    checklist_rows = [{
        "id": r.id,
        "sport": r.sport,
        "year": r.year,
        "brand": r.brand,
        "set_name": r.set_name,
        "player": r.player,
        "team": r.team,
        "card_number": r.card_number,
        "parallel": r.parallel,
    } for r in rows]

    candidates = top_candidates(extracted_fields, checklist_rows, limit=3)

    extracted = CardCreate(
        sport=None,
        year=extracted_fields.get("year"),
        brand=extracted_fields.get("brand"),
        set_name=extracted_fields.get("set_name"),
        player=extracted_fields.get("player"),
        team=None,
        card_number=extracted_fields.get("card_number"),
        parallel=None,
        ocr_text=extracted_fields.get("ocr_text"),
        confidence=confidence,
    )

    return ScanResult(
        extracted=extracted,
        candidates=[MatchCandidate(**c) for c in candidates]
    )

@app.post("/cards", response_model=CardOut)
async def create_card(payload: CardCreate, session: AsyncSession = Depends(get_session)):
    card = Card(**payload.model_dump())
    session.add(card)
    await session.commit()
    await session.refresh(card)
    return CardOut(id=card.id, **payload.model_dump())

@app.get("/cards", response_model=List[CardOut])
async def list_cards(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Card).order_by(Card.created_at.desc()))).scalars().all()
    out = []
    for r in rows:
        out.append(CardOut(
            id=r.id,
            sport=r.sport,
            year=r.year,
            brand=r.brand,
            set_name=r.set_name,
            player=r.player,
            team=r.team,
            card_number=r.card_number,
            parallel=r.parallel,
            condition=r.condition,
            grader=r.grader,
            grade=r.grade,
            notes=r.notes,
            image_front_path=r.image_front_path,
            image_cropped_path=r.image_cropped_path,
            ocr_text=r.ocr_text,
            confidence=r.confidence,
        ))
    return out

@app.delete("/cards/{card_id}")
async def delete_card(card_id: int, session: AsyncSession = Depends(get_session)):
    await session.execute(delete(Card).where(Card.id == card_id))
    await session.commit()
    return {"ok": True}

@app.post("/upload-image")
async def upload_image(image: UploadFile = File(...)):
    raw = await image.read()
    img = _read_upload_to_bgr(raw)
    uid = uuid.uuid4().hex
    rel_front = _save_image(img, f"{uid}_front.jpg")
    cropped, _ = auto_crop_card(img)
    rel_crop = _save_image(cropped, f"{uid}_cropped.jpg")
    return {"image_front_path": rel_front, "image_cropped_path": rel_crop}

@app.post("/checklist/import")
async def import_checklist(csv_file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    import csv, io
    text = (await csv_file.read()).decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    count = 0
    for row in reader:
        entry = ChecklistEntry(
            sport=row.get("sport") or None,
            year=int(row["year"]) if row.get("year") and row["year"].isdigit() else None,
            brand=row.get("brand") or None,
            set_name=row.get("set_name") or None,
            player=row.get("player") or None,
            team=row.get("team") or None,
            card_number=row.get("card_number") or None,
            parallel=row.get("parallel") or None,
        )
        session.add(entry)
        count += 1
    await session.commit()
    return {"imported": count}

@app.get("/images/{path:path}")
async def get_image(path: str):
    # Simple file serving for local LAN usage.
    full = os.path.join(DATA_DIR, path)
    if not os.path.isfile(full):
        raise HTTPException(status_code=404, detail="Not found")
    from fastapi.responses import FileResponse
    return FileResponse(full)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
