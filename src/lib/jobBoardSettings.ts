export interface JobBoardSettings {
  useDirectApify: boolean;
  apifyToken: string;
  linkedinActorId: string;
  careerActorId: string;
}

export const DEFAULT_LINKEDIN_ACTOR_ID = "vIGxjRrHqDTPuE6M4";
export const DEFAULT_CAREER_ACTOR_ID = "s3dtSTZSZWFtAVLn5";

const STORAGE_KEYS = {
  linkedinActor: "jobs.apify_actor_linkedin",
  careerActor: "jobs.apify_actor_career",
};

export function loadJobBoardSettings(): JobBoardSettings {
  if (typeof window === "undefined") {
    return {
      useDirectApify: false,
      apifyToken: "",
      linkedinActorId: DEFAULT_LINKEDIN_ACTOR_ID,
      careerActorId: DEFAULT_CAREER_ACTOR_ID,
    };
  }

  return {
    // Always use shared backend mode for all users.
    useDirectApify: false,
    apifyToken: "",
    linkedinActorId: localStorage.getItem(STORAGE_KEYS.linkedinActor) || DEFAULT_LINKEDIN_ACTOR_ID,
    careerActorId: localStorage.getItem(STORAGE_KEYS.careerActor) || DEFAULT_CAREER_ACTOR_ID,
  };
}

export function saveJobBoardSettings(settings: JobBoardSettings) {
  if (typeof window === "undefined") return;
  // Persist only actor IDs for admin convenience in Settings UI.
  localStorage.setItem(STORAGE_KEYS.linkedinActor, settings.linkedinActorId);
  localStorage.setItem(STORAGE_KEYS.careerActor, settings.careerActorId);
}
