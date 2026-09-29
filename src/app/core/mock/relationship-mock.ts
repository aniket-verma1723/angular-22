import { HttpErrorResponse } from '@angular/common/http';
import type { PublicComment, PublicPost } from '../../features/posts/data/post.models';
import type { PublicUser } from '../../features/users/data/user.models';

// Fictional, public display identities only; the first two match the existing demo accounts.
const names = [
  ['Emily', 'Johnson'], ['Demo', 'Learner'], ['Aster', 'Brook'], ['Briar', 'Vale'],
  ['Cedar', 'Wren'], ['Dara', 'Meadow'], ['Ellis', 'Fern'], ['Finley', 'Reed'],
  ['Gale', 'Rowan'], ['Harper', 'Grove'], ['Indigo', 'Lake'], ['Jules', 'Birch'],
  ['Kit', 'Willow'], ['Linden', 'Moss'], ['Morgan', 'Pine'], ['Nova', 'Field'],
  ['Oakley', 'River'], ['Parker', 'Bloom'], ['Quinn', 'Ash'], ['Robin', 'Haven'],
  ['Sage', 'Stone'], ['Taylor', 'Maple'], ['Uma', 'Cove'], ['Val', 'Hill'],
  ['Winter', 'Dale'], ['Xen', 'Forest'], ['Yael', 'Spring'], ['Zuri', 'Orchard'],
  ['Arden', 'Cloud'], ['Blair', 'Quiet']
] as const;

const users: readonly PublicUser[] = names.map(([firstName, lastName], index) => ({
  id: index + 1, firstName, lastName, image: null
}));

const posts: readonly PublicPost[] = users.flatMap(user => {
  const count = user.id === 1 ? 12 : user.id === 2 ? 3 : user.id === 30 ? 0 : 1;
  const firstId = user.id === 1 ? 1 : user.id === 2 ? 13 : user.id + 13;
  return Array.from({ length: count }, (_, index) => ({ id: firstId + index, userId: user.id,
    title: `${user.firstName}'s learning note ${index + 1}`,
    body: `A fictional practice note about learning together, written by ${user.firstName} ${user.lastName}.`
  }));
});

const comments: readonly PublicComment[] = users.slice(0, 14).map((user, index) => ({
  id: index + 1, postId: index < 12 ? 1 : index === 12 ? 13 : 16,
  body: `Practice comment ${index + 1}: thanks for sharing this learning note.`,
  user: { id: user.id, fullName: `${user.firstName} ${user.lastName}` }
}));

const userFields = ['id', 'firstName', 'lastName', 'image'];
const postFields = ['id', 'title', 'body', 'userId'];
const commentFields = ['id', 'body', 'postId', 'user'];

function failure(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Mock response', error: { message: 'Simulated API failure.' } });
}

function numberParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (value !== value.trim() || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw failure(400);
  return Number(value);
}

function idParam(value: string | undefined): number {
  const id = numberParam(value ?? '', 0);
  if (id === 0) throw failure(400);
  return id;
}

function validateParams(params: URLSearchParams, fields: readonly string[], paged: boolean, search = false): readonly string[] {
  const allowed = ['select', ...(paged ? ['skip', 'limit'] : []), ...(search ? ['q'] : [])];
  params.forEach((_, key) => {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw failure(400);
  });
  if (search && !params.has('q')) throw failure(400);
  const selected = params.has('select') ? (params.get('select') ?? '').split(',') : fields;
  if (selected.some(field => !fields.includes(field)) || new Set(selected).size !== selected.length) throw failure(400);
  return [...new Set(['id', ...selected])];
}

function select(row: object, fields: readonly string[]): unknown {
  return Object.fromEntries(Object.entries(row).filter(([key]) => fields.includes(key)));
}

function page(rows: readonly object[], key: string, params: URLSearchParams, fields: readonly string[], empty: boolean): unknown {
  const skip = numberParam(params.get('skip'), 0);
  const limit = numberParam(params.get('limit'), 10);
  if (![10, 25, 50].includes(limit) || !Number.isSafeInteger(skip + limit)) throw failure(400);
  const records = empty ? [] : rows;
  const items = records.slice(skip, skip + limit).map(row => select(row, fields));
  // Exercise the documented short-collection limit shape, including zero for empty pages.
  return { [key]: items, total: records.length, skip, limit: items.length };
}

// Called only inside MockProductBackend's delayed response path. No mutable state or network access.
export function dispatchRelationshipRead(method: string, path: string, params: URLSearchParams, empty: boolean): { readonly body: unknown } {
  if (method !== 'GET') throw failure(501);
  if (path === '/users' || path === '/users/search') {
    const selected = validateParams(params, userFields, true, path === '/users/search');
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const matches = users.filter(user => `${user.firstName} ${user.lastName}`.toLowerCase().includes(q));
    return { body: page(matches, 'users', params, selected, empty) };
  }
  const user = /^\/users\/([\d.+-]+)$/.exec(path);
  if (user) {
    const selected = validateParams(params, userFields, false);
    const id = idParam(user[1]);
    const found = users.find(item => item.id === id);
    if (!found || empty) throw failure(404);
    return { body: select(found, selected) };
  }
  const byUser = /^\/posts\/user\/([\d.+-]+)$/.exec(path);
  if (byUser) {
    const selected = validateParams(params, postFields, true);
    const id = idParam(byUser[1]);
    if (!users.some(item => item.id === id)) throw failure(404);
    return { body: page(posts.filter(post => post.userId === id), 'posts', params, selected, empty) };
  }
  const post = /^\/posts\/([\d.+-]+)(\/comments)?$/.exec(path);
  if (post) {
    const isComments = post[2] !== undefined;
    const selected = validateParams(params, isComments ? commentFields : postFields, isComments);
    const id = idParam(post[1]);
    const found = posts.find(item => item.id === id);
    if (!found) throw failure(404);
    if (isComments) return { body: page(comments.filter(comment => comment.postId === id), 'comments', params, selected, empty) };
    if (empty) throw failure(404);
    return { body: select(found, selected) };
  }
  throw failure(501);
}
