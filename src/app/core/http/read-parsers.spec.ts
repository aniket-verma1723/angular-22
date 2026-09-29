import { ApiError } from './api-error';
import { parseReadPage, readId, readPageRequest, readRecord, readText } from './read-parsers';

describe('Shared public read boundary', () => {
  const request = { skip: 0, limit: 10 };
  const envelope = { rows: [{ id: 1 }, { id: 2 }], total: 2, skip: 0, limit: 10 };
  const parse = (value: unknown) => ({ id: readId(readRecord(value)['id']) });

  it('validates page sizes and computes safe skip values', () => {
    for (const size of [10, 25, 50]) expect(readPageRequest(2, size)).toEqual({ skip: size * 2, limit: size });
  });

  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, '1', null, undefined]) {
    it(`rejects invalid or overflowing page index ${String(value)}`, () => {
      expect(() => readPageRequest(value, 10)).toThrowError(ApiError);
    });
  }

  for (const value of [0, 1, 12, 100, 10.5, '10', null, undefined]) {
    it(`rejects unsupported page size ${String(value)}`, () => {
      expect(() => readPageRequest(0, value)).toThrowError(ApiError);
    });
  }

  it('rejects unsafe page end arithmetic even when skip itself is safe', () => {
    expect(() => readPageRequest(Math.floor(Number.MAX_SAFE_INTEGER / 10), 10)).toThrowError(ApiError);
  });

  it('accepts both requested and reduced limits for a short collection', () => {
    expect(parseReadPage(envelope, 'rows', request, parse)).toEqual({ items: envelope.rows, total: 2, skip: 0, limit: 10 });
    for (const limit of [2, 5]) {
      expect(parseReadPage({ ...envelope, limit }, 'rows', request, parse).limit).toBe(limit);
    }
  });

  it('accepts empty collections and beyond-end pages with zero or requested limits', () => {
    for (const limit of [0, 2, 10]) {
      expect(parseReadPage({ rows: [], total: 0, skip: 0, limit }, 'rows', request, parse).items).toEqual([]);
      expect(parseReadPage({ rows: [], total: 2, skip: 10, limit }, 'rows', { skip: 10, limit: 10 }, parse).total).toBe(2);
    }
  });

  it('accepts full pages without retaining envelope or item extras', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ id: index + 11, extra: true }));
    const result = parseReadPage({ rows, total: 25, skip: 10, limit: 10, private: true }, 'rows', { skip: 10, limit: 10 }, parse);
    expect(result.items.map(item => Object.keys(item))).toEqual(rows.map(() => ['id']));
    expect(Object.keys(result).sort()).toEqual(['items', 'limit', 'skip', 'total']);
  });

  for (const field of ['total', 'skip', 'limit']) {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null]) {
      it(`rejects invalid ${field} metadata ${String(value)}`, () => {
        expect(() => parseReadPage({ ...envelope, [field]: value }, 'rows', request, parse)).toThrowError(ApiError);
      });
    }
  }

  for (const patch of [
    { skip: 1 }, { limit: 11 }, { limit: 1 }, { total: 1 }, { total: 3 },
    { rows: [{ id: 1 }, { id: 1 }] }, { rows: [] }, { rows: {} }, { rows: null },
    { rows: [{ id: 1 }, { id: 0 }] }
  ]) {
    it(`rejects inconsistent metadata, lists or identities: ${JSON.stringify(patch)}`, () => {
      expect(() => parseReadPage({ ...envelope, ...patch }, 'rows', request, parse)).toThrowError(ApiError);
    });
  }

  it('does not accept a server-truncated page when enough records remain', () => {
    expect(() => parseReadPage({ ...envelope, total: 20, limit: 2 }, 'rows', request, parse)).toThrowError(ApiError);
  });

  it('rejects missing envelopes, records, positive IDs and required text without echoing input', () => {
    for (const value of [null, undefined, [], 'untrusted']) expect(() => readRecord(value)).toThrowError(ApiError);
    for (const value of [0, -1, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) expect(() => readId(value)).toThrowError(ApiError);
    for (const value of [undefined, null, '', '  ', 1]) expect(() => readText(value)).toThrowError(ApiError);
  });
});
