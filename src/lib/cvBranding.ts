export type PresetKey = "acl_partners" | "everet_marsh" | "brock_decker";

export type CVBrandingPreset = {
  label: string;
  watermarkImageUrl: string | null;
  headerImageUrl: string | null;
  headerText: string;
};

export const CV_BRANDING_STORAGE_KEY = "cv-branding-assets.v1";

export const CV_BRANDING_PRESETS: Record<PresetKey, CVBrandingPreset> = {
  acl_partners: {
    label: "ACL Partners",
    watermarkImageUrl: "/cv-branding/presets/acl_watermark.png",
    headerImageUrl: null,
    headerText: "59-60 Russell Square, London, WC1B 4HP\ninfo@aclpartners.co.uk",
  },
  everet_marsh: {
    label: "Everet Marsh",
    watermarkImageUrl: "/cv-branding/presets/everet_watermark.png",
    headerImageUrl: "/cv-branding/presets/everet_header.png",
    headerText: "59-60 Russell Square, London, WC1B 4HP\ninfo@everetmarsh.com",
  },
  brock_decker: {
    label: "Brock & Decker",
    watermarkImageUrl: "/cv-branding/presets/brock_watermark.png",
    headerImageUrl: null,
    headerText: "Brock & Decker",
  },
};

export function normalizePresetKey(input: unknown): PresetKey {
  if (input === "acl_partners" || input === "brock_decker" || input === "everet_marsh") {
    return input;
  }
  if (input === "everett_marsh") return "everet_marsh";
  return "acl_partners";
}

export function getStoredBrandingPreset(): PresetKey {
  if (typeof window === "undefined") return "acl_partners";
  try {
    const raw = window.localStorage.getItem(CV_BRANDING_STORAGE_KEY);
    if (!raw) return "acl_partners";
    const parsed = JSON.parse(raw);
    return normalizePresetKey(parsed?.selectedPreset);
  } catch {
    return "acl_partners";
  }
}

export function setStoredBrandingPreset(preset: PresetKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CV_BRANDING_STORAGE_KEY, JSON.stringify({ selectedPreset: preset }));
  } catch {
    // Ignore localStorage failures.
  }
}

export function getBrandingForPreset(preset: PresetKey): CVBrandingPreset {
  return CV_BRANDING_PRESETS[preset] || CV_BRANDING_PRESETS.acl_partners;
}

