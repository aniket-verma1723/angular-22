import { ApiError } from '../../../core/http/api-error';
import { publicCommentFixture, publicPostFixture } from '../../../testing/relationship-fixtures';
import { parseCommentPage, parsePostPage, parsePublicComment, parsePublicPost } from './post.parsers';

describe('Public post and comment parsers', () => {
  const request = { skip: 0, limit: 10 };

  it('drops unused post fields including reaction objects, tags and views', () => {
    expect(parsePublicPost({ ...publicPostFixture(), tags: ['unused'], reactions: { likes: 4, dislikes: 1 }, views: 20 }))
      .toEqual(publicPostFixture());
  });

  it('drops comment likes, username and every extra nested author field', () => {
    const raw = { ...publicCommentFixture(), likes: 3,
      user: { id: 2, fullName: 'Demo Learner', username: 'discarded', email: 'discarded', private: {} } };
    const result = parsePublicComment(raw, 1);
    expect(result).toEqual(publicCommentFixture());
    raw.user.fullName = 'Changed raw response';
    expect(result.user.fullName).toBe('Demo Learner');
  });

  it('checks single post identity and by-user relationship identity', () => {
    expect(() => parsePublicPost(publicPostFixture(), 2)).toThrowError(ApiError);
    expect(() => parsePostPage({ posts: [publicPostFixture({ userId: 2 })], total: 1, skip: 0, limit: 1 }, 1, request))
      .toThrowError(ApiError);
  });

  it('checks comments belong to the requested post, not necessarily its author', () => {
    expect(parsePublicComment(publicCommentFixture(), 1).user.id).toBe(2);
    expect(() => parseCommentPage({ comments: [publicCommentFixture({ postId: 2 })], total: 1, skip: 0, limit: 1 }, 1, request))
      .toThrowError(ApiError);
  });

  it('validates post IDs, relation IDs and required text fields', () => {
    for (const patch of [{ id: 0 }, { userId: '1' }, { userId: -1 }, { title: '' }, { body: null }]) {
      expect(() => parsePublicPost({ ...publicPostFixture(), ...patch })).toThrowError(ApiError);
    }
  });

  it('validates comment IDs, relation IDs and nested author fields', () => {
    for (const patch of [{ id: 0 }, { postId: '1' }, { body: '' }, { user: null },
      { user: { id: 0, fullName: 'Name' } }, { user: { id: 1, fullName: '' } }, { user: { id: 1, username: 'Name' } }]) {
      expect(() => parsePublicComment({ ...publicCommentFixture(), ...patch })).toThrowError(ApiError);
    }
  });

  it('accepts short and empty related collections', () => {
    expect(parsePostPage({ posts: [publicPostFixture()], total: 1, skip: 0, limit: 1 }, 1, request).items)
      .toEqual([publicPostFixture()]);
    expect(parseCommentPage({ comments: [], total: 0, skip: 0, limit: 0 }, 1, request).items).toEqual([]);
  });

  it('rejects duplicate IDs and inconsistent paging in both related collections', () => {
    expect(() => parsePostPage({ posts: [publicPostFixture(), publicPostFixture()], total: 2, skip: 0, limit: 2 }, 1, request))
      .toThrowError(ApiError);
    expect(() => parseCommentPage({ comments: [publicCommentFixture(), publicCommentFixture()], total: 2, skip: 0, limit: 2 }, 1, request))
      .toThrowError(ApiError);
    expect(() => parsePostPage({ posts: [], total: 1, skip: 0, limit: 10 }, 1, request)).toThrowError(ApiError);
    expect(() => parseCommentPage({ comments: [], total: 0, skip: 1, limit: 10 }, 1, request)).toThrowError(ApiError);
  });
});
