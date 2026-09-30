/** First letter of the first two words that start with a letter or digit, uppercased. */
export function getInitials(title: string): string {
  const words = title.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  const initials = words
    .slice(0, 2)
    .map((w) => Array.from(w)[0].toLocaleUpperCase("en-US"))
    .join("");
  if (initials) return initials;
  // Fallback for titles with no word starting on a letter/digit, e.g. "…" or "!!!".
  const first = Array.from(title.trim())[0];
  return first ? first.toLocaleUpperCase("en-US") : "?";
}

/** djb2 hash of the title mod 8, mapped to 1..8. */
export function coverTone(title: string): number {
  let hash = 5381;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) + hash + title.charCodeAt(i)) >>> 0;
  }
  return (hash % 8) + 1;
}
