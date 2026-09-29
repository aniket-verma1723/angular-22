import { publicProductLink } from './public-product-link';

describe('publicProductLink', () => {
  it('constructs only the constant public route on the provided HTTP(S) origin', () => {
    expect(publicProductLink('https://example.test')).toBe('https://example.test/products/1');
    expect(publicProductLink('http://localhost:4200')).toBe('http://localhost:4200/products/1');
    expect(publicProductLink('https://example.test/')).toBe('https://example.test/products/1');
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
