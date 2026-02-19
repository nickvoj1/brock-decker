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


def _is_personal_line(text: str) -> bool:
    line = text.strip()
    if not line:
        return False
    low = line.lower()
    return (
        bool(EMAIL_RE.search(line))
        or bool(PHONE_RE.search(line))
        or bool(SITE_RE.search(low))
        or bool(ADDRESS_RE.search(low))
    )


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


def _line_rects_under_name(page: fitz.Page, name_rect: Optional[fitz.Rect]) -> List[fitz.Rect]:
    words = page.get_text("words")
    if not words:
        return []

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
    for _key, parts in grouped.items():
        parts.sort(key=lambda p: p[0])
        line_text = " ".join(p[4] for p in parts).strip()
        if not _is_personal_line(line_text):
            continue

        x0 = min(p[0] for p in parts) - 10
        y0 = min(p[1] for p in parts) - 4
        x1 = max(p[2] for p in parts) + 10
        y1 = max(p[3] for p in parts) + 4
        rects.append(fitz.Rect(x0, y0, x1, y1))

    return rects


def _fallback_personal_masks(page: fitz.Page) -> List[fitz.Rect]:
    w = page.rect.width
    h = page.rect.height
    return [
        fitz.Rect(w * 0.14, h - 158, w * 0.86, h - 106),
        fitz.Rect(w * 0.18, h - 190, w * 0.82, h - 164),
    ]


def _photo_mask(page: fitz.Page) -> fitz.Rect:
    w = page.rect.width
    h = page.rect.height
    return fitz.Rect(w - 150, h - 220, w - 30, h - 80)


def redact_cv_bytes(input_pdf: bytes) -> bytes:
    doc = fitz.open(stream=input_pdf, filetype="pdf")
    if doc.page_count == 0:
        raise ValueError("PDF has no pages")

    page = doc[0]
    name_rect = _name_anchor(page)
    line_rects = _line_rects_under_name(page, name_rect)
    if not line_rects:
        line_rects = _fallback_personal_masks(page)

    # Personal lines under name
    for rect in line_rects:
        page.add_redact_annot(rect, fill=(1, 1, 1))

    # Common photo area (top-right)
    page.add_redact_annot(_photo_mask(page), fill=(1, 1, 1))

    # Apply true redaction: removes text objects in redacted areas.
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_REMOVE,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
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
