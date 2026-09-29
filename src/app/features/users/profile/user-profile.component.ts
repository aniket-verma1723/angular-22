import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatPaginator } from '@angular/material/paginator';
import type { PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, combineLatest, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import type { Page } from '../../../core/http/page';
import { ReadErrorComponent } from '../../../shared/ui/read-error.component';
import { readIdFromUrl, readState } from '../../../shared/ui/read-state';
import type { ReadState } from '../../../shared/ui/read-state';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar.component';
import type { PublicPost } from '../../posts/data/post.models';
import { PostsApiService } from '../../posts/data/posts-api.service';
import type { PublicUser } from '../data/user.models';
import { UsersApiService } from '../data/users-api.service';
import { parseUserUrl, userUrlParams } from '../data/user-url';

interface ProfileView {
  readonly profile: ReadState<PublicUser>;
  readonly posts: ReadState<Page<PublicPost>>;
}
const initialView: ProfileView = { profile: { status: 'loading' }, posts: { status: 'loading' } };

@Component({
  selector: 'app-user-profile',
  imports: [RouterLink, MatButton, MatPaginator, MatProgressBar, ReadErrorComponent, UserAvatarComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly usersApi = inject(UsersApiService);
  private readonly postsApi = inject(PostsApiService);
  private readonly retryProfile$ = new Subject<void>();
  private readonly retryPosts$ = new Subject<void>();
  private readonly id$ = this.route.paramMap.pipe(map(params => readIdFromUrl(params.get('id'))), distinctUntilChanged());
  protected readonly id = toSignal(this.id$, { initialValue: readIdFromUrl(this.route.snapshot.paramMap.get('id')) });
  private readonly pageState = linkedSignal({ source: this.id, computation: id => ({ id, index: 0 }) });
  private readonly page$ = toObservable(this.pageState);
  protected readonly pageIndex = computed(() => this.pageState().index);
  protected readonly backParams = toSignal(this.route.queryParamMap.pipe(map(params => userUrlParams(parseUserUrl(params)))),
    { initialValue: userUrlParams(parseUserUrl(this.route.snapshot.queryParamMap)) });
  protected readonly view = toSignal(this.id$.pipe(switchMap(id => {
    if (id === null) return of(initialView);
    // Key the local page to its route identity; no old page can leak into a reused profile.
    const page$ = this.page$.pipe(map(page => page.id === id ? page.index : 0), startWith(0), distinctUntilChanged());
    return combineLatest({
      profile: this.retryProfile$.pipe(startWith(undefined), switchMap(() => readState(this.usersApi.get(id)))),
      posts: combineLatest([page$, this.retryPosts$.pipe(startWith(undefined))]).pipe(
        switchMap(([page]) => readState(this.postsApi.byUser(id, page, 10))))
    });
  })), { initialValue: initialView });

  protected retryProfile(): void { this.retryProfile$.next(); }
  protected retryPosts(): void { this.retryPosts$.next(); }
  protected paginate(event: PageEvent): void { this.setPage(event.pageIndex); }
  protected firstPage(): void { this.setPage(0); }
  private setPage(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger((index + 1) * 10)) return;
    this.pageState.set({ id: this.id(), index });
  }
}
