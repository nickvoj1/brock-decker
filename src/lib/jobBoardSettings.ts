export interface JobBoardSettings {
  useDirectApify: boolean;
  apifyToken: string;
  linkedinActorId: string;
  careerActorId: string;
}

export const DEFAULT_LINKEDIN_ACTOR_ID = "vIGxjRrHqDTPuE6M4";
export const DEFAULT_CAREER_ACTOR_ID = "s3dtSTZSZWFtAVLn5";

const STORAGE_KEYS = {
  mode: "jobs.use_direct_apify",
  token: "jobs.apify_token",
  linkedinActor: "jobs.apify_actor_linkedin",
  careerActor: "jobs.apify_actor_career",
};

export function loadJobBoardSettings(): JobBoardSettings {
  if (typeof window === "undefined") {
    return {
      // Default to backend/shared mode so all users can use centrally saved credentials.
      useDirectApify: false,
      apifyToken: "",
      linkedinActorId: DEFAULT_LINKEDIN_ACTOR_ID,
      careerActorId: DEFAULT_CAREER_ACTOR_ID,
    };
  }

  return {
    // Use direct mode only when explicitly enabled for this browser.
    useDirectApify: localStorage.getItem(STORAGE_KEYS.mode) === "true",
    apifyToken: localStorage.getItem(STORAGE_KEYS.token) || "",
    linkedinActorId: localStorage.getItem(STORAGE_KEYS.linkedinActor) || DEFAULT_LINKEDIN_ACTOR_ID,
    careerActorId: localStorage.getItem(STORAGE_KEYS.careerActor) || DEFAULT_CAREER_ACTOR_ID,
  };
}

export function saveJobBoardSettings(settings: JobBoardSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.mode, String(settings.useDirectApify));
  localStorage.setItem(STORAGE_KEYS.token, settings.apifyToken);
  localStorage.setItem(STORAGE_KEYS.linkedinActor, settings.linkedinActorId);
  localStorage.setItem(STORAGE_KEYS.careerActor, settings.careerActorId);
}
