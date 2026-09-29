import { createApiConfig } from './api-config';

describe('API configuration', () => {
  it('normalizes and freezes public configuration', () => {
    const config = createApiConfig('remote', 'https://example.test/api///');
    expect(config).toEqual({ mode: 'remote', baseUrl: 'https://example.test/api' });
    expect(Object.isFrozen(config)).toBeTrue();
  });

  for (const base of ['javascript:alert(1)', '/relative', 'https://user:pass@example.test',
    'https://example.test?token=demo', 'https://example.test#fragment']) {
    it(`rejects invalid configuration ${base}`, () => expect(() => createApiConfig('remote', base)).toThrow());
  }
});
