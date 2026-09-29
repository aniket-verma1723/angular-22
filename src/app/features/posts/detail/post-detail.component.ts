import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatPaginator } from '@angular/material/paginator';
import type { PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, combineLatest, distinctUntilChanged, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import type { Page } from '../../../core/http/page';
import { ReadErrorComponent } from '../../../shared/ui/read-error.component';
import { readIdFromUrl, readState } from '../../../shared/ui/read-state';
import type { ReadState } from '../../../shared/ui/read-state';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar.component';
import type { PublicUser } from '../../users/data/user.models';
import { UsersApiService } from '../../users/data/users-api.service';
import type { PublicComment, PublicPost } from '../data/post.models';
import { PostsApiService } from '../data/posts-api.service';

interface PostView {
  readonly post: ReadState<PublicPost>;
  readonly comments: ReadState<Page<PublicComment>>;
  readonly author: ReadState<PublicUser>;
}
const initialView: PostView = { post: { status: 'loading' }, comments: { status: 'loading' }, author: { status: 'loading' } };

@Component({
  selector: 'app-post-detail',
  imports: [RouterLink, MatButton, MatPaginator, MatProgressBar, ReadErrorComponent, UserAvatarComponent],
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.css'
})
export class PostDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly postsApi = inject(PostsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly retryPost$ = new Subject<void>();
  private readonly retryComments$ = new Subject<void>();
  private readonly retryAuthor$ = new Subject<void>();
  private readonly id$ = this.route.paramMap.pipe(map(params => readIdFromUrl(params.get('id'))), distinctUntilChanged());
  protected readonly id = toSignal(this.id$, { initialValue: readIdFromUrl(this.route.snapshot.paramMap.get('id')) });
  private readonly pageState = linkedSignal({ source: this.id, computation: id => ({ id, index: 0 }) });
  private readonly page$ = toObservable(this.pageState);
  protected readonly pageIndex = computed(() => this.pageState().index);
  protected readonly view = toSignal(this.id$.pipe(switchMap(id => {
    if (id === null) return of(initialView);
    // Two consumers (rendering and author dependency), but exactly one post HTTP subscription.
    // Sharing lives inside the route switchMap, so its cache cannot survive a changed ID.
    const post$ = this.retryPost$.pipe(startWith(undefined), switchMap(() => readState(this.postsApi.get(id))),
      shareReplay({ bufferSize: 1, refCount: true }));
    const page$ = this.page$.pipe(map(page => page.id === id ? page.index : 0), startWith(0), distinctUntilChanged());
    return combineLatest({
      post: post$,
      comments: combineLatest([page$, this.retryComments$.pipe(startWith(undefined))]).pipe(
        switchMap(([page]) => readState(this.postsApi.comments(id, page, 10)))),
      author: post$.pipe(switchMap(post => post.status === 'success'
        ? this.retryAuthor$.pipe(startWith(undefined), switchMap(() => readState(this.usersApi.get(post.value.userId))))
        : of<ReadState<PublicUser>>({ status: 'loading' })))
    });
  })), { initialValue: initialView });

  protected retryPost(): void { this.retryPost$.next(); }
  protected retryComments(): void { this.retryComments$.next(); }
  protected retryAuthor(): void { this.retryAuthor$.next(); }
  protected paginate(event: PageEvent): void { this.setPage(event.pageIndex); }
  protected firstPage(): void { this.setPage(0); }
  private setPage(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger((index + 1) * 10)) return;
    this.pageState.set({ id: this.id(), index });
  }
}
