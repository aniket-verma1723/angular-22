import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import type { PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, NavigationStart, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, combineLatest, distinctUntilChanged, filter, map, startWith, switchMap, timer } from 'rxjs';
import { ReadErrorComponent } from '../../../shared/ui/read-error.component';
import { readState } from '../../../shared/ui/read-state';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar.component';
import type { UserQuery } from '../data/user.models';
import { UsersApiService } from '../data/users-api.service';
import { USER_SEARCH_MAX_LENGTH, isCanonicalUserUrl, normalizeUserSearch, parseUserUrl, sameUserQuery, userUrlParams } from '../data/user-url';

@Component({
  selector: 'app-user-directory',
  imports: [RouterLink, MatButton, MatFormField, MatLabel, MatInput, MatPaginator, MatProgressBar,
    MatTableModule, ReadErrorComponent, UserAvatarComponent],
  templateUrl: './user-directory.component.html',
  styleUrl: './user-directory.component.css'
})
export class UserDirectoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(UsersApiService);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly edits$ = new Subject<string | null>();
  private readonly retry$ = new Subject<void>();
  private readonly query$ = this.route.queryParamMap.pipe(map(parseUserUrl), distinctUntilChanged(sameUserQuery));
  protected readonly query = toSignal(this.query$, { initialValue: parseUserUrl(this.route.snapshot.queryParamMap) });
  private readonly draftState = linkedSignal({ source: this.query, computation: query => query.q });
  protected readonly draft = this.draftState.asReadonly();
  private readonly navigationErrorState = signal(false);
  protected readonly navigationError = this.navigationErrorState.asReadonly();
  protected readonly maxSearchLength = USER_SEARCH_MAX_LENGTH;
  protected readonly pageSizes = [10, 25, 50];
  protected readonly columns = ['avatar', 'name'];
  protected readonly linkParams = computed(() => userUrlParams(this.query()));
  protected readonly users = toSignal(combineLatest([this.query$, this.retry$.pipe(startWith(undefined))]).pipe(
    switchMap(([query]) => readState(this.api.list(query)))
  ), { initialValue: { status: 'loading' } });

  constructor() {
    this.edits$.pipe(
      switchMap(value => value === null ? EMPTY : timer(300).pipe(map(() => normalizeUserSearch(value)))),
      takeUntilDestroyed()
    ).subscribe(q => {
      this.draftState.set(q);
      if (q !== this.query().q) this.navigate({ ...this.query(), q, pageIndex: 0 });
    });
    this.router.events.pipe(filter(event => event instanceof NavigationStart), takeUntilDestroyed())
      .subscribe(() => this.edits$.next(null));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.edits$.next(null);
      const query = parseUserUrl(params);
      this.draftState.set(query.q);
      if (!isCanonicalUserUrl(params, query)) this.navigate(query, true);
    });
  }

  protected search(value: string): void { this.draftState.set(value); this.edits$.next(value); }
  protected clear(): void {
    this.edits$.next(null);
    this.draftState.set('');
    this.navigate({ ...this.query(), q: '', pageIndex: 0 });
    this.searchInput().nativeElement.focus();
  }
  protected paginate(event: PageEvent): void {
    this.edits$.next(null);
    this.draftState.set(this.query().q);
    if (event.pageSize !== 10 && event.pageSize !== 25 && event.pageSize !== 50) return;
    const pageIndex = event.pageSize === this.query().pageSize ? event.pageIndex : 0;
    if (!Number.isSafeInteger(pageIndex + 1) || pageIndex < 0 || !Number.isSafeInteger((pageIndex + 1) * event.pageSize)) return;
    this.navigate({ ...this.query(), pageSize: event.pageSize, pageIndex });
  }
  protected firstPage(): void { this.edits$.next(null); this.navigate({ ...this.query(), pageIndex: 0 }); }
  protected retry(): void { this.retry$.next(); }
  private navigate(query: UserQuery, replaceUrl = false): void {
    this.navigationErrorState.set(false);
    const queryParams = userUrlParams(query);
    const target = this.router.createUrlTree([], { relativeTo: this.route, queryParams });
    if (this.router.serializeUrl(target) === this.router.url) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl })
      .then(ok => { if (!ok) this.navigationErrorState.set(true); })
      .catch(() => this.navigationErrorState.set(true));
  }
}
