import { useState, useEffect } from "react";

const PROFILE_NAME_KEY = "apollo-search-profile-name";
const PROFILE_VERIFIED_KEY = "apollo-search-profile-verified";

export function useProfileName() {
  const [profileName, setProfileName] = useState<string>(() => {
    // Only return profile if verified in this session
    const verified = sessionStorage.getItem(PROFILE_VERIFIED_KEY);
    if (verified === "true") {
      return localStorage.getItem(PROFILE_NAME_KEY) || "";
    }
    return "";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const verified = sessionStorage.getItem(PROFILE_VERIFIED_KEY);
      if (verified === "true") {
        const name = localStorage.getItem(PROFILE_NAME_KEY) || "";
        setProfileName(name);
      } else {
        setProfileName("");
      }
    };

    // Listen for storage changes from other components
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    window.addEventListener("profile-name-changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("profile-name-changed", handleStorageChange);
    };
  }, []);

  return profileName;
}
