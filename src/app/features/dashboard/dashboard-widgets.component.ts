import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, map, switchMap } from 'rxjs';
import { PostsApiService } from '../posts/data/posts-api.service';
import { TasksApiService } from '../tasks/data/tasks-api.service';
import { UsersApiService } from '../users/data/users-api.service';
import { IDLE_WIDGETS, composeWidgets } from './widget-composition';
import type { WidgetData, WidgetId, WidgetSources, WidgetState, WidgetStrategy } from './widget-composition';

const WIDGET_DEFINITIONS = [
  { id: 'users', title: 'Users', description: 'Public directory total and the first three names on page 1.' },
  { id: 'tasks', title: 'Tasks', description: 'Public task total. Completion counts are page-local: only the first 10 tasks, not global counts.' },
  { id: 'posts', title: 'Posts · public user 1', description: 'Total for public user 1 and the first three titles on page 1. Not the authenticated user, not recent posts, and not a global post total.' }
] satisfies readonly { readonly id: WidgetId; readonly title: string; readonly description: string }[];

@Component({
  selector: 'app-dashboard-widgets',
  imports: [RouterLink],
  templateUrl: './dashboard-widgets.component.html',
  styleUrl: './dashboard-widgets.component.css'
})
export class DashboardWidgetsComponent {
  private readonly usersApi = inject(UsersApiService);
  private readonly tasksApi = inject(TasksApiService);
  private readonly postsApi = inject(PostsApiService);
  private readonly selectedStrategy = signal<WidgetStrategy>('independent');
  private readonly load$ = new Subject<WidgetStrategy>();
  private readonly retry$ = new Subject<WidgetId>();
  private readonly sources: WidgetSources = {
    users: () => this.usersApi.list({ q: '', pageIndex: 0, pageSize: 10 }).pipe(map((page): WidgetData => ({
      kind: 'users', total: page.total,
      previews: page.items.slice(0, 3).map(user => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))
    }))),
    tasks: () => this.tasksApi.list({ userId: null, pageIndex: 0, pageSize: 10 }).pipe(map((page): WidgetData => {
      const completed = page.items.filter(task => task.completed).length;
      return { kind: 'tasks', total: page.total, count: page.items.length,
        completed, incomplete: page.items.length - completed };
    })),
    posts: () => this.postsApi.byUser(1, 0, 10).pipe(map((page): WidgetData => ({
      kind: 'posts', total: page.total,
      previews: page.items.slice(0, 3).map(post => ({ id: post.id, label: post.title }))
    })))
  };
  // A single stable boundary owns the outer stream and all active inner subscriptions.
  private readonly state = toSignal(this.load$.pipe(
    switchMap(strategy => composeWidgets(strategy, this.sources, this.retry$.asObservable()))
  ), { initialValue: IDLE_WIDGETS });

  protected readonly strategy = this.selectedStrategy.asReadonly();
  protected readonly loaded = computed(() => this.state().users.status !== 'idle');
  protected readonly busy = computed(() => Object.values(this.state()).some(state => state.status === 'loading'));
  protected readonly widgets = computed(() => WIDGET_DEFINITIONS.map(widget => ({
    ...widget, state: this.state()[widget.id]
  })));
  protected readonly progress = computed(() => {
    if (!this.loaded()) return 'Widgets idle. No data requested.';
    const states = Object.values(this.state());
    const count = (status: WidgetState['status']): number => states.filter(state => state.status === status).length;
    return `${count('loading')} loading · ${count('success')} loaded · ${count('empty')} empty · ${count('error')} failed`;
  });

  protected load(): void {
    if (!this.loaded()) this.load$.next(this.strategy());
  }

  protected changeStrategy(value: string): void {
    if (value !== 'independent' && value !== 'combineLatest' && value !== 'forkJoin') return;
    if (value === this.strategy()) return;
    const wasLoaded = this.loaded();
    this.selectedStrategy.set(value);
    if (wasLoaded) this.load$.next(value);
  }

  protected retry(id: WidgetId): void {
    if (this.strategy() !== 'forkJoin' && this.state()[id].status === 'error') this.retry$.next(id);
  }

  protected reloadSnapshot(): void {
    if (this.strategy() === 'forkJoin' && this.loaded() && !this.busy()) this.load$.next('forkJoin');
  }
}
