import type { Page } from '../../../core/http/page';
import { parseReadPage, readId, readRecord, readText, requireReadIdentity } from '../../../core/http/read-parsers';
import type { ReadPageRequest } from '../../../core/http/read-parsers';
import type { PublicComment, PublicPost } from './post.models';

export function parsePublicPost(value: unknown, expectedId?: number, expectedUserId?: number): PublicPost {
  const data = readRecord(value);
  const id = readId(data['id']);
  const userId = readId(data['userId']);
  requireReadIdentity(id, expectedId);
  requireReadIdentity(userId, expectedUserId);
  return { id, title: readText(data['title']), body: readText(data['body']), userId };
}

export function parsePublicComment(value: unknown, expectedPostId?: number): PublicComment {
  const data = readRecord(value);
  const postId = readId(data['postId']);
  requireReadIdentity(postId, expectedPostId);
  const user = readRecord(data['user']);
  return { id: readId(data['id']), body: readText(data['body']), postId,
    user: { id: readId(user['id']), fullName: readText(user['fullName']) } };
}

export function parsePostPage(value: unknown, userId: number, request: ReadPageRequest): Page<PublicPost> {
  return parseReadPage(value, 'posts', request, item => parsePublicPost(item, undefined, userId));
}

export function parseCommentPage(value: unknown, postId: number, request: ReadPageRequest): Page<PublicComment> {
  return parseReadPage(value, 'comments', request, item => parsePublicComment(item, postId));
}
