from __future__ import annotations

import cv2
import numpy as np
from typing import Tuple

def auto_crop_card(image_bgr: np.ndarray) -> Tuple[np.ndarray, float]:
    """Attempt to find the card boundary and warp-crop it.
    Returns (cropped_image_bgr, crop_confidence).
    """
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, None, iterations=2)
    edges = cv2.erode(edges, None, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image_bgr, 0.2

    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    best = contours[0]
    area = cv2.contourArea(best)
    area_ratio = area / float(h * w)

    peri = cv2.arcLength(best, True)
    approx = cv2.approxPolyDP(best, 0.02 * peri, True)

    if len(approx) != 4 or area_ratio < 0.10:
        # Not confident; return original
        return image_bgr, min(0.45, max(0.2, area_ratio))

    pts = approx.reshape(4, 2).astype(np.float32)

    # order points: top-left, top-right, bottom-right, bottom-left
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)

    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]

    ordered = np.array([tl, tr, br, bl], dtype=np.float32)

    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxW = int(max(widthA, widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxH = int(max(heightA, heightB))

    maxW = max(300, maxW)
    maxH = max(420, maxH)

    dst = np.array([[0, 0], [maxW - 1, 0], [maxW - 1, maxH - 1], [0, maxH - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(ordered, dst)
    warped = cv2.warpPerspective(image_bgr, M, (maxW, maxH))

    # confidence based on area ratio and quadrilateral
    conf = float(min(0.95, max(0.55, area_ratio * 3.5)))
    return warped, conf
