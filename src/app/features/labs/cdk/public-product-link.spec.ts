import { publicProductLink } from './public-product-link';

describe('publicProductLink', () => {
  it('constructs only the constant public route on the provided HTTP(S) origin', () => {
    expect(publicProductLink('https://example.test')).toBe('https://example.test/#/products/1');
    expect(publicProductLink('http://localhost:4200')).toBe('http://localhost:4200/#/products/1');
    expect(publicProductLink('https://example.test/')).toBe('https://example.test/#/products/1');
  });

  it('preserves the Pages subpath without copying the active route or query', () => {
    expect(publicProductLink('https://example.test', '/angular-22/'))
      .toBe('https://example.test/angular-22/#/products/1');
    expect(publicProductLink('https://example.test', 'https://example.test/angular-22/'))
      .toBe('https://example.test/angular-22/#/products/1');
  });

  it('rejects external, credential-bearing, non-directory and state-bearing bases', () => {
    for (const base of ['https://elsewhere.test/', '//elsewhere.test/', 'https://user@example.test/',
      '/angular-22', '/angular-22/?private=example', '/angular-22/#private-example', 'javascript:alert(1)']) {
      expect(publicProductLink('https://example.test', base)).withContext(base).toBeNull();
    }
  });

  it('rejects non-web origins, credentials, page paths, query strings and fragments', () => {
    const invalid = [
      '', 'null', 'not a URL', '//example.test', 'file:///tmp/', 'javascript:alert(1)',
      'data:text/plain,example', 'ftp://example.test', 'https://name:password@example.test',
      'https://example.test/labs/cdk', 'https://example.test/?private=example',
      'https://example.test/#private-example'
    ];
    for (const origin of invalid) expect(publicProductLink(origin)).withContext(origin).toBeNull();
  });
});
