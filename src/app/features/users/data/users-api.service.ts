import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { catchError, defer, map, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { ApiError, toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../core/http/page';
import { readId, readPageRequest, readRecord } from '../../../core/http/read-parsers';
import type { PublicUser, UserQuery } from './user.models';
import { parsePublicUser, parseUserPage } from './user.parsers';

const USER_FIELDS = 'id,firstName,lastName,image';

@Service()
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  list(query: UserQuery): Observable<Page<PublicUser>> {
    return this.request(() => {
      const data = readRecord(query, 'validation');
      const page = readPageRequest(data['pageIndex'], data['pageSize']);
      if (typeof data['q'] !== 'string') throw new ApiError('validation', 'Expected a search term.');
      const q = data['q'].trim();
      let params = new HttpParams().set('skip', page.skip).set('limit', page.limit).set('select', USER_FIELDS);
      if (q) params = params.set('q', q);
      return this.http.get<unknown>(`${this.config.baseUrl}/users${q ? '/search' : ''}`, {
        params, withCredentials: false, credentials: 'omit'
      }).pipe(map(value => parseUserPage(value, page)));
    });
  }

  get(id: number): Observable<PublicUser> {
    return this.request(() => this.http.get<unknown>(`${this.config.baseUrl}/users/${readId(id, 'validation')}`, {
      params: { select: USER_FIELDS }, withCredentials: false, credentials: 'omit'
    }).pipe(map(value => parsePublicUser(value, id))));
  }

  private request<T>(send: () => Observable<T>): Observable<T> {
    return defer(send).pipe(timeout({ first: 15_000 }),
      catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
