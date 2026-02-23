import { afterEach, describe, expect, it, vi } from "vitest";
import mupdf from "mupdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { downloadBrandedSourcePdf } from "@/lib/cvPdf";

const RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF/gL+SXN6SAAAAABJRU5ErkJggg==";

type ExportHints = {
  name: string;
  email: string;
  phone: string;
  anonymizeName: boolean;
  replacementName: string;
};

function decodeBase64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function createSampleCvPdf(withPhoto = false): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  page.drawText("Irina Butenko", {
    x: 210,
    y: 782,
    size: 33,
    font: serifBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText("Breslauer Strabe 3, 80992 Munich", {
    x: 186,
    y: 760,
    size: 11,
    font: serif,
    color: rgb(0.12, 0.12, 0.12),
  });
  page.drawText("+49 152 3724 7346 | irina@example.com", {
    x: 165,
    y: 746,
    size: 11,
    font: serif,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText("WORK EXPERIENCE", {
    x: 50,
    y: 698,
    size: 13,
    font: serifBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText("Raymond James", {
    x: 50,
    y: 676,
    size: 12,
    font: serifBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText("Supported sell-side M&A mandates across Europe.", {
    x: 50,
    y: 660,
    size: 11,
    font: serif,
    color: rgb(0.12, 0.12, 0.12),
  });

  if (withPhoto) {
    const photo = await pdfDoc.embedPng(decodeBase64ToBytes(RED_PNG_BASE64));
    page.drawImage(photo, {
      x: 508,
      y: 710,
      width: 68,
      height: 86,
    });
  }

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}

async function exportBrandedBytes(sourcePdf: Uint8Array, hints: ExportHints): Promise<Uint8Array> {
  let capturedBlob: Blob | null = null;
  const originalCreateObjectUrl = (URL as any).createObjectURL;
  const originalRevokeObjectUrl = (URL as any).revokeObjectURL;
  (URL as any).createObjectURL = (blob: Blob | MediaSource) => {
    capturedBlob = blob as Blob;
    return "blob:cv-test";
  };
  (URL as any).revokeObjectURL = () => {};
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  try {
    const file = {
      name: "input-cv.pdf",
      type: "application/pdf",
      size: sourcePdf.byteLength,
      async arrayBuffer() {
        const stable = new Uint8Array(sourcePdf);
        return stable.buffer.slice(stable.byteOffset, stable.byteOffset + stable.byteLength);
      },
    } as File;
    await downloadBrandedSourcePdf(
      file,
      "input-cv-edited",
      {
        headerText: "59-60 Russell Square, London, WC1B 4HP\ninfo@aclpartners.co.uk",
      },
      hints,
    );
  } finally {
    if (originalCreateObjectUrl) (URL as any).createObjectURL = originalCreateObjectUrl;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectUrl) (URL as any).revokeObjectURL = originalRevokeObjectUrl;
    else delete (URL as any).revokeObjectURL;
    clickSpy.mockRestore();
  }

  if (!capturedBlob) throw new Error("Expected PDF blob to be captured");
  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const out = reader.result;
      if (!(out instanceof ArrayBuffer)) {
        reject(new Error("Expected exported blob to decode to ArrayBuffer"));
        return;
      }
      resolve(new Uint8Array(out));
    };
    reader.onerror = () => reject(new Error("Failed to read exported blob"));
    reader.readAsArrayBuffer(capturedBlob as Blob);
  });
}

function extractPage0State(pdfBytes: Uint8Array): {
  text: string;
  height: number;
  candidateMinY: number | null;
  meanRedPhotoArea: number;
} {
  const mupdfMod: any = (mupdf as any)?.default || mupdf;
  const doc = mupdfMod.Document.openDocument(new Uint8Array(pdfBytes), "application/pdf");
  const pdf = doc.asPDF();
  const page = pdf.loadPage(0);
  const bounds = page.getBounds();
  const width = Number(bounds?.[2] || 0);
  const height = Number(bounds?.[3] || 0);

  const st = JSON.parse(page.toStructuredText().asJSON(1));
  const textLines: string[] = [];
  const blocks = Array.isArray(st?.blocks) ? st.blocks : [];
  for (const block of blocks) {
    if (block?.type !== "text") continue;
    const lines = Array.isArray(block?.lines) ? block.lines : [];
    for (const line of lines) {
      const lineText = String(line?.text || "").replace(/\s+/g, " ").trim();
      if (lineText) textLines.push(lineText);
    }
  }

  let candidateMinY: number | null = null;
  try {
    const hits = page.search("CANDIDATE", 8) as number[][][];
    const ys: number[] = [];
    for (const quadSet of hits || []) {
      for (const q of quadSet || []) {
        if (!Array.isArray(q) || q.length < 8) continue;
        ys.push(Number(q[1]), Number(q[3]), Number(q[5]), Number(q[7]));
      }
    }
    if (ys.length > 0) candidateMinY = Math.min(...ys);
  } catch {
    // Ignore search failures in tests.
  }

  const pix = page.toPixmap([1, 0, 0, 1, 0, 0], mupdfMod.ColorSpace.DeviceRGB, false);
  const pixels = pix.getPixels();
  const stride = Number(pix.getStride() || width * 3);
  const x0 = Math.max(0, Math.floor(width * 0.82));
  const x1 = Math.min(width - 1, Math.floor(width * 0.98));
  const y0 = Math.max(0, Math.floor(height * 0.05));
  const y1 = Math.min(height - 1, Math.floor(height * 0.24));

  let totalR = 0;
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = y * stride + x * 3;
      totalR += pixels[idx];
      count += 1;
    }
  }

  return {
    text: textLines.join("\n"),
    height,
    candidateMinY,
    meanRedPhotoArea: count > 0 ? totalR / count : 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CV PDF export", () => {
  it("removes personal header text while preserving core CV content", async () => {
    const source = await createSampleCvPdf(false);
    const out = await exportBrandedBytes(source, {
      name: "Irina Butenko",
      email: "irina@example.com",
      phone: "+49 152 3724 7346",
      anonymizeName: false,
      replacementName: "CANDIDATE",
    });
    const state = extractPage0State(out);

    expect(state.text).not.toContain("irina@example.com");
    expect(state.text).not.toContain("+49 152");
    expect(state.text).toContain("WORK EXPERIENCE");
    expect(state.text).toContain("Raymond James");
    expect(state.text).toContain("Irina Butenko");
  });

  it("uses anonymized CANDIDATE in the top area when requested", async () => {
    const source = await createSampleCvPdf(false);
    const out = await exportBrandedBytes(source, {
      name: "Irina Butenko",
      email: "irina@example.com",
      phone: "+49 152 3724 7346",
      anonymizeName: true,
      replacementName: "CANDIDATE",
    });
    const state = extractPage0State(out);

    expect(state.text).not.toContain("Irina Butenko");
    expect(state.text).toContain("CANDIDATE");
    expect(state.candidateMinY).not.toBeNull();
    expect(Number(state.candidateMinY)).toBeLessThan(state.height * 0.35);
  });

  it("removes a top-right profile photo image on page 1", async () => {
    const sourceWithPhoto = await createSampleCvPdf(true);
    const sourceState = extractPage0State(sourceWithPhoto);
    const out = await exportBrandedBytes(sourceWithPhoto, {
      name: "Irina Butenko",
      email: "irina@example.com",
      phone: "+49 152 3724 7346",
      anonymizeName: false,
      replacementName: "CANDIDATE",
    });
    const outState = extractPage0State(out);

    // The source has a bright red patch in the top-right photo area.
    expect(sourceState.meanRedPhotoArea).toBeGreaterThan(220);
    // After redaction this area should no longer be strongly red.
    expect(outState.meanRedPhotoArea).toBeLessThan(200);
  });
});
