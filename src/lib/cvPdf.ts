import { jsPDF } from "jspdf";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfJsWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

type WorkExperience = { company: string; title: string; duration?: string };
type Education = { institution: string; degree: string; year?: string };
type RedactionZone = { pageIndex: number; x: number; y: number; width: number; height: number };

type TextBox = {
  text: string;
  x: number;
  yTop: number;
  width: number;
  height: number;
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

export type CVRedactionSettings = {
  hardDeleteEnabled: boolean;
  hardDeleteApiUrl: string;
};

const CV_REDACTION_SETTINGS_KEY = "cv-redaction-settings.v1";
const DEFAULT_CV_REDACTION_SETTINGS: CVRedactionSettings = {
  hardDeleteEnabled: true,
  hardDeleteApiUrl: "/redact",
};

function getDefaultRedactionSettingsFromEnv(): CVRedactionSettings {
  const envUrl = String(import.meta.env.VITE_CV_HARD_DELETE_API_URL || "").trim();
  if (envUrl) {
    return {
      hardDeleteEnabled: true,
      hardDeleteApiUrl: envUrl,
    };
  }
  return DEFAULT_CV_REDACTION_SETTINGS;
}

GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;

export function getCVRedactionSettings(): CVRedactionSettings {
  const envDefaults = getDefaultRedactionSettingsFromEnv();
  if (typeof window === "undefined") return envDefaults;
  try {
    const raw = window.localStorage.getItem(CV_REDACTION_SETTINGS_KEY);
    if (!raw) return envDefaults;
    const parsed = JSON.parse(raw);
    return {
      // Enforce hard-delete mode for CV compliance.
      hardDeleteEnabled: true,
      hardDeleteApiUrl:
        String(parsed?.hardDeleteApiUrl || "").trim() || envDefaults.hardDeleteApiUrl,
    };
  } catch {
    return { ...envDefaults, hardDeleteEnabled: true };
  }
}

export function saveCVRedactionSettings(settings: CVRedactionSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CV_REDACTION_SETTINGS_KEY,
      JSON.stringify({
        hardDeleteEnabled: Boolean(settings.hardDeleteEnabled),
        hardDeleteApiUrl: String(settings.hardDeleteApiUrl || "").trim(),
      }),
    );
  } catch {
    // Ignore localStorage failures.
  }
}

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

function base64ToUint8Array(base64: string): Uint8Array | null {
  const clean = String(base64 || "").trim().replace(/^data:application\/pdf;base64,/i, "");
  if (!clean) return null;
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function looksLikePdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

async function tryHardDeleteWithApi(sourceFile: File, apiUrl: string): Promise<Uint8Array | null> {
  const endpoint = String(apiUrl || "").trim();
  if (!endpoint) return null;

  try {
    const form = new FormData();
    form.append("file", sourceFile, sourceFile.name || "cv.pdf");

    const res = await fetch(endpoint, {
      method: "POST",
      body: form,
    });

    if (!res.ok) return null;

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const payload = await res.json();
      const candidateBase64 =
        payload?.pdfBase64 ||
        payload?.pdf_base64 ||
        payload?.pdf ||
        payload?.data ||
        payload?.file;
      const bytes = base64ToUint8Array(String(candidateBase64 || ""));
      return bytes && looksLikePdfBytes(bytes) ? bytes : null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    return looksLikePdfBytes(bytes) ? bytes : null;
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
  return (
    /@/.test(t) ||
    /\b(\+?\d[\d\s().-]{6,})\b/.test(text) ||
    /\b(street|strasse|road|avenue|ave|square|sq|blvd|boulevard|london|munich|berlin|paris|madrid|germany|uk|united kingdom)\b/.test(t) ||
    /\b(linkedin|github|portfolio|website|www\.)\b/.test(t)
  );
}

function looksLikePersonalLine(lineText: string): boolean {
  const t = lineText.toLowerCase();
  return (
    looksLikePersonalInfo(lineText) ||
    (/^\+?\d/.test(lineText) && /[a-z]/i.test(lineText)) ||
    t.includes(".com") ||
    t.includes(".co.uk") ||
    t.includes("gmail") ||
    t.includes("outlook") ||
    t.includes("yahoo")
  );
}

async function detectPersonalInfoZones(pdfBytes: Uint8Array): Promise<RedactionZone[]> {
  try {
    const loadingTask = getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const zones: RedactionZone[] = [];

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const rawItems = (textContent.items || []) as Array<any>;

    const itemBoxes = rawItems
      .map((item): TextBox | null => {
        const text = String(item?.str || "").trim();
        if (!text) return null;

        const tx = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
        const x = Number(tx[4] || 0);
        const yBottom = Number(tx[5] || 0);
        const h = Math.max(Number(item?.height || 0), 8);
        const w = Math.max(Number(item?.width || 0), 8);
        const yTop = viewport.height - yBottom - h;

        return { text, x, yTop, width: w, height: h };
      })
      .filter(Boolean) as TextBox[];

    if (itemBoxes.length === 0) {
      await pdf.destroy();
      return zones;
    }

    const nameCandidate = itemBoxes
      .filter((b) => b.yTop < viewport.height * 0.35 && b.text.split(/\s+/).length >= 2)
      .sort((a, b) => b.height - a.height)[0];

    const topStart = nameCandidate ? nameCandidate.yTop + nameCandidate.height + 4 : viewport.height * 0.09;
    const topEnd = nameCandidate ? Math.min(nameCandidate.yTop + 150, viewport.height * 0.40) : viewport.height * 0.33;

    const candidateTopItems = itemBoxes
      .filter((b) => b.yTop >= topStart && b.yTop <= topEnd)
      .sort((a, b) => a.yTop - b.yTop || a.x - b.x);

    const lineGroups: TextBox[][] = [];
    const lineThreshold = 3.5;

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

    for (const group of lineGroups) {
      const ordered = group.slice().sort((a, b) => a.x - b.x);
      const lineText = ordered.map((g) => g.text).join(" ").replace(/\s+/g, " ").trim();
      if (!lineText || isHeadingLike(lineText)) continue;
      if (!looksLikePersonalLine(lineText)) continue;

      const minX = Math.min(...ordered.map((i) => i.x));
      const maxX = Math.max(...ordered.map((i) => i.x + i.width));
      const minYTop = Math.min(...ordered.map((i) => i.yTop));
      const maxYTop = Math.max(...ordered.map((i) => i.yTop + i.height));

      const padX = 10;
      const padY = 5;
      const x = Math.max(0, minX - padX);
      const yTop = Math.max(0, minYTop - padY);
      const width = Math.min(viewport.width - x, maxX - minX + padX * 2);
      const height = Math.max(12, maxYTop - minYTop + padY * 2);

      zones.push({
        pageIndex: 0,
        x,
        y: viewport.height - (yTop + height),
        width,
        height,
      });
    }

    await pdf.destroy();
    return zones;
  } catch {
    return [];
  }
}

function drawFallbackPersonalMasks(page: PDFPage, width: number, height: number): void {
  page.drawRectangle({
    x: width * 0.14,
    y: height - 158,
    width: width * 0.72,
    height: 52,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: width * 0.18,
    y: height - 190,
    width: width * 0.64,
    height: 26,
    color: rgb(1, 1, 1),
  });
}

function drawPhotoMask(page: PDFPage, width: number, height: number): void {
  page.drawRectangle({
    x: width - 150,
    y: height - 220,
    width: 120,
    height: 140,
    color: rgb(1, 1, 1),
  });
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
      doc.addImage(watermarkData, "PNG", margin, 20, 62, 18, undefined, "FAST");
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
): Promise<void> {
  const settings = getCVRedactionSettings();

  const originalBytes = new Uint8Array(await sourceFile.arrayBuffer());
  let sourcePdfBytes = originalBytes;
  let usedHardDelete = false;

  if (settings.hardDeleteEnabled && settings.hardDeleteApiUrl) {
    const hardDeleted = await tryHardDeleteWithApi(sourceFile, settings.hardDeleteApiUrl);
    if (hardDeleted) {
      sourcePdfBytes = hardDeleted;
      usedHardDelete = true;
    } else {
      throw new Error(
        "Hard redaction service is unavailable. Personal info cannot be truly deleted right now.",
      );
    }
  }

  const pdfDoc = await PDFDocument.load(sourcePdfBytes);
  const detectedZones = usedHardDelete ? [] : await detectPersonalInfoZones(sourcePdfBytes);

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

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();

    if (idx === 0 && !usedHardDelete) {
      const pageZones = detectedZones.filter((z) => z.pageIndex === 0);
      if (pageZones.length > 0) {
        for (const z of pageZones) {
          page.drawRectangle({
            x: Math.max(0, z.x),
            y: Math.max(0, z.y),
            width: Math.min(width, z.width),
            height: Math.min(height, z.height),
            color: rgb(1, 1, 1),
          });
        }
      } else {
        drawFallbackPersonalMasks(page, width, height);
      }

      drawPhotoMask(page, width, height);
    }

    if (embeddedWatermark) {
      const natural = embeddedWatermark.scale(1);
      const fitted = fitInBox(natural.width, natural.height, 62, 18);
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
  });

  const out = await pdfDoc.save();
  downloadPdfBytes(out, fileNameBase);
}
