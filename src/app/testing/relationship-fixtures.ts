import type { PublicComment, PublicPost } from '../features/posts/data/post.models';
import type { PublicUser } from '../features/users/data/user.models';

export function publicUserFixture(overrides: Partial<PublicUser> = {}): PublicUser {
  return { id: 1, firstName: 'Emily', lastName: 'Johnson', image: null, ...overrides };
}

export function publicPostFixture(overrides: Partial<PublicPost> = {}): PublicPost {
  return { id: 1, title: 'A practice note', body: 'Learning with a fictional example.', userId: 1, ...overrides };
}

export function publicCommentFixture(overrides: Partial<PublicComment> = {}): PublicComment {
  return { id: 1, body: 'A fictional reply.', postId: 1, user: { id: 2, fullName: 'Demo Learner' }, ...overrides };
}
