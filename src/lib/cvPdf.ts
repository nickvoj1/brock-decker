import { jsPDF } from "jspdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfJsWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

type WorkExperience = { company: string; title: string; duration?: string };
type Education = { institution: string; degree: string; year?: string };
type RedactionZone = { pageIndex: number; x: number; y: number; width: number; height: number };

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
  const watermarkData = await toDataUrl(branding?.watermarkImageUrl);
  const headerData = await toDataUrl(branding?.headerImageUrl);
  const headerText = safeText(branding?.headerText);

  if (watermarkData) {
    try {
      doc.addImage(watermarkData, "PNG", margin, 18, 90, 28, undefined, "FAST");
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
  return (
    /@/.test(t) ||
    /\b(\+?\d[\d\s().-]{6,})\b/.test(text) ||
    /\b(street|strasse|road|avenue|ave|square|sq|blvd|boulevard|london|munich|berlin|paris|madrid|germany|uk|united kingdom)\b/.test(t) ||
    /\b(linkedin|github|portfolio|website|www\.)\b/.test(t)
  );
}

async function detectPersonalInfoZones(sourceFile: File): Promise<RedactionZone[]> {
  try {
    const bytes = new Uint8Array(await sourceFile.arrayBuffer());
    const loadingTask = getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const zones: RedactionZone[] = [];

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = (textContent.items || []) as any[];

    const itemBoxes = items
      .map((item: any) => {
        const text = String(item.str || "").trim();
        if (!text) return null;
        const tx = item.transform || [1, 0, 0, 1, 0, 0];
        const x = Number(tx[4] || 0);
        const yBottom = Number(tx[5] || 0);
        const h = Math.max(Number(item.height || 0), 8);
        const w = Math.max(Number(item.width || 0), 8);
        const yTop = viewport.height - yBottom - h;
        return { text, x, yTop, w, h };
      })
      .filter(Boolean) as Array<{ text: string; x: number; yTop: number; w: number; h: number }>;

    if (itemBoxes.length === 0) {
      await pdf.destroy();
      return zones;
    }

    const nameCandidate = itemBoxes
      .filter((b) => b.yTop < viewport.height * 0.35 && b.text.split(/\s+/).length >= 2)
      .sort((a, b) => b.h - a.h)[0];

    const topStart = nameCandidate ? nameCandidate.yTop + nameCandidate.h + 4 : viewport.height * 0.09;
    const topEnd = nameCandidate ? Math.min(nameCandidate.yTop + 150, viewport.height * 0.40) : viewport.height * 0.33;

    const matched = itemBoxes.filter((b) => {
      if (b.yTop < topStart || b.yTop > topEnd) return false;
      if (isHeadingLike(b.text)) return false;
      return looksLikePersonalInfo(b.text);
    });

    for (const b of matched) {
      const padX = 8;
      const padY = 4;
      const x = Math.max(0, b.x - padX);
      const yTop = Math.max(0, b.yTop - padY);
      const width = Math.min(viewport.width - x, b.w + padX * 2);
      const height = b.h + padY * 2;

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

export async function downloadBrandedSourcePdf(
  sourceFile: File,
  fileNameBase: string,
  branding?: CVBranding,
): Promise<void> {
  const pdfBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const detectedZones = await detectPersonalInfoZones(sourceFile);
  const watermarkData = await toDataUrl(branding?.watermarkImageUrl);
  const headerData = await toDataUrl(branding?.headerImageUrl);
  const headerText = safeText(branding?.headerText);

  let embeddedWatermark: any = null;
  let embeddedHeader: any = null;

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

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();

    if (idx === 0) {
      // Text-aware redaction for personal info lines under the name.
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
        // Fallback for CVs where text extraction is unavailable.
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

      // Redact common photo area (top-right), preserving all other content.
      page.drawRectangle({
        x: width - 150,
        y: height - 220,
        width: 120,
        height: 140,
        color: rgb(1, 1, 1),
      });
    }

    if (embeddedWatermark) {
      page.drawImage(embeddedWatermark, {
        x: 26,
        y: height - 54,
        width: 90,
        height: 28,
        opacity: 0.7,
      });
    }

    if (embeddedHeader) {
      page.drawImage(embeddedHeader, {
        x: width - 166,
        y: height - 54,
        width: 140,
        height: 28,
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
  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(fileNameBase || "candidate-cv").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
