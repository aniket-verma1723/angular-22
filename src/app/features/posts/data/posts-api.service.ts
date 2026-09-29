import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { catchError, defer, map, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import { readId, readPageRequest } from '../../../core/http/read-parsers';
import type { PublicComment, PublicPost } from './post.models';
import { parseCommentPage, parsePostPage, parsePublicPost } from './post.parsers';

const POST_FIELDS = 'id,title,body,userId';
const COMMENT_FIELDS = 'id,body,postId,user';

@Service()
export class PostsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  byUser(userId: number, pageIndex = 0, pageSize = 10): Observable<Page<PublicPost>> {
    return this.request(() => {
      const id = readId(userId, 'validation');
      const page = readPageRequest(pageIndex, pageSize);
      return this.http.get<unknown>(`${this.config.baseUrl}/posts/user/${id}`, {
        params: { ...page, select: POST_FIELDS }, withCredentials: false, credentials: 'omit'
      }).pipe(map(value => parsePostPage(value, id, page)));
    });
  }

  get(id: number): Observable<PublicPost> {
    return this.request(() => this.http.get<unknown>(`${this.config.baseUrl}/posts/${readId(id, 'validation')}`, {
      params: { select: POST_FIELDS }, withCredentials: false, credentials: 'omit'
    }).pipe(map(value => parsePublicPost(value, id))));
  }

  comments(postId: number, pageIndex = 0, pageSize = 10): Observable<Page<PublicComment>> {
    return this.request(() => {
      const id = readId(postId, 'validation');
      const page = readPageRequest(pageIndex, pageSize);
      return this.http.get<unknown>(`${this.config.baseUrl}/posts/${id}/comments`, {
        params: { ...page, select: COMMENT_FIELDS }, withCredentials: false, credentials: 'omit'
      }).pipe(map(value => parseCommentPage(value, id, page)));
    });
  }

  private request<T>(send: () => Observable<T>): Observable<T> {
    return defer(send).pipe(timeout({ first: 15_000 }),
      catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
