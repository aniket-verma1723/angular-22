const PUBLIC_PRODUCT_PATH = '/products/1';

/** Use only the origin and trusted document base, never the current route or user input. */
export function publicProductLink(origin: string, baseHref = '/'): string | null {
  try {
    const base = new URL(origin);
    if ((base.protocol !== 'http:' && base.protocol !== 'https:') ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') return null;
    const appBase = new URL(baseHref, base.origin);
    if (appBase.origin !== base.origin || appBase.username || appBase.password ||
      appBase.search || appBase.hash || !appBase.pathname.endsWith('/')) return null;
    return new URL(`#${PUBLIC_PRODUCT_PATH}`, appBase).href;
  } catch {
    return null;
  }
}
