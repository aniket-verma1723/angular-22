const PUBLIC_PRODUCT_PATH = '/products/1';

/** Accept an origin only, never the current page URL, user input, query or fragment. */
export function publicProductLink(origin: string): string | null {
  try {
    const base = new URL(origin);
    if ((base.protocol !== 'http:' && base.protocol !== 'https:') ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') return null;
    const link = new URL(PUBLIC_PRODUCT_PATH, base.origin);
    return link.origin === base.origin && link.pathname === PUBLIC_PRODUCT_PATH ? link.href : null;
  } catch {
    return null;
  }
}
