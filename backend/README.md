# CardTrack MVP Backend (Windows PC AI Service)

FastAPI service that:
- accepts an image of a sports card
- auto-crops the card
- runs OCR (PaddleOCR preferred; Tesseract fallback)
- extracts structured fields (year, brand/set, player, card number, etc.)
- stores cards + images in a local SQLite database

## Requirements (Windows)
- Python 3.10+ recommended
- For best OCR: install PaddleOCR (can be heavier)
- Optional: Tesseract OCR installed (only needed for fallback)

## Quick start
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# (Optional but recommended) If you want PaddleOCR:
pip install paddleocr paddlepaddle

# Run
python -m app.main
```

Server will start at: http://127.0.0.1:8000

## Notes
- Data (SQLite + images) stored under `backend/data/`
- CORS is enabled for local dev.
