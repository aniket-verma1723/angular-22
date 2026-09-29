import { ApiError } from '../../../core/http/api-error';
import { publicUserFixture } from '../../../testing/relationship-fixtures';
import { parsePublicUser, parseUserPage } from './user.parsers';

describe('Public user parsers', () => {
  it('retains only the four public fields, even when the server returns private extras', () => {
    const raw = { ...publicUserFixture(), email: 'discarded', phone: 'discarded', password: 'discarded',
      address: { discarded: true }, bank: { discarded: true }, role: 'admin', username: 'discarded' };
    expect(parsePublicUser(raw, 1)).toEqual(publicUserFixture());
    expect(parseUserPage({ users: [raw], total: 1, skip: 0, limit: 1, private: true }, { skip: 0, limit: 10 }))
      .toEqual({ items: [publicUserFixture()], total: 1, skip: 0, limit: 1 });
  });

  it('accepts missing, null and empty avatars as explicit null', () => {
    for (const image of [undefined, null, '']) expect(parsePublicUser({ ...publicUserFixture(), image }).image).toBeNull();
  });

  it('accepts root-relative assets and HTTPS images without credentials', () => {
    for (const image of ['/mock-avatar.svg', 'https://images.example.test/avatar.png']) {
      expect(parsePublicUser({ ...publicUserFixture(), image }).image).toBe(image);
    }
  });

  for (const image of [
    '//images.example.test/a', 'http://images.example.test/a', 'javascript:alert(1)', 'data:image/png;base64,AA',
    'avatar.png', 'https://name:pass@images.example.test/a', 'https://name@images.example.test/a',
    '/\\images.example.test/a', '/avatar\n.svg', 'https://images.example.test/\ta',
    ' https://images.example.test/a', 'https://images.example.test/a ', '/avatar\u007f.svg', '/avatar\u0085.svg', 42
  ]) {
    it(`rejects unsafe avatar input ${JSON.stringify(image)}`, () => {
      expect(() => parsePublicUser({ ...publicUserFixture(), image })).toThrowError(ApiError);
    });
  }

  it('checks detail identity and required display fields', () => {
    expect(() => parsePublicUser(publicUserFixture(), 2)).toThrowError(ApiError);
    for (const patch of [{ id: 0 }, { id: '1' }, { firstName: '' }, { lastName: null }, { firstName: 1 }]) {
      expect(() => parsePublicUser({ ...publicUserFixture(), ...patch })).toThrowError(ApiError);
    }
  });

  it('rejects duplicate users and mismatched requested skip', () => {
    expect(() => parseUserPage({ users: [publicUserFixture(), publicUserFixture()], total: 2, skip: 0, limit: 2 },
      { skip: 0, limit: 10 })).toThrowError(ApiError);
    expect(() => parseUserPage({ users: [publicUserFixture()], total: 1, skip: 0, limit: 1 },
      { skip: 10, limit: 10 })).toThrowError(ApiError);
  });
});
