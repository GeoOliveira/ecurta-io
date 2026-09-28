export const DEFAULT_SHORT_DOMAINS = ["https://encurta.io", "https://curto.ink"] as const;
export type ShortDomain = string;

export function normalizeShortDomain(raw: unknown): ShortDomain | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return `${url.protocol}//${url.hostname.toLowerCase()}`;
  } catch {
    return null;
  }
}

export const getAllowedShortDomains = (raw?: unknown): readonly ShortDomain[] => {
  const candidates = Array.isArray(raw) ? raw : DEFAULT_SHORT_DOMAINS;
  const domains = candidates
    .map(normalizeShortDomain)
    .filter((domain): domain is ShortDomain => Boolean(domain));
  return [...new Set(domains)];
};

export const getShortDomain = (raw?: unknown): ShortDomain =>
  normalizeShortDomain(raw) ??
  normalizeShortDomain(process.env.NEXT_PUBLIC_SHORT_DOMAIN) ??
  DEFAULT_SHORT_DOMAINS[0];

export const getDefaultShortDomain = (allowedDomains: readonly ShortDomain[], raw?: unknown): ShortDomain => {
  const configured = getShortDomain(raw);
  return allowedDomains.includes(configured) ? configured : allowedDomains[0] ?? DEFAULT_SHORT_DOMAINS[0];
};
export const allowedHosts=()=> (process.env.ALLOWED_DESTINATION_HOSTS??"wa.me").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
