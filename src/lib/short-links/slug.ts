import { RESERVED_SLUGS } from "./reserved-slugs";

export const SLUG_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const DEFAULT_SLUG_LENGTH = 4;
export const MIN_SLUG_LENGTH = 4;
export const MAX_SLUG_LENGTH = 16;
export const SLUG_EXPANSION_THRESHOLD_PERCENT = 10;

export function normalizeSlugLength(value: unknown) {
  const length = Number(value);
  return Number.isInteger(length) &&
    length >= MIN_SLUG_LENGTH &&
    length <= MAX_SLUG_LENGTH
    ? length
    : DEFAULT_SLUG_LENGTH;
}

export function getSlugCapacity(length: number) {
  const safeLength = normalizeSlugLength(length);
  const reserved = Array.from(RESERVED_SLUGS).filter(
    (slug) => slug.length === safeLength && /^[A-Za-z0-9]+$/.test(slug),
  ).length;
  return BigInt(SLUG_ALPHABET.length) ** BigInt(safeLength) - BigInt(reserved);
}

export function getSlugExpansionThreshold(length: number) {
  return (
    (getSlugCapacity(length) * BigInt(SLUG_EXPANSION_THRESHOLD_PERCENT)) /
    BigInt(100)
  );
}
export function isValidSlug(slug: string) {
  return (
    /^[A-Za-z0-9]{4,32}$/.test(slug) && !RESERVED_SLUGS.has(slug.toLowerCase())
  );
}

export function generateShortSlug(length = DEFAULT_SLUG_LENGTH) {
  const safeLength = normalizeSlugLength(length);
  while (true) {
    let slug = "";
    while (slug.length < safeLength) {
      const bytes = crypto.getRandomValues(new Uint8Array(safeLength));
      for (const byte of bytes) {
        if (byte >= 248) continue;
        slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
        if (slug.length === safeLength) break;
      }
    }
    if (!RESERVED_SLUGS.has(slug.toLowerCase())) return slug;
  }
}
