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
          if (r.y1 > pageHeight * 0.33) continue;
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
      .filter((l) => l.y < pageHeight * 0.24 && l.h >= 12 && looksLikeNameLine(l.text, l.x, l.w, pageWidth))
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

  // Detect likely profile photo images in top-right from structured text image blocks.
  try {
    const stJsonRaw = page.toStructuredText().asJSON(1);
    const st = JSON.parse(stJsonRaw);
    const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
    for (const b of blocks) {
      if (b?.type !== "image") continue;
      const bb = b?.bbox || {};
      const x = Number(bb.x || 0);
      const y = Number(bb.y || 0);
      const w = Number(bb.w || 0);
      const h = Number(bb.h || 0);
      if (w < 50 || h < 60) continue;
      if (x < pageWidth * 0.55 || y > pageHeight * 0.45) continue;
      const r = clampRect({ x0: x, y0: y, x1: x + w, y1: y + h }, pageWidth, pageHeight);
      if (r) rects.push(r);
    }
  } catch {
    // Ignore image detection issues.
  }

  let uniqueRects = dedupeRects(rects).filter((r) => r.y0 < pageHeight * 0.42);
  uniqueRects = protectRectsFromName(uniqueRects, nameRects, pageWidth, pageHeight);
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
  uniqueRects = protectRectsFromName(uniqueRects, nameRects, pageWidth, pageHeight);

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

  page.applyRedactions(
    false,
    page.REDACT_IMAGE_PIXELS,
    page.REDACT_LINE_ART_NONE,
    page.REDACT_TEXT_REMOVE,
  );

  const out = pdf.saveToBuffer("compress");
  const raw = out.asUint8Array();
  const stable = new Uint8Array(raw.length);
  stable.set(raw);
  return stable;
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
  const headerData = await trimTransparentDataUrl(await toDataUrl(branding?.headerImageUrl));
  const headerText = safeText(branding?.headerText);

  if (watermarkData) {
    try {
      doc.addImage(watermarkData, "PNG", margin, 20, 92, 24, undefined, "FAST");
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
  const detectedZones = await detectPersonalInfoZones(new Uint8Array(originalBytes));
  const hardDeletedBytes = await redactPdfTextLocally(originalBytes, detectedZones, hints);

  const pdfDoc = await PDFDocument.load(hardDeletedBytes);
  const watermarkData = await trimTransparentDataUrl(await toDataUrl(branding?.watermarkImageUrl));
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
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    if (embeddedWatermark) {
      const natural = embeddedWatermark.scale(1);
      const fitted = fitInBox(natural.width, natural.height, 92, 24);
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
  }

  const out = await pdfDoc.save();
  downloadPdfBytes(out, fileNameBase);
}
