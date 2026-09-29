import { convertToParamMap } from '@angular/router';
import { DEFAULT_PRODUCT_QUERY } from './product.models';
import { isCanonicalProductUrl, normalizeSearch, parseProductUrl, productIdFromUrl, productUrlParams } from './product-url';

describe('Product URL contract', () => {
  it('uses defaults with a compact canonical URL', () => {
    expect(parseProductUrl(convertToParamMap({}))).toEqual(DEFAULT_PRODUCT_QUERY);
    expect(productUrlParams(DEFAULT_PRODUCT_QUERY)).toEqual({});
  });

  it('round trips all supported paging/sorting and category values', () => {
    const params = convertToParamMap({ category: 'home-decoration', page: '2', pageSize: '24', sort: 'price', order: 'desc' });
    const query = parseProductUrl(params);
    expect(query).toEqual({ pageIndex: 1, pageSize: 24, sortBy: 'price', order: 'desc', filter: { kind: 'category', slug: 'home-decoration' } });
    expect(isCanonicalProductUrl(params, query)).toBeTrue();
    expect(parseProductUrl(convertToParamMap(productUrlParams(query)))).toEqual(query);
  });

  it('normalizes whitespace, omits defaults and lets search take precedence over category', () => {
    const params = convertToParamMap({ q: '  pen & paper  ', category: 'groceries', page: '1', sort: 'title', extra: 'unused' });
    const query = parseProductUrl(params);
    expect(productUrlParams(query)).toEqual({ q: 'pen & paper' });
    expect(isCanonicalProductUrl(params, query)).toBeFalse();
    expect(normalizeSearch('a'.repeat(201)).length).toBe(200);
  });

  for (const page of ['-1', '0', '1.5', '1e3', 'Infinity', 'NaN', '9007199254740991']) {
    it(`safely defaults invalid page ${page}`, () => {
      expect(parseProductUrl(convertToParamMap({ page })).pageIndex).toBe(0);
    });
  }

  it('rejects duplicates and invalid values rather than forwarding arbitrary strings', () => {
    const params = convertToParamMap({ q: ['a', 'b'], page: ['2', '3'], category: '../auth', pageSize: '999', sort: 'admin', order: 'wrong' });
    expect(parseProductUrl(params)).toEqual(DEFAULT_PRODUCT_QUERY);
    expect(isCanonicalProductUrl(params, DEFAULT_PRODUCT_QUERY)).toBeFalse();
  });

  for (const value of [null, '', '0', '-1', '1.1', '1e3', '0x10', ' 1 ', '01', '9007199254740992']) {
    it(`rejects invalid detail ID ${value}`, () => expect(productIdFromUrl(value)).toBeNull());
  }
  it('accepts a positive safe integer detail ID', () => expect(productIdFromUrl('123')).toBe(123));
});
