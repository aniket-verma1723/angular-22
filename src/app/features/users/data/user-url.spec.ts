import { convertToParamMap } from '@angular/router';
import { isCanonicalUserUrl, normalizeUserSearch, parseUserUrl, sameUserQuery, userUrlParams } from './user-url';

describe('User URL contract', () => {
  it('omits defaults and round trips every supported size', () => {
    expect(parseUserUrl(convertToParamMap({}))).toEqual({ q: '', pageIndex: 0, pageSize: 10 });
    expect(userUrlParams({ q: '', pageIndex: 0, pageSize: 10 })).toEqual({});
    for (const pageSize of [10, 25, 50] as const) {
      const query = { q: 'Ada & Grace', pageIndex: 2, pageSize };
      const params = convertToParamMap(userUrlParams(query));
      expect(parseUserUrl(params)).toEqual(query);
      expect(isCanonicalUserUrl(params, query)).toBeTrue();
    }
  });

  it('trims, truncates at 200 characters and remains canonical after truncation', () => {
    expect(normalizeUserSearch('  Ada  ')).toBe('Ada');
    const q = normalizeUserSearch('a'.repeat(199) + '  trailing');
    expect(q.length).toBe(199);
    expect(normalizeUserSearch('a'.repeat(201)).length).toBe(200);
    expect(normalizeUserSearch(q)).toBe(q);
  });

  it('drops duplicate keys, unknown parameters and explicit defaults', () => {
    const params = convertToParamMap({ q: ['Ada', 'Grace'], page: ['2', '3'], pageSize: ['25', '50'], id: '99' });
    const query = parseUserUrl(params);
    expect(userUrlParams(query)).toEqual({});
    expect(isCanonicalUserUrl(params, query)).toBeFalse();
    const defaults = convertToParamMap({ page: '1', pageSize: '10', q: ' ' });
    expect(isCanonicalUserUrl(defaults, parseUserUrl(defaults))).toBeFalse();
  });

  for (const page of ['0', '-1', '1.5', '1e3', 'NaN', 'Infinity', ' 2', '2\n', '9007199254740991', '9007199254740992']) {
    it(`defaults unsafe or malformed page ${JSON.stringify(page)}`, () => {
      expect(parseUserUrl(convertToParamMap({ page, pageSize: '50' })).pageIndex).toBe(0);
    });
  }

  it('accepts the safe paging boundary and rejects offset overflow', () => {
    const index = Math.floor(Number.MAX_SAFE_INTEGER / 50) - 1;
    expect(parseUserUrl(convertToParamMap({ page: String(index + 1), pageSize: '50' })).pageIndex).toBe(index);
    expect(parseUserUrl(convertToParamMap({ page: String(index + 2), pageSize: '50' })).pageIndex).toBe(0);
  });

  it('normalizes leading zeroes and unsupported sizes, comparing only query semantics', () => {
    const params = convertToParamMap({ q: ' Ada ', page: '002', pageSize: '11', ignored: 'x' });
    const query = parseUserUrl(params);
    expect(userUrlParams(query)).toEqual({ q: 'Ada', page: '2' });
    expect(isCanonicalUserUrl(params, query)).toBeFalse();
    expect(sameUserQuery(query, { q: 'Ada', pageIndex: 1, pageSize: 10 })).toBeTrue();
    expect(sameUserQuery(query, { ...query, pageSize: 25 })).toBeFalse();
  });
});
