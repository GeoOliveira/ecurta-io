/**
 * Canonicalize a public web destination without requesting it.
 * Keep this policy synchronized with Encurta's short-links/public-url.mjs.
 * This is syntactic validation, not a DNS or malicious-content reputation check.
 * @param {string} raw
 * @returns {string}
 */
export function normalizePublicUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || /[\u0000-\u0020\u007f\\]/u.test(raw)) throw new Error('INVALID_DESTINATION');
  const url = new URL(raw);
  if (!/^https?:\/\//i.test(raw) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('INVALID_DESTINATION');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'encurta.io' || host.endsWith('.encurta.io') || /(^|\.)(localhost|local|internal|invalid|test|onion)$/.test(host)) throw new Error('INVALID_DESTINATION');
  if (host.startsWith('[')) {
    // Public global-unicast IPv6 only; excludes mapped IPv4 and documentation.
    if (!/^\[[23][0-9a-f]{3}:/.test(host) || host.startsWith('[2001:db8:')) throw new Error('INVALID_DESTINATION');
  } else if (/^\d+(\.\d+){3}$/.test(host)) {
    const [a, b, c] = host.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && [18, 19].includes(b)) ||
      (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) throw new Error('INVALID_DESTINATION');
  } else if (host.length > 253 || !host.includes('.') || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('INVALID_DESTINATION');
  }
  const normalized = url.toString();
  if (normalized.length > 4096) throw new Error('INVALID_DESTINATION');
  return normalized;
}
