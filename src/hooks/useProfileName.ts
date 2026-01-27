import { useState, useEffect } from "react";

const PROFILE_NAME_KEY = "apollo-search-profile-name";
const REMEMBER_ME_KEY = "apollo-search-remember-me";

export function useProfileName() {
  const [profileName, setProfileName] = useState<string>(() => {
    const savedRemember = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    if (savedRemember) {
      return localStorage.getItem(PROFILE_NAME_KEY) || "";
    }
    return "";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const name = localStorage.getItem(PROFILE_NAME_KEY) || "";
      setProfileName(name);
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
