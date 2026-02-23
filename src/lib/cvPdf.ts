import { jsPDF } from "jspdf";
import mupdf from "mupdf";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfJsWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

type WorkExperience = { company: string; title: string; duration?: string };
type Education = { institution: string; degree: string; year?: string };
type RedactionZone = {
  pageIndex: number;
  x: number;
  yTop: number;
  width: number;
  height: number;
};

type NamePlacement = {
  xCenter: number;
  yTop: number;
  boxWidth: number;
  boxHeight: number;
};

type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type CandidateForPdf = {
  name: string;
  current_title?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
  skills?: string[];
  work_history?: WorkExperience[];
  education?: Education[];
};

export type CVBranding = {
  watermarkImageUrl?: string | null;
  headerImageUrl?: string | null;
  headerText?: string | null;
};

export type CVPersonalHints = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  anonymizeName?: boolean;
  replacementName?: string | null;
};

GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;

async function toDataUrl(urlOrData?: string | null): Promise<string | null> {
  const raw = String(urlOrData || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;
  try {
    const res = await fetch(raw);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image blob"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function safeText(value?: string | null): string {
  return String(value || "").trim();
}

function getWatermarkBox(watermarkImageUrl?: string | null): { maxW: number; maxH: number } {
  const key = String(watermarkImageUrl || "").toLowerCase();
  if (key.includes("brock") || key.includes("decker")) {
    // Brock mark should be visible but not oversized.
    return { maxW: 100, maxH: 30 };
  }
  if (key.includes("everet") || key.includes("everett")) {
    // Everet mark is naturally compact; render slightly larger for readability.
    return { maxW: 110, maxH: 30 };
  }
  return { maxW: 92, maxH: 24 };
}

function fitInBox(sourceW: number, sourceH: number, maxW: number, maxH: number): { width: number; height: number } {
  const w = Number(sourceW || 0);
  const h = Number(sourceH || 0);
  if (w <= 0 || h <= 0) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / w, maxH / h);
  return { width: w * scale, height: h * scale };
}

async function trimTransparentDataUrl(dataUrl?: string | null): Promise<string | null> {
  const raw = String(dataUrl || "").trim();
  if (!raw.startsWith("data:image/") || typeof document === "undefined") return raw || null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Failed to load image"));
      i.src = raw;
    });

    const w = Math.max(1, Math.floor(img.naturalWidth || img.width));
    const h = Math.max(1, Math.floor(img.naturalHeight || img.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha < 8) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < 0 || maxY < 0) return raw;

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    if (cropW <= 0 || cropH <= 0) return raw;
    if (cropW === w && cropH === h) return raw;

    const out = document.createElement("canvas");
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext("2d");
    if (!outCtx) return raw;

    outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return out.toDataURL("image/png");
  } catch {
    return raw || null;
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const i = dataUrl.indexOf(",");
  if (i < 0) return null;
  const b64 = dataUrl.slice(i + 1);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
    return out;
  } catch {
    return null;
  }
}

function isHeadingLike(text: string): boolean {
  const stripped = text.replace(/[^A-Za-z]/g, "");
  if (!stripped) return false;
  return stripped.length >= 5 && stripped === stripped.toUpperCase();
}

function looksLikePersonalInfo(text: string): boolean {
  const t = text.toLowerCase();
  const compact = text.replace(/\s+/g, " ").trim();
  const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(compact);
  const hasWeb = /\b(linkedin|github|website|www\.|gmail|outlook|yahoo)\b|\. ?com\b|\. ?co\. ?uk\b/.test(t);
  const hasAddress = /\b(street|strasse|straße|road|avenue|ave|square|blvd|boulevard|postal|postcode|zip)\b/.test(t);
  const hasPostalAddress = /\b\d{4,6}\b/.test(compact) && /,/.test(compact) && /[a-z]/i.test(compact);

  const phoneChunkRegex = /(\+?\d[\d\s().-]{6,}\d)/g;
  const phoneChunks = [...compact.matchAll(phoneChunkRegex)].map((m) => m[1]);
  const hasPhone = phoneChunks.some((chunk) => {
    const digits = chunk.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return false;
    const hasPlus = chunk.trim().startsWith("+");
    const hasParens = /[()]/.test(chunk);
    const hasSeparators = /[\s.-]/.test(chunk);
    const looksLikeYearRange = /^\d{4}\s*[-–—]\s*\d{2,4}$/u.test(chunk.trim());
    return !looksLikeYearRange && (hasPlus || hasParens || hasSeparators);
  });

  return (
    hasEmail ||
    hasPhone ||
    hasWeb ||
    hasAddress ||
    hasPostalAddress
  );
}

function uniqueSearchTerms(hints?: CVPersonalHints): string[] {
  const out: string[] = [];
  const add = (v?: string | null) => {
    const t = String(v || "").trim();
    if (!t) return;
    if (t.length < 5) return;
    if (!out.includes(t)) out.push(t);
    const compact = t.replace(/\s+/g, "");
    if (compact.length >= 5 && !out.includes(compact)) out.push(compact);

    if (t.includes("@")) {
      const [local, domain] = t.split("@");
      if (local && local.length >= 4 && !out.includes(local)) out.push(local);
      if (domain && domain.length >= 4 && !out.includes(domain)) out.push(domain);
    } else {
      const digits = t.replace(/\D/g, "");
      if (digits.length >= 8 && !out.includes(digits)) out.push(digits);
    }
  };
  add(hints?.email);
  add(hints?.phone);
  return out;
}

function normalizeComparable(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "").replace(/[|,;:()[\]{}<>]/g, "");
}

function looksLikeNameLine(text: string, x: number, width: number, pageWidth: number): boolean {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (compact.length < 5 || compact.length > 64) return false;
  if (compact.includes("@")) return false;
  if (/\d/.test(compact)) return false;
  if (/[|/\\]/.test(compact)) return false;
  if (/,/.test(compact)) return false;
  const words = compact.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  const mostlyLetters = words.every((w) => /^[A-Za-z.'-]+$/.test(w));
  if (!mostlyLetters) return false;

  const centerX = x + width / 2;
  const distanceFromCenter = Math.abs(centerX - pageWidth / 2);
  return distanceFromCenter <= pageWidth * 0.3;
}

function clampRect(rect: Rect, width: number, height: number): Rect | null {
  const x0 = Math.max(0, Math.min(width, rect.x0));
  const y0 = Math.max(0, Math.min(height, rect.y0));
  const x1 = Math.max(0, Math.min(width, rect.x1));
  const y1 = Math.max(0, Math.min(height, rect.y1));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  return { x0, y0, x1, y1 };
}

function rectArea(r: Rect): number {
  return Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
}

function topDistanceForRect(rect: Rect, pageHeight: number): number {
  const topByTopOrigin = rect.y0;
  const topByBottomOrigin = Math.max(0, pageHeight - rect.y1);
  return Math.min(topByTopOrigin, topByBottomOrigin);
}

function topDistanceForLine(y: number, h: number, pageHeight: number): number {
  const topByTopOrigin = y;
  const topByBottomOrigin = Math.max(0, pageHeight - (y + h));
  return Math.min(topByTopOrigin, topByBottomOrigin);
}

function quadsToRects(quads: number[][], padX = 6, padY = 3): Rect[] {
  const rects: Rect[] = [];
  for (const q of quads) {
    if (!Array.isArray(q) || q.length < 8) continue;
    const xs = [q[0], q[2], q[4], q[6]];
    const ys = [q[1], q[3], q[5], q[7]];
    const minX = Math.min(...xs) - padX;
    const maxX = Math.max(...xs) + padX;
    const minY = Math.min(...ys) - padY;
    const maxY = Math.max(...ys) + padY;
    rects.push({ x0: minX, y0: minY, x1: maxX, y1: maxY });
  }
  return rects;
}

function dedupeRects(rects: Rect[], tolerance = 2): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    const exists = out.some((e) =>
      Math.abs(e.x0 - r.x0) <= tolerance &&
      Math.abs(e.y0 - r.y0) <= tolerance &&
      Math.abs(e.x1 - r.x1) <= tolerance &&
      Math.abs(e.y1 - r.y1) <= tolerance,
    );
    if (!exists) out.push(r);
  }
  return out;
}

function mergeRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x0 = rects[0].x0;
  let y0 = rects[0].y0;
  let x1 = rects[0].x1;
  let y1 = rects[0].y1;
  for (const r of rects.slice(1)) {
    if (r.x0 < x0) x0 = r.x0;
    if (r.y0 < y0) y0 = r.y0;
    if (r.x1 > x1) x1 = r.x1;
    if (r.y1 > y1) y1 = r.y1;
  }
  return { x0, y0, x1, y1 };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function findNameProtectionRects(
  page: any,
  pageWidth: number,
  pageHeight: number,
  hints?: CVPersonalHints,
): Rect[] {
  const out: Rect[] = [];

  const nameSeed = safeText(hints?.name);
  const nameTerms = new Set<string>();
  const addNameTerm = (v?: string | null) => {
    const t = safeText(v);
    if (t.length >= 4) nameTerms.add(t);
  };

  addNameTerm(nameSeed);
  if (nameSeed) {
    addNameTerm(nameSeed.replace(/[(),]/g, " ").replace(/\s+/g, " "));
    const compactWords = nameSeed
      .replace(/[(),]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);
    if (compactWords.length >= 2) {
      addNameTerm(compactWords.slice(0, 2).join(" "));
      addNameTerm(compactWords.slice(-2).join(" "));
    }
  }

  for (const term of nameTerms) {
    try {
      const hits = page.search(term, 12) as number[][][];
      if (!Array.isArray(hits)) continue;
      for (const quadSet of hits) {
        const hitRects = quadsToRects(Array.isArray(quadSet) ? quadSet : [], 4, 3);
        for (const hr of hitRects) {
          const r = clampRect(hr, pageWidth, pageHeight);
          if (!r) continue;
          if (topDistanceForRect(r, pageHeight) > pageHeight * 0.33) continue;
          out.push(r);
        }
      }
    } catch {
      // Ignore search issues.
    }
  }

  try {
    const stJsonRaw = page.toStructuredText().asJSON(1);
    const st = JSON.parse(stJsonRaw);
    const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
    const lines: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];
    for (const block of blocks) {
      if (block?.type !== "text") continue;
      const blockLines = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of blockLines) {
        const bb = line?.bbox || {};
        const text = String(line?.text || "").replace(/\s+/g, " ").trim();
        const x = Number(bb.x || 0);
        const y = Number(bb.y || 0);
        const w = Number(bb.w || 0);
        const h = Number(bb.h || 0);
        if (!text || w <= 0 || h <= 0) continue;
        lines.push({ x, y, w, h, text });
      }
    }

    const nameLike = lines
      .filter(
        (l) =>
          topDistanceForLine(l.y, l.h, pageHeight) < pageHeight * 0.24 &&
          l.h >= 12 &&
          looksLikeNameLine(l.text, l.x, l.w, pageWidth),
      )
      .sort((a, b) => b.h - a.h || a.y - b.y)[0];

    if (nameLike) {
      const r = clampRect(
        {
          x0: nameLike.x - 8,
          y0: nameLike.y - 4,
          x1: nameLike.x + nameLike.w + 8,
          y1: nameLike.y + nameLike.h + 4,
        },
        pageWidth,
        pageHeight,
      );
      if (r) out.push(r);
    }
  } catch {
    // Ignore structured text parsing issues.
  }

  return dedupeRects(out, 3);
}

function protectRectsFromName(
  rects: Rect[],
  nameRects: Rect[],
  pageWidth: number,
  pageHeight: number,
): Rect[] {
  if (nameRects.length === 0) return rects;
  const nameBottom = Math.max(...nameRects.map((r) => r.y1));
  const protectedRects: Rect[] = [];
  for (const r of rects) {
    const overlapsName = nameRects.some((n) => intersects(r, n));
    if (!overlapsName) {
      protectedRects.push(r);
      continue;
    }
    const moved = clampRect(
      { x0: r.x0, y0: Math.max(r.y0, nameBottom + 3), x1: r.x1, y1: r.y1 },
      pageWidth,
      pageHeight,
    );
    if (moved) protectedRects.push(moved);
  }
  return dedupeRects(protectedRects, 2);
}

function pickPrimaryNameRect(nameRects: Rect[], pageWidth: number, pageHeight: number): Rect | null {
  const candidates = nameRects.filter((r) => {
    if (topDistanceForRect(r, pageHeight) > pageHeight * 0.35) return false;
    return rectArea(r) >= 40;
  });
  if (candidates.length === 0) return null;

  const sorted = candidates.sort((a, b) => {
    const topDiff = topDistanceForRect(a, pageHeight) - topDistanceForRect(b, pageHeight);
    if (Math.abs(topDiff) > 0.5) return topDiff;
    const areaDiff = rectArea(b) - rectArea(a);
    if (Math.abs(areaDiff) > 0.5) return areaDiff;
    const centerA = Math.abs((a.x0 + a.x1) / 2 - pageWidth / 2);
    const centerB = Math.abs((b.x0 + b.x1) / 2 - pageWidth / 2);
    if (Math.abs(centerA - centerB) > 0.5) return centerA - centerB;
    return a.y0 - b.y0;
  });

  return sorted[0] || null;
}

function detectNamePlacementFromPdf(sourcePdfBytes: Uint8Array, hints?: CVPersonalHints): NamePlacement | null {
  try {
    const mupdfMod: any = (mupdf as any)?.default || mupdf;
    if (!mupdfMod?.Document?.openDocument) return null;

    const inputBytes = new Uint8Array(sourcePdfBytes);
    const doc = mupdfMod.Document.openDocument(inputBytes, "application/pdf");
    const pdf = doc?.asPDF?.();
    if (!pdf) return null;

    const page = pdf.loadPage(0);
    const bounds = page.getBounds();
    const pageWidth = Number(bounds?.[2] || 0);
    const pageHeight = Number(bounds?.[3] || 0);
    if (!pageWidth || !pageHeight) return null;

    const nameRects = findNameProtectionRects(page, pageWidth, pageHeight, hints);
    const bestRect = pickPrimaryNameRect(nameRects, pageWidth, pageHeight);
    if (!bestRect) return null;
    const topY = Math.min(bestRect.y0, bestRect.y1);
    const bottomY = Math.max(bestRect.y0, bestRect.y1);
    if (topDistanceForRect(bestRect, pageHeight) > pageHeight * 0.52) return null;

    return {
      xCenter: (bestRect.x0 + bestRect.x1) / 2,
      yTop: topY,
      boxWidth: Math.max(16, bestRect.x1 - bestRect.x0),
      boxHeight: Math.max(10, bottomY - topY),
    };
  } catch {
    return null;
  }
}

function findStructuredTopContactRects(
  page: any,
  pageWidth: number,
  pageHeight: number,
  hints?: CVPersonalHints,
): Rect[] {
  try {
    const stJsonRaw = page.toStructuredText().asJSON(1);
    const st = JSON.parse(stJsonRaw);
    const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
    const lines: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];

    for (const block of blocks) {
      if (block?.type !== "text") continue;
      const blockLines = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of blockLines) {
        const bb = line?.bbox || {};
        const text = String(line?.text || "").replace(/\s+/g, " ").trim();
        const x = Number(bb.x || 0);
        const y = Number(bb.y || 0);
        const w = Number(bb.w || 0);
        const h = Number(bb.h || 0);
        if (!text || w <= 0 || h <= 0) continue;
        lines.push({ x, y, w, h, text });
      }
    }

    if (lines.length === 0) return [];

    const topLimit = pageHeight * 0.36;
    const topLines = lines.filter((l) => l.y <= topLimit).sort((a, b) => a.y - b.y || a.x - b.x);
    if (topLines.length === 0) return [];

    const heading = topLines.find((l) => l.y > 40 && isHeadingLike(l.text));
    const headingY = heading ? heading.y : pageHeight * 0.24;
    const nameLine = topLines
      .filter((l) => l.y < Math.min(110, headingY) && l.text.split(/\s+/).length >= 2)
      .sort((a, b) => b.h - a.h)[0];

    const termNorms = uniqueSearchTerms(hints)
      .map((x) => normalizeComparable(x))
      .filter((x) => x.length >= 4);

    const out: Rect[] = [];
    for (const l of topLines) {
      if (l.y > headingY + 2) continue;
      if (nameLine && Math.abs(l.y - nameLine.y) <= 1.5 && Math.abs(l.x - nameLine.x) <= 1.5) continue;

      const normLine = normalizeComparable(l.text);
      const fuzzyHintMatch = termNorms.some((term) => normLine.includes(term) || term.includes(normLine));
      const personal = looksLikePersonalInfo(l.text) || fuzzyHintMatch;
      if (!personal) continue;

      const rect = clampRect(
        { x0: l.x - 8, y0: l.y - 4, x1: l.x + l.w + 8, y1: l.y + l.h + 4 },
        pageWidth,
        pageHeight,
      );
      if (rect) out.push(rect);
    }

    return out;
  } catch {
    return [];
  }
}

function findHeaderBandFallbackRect(
  page: any,
  pageWidth: number,
  pageHeight: number,
  nameFloorY?: number,
): Rect | null {
  const centerX0 = Math.max(24, Math.floor(pageWidth * 0.18));
  const centerX1 = Math.min(pageWidth - 24, Math.ceil(pageWidth * 0.82));
  const yFloor = Math.max(84, Math.floor((nameFloorY || 0) + 4));
  const defaultRect = clampRect(
    {
      x0: centerX0,
      y0: yFloor,
      x1: centerX1,
      y1: Math.min(Math.max(yFloor + 40, 150), pageHeight * 0.34),
    },
    pageWidth,
    pageHeight,
  );

  try {
    const stJsonRaw = page.toStructuredText().asJSON(1);
    const st = JSON.parse(stJsonRaw);
    const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
    const lines: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];

    for (const block of blocks) {
      if (block?.type !== "text") continue;
      const blockLines = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of blockLines) {
        const bb = line?.bbox || {};
        const text = String(line?.text || "").replace(/\s+/g, " ").trim();
        const x = Number(bb.x || 0);
        const y = Number(bb.y || 0);
        const w = Number(bb.w || 0);
        const h = Number(bb.h || 0);
        if (!text || w <= 0 || h <= 0) continue;
        lines.push({ x, y, w, h, text });
      }
    }

    if (lines.length === 0) return defaultRect;

    const topLines = lines
      .filter((l) => l.y < pageHeight * 0.42)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    if (topLines.length === 0) return defaultRect;

    const nameLine = topLines
      .filter(
        (l) =>
          l.y < pageHeight * 0.24 &&
          l.h >= 12 &&
          !isHeadingLike(l.text) &&
          looksLikeNameLine(l.text, l.x, l.w, pageWidth),
      )
      .sort((a, b) => b.h - a.h || a.y - b.y)[0];

    const heading = topLines
      .filter((l) => isHeadingLike(l.text) && (!nameLine || l.y > nameLine.y + 16))
      .sort((a, b) => a.y - b.y)[0];

    const y0Base = nameLine
      ? nameLine.y + nameLine.h + 2
      : Math.max(58, topLines[0].y + topLines[0].h + 2);
    const y0 = Math.max(yFloor, y0Base);

    const y1Raw = heading ? heading.y - 3 : y0 + 72;
    const y1 = Math.min(y1Raw, pageHeight * 0.34);
    if (y1 <= y0 + 8) return defaultRect;

    return clampRect({ x0: centerX0, y0, x1: centerX1, y1 }, pageWidth, pageHeight) || defaultRect;
  } catch {
    return defaultRect;
  }
}

type StructuredLine = { x: number; y: number; w: number; h: number; text: string };

function extractStructuredLines(page: any): StructuredLine[] {
  try {
    const stJsonRaw = page.toStructuredText().asJSON(1);
    const st = JSON.parse(stJsonRaw);
    const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
    const lines: StructuredLine[] = [];
    for (const block of blocks) {
      if (block?.type !== "text") continue;
      const blockLines = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of blockLines) {
        const bb = line?.bbox || {};
        const text = String(line?.text || "").replace(/\s+/g, " ").trim();
        const x = Number(bb.x || 0);
        const y = Number(bb.y || 0);
        const w = Number(bb.w || 0);
        const h = Number(bb.h || 0);
        if (!text || w <= 0 || h <= 0) continue;
        lines.push({ x, y, w, h, text });
      }
    }
    return lines;
  } catch {
    return [];
  }
}

function bboxLikeToRect(raw: any, pageWidth: number, pageHeight: number): Rect | null {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.length >= 4) {
    return clampRect(
      {
        x0: Number(raw[0] || 0),
        y0: Number(raw[1] || 0),
        x1: Number(raw[2] || 0),
        y1: Number(raw[3] || 0),
      },
      pageWidth,
      pageHeight,
    );
  }

  if (typeof raw === "object") {
    const x = Number(raw.x ?? raw.x0 ?? 0);
    const y = Number(raw.y ?? raw.y0 ?? 0);
    const w = Number(raw.w ?? (raw.x1 != null && raw.x0 != null ? raw.x1 - raw.x0 : 0) ?? 0);
    const h = Number(raw.h ?? (raw.y1 != null && raw.y0 != null ? raw.y1 - raw.y0 : 0) ?? 0);

    if (w > 0 && h > 0) {
      return clampRect({ x0: x, y0: y, x1: x + w, y1: y + h }, pageWidth, pageHeight);
    }

    const x0 = Number(raw.x0 ?? x);
    const y0 = Number(raw.y0 ?? y);
    const x1 = Number(raw.x1 ?? x0);
    const y1 = Number(raw.y1 ?? y0);
    return clampRect({ x0, y0, x1, y1 }, pageWidth, pageHeight);
  }

  return null;
}

function matrixToRect(matrix: any, pageWidth: number, pageHeight: number, scaleX = 1, scaleY = 1): Rect | null {
  if (!Array.isArray(matrix) || matrix.length < 6) return null;
  const a = Number(matrix[0] || 0);
  const b = Number(matrix[1] || 0);
  const c = Number(matrix[2] || 0);
  const d = Number(matrix[3] || 0);
  const e = Number(matrix[4] || 0);
  const f = Number(matrix[5] || 0);

  const corners: Array<[number, number]> = [
    [0, 0],
    [scaleX, 0],
    [0, scaleY],
    [scaleX, scaleY],
  ];

  const xs: number[] = [];
  const ys: number[] = [];
  for (const [u, v] of corners) {
    xs.push(a * u + c * v + e);
    ys.push(b * u + d * v + f);
  }

  return clampRect(
    {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
    },
    pageWidth,
    pageHeight,
  );
}

function collectImageRects(page: any, pageWidth: number, pageHeight: number): Rect[] {
  const rects: Rect[] = [];

  try {
    const stPage = page.toStructuredText();
    if (stPage?.walk) {
      stPage.walk({
        onImageBlock: (bbox: any, transform: any, image: any) => {
          const boxRect = bboxLikeToRect(bbox, pageWidth, pageHeight);
          if (boxRect) rects.push(boxRect);

          const unitRect = matrixToRect(transform, pageWidth, pageHeight, 1, 1);
          if (unitRect && rectArea(unitRect) >= 6) rects.push(unitRect);

          try {
            const iw = Number(image?.getWidth?.() || 0);
            const ih = Number(image?.getHeight?.() || 0);
            if (iw > 0 && ih > 0) {
              const pixelRect = matrixToRect(transform, pageWidth, pageHeight, iw, ih);
              if (pixelRect && rectArea(pixelRect) >= 6) rects.push(pixelRect);
            }
          } catch {
            // Ignore image dimension extraction issues.
          }
        },
      });
    }
  } catch {
    // Ignore StructuredText walk issues.
  }

  try {
    const stJsonRaw = page.toStructuredText().asJSON(1);
    const st = JSON.parse(stJsonRaw);
    const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
    for (const b of blocks) {
      const type = String(b?.type || "").toLowerCase();
      if (type !== "image" && !type.includes("img")) continue;
      const r = bboxLikeToRect(b?.bbox, pageWidth, pageHeight);
      if (r) rects.push(r);
    }
  } catch {
    // Ignore asJSON image parsing issues.
  }

  return dedupeRects(rects, 3);
}

function detectPhotoImageRectsFromImageRects(imageRects: Rect[], pageWidth: number, pageHeight: number): Rect[] {
  const rects: Rect[] = [];
  for (const r of imageRects) {
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    if (w < 28 || h < 28) continue;

    const areaRatio = (w * h) / Math.max(1, pageWidth * pageHeight);
    const aspect = w / Math.max(1, h);
    const topDist = Math.min(Math.max(0, r.y0), Math.max(0, pageHeight - r.y1));
    const leftDist = Math.max(0, r.x0);
    const rightDist = Math.max(0, pageWidth - r.x1);
    const nearTop = topDist <= pageHeight * 0.42;
    const nearSide = leftDist <= pageWidth * 0.28 || rightDist <= pageWidth * 0.28;
    const veryNearSide = leftDist <= pageWidth * 0.16 || rightDist <= pageWidth * 0.16;

    const profileLike =
      aspect >= 0.5 &&
      aspect <= 1.85 &&
      areaRatio >= 0.004 &&
      areaRatio <= 0.22;

    const topCornerLike =
      nearTop &&
      nearSide &&
      aspect >= 0.33 &&
      aspect <= 2.5 &&
      areaRatio >= 0.0025 &&
      areaRatio <= 0.24;

    const edgePhotoLike =
      veryNearSide &&
      aspect >= 0.42 &&
      aspect <= 2.2 &&
      areaRatio >= 0.005 &&
      areaRatio <= 0.26;

    if (!profileLike && !topCornerLike && !edgePhotoLike) continue;

    const padded = clampRect(
      { x0: r.x0 - 2, y0: r.y0 - 2, x1: r.x1 + 2, y1: r.y1 + 2 },
      pageWidth,
      pageHeight,
    );
    if (padded) rects.push(padded);
  }
  return dedupeRects(rects, 3);
}

function detectPhotoRectFromPixels(page: any, pageWidth: number, pageHeight: number): Rect | null {
  try {
    const mupdfMod: any = (mupdf as any)?.default || mupdf;
    const colorspace = mupdfMod?.ColorSpace?.DeviceRGB;
    const pix = page.toPixmap([1, 0, 0, 1, 0, 0], colorspace, false);
    const w = Number(pix?.getWidth?.() || 0);
    const h = Number(pix?.getHeight?.() || 0);
    const stride = Number(pix?.getStride?.() || 0);
    const pixels: Uint8Array = pix?.getPixels?.();
    if (!w || !h || !stride || !pixels || pixels.length < stride * h) return null;

    const scanX0 = Math.max(0, Math.floor(w * 0.62));
    const scanX1 = Math.min(w - 1, Math.floor(w * 0.99));
    const scanY0 = Math.max(0, Math.floor(h * 0.02));
    const scanY1 = Math.min(h - 1, Math.floor(h * 0.46));
    if (scanX1 <= scanX0 || scanY1 <= scanY0) return null;

    const regionW = scanX1 - scanX0 + 1;
    const regionH = scanY1 - scanY0 + 1;
    const visited = new Uint8Array(regionW * regionH);
    const idx = (x: number, y: number) => (y - scanY0) * regionW + (x - scanX0);

    const isPhotoPixel = (x: number, y: number): boolean => {
      const p = y * stride + x * 3;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      // Focus on non-white, non-nearly-transparent-looking rendered pixels.
      return r < 242 || g < 242 || b < 242;
    };

    let best: Rect | null = null;
    let bestScore = -1;
    const stackX: number[] = [];
    const stackY: number[] = [];

    for (let y = scanY0; y <= scanY1; y++) {
      for (let x = scanX0; x <= scanX1; x++) {
        const vIndex = idx(x, y);
        if (visited[vIndex]) continue;
        visited[vIndex] = 1;
        if (!isPhotoPixel(x, y)) continue;

        stackX.length = 0;
        stackY.length = 0;
        stackX.push(x);
        stackY.push(y);

        let area = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;

        while (stackX.length > 0) {
          const cx = stackX.pop() as number;
          const cy = stackY.pop() as number;
          area += 1;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < scanX0 || nx > scanX1 || ny < scanY0 || ny > scanY1) continue;
              const nIndex = idx(nx, ny);
              if (visited[nIndex]) continue;
              visited[nIndex] = 1;
              if (!isPhotoPixel(nx, ny)) continue;
              stackX.push(nx);
              stackY.push(ny);
            }
          }
        }

        const compW = maxX - minX + 1;
        const compH = maxY - minY + 1;
        const aspect = compW / Math.max(1, compH);
        const compArea = compW * compH;

        if (area < 1100) continue;
        if (compArea < 1600) continue;
        if (compW < 36 || compH < 48) continue;
        if (aspect < 0.38 || aspect > 2.35) continue;

        const nearRightScore = maxX / Math.max(1, w);
        const nearTopScore = 1 - minY / Math.max(1, h);
        const score = area + nearRightScore * 600 + nearTopScore * 350;
        if (score <= bestScore) continue;

        bestScore = score;
        best = clampRect(
          {
            x0: minX - 3,
            y0: minY - 3,
            x1: maxX + 3,
            y1: maxY + 3,
          },
          pageWidth,
          pageHeight,
        );
      }
    }

    return best;
  } catch {
    return null;
  }
}

function findPhotoFallbackRect(page: any, pageWidth: number, pageHeight: number): Rect | null {
  const candidates: Rect[] = [];

  const topOriginCandidate = clampRect(
    {
      x0: pageWidth * 0.78,
      y0: pageHeight * 0.06,
      x1: pageWidth * 0.985,
      y1: pageHeight * 0.34,
    },
    pageWidth,
    pageHeight,
  );
  const bottomOriginCandidate = clampRect(
    {
      x0: pageWidth * 0.78,
      y0: pageHeight * 0.66,
      x1: pageWidth * 0.985,
      y1: pageHeight * 0.94,
    },
    pageWidth,
    pageHeight,
  );

  if (topOriginCandidate) candidates.push(topOriginCandidate);
  if (bottomOriginCandidate) candidates.push(bottomOriginCandidate);
  if (candidates.length === 0) return null;

  const lines = extractStructuredLines(page);
  if (lines.length === 0) return candidates[0] || null;

  let best: { rect: Rect; score: number } | null = null;
  for (const candidate of candidates) {
    const score = lines
      .filter((l) =>
        intersects(
          candidate,
          { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h },
        ),
      )
      .reduce((sum, l) => sum + Math.min(32, l.text.length), 0);

    if (!best || score < best.score) best = { rect: candidate, score };
  }

  if (!best) return null;
  if (best.score > 44) return null;
  return best.rect;
}

function detectPhotoImageRects(page: any, pageWidth: number, pageHeight: number, includeFallback = false): Rect[] {
  const imageRects = collectImageRects(page, pageWidth, pageHeight);
  if (imageRects.length === 0) {
    if (!includeFallback) return [];
    const pixelFallbackOnly = detectPhotoRectFromPixels(page, pageWidth, pageHeight);
    if (pixelFallbackOnly) return [pixelFallbackOnly];
    const geoFallbackOnly = findPhotoFallbackRect(page, pageWidth, pageHeight);
    return geoFallbackOnly ? [geoFallbackOnly] : [];
  }
  const photoRects = detectPhotoImageRectsFromImageRects(imageRects, pageWidth, pageHeight);
  if (photoRects.length > 0) return photoRects;
  if (!includeFallback) return [];
  const pixelFallback = detectPhotoRectFromPixels(page, pageWidth, pageHeight);
  if (pixelFallback) return [pixelFallback];
  const fallback = findPhotoFallbackRect(page, pageWidth, pageHeight);
  return fallback ? [fallback] : [];
}

function resolveAnonymizedNameBaselineY(
  placement: NamePlacement | null,
  pageHeight: number,
  fontSize: number,
): number {
  const fallbackTop = pageHeight - 88;
  if (!placement) return fallbackTop;

  const boxOffset = Math.max(0, (placement.boxHeight - fontSize) / 2);
  const assumeTopOrigin = pageHeight - (placement.yTop + placement.boxHeight) + boxOffset;
  const assumeBottomOrigin = placement.yTop + boxOffset;
  const candidates = [assumeTopOrigin, assumeBottomOrigin].filter(
    (y) => Number.isFinite(y) && y > pageHeight * 0.52 && y < pageHeight - 20,
  );

  if (candidates.length === 0) return fallbackTop;
  return candidates.sort((a, b) => Math.abs(a - fallbackTop) - Math.abs(b - fallbackTop))[0];
}

async function detectPersonalInfoZones(pdfBytes: Uint8Array): Promise<RedactionZone[]> {
  try {
    // Use an isolated copy so PDF.js processing cannot detach buffers needed later.
    const analysisBytes = new Uint8Array(pdfBytes);
    const loadingTask = getDocument({ data: analysisBytes, disableWorker: true });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = (textContent.items || []) as any[];

    const itemBoxes = items
      .map((item) => {
        const text = String(item?.str || "").trim();
        if (!text) return null;
        const tx = item?.transform || [1, 0, 0, 1, 0, 0];
        const x = Number(tx[4] || 0);
        const yBottom = Number(tx[5] || 0);
        const h = Math.max(Number(item?.height || 0), 8);
        const w = Math.max(Number(item?.width || 0), 8);
        const yTop = viewport.height - yBottom - h;
        return { text, x, yTop, width: w, height: h };
      })
      .filter(Boolean) as Array<{ text: string; x: number; yTop: number; width: number; height: number }>;

    if (itemBoxes.length === 0) {
      await pdf.destroy();
      return [];
    }

    const nameCandidate = itemBoxes
      .filter((b) => b.yTop < viewport.height * 0.35 && b.text.split(/\s+/).length >= 2)
      .sort((a, b) => b.height - a.height)[0];

    const topStart = nameCandidate ? nameCandidate.yTop + nameCandidate.height + 4 : viewport.height * 0.09;
    const topEnd = nameCandidate
      ? Math.min(nameCandidate.yTop + 96, viewport.height * 0.28)
      : viewport.height * 0.24;

    const candidateTopItems = itemBoxes
      .filter((b) => b.yTop >= topStart && b.yTop <= topEnd)
      .sort((a, b) => a.yTop - b.yTop || a.x - b.x);

    const lineGroups: Array<Array<{ text: string; x: number; yTop: number; width: number; height: number }>> = [];
    const lineThreshold = 3.8;

    for (const b of candidateTopItems) {
      const current = lineGroups[lineGroups.length - 1];
      if (!current) {
        lineGroups.push([b]);
        continue;
      }
      const baseline = current.reduce((sum, item) => sum + item.yTop, 0) / current.length;
      if (Math.abs(b.yTop - baseline) <= lineThreshold) {
        current.push(b);
      } else {
        lineGroups.push([b]);
      }
    }

    const zones: RedactionZone[] = [];
    for (const group of lineGroups) {
      const ordered = group.slice().sort((a, b) => a.x - b.x);
      const lineText = ordered.map((g) => g.text).join(" ").replace(/\s+/g, " ").trim();
      if (!lineText || isHeadingLike(lineText)) continue;
      if (!looksLikePersonalInfo(lineText)) continue;

      const minX = Math.min(...ordered.map((i) => i.x));
      const maxX = Math.max(...ordered.map((i) => i.x + i.width));
      const minYTop = Math.min(...ordered.map((i) => i.yTop));
      const maxYTop = Math.max(...ordered.map((i) => i.yTop + i.height));

      const padX = 10;
      const padY = 5;
      zones.push({
        pageIndex: 0,
        x: Math.max(0, minX - padX),
        yTop: Math.max(0, minYTop - padY),
        width: Math.max(4, maxX - minX + padX * 2),
        height: Math.max(12, maxYTop - minYTop + padY * 2),
      });
    }

    await pdf.destroy();
    return zones.slice(0, 5);
  } catch {
    return [];
  }
}

async function redactPdfTextLocally(
  sourcePdfBytes: Uint8Array,
  detectedZones: RedactionZone[],
  hints?: CVPersonalHints,
): Promise<Uint8Array> {
  const mupdfMod: any = (mupdf as any)?.default || mupdf;
  if (!mupdfMod?.Document?.openDocument) {
    throw new Error("CV redaction engine failed to load. Refresh and try again.");
  }

  // Use a stable copy to avoid detached/out-of-bounds ArrayBuffer issues.
  const inputBytes = new Uint8Array(sourcePdfBytes);
  const doc = mupdfMod.Document.openDocument(inputBytes, "application/pdf");
  const pdf = doc.asPDF();
  if (!pdf) {
    throw new Error("Failed to open PDF for redaction.");
  }

  const page = pdf.loadPage(0);
  const bounds = page.getBounds();
  const pageWidth = Number(bounds?.[2] || 0);
  const pageHeight = Number(bounds?.[3] || 0);
  const anonymizeName = Boolean(hints?.anonymizeName);
  if (!pageWidth || !pageHeight) {
    throw new Error("Invalid PDF page bounds.");
  }

  const rects: Rect[] = [];

  for (const z of detectedZones.filter((z) => z.pageIndex === 0)) {
    const r = clampRect(
      { x0: z.x, y0: z.yTop, x1: z.x + z.width, y1: z.yTop + z.height },
      pageWidth,
      pageHeight,
    );
    if (!r) continue;
    if (r.y0 > pageHeight * 0.45) continue;
    rects.push(r);
  }

  const terms = uniqueSearchTerms(hints);
  for (const term of terms) {
    try {
      const hits = page.search(term, 20) as number[][][];
      if (!Array.isArray(hits)) continue;
      for (const quadSet of hits) {
        const hitRects = quadsToRects(Array.isArray(quadSet) ? quadSet : []);
        for (const hr of hitRects) {
          const r = clampRect(hr, pageWidth, pageHeight);
          if (!r) continue;
          if (r.y0 > pageHeight * 0.45) continue;
          rects.push(r);
        }
      }
    } catch {
      // Ignore term search issues for this term.
    }
  }

  // Fallback: detect personal lines from MuPDF structured text (same engine used for deletion).
  rects.push(...findStructuredTopContactRects(page, pageWidth, pageHeight, hints));

  const nameRects = findNameProtectionRects(page, pageWidth, pageHeight, hints);
  const nameBottom = nameRects.length > 0 ? Math.max(...nameRects.map((r) => r.y1)) : 0;
  if (anonymizeName) {
    const manualNameSearchTerms = new Set<string>();
    const hintedName = safeText(hints?.name);
    if (hintedName) {
      manualNameSearchTerms.add(hintedName);
      manualNameSearchTerms.add(hintedName.toLowerCase());
      manualNameSearchTerms.add(hintedName.toUpperCase());
      for (const token of hintedName.split(/\s+/).filter((t) => t.length >= 3)) {
        manualNameSearchTerms.add(token);
      }
    }
    for (const term of manualNameSearchTerms) {
      try {
        const hits = page.search(term, 28) as number[][][];
        if (!Array.isArray(hits)) continue;
        for (const quadSet of hits) {
          const hitRects = quadsToRects(Array.isArray(quadSet) ? quadSet : [], 6, 4);
          for (const hr of hitRects) {
            const r = clampRect(hr, pageWidth, pageHeight);
            if (!r) continue;
            if (topDistanceForRect(r, pageHeight) > pageHeight * 0.42) continue;
            rects.push(r);
          }
        }
      } catch {
        // Ignore manual name search errors.
      }
    }

    rects.push(...nameRects);

    // Enforce full name removal by adding a broader kill-band around the detected name zone.
    const mergedName = mergeRects(
      rects.filter((r) => topDistanceForRect(r, pageHeight) <= pageHeight * 0.42),
    );
    const defaultNameBand = clampRect(
      {
        x0: pageWidth * 0.2,
        y0: pageHeight * 0.02,
        x1: pageWidth * 0.8,
        y1: pageHeight * 0.16,
      },
      pageWidth,
      pageHeight,
    );
    const nameKillBand = mergedName
      ? clampRect(
          {
            x0: mergedName.x0 - 8,
            y0: mergedName.y0 - 6,
            x1: mergedName.x1 + 8,
            y1: mergedName.y1 + 6,
          },
          pageWidth,
          pageHeight,
        )
      : defaultNameBand;
    if (nameKillBand) rects.push(nameKillBand);
  }

  // Remove photo-like images from page 1.
  rects.push(...detectPhotoImageRects(page, pageWidth, pageHeight, true));

  let uniqueRects = dedupeRects(rects).filter((r) => r.y0 < pageHeight * 0.42);
  if (!anonymizeName) {
    uniqueRects = protectRectsFromName(uniqueRects, nameRects, pageWidth, pageHeight);
  }
  if (uniqueRects.length === 0) {
    const fallbackBand = findHeaderBandFallbackRect(page, pageWidth, pageHeight, nameBottom);
    if (fallbackBand) uniqueRects = [fallbackBand];
  }

  if (uniqueRects.length === 0) {
    throw new Error("Could not detect personal header lines to delete.");
  }

  const totalArea = uniqueRects.reduce((sum, r) => sum + rectArea(r), 0);
  const coverage = totalArea / Math.max(1, pageWidth * pageHeight);
  if (coverage > 0.11) {
    const fallbackBand = findHeaderBandFallbackRect(page, pageWidth, pageHeight, nameBottom);
    if (fallbackBand) uniqueRects = [fallbackBand];
  }
  if (!anonymizeName) {
    uniqueRects = protectRectsFromName(uniqueRects, nameRects, pageWidth, pageHeight);
  }

  const guardedArea = uniqueRects.reduce((sum, r) => sum + rectArea(r), 0);
  const guardedCoverage = guardedArea / Math.max(1, pageWidth * pageHeight);
  if (guardedCoverage > 0.2) {
    throw new Error("Redaction area is unexpectedly large. Export stopped.");
  }

  for (const r of uniqueRects) {
    const annot = page.createAnnotation("Redact");
    annot.setRect([r.x0, r.y0, r.x1, r.y1]);
    annot.update();
  }

  page.applyRedactions();

  // Remove photo-like images from all remaining pages as well.
  const pageCount = Number(pdf.countPages() || 1);
  for (let idx = 1; idx < pageCount; idx++) {
    try {
      const p = pdf.loadPage(idx);
      const b = p.getBounds();
      const w = Number(b?.[2] || 0);
      const h = Number(b?.[3] || 0);
      if (!w || !h) continue;
      const photoRects = detectPhotoImageRects(p, w, h, false);
      if (photoRects.length === 0) continue;
      for (const r of photoRects) {
        const annot = p.createAnnotation("Redact");
        annot.setRect([r.x0, r.y0, r.x1, r.y1]);
        annot.update();
      }
      p.applyRedactions();
    } catch {
      // Ignore per-page image redaction failures.
    }
  }

  const out = pdf.saveToBuffer("compress");
  const raw = out.asUint8Array();
  const stable = new Uint8Array(raw.length);
  stable.set(raw);
  return stable;
}

function stripResidualNameFromPdf(pdfBytes: Uint8Array, originalName?: string | null): Uint8Array {
  const name = safeText(originalName);
  if (!name) return pdfBytes;

  try {
    const mupdfMod: any = (mupdf as any)?.default || mupdf;
    const doc = mupdfMod.Document.openDocument(new Uint8Array(pdfBytes), "application/pdf");
    const pdf = doc?.asPDF?.();
    if (!pdf) return pdfBytes;

    const page = pdf.loadPage(0);
    const bounds = page.getBounds();
    const pageWidth = Number(bounds?.[2] || 0);
    const pageHeight = Number(bounds?.[3] || 0);
    if (!pageWidth || !pageHeight) return pdfBytes;

    const searchTerms = new Set<string>([name]);
    for (const token of name.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 3)) {
      searchTerms.add(token);
    }

    const rects: Rect[] = [];
    for (const term of searchTerms) {
      try {
        const hits = page.search(term, 24) as number[][][];
        if (!Array.isArray(hits)) continue;
        for (const quadSet of hits) {
          const hitRects = quadsToRects(Array.isArray(quadSet) ? quadSet : [], 5, 4);
          for (const hr of hitRects) {
            const r = clampRect(hr, pageWidth, pageHeight);
            if (!r) continue;
            if (topDistanceForRect(r, pageHeight) > pageHeight * 0.42) continue;
            rects.push(r);
          }
        }
      } catch {
        // Ignore per-term search failure.
      }
    }

    const unique = dedupeRects(rects, 2);
    if (unique.length === 0) return pdfBytes;

    for (const r of unique) {
      const annot = page.createAnnotation("Redact");
      annot.setRect([r.x0, r.y0, r.x1, r.y1]);
      annot.update();
    }
    page.applyRedactions();

    const out = pdf.saveToBuffer("compress").asUint8Array();
    const stable = new Uint8Array(out.length);
    stable.set(out);
    return stable;
  } catch {
    return pdfBytes;
  }
}

function downloadPdfBytes(bytes: Uint8Array, fileNameBase: string): void {
  const safeName = (fileNameBase || "candidate-cv").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadCandidatePdf(
  candidate: CandidateForPdf,
  fileNameBase: string,
  branding?: CVBranding,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const watermarkData = await trimTransparentDataUrl(await toDataUrl(branding?.watermarkImageUrl));
  const watermarkBox = getWatermarkBox(branding?.watermarkImageUrl);
  const headerData = await trimTransparentDataUrl(await toDataUrl(branding?.headerImageUrl));
  const headerText = safeText(branding?.headerText);

  if (watermarkData) {
    try {
      doc.addImage(
        watermarkData,
        "PNG",
        margin,
        20,
        watermarkBox.maxW,
        watermarkBox.maxH,
        undefined,
        "FAST",
      );
    } catch {
      // Ignore non-critical image errors.
    }
  }

  if (headerData) {
    try {
      doc.addImage(headerData, "PNG", pageW - margin - 140, 18, 140, 28, undefined, "FAST");
    } catch {
      // Ignore non-critical image errors.
    }
  } else if (headerText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = headerText.split("\n").map((x) => x.trim()).filter(Boolean);
    let y = 25;
    for (const line of lines) {
      doc.text(line, pageW - margin, y, { align: "right" });
      y += 10;
    }
  }

  let y = 82;
  doc.setFont("times", "normal");
  doc.setFontSize(24);
  doc.text(safeText(candidate.name) || "Candidate Name", pageW / 2, y, { align: "center" });
  y += 18;

  const contactParts = [safeText(candidate.current_title), safeText(candidate.location), safeText(candidate.email), safeText(candidate.phone)].filter(Boolean);
  if (contactParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(contactParts.join(" | "), pageW / 2, y, { align: "center" });
    y += 24;
  } else {
    y += 10;
  }

  const ensureSpace = (needed = 40) => {
    if (y + needed < pageH - margin) return;
    doc.addPage();
    y = margin;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(30);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text(title.toUpperCase(), margin, y);
    y += 8;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  if (safeText(candidate.summary)) {
    addSectionTitle("Summary");
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const wrapped = doc.splitTextToSize(safeText(candidate.summary), contentW);
    for (const line of wrapped) {
      ensureSpace(16);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 8;
  }

  if (Array.isArray(candidate.work_history) && candidate.work_history.length > 0) {
    addSectionTitle("Work & Leadership Experience");
    for (const job of candidate.work_history) {
      ensureSpace(36);
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(safeText(job.company), margin, y);
      const duration = safeText(job.duration);
      if (duration) {
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(duration, pageW - margin, y, { align: "right" });
      }
      y += 14;
      doc.setFont("times", "italic");
      doc.setFontSize(10);
      if (safeText(job.title)) {
        doc.text(safeText(job.title), margin, y);
        y += 12;
      }
      y += 4;
    }
  }

  if (Array.isArray(candidate.education) && candidate.education.length > 0) {
    addSectionTitle("Education");
    for (const edu of candidate.education) {
      ensureSpace(28);
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.text(safeText(edu.institution), margin, y);
      const year = safeText(edu.year);
      if (year) doc.text(year, pageW - margin, y, { align: "right" });
      y += 13;
      doc.setFont("times", "italic");
      doc.setFontSize(10);
      doc.text(safeText(edu.degree), margin, y);
      y += 14;
    }
  }

  if (Array.isArray(candidate.skills) && candidate.skills.length > 0) {
    addSectionTitle("Skills");
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(candidate.skills.filter(Boolean).join(", "), contentW);
    for (const line of wrapped) {
      ensureSpace(15);
      doc.text(line, margin, y);
      y += 13;
    }
  }

  const safeName = (fileNameBase || "candidate-cv").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  doc.save(`${safeName}.pdf`);
}

export async function downloadBrandedSourcePdf(
  sourceFile: File,
  fileNameBase: string,
  branding?: CVBranding,
  hints?: CVPersonalHints,
): Promise<void> {
  const originalBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const namePlacement = hints?.anonymizeName
    ? detectNamePlacementFromPdf(new Uint8Array(originalBytes), hints)
    : null;
  const detectedZones = await detectPersonalInfoZones(new Uint8Array(originalBytes));
  let hardDeletedBytes = await redactPdfTextLocally(originalBytes, detectedZones, hints);
  if (hints?.anonymizeName) {
    hardDeletedBytes = stripResidualNameFromPdf(hardDeletedBytes, hints?.name);
  }

  const pdfDoc = await PDFDocument.load(hardDeletedBytes);
  const watermarkData = await trimTransparentDataUrl(await toDataUrl(branding?.watermarkImageUrl));
  const watermarkBox = getWatermarkBox(branding?.watermarkImageUrl);
  const headerData = await trimTransparentDataUrl(await toDataUrl(branding?.headerImageUrl));
  const headerText = safeText(branding?.headerText);

  let embeddedWatermark: PDFImage | null = null;
  let embeddedHeader: PDFImage | null = null;

  if (watermarkData) {
    const bytes = dataUrlToUint8Array(watermarkData);
    if (bytes) {
      try {
        embeddedWatermark = watermarkData.includes("image/jpeg")
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes);
      } catch {
        embeddedWatermark = null;
      }
    }
  }

  if (headerData) {
    const bytes = dataUrlToUint8Array(headerData);
    if (bytes) {
      try {
        embeddedHeader = headerData.includes("image/jpeg")
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes);
      } catch {
        embeddedHeader = null;
      }
    }
  }

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    if (embeddedWatermark) {
      const natural = embeddedWatermark.scale(1);
      const fitted = fitInBox(natural.width, natural.height, watermarkBox.maxW, watermarkBox.maxH);
      page.drawImage(embeddedWatermark, {
        x: 26,
        y: height - 24 - fitted.height,
        width: fitted.width,
        height: fitted.height,
        opacity: 0.92,
      });
    }

    if (embeddedHeader) {
      const natural = embeddedHeader.scale(1);
      const fitted = fitInBox(natural.width, natural.height, 146, 32);
      page.drawImage(embeddedHeader, {
        x: width - 26 - fitted.width,
        y: height - 24 - fitted.height,
        width: fitted.width,
        height: fitted.height,
      });
    } else if (headerText) {
      const lines = headerText.split("\n").map((x) => x.trim()).filter(Boolean);
      let y = height - 18;
      for (const line of lines) {
        const textWidth = helvetica.widthOfTextAtSize(line, 8);
        page.drawText(line, {
          x: width - 26 - textWidth,
          y,
          size: 8,
          font: helvetica,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= 10;
      }
    }

    if (hints?.anonymizeName && pageIndex === 0) {
      const replacement = safeText(hints?.replacementName) || "CANDIDATE";
      const hasPlacement =
        Boolean(namePlacement) &&
        Number.isFinite(namePlacement?.yTop) &&
        Number.isFinite(namePlacement?.boxHeight);
      let size = namePlacement
        ? Math.min(24, Math.max(11, namePlacement.boxHeight * 0.78))
        : 16;
      let textWidth = helveticaBold.widthOfTextAtSize(replacement, size);
      if (hasPlacement) {
        const maxAllowedWidth = Math.max(44, namePlacement!.boxWidth - 4);
        while (textWidth > maxAllowedWidth && size > 10) {
          size -= 1;
          textWidth = helveticaBold.widthOfTextAtSize(replacement, size);
        }
      }
      const desiredX = hasPlacement ? namePlacement!.xCenter - textWidth / 2 : (width - textWidth) / 2;
      const desiredY = resolveAnonymizedNameBaselineY(hasPlacement ? namePlacement! : null, height, size);
      page.drawText(replacement, {
        x: Math.max(26, Math.min(width - 26 - textWidth, desiredX)),
        y: Math.max(26, Math.min(height - 42, desiredY)),
        size,
        font: helveticaBold,
        color: rgb(0.09, 0.09, 0.09),
      });
    }
  }

  const out = await pdfDoc.save();
  downloadPdfBytes(out, fileNameBase);
}
