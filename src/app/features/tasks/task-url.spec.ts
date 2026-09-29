import { convertToParamMap } from '@angular/router';
import { isCanonicalTaskUrl, parseTaskUrl, taskUrlParams, taskUserId } from './task-url';

describe('Task URL ownership', () => {
  it('defaults to all users and a ten-row first page', () => {
    expect(parseTaskUrl(convertToParamMap({}))).toEqual({ valid: true, query: { userId: null, pageIndex: 0, pageSize: 10 } });
    expect(taskUrlParams({ userId: null, pageIndex: 0, pageSize: 10 })).toEqual({});
  });

  for (const userId of ['', '0', '-1', '01', '1.5', '1e2', ' 1', '1 ', '1\n', 'Infinity', 'NaN', '9007199254740992']) {
    it(`rejects present invalid user filter ${JSON.stringify(userId)} instead of broadening it`, () => {
      expect(taskUserId(userId)).toBeNull();
      const parsed = parseTaskUrl(convertToParamMap({ userId }));
      expect(parsed.valid).toBeFalse();
      if (!parsed.valid) expect(parsed.message).toContain('Invalid userId filter');
    });
  }
  it('rejects duplicate user filters even if they agree', () => {
    expect(parseTaskUrl(convertToParamMap({ userId: ['1', '1'] })).valid).toBeFalse();
  });
  it('preserves public numeric IDs and safe page arithmetic', () => {
    const parsed = parseTaskUrl(convertToParamMap({ userId: '7', page: '003', pageSize: '25', q: 'ignored' }));
    expect(parsed).toEqual({ valid: true, query: { userId: 7, pageIndex: 2, pageSize: 25 } });
    if (!parsed.valid) throw new Error('Expected valid query');
    const params = taskUrlParams(parsed.query);
    expect(params).toEqual({ userId: '7', page: '3', pageSize: '25' });
    expect(isCanonicalTaskUrl(convertToParamMap(params), parsed.query)).toBeTrue();
    expect(isCanonicalTaskUrl(convertToParamMap({ ...params, q: 'ignored' }), parsed.query)).toBeFalse();
  });
  for (const page of ['0', '-1', '1.5', '1e2', '2\n', 'NaN', '9007199254740991', '9007199254740992']) {
    it(`canonicalizes unsafe or invalid page ${JSON.stringify(page)} to page one`, () => {
      expect(parseTaskUrl(convertToParamMap({ page, pageSize: '50' }))).toEqual({ valid: true, query: { userId: null, pageIndex: 0, pageSize: 50 } });
    });
  }
  it('normalizes duplicate pagination/defaults and unsupported sizes without losing valid filters', () => {
    const parsed = parseTaskUrl(convertToParamMap({ userId: '3', page: ['2', '3'], pageSize: '100' }));
    expect(parsed).toEqual({ valid: true, query: { userId: 3, pageIndex: 0, pageSize: 10 } });
    if (!parsed.valid) throw new Error('Expected valid query');
    expect(isCanonicalTaskUrl(convertToParamMap({ userId: '3', page: '1', pageSize: '10' }), parsed.query)).toBeFalse();
  });
  it('accepts exactly the supported sizes and safe integer boundary', () => {
    for (const pageSize of [10, 25, 50] as const) {
      const page = Math.floor(Number.MAX_SAFE_INTEGER / pageSize);
      const parsed = parseTaskUrl(convertToParamMap({ userId: String(Number.MAX_SAFE_INTEGER), page: String(page), pageSize: String(pageSize) }));
      expect(parsed).toEqual({ valid: true, query: { userId: Number.MAX_SAFE_INTEGER, pageIndex: page - 1, pageSize } });
    }
  });
});
