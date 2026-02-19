export function normalizeCandidateName(input: unknown): string {
  const raw = String(input || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  // Keep known placeholders untouched.
  if (/^(unknown|not specified|could not parse)$/i.test(raw)) {
    return raw;
  }

  let name = raw;

  // Convert "LAST, FIRST" into "FIRST LAST" when safe.
  const commaParts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length === 2 && !/[()]/.test(name)) {
    const leftWordCount = commaParts[0].split(/\s+/).filter(Boolean).length;
    const rightWordCount = commaParts[1].split(/\s+/).filter(Boolean).length;
    if (leftWordCount <= 3 && rightWordCount <= 3) {
      name = `${commaParts[1]} ${commaParts[0]}`.replace(/\s+/g, " ").trim();
    }
  }

  const hasLower = /[a-z]/.test(name);
  const hasUpper = /[A-Z]/.test(name);
  const shouldFixCase = hasUpper && !hasLower;

  const fixWord = (w: string): string => {
    if (w.length <= 1) return w;
    if (!/[A-Z]/.test(w) || /[a-z]/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  };

  const fixToken = (token: string): string =>
    token.replace(/[A-Za-z]+/g, (word) => fixWord(word));

  if (shouldFixCase) {
    name = name.split(" ").map(fixToken).join(" ");
  } else {
    // Fix mixed names where one part is all-caps surname, e.g. "Hugo PERGHER".
    name = name
      .split(" ")
      .map((token) => {
        const lettersOnly = token.replace(/[^A-Za-z]/g, "");
        if (lettersOnly.length >= 3 && lettersOnly === lettersOnly.toUpperCase()) {
          return fixToken(token);
        }
        return token;
      })
      .join(" ");
  }

  return name.replace(/\s+/g, " ").trim();
}
