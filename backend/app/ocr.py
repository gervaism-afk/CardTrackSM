from __future__ import annotations

import os
from typing import List, Tuple
import numpy as np

# Prefer PaddleOCR if available; otherwise fallback to pytesseract.
_PADDLE_AVAILABLE = False
try:
    from paddleocr import PaddleOCR  # type: ignore
    _PADDLE_AVAILABLE = True
except Exception:
    _PADDLE_AVAILABLE = False

import pytesseract
from PIL import Image

_paddle_instance = None

def _get_paddle():
    global _paddle_instance
    if _paddle_instance is None:
        # Use English model. This is the common case for card text.
        _paddle_instance = PaddleOCR(use_angle_cls=True, lang="en")
    return _paddle_instance

def run_ocr(image_bgr: np.ndarray) -> Tuple[str, float]:
    """Returns (text, confidence 0-1)."""
    if _PADDLE_AVAILABLE:
        ocr = _get_paddle()
        result = ocr.ocr(image_bgr, cls=True)
        lines: List[str] = []
        confs: List[float] = []
        for block in result:
            for line in block:
                txt = line[1][0]
                conf = float(line[1][1])
                lines.append(txt)
                confs.append(conf)
        text = "\n".join(lines).strip()
        confidence = float(sum(confs) / max(1, len(confs))) if confs else 0.0
        return text, confidence
    else:
        # pytesseract expects RGB/PIL
        img_rgb = image_bgr[:, :, ::-1]
        pil = Image.fromarray(img_rgb)
        text = pytesseract.image_to_string(pil)
        # Tesseract doesn't give a simple confidence here; provide a conservative default.
        return text.strip(), 0.55
