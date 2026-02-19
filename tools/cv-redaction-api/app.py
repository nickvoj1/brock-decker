from __future__ import annotations

import re
from typing import List, Optional, Tuple

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="CV Redaction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}")
SITE_RE = re.compile(r"(linkedin|github|www\.|\.com\b|\.co\.uk\b)", re.IGNORECASE)
ADDRESS_RE = re.compile(
    r"\b(street|strasse|road|avenue|ave|square|blvd|boulevard|london|munich|berlin|paris|madrid|germany|uk|united kingdom)\b",
    re.IGNORECASE,
)
HAS_NUMBER_RE = re.compile(r"\d")


def _is_personal_line(text: str) -> Tuple[bool, bool]:
    line = text.strip()
    if not line:
        return False, False
    low = line.lower()
    has_email = bool(EMAIL_RE.search(line))
    has_phone = bool(PHONE_RE.search(line))
    has_site = bool(SITE_RE.search(low))
    has_address = bool(ADDRESS_RE.search(low)) and bool(HAS_NUMBER_RE.search(line))
    matched = has_email or has_phone or has_site or has_address
    strong = has_email or has_phone or has_site
    return matched, strong


def _name_anchor(page: fitz.Page) -> Optional[fitz.Rect]:
    text_dict = page.get_text("dict")
    best_rect: Optional[fitz.Rect] = None
    best_score = -1.0
    max_top = page.rect.height * 0.38

    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = str(span.get("text", "")).strip()
                if not text:
                    continue
                bbox = fitz.Rect(span.get("bbox", [0, 0, 0, 0]))
                if bbox.y0 > max_top:
                    continue
                if len(text.split()) < 2:
                    continue
                size = float(span.get("size", 0.0))
                score = size * (1.15 if text[0].isupper() else 1.0)
                if score > best_score:
                    best_score = score
                    best_rect = bbox

    return best_rect


def _line_rects_under_name(page: fitz.Page, name_rect: Optional[fitz.Rect]) -> Tuple[List[fitz.Rect], int]:
    words = page.get_text("words")
    if not words:
        return [], 0

    if name_rect is not None:
        y_start = name_rect.y1 + 2
        y_end = min(name_rect.y1 + 160, page.rect.height * 0.45)
    else:
        y_start = page.rect.height * 0.08
        y_end = page.rect.height * 0.33

    grouped: dict[Tuple[int, int], list] = {}
    for word in words:
        x0, y0, x1, y1, text, block_no, line_no, _word_no = word
        if y0 < y_start or y1 > y_end:
            continue
        grouped.setdefault((int(block_no), int(line_no)), []).append((float(x0), float(y0), float(x1), float(y1), str(text)))

    rects: List[fitz.Rect] = []
    strong_hits = 0
    for _key, parts in grouped.items():
        parts.sort(key=lambda p: p[0])
        line_text = " ".join(p[4] for p in parts).strip()
        matched, strong = _is_personal_line(line_text)
        if not matched:
            continue
        if strong:
            strong_hits += 1

        x0 = min(p[0] for p in parts) - 10
        y0 = min(p[1] for p in parts) - 4
        x1 = max(p[2] for p in parts) + 10
        y1 = max(p[3] for p in parts) + 4
        rects.append(fitz.Rect(x0, y0, x1, y1))

    rects.sort(key=lambda r: (r.y0, r.x0))
    return rects[:3], strong_hits


def _detect_photo_masks(page: fitz.Page) -> List[fitz.Rect]:
    # Detect likely profile photo image blocks near top-right; avoid static broad masks.
    masks: List[fitz.Rect] = []
    seen: set[Tuple[int, int, int, int]] = set()
    min_x = page.rect.width * 0.55
    max_y = page.rect.height * 0.45

    for img in page.get_images(full=True):
        xref = int(img[0])
        rects = page.get_image_rects(xref)
        for rect in rects:
            r = fitz.Rect(rect)
            if r.x0 < min_x or r.y0 > max_y:
                continue
            if r.width < 55 or r.height < 70:
                continue
            key = (int(r.x0), int(r.y0), int(r.x1), int(r.y1))
            if key in seen:
                continue
            seen.add(key)
            masks.append(r)

    return masks


def redact_cv_bytes(input_pdf: bytes) -> bytes:
    doc = fitz.open(stream=input_pdf, filetype="pdf")
    if doc.page_count == 0:
        raise ValueError("PDF has no pages")

    page = doc[0]
    name_rect = _name_anchor(page)
    line_rects, strong_hits = _line_rects_under_name(page, name_rect)
    if not line_rects or strong_hits == 0:
        doc.close()
        raise ValueError("No high-confidence personal-info line found under candidate name.")

    photo_rects = _detect_photo_masks(page)
    all_rects = line_rects + photo_rects
    total_area = sum(max(0.0, r.width) * max(0.0, r.height) for r in all_rects)
    coverage = total_area / max(1.0, page.rect.width * page.rect.height)
    if coverage > 0.08:
        doc.close()
        raise ValueError("Redaction coverage too large; aborting to avoid deleting CV content.")

    # Personal lines under name
    for rect in all_rects:
        page.add_redact_annot(rect, fill=(1, 1, 1))

    # Apply true redaction: removes text objects in redacted areas.
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )

    out = doc.tobytes(garbage=4, clean=True, deflate=True)
    doc.close()
    return out


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/redact")
async def redact(file: UploadFile = File(...)) -> Response:
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if not filename.endswith(".pdf") and "pdf" not in content_type:
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    source_bytes = await file.read()
    if not source_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        out = redact_cv_bytes(source_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Redaction failed: {exc}") from exc

    return Response(
        content=out,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=redacted-cv.pdf"},
    )
