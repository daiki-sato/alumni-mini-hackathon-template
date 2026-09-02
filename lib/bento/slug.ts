const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** URL に載せる識別子。読み間違えやすい文字（l, o, 0, 1）は除いてある。 */
export function generateSlug(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
