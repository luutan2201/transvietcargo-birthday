/**
 * Turns whatever a person typed/pasted into a safe, clickable web link, or
 * returns undefined if it can't be one.
 *
 * - "shopee.vn/abc"        → "https://shopee.vn/abc"  (scheme added when missing)
 * - "https://a.com/x"      → kept as is
 * - "javascript:alert(1)"  → undefined (any non-http(s) scheme is rejected,
 *                            since this value is rendered as an <a href>)
 * - "abc" / "" / "   "     → undefined (not a real link)
 */
export function normalizeExternalUrl(raw: string | undefined | null): string | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) return undefined;

  try {
    const url = new URL(hasScheme ? value : `https://${value}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (!url.hostname.includes('.')) return undefined; // "https://abc" is a typo, not a link
    return url.toString();
  } catch {
    return undefined;
  }
}
