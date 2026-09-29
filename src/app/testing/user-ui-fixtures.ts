import type { PublicUser } from '../features/users/data/user.models';
import type { PublicComment, PublicPost } from '../features/posts/data/post.models';

export function userUiFixture(overrides: Partial<PublicUser> = {}): PublicUser {
  return { id: 1, firstName: 'Ada', lastName: 'Reader', image: null, ...overrides };
}

export function postUiFixture(overrides: Partial<PublicPost> = {}): PublicPost {
  return { id: 11, title: 'A public learning post', body: 'Read streams independently.', userId: 1, ...overrides };
}

export function commentUiFixture(overrides: Partial<PublicComment> = {}): PublicComment {
  return { id: 21, body: 'A thoughtful comment', postId: 11, user: { id: 2, fullName: 'Grace Reader' }, ...overrides };
}

type UiPage<T, K extends string> = Readonly<Record<K, readonly T[]>> & {
  readonly total: number; readonly skip: number; readonly limit: number;
};

// Large totals need a full server page, not one item with inconsistent metadata.
function completePage<T extends { readonly id: number }>(items: readonly T[], total: number, skip: number, limit: number): readonly T[] {
  const sample = items[0];
  if (!sample) return [];
  const maxId = Math.max(...items.map(item => item.id));
  return Array.from({ length: Math.min(limit, Math.max(0, total - skip)) },
    (_, index) => items[index] ?? { ...sample, id: maxId + index + 1 });
}

export function userUiPage(users: readonly PublicUser[] = [userUiFixture()], total = users.length, skip = 0, limit = 10): UiPage<PublicUser, 'users'> {
  return { users: completePage(users, total, skip, limit), total, skip, limit };
}

export function postUiPage(posts: readonly PublicPost[] = [postUiFixture()], total = posts.length, skip = 0, limit = 10): UiPage<PublicPost, 'posts'> {
  return { posts: completePage(posts, total, skip, limit), total, skip, limit };
}

export function commentUiPage(comments: readonly PublicComment[] = [commentUiFixture()], total = comments.length, skip = 0, limit = 10): UiPage<PublicComment, 'comments'> {
  return { comments: completePage(comments, total, skip, limit), total, skip, limit };
}
