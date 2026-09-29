import { CdkDrag, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import type { CdkDragDrop, CdkDragStart } from '@angular/cdk/drag-drop';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { ChangeDetectorRef, afterNextRender, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { appConfig } from '../../app.config';
import { API_CONFIG, createApiConfig } from '../../core/config/api-config';
import type { Task } from './data/task.models';
import type { TaskRow } from './task-board.service';
import { TasksComponent } from './tasks.component';

describe('Public task board UI', () => {
  const base = 'https://dummyjson.com/todos';
  const task = (id: number, completed = false, userId = 1): Task => ({ id, todo: `Task ${id}`, completed, userId });
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function element(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) throw new Error('Task board not routed');
    return element;
  }
  function flushPage(request: TestRequest, tasks: readonly Task[] = [task(1), task(2)], total?: number): void {
    const skip = Number(request.request.params.get('skip'));
    const limit = Number(request.request.params.get('limit'));
    const pageTotal = total ?? (tasks.length === 0 ? 0 : skip + tasks.length);
    const expectedCount = Math.min(limit, Math.max(0, pageTotal - skip));
    const lastId = Math.max(0, ...tasks.map(item => item.id));
    // Explicit larger totals need full pages, without changing the supplied semantic rows.
    const padding = Array.from({ length: Math.max(0, expectedCount - tasks.length) },
      (_, index) => task(lastId + index + 1, false, tasks[0]?.userId ?? 1));
    request.flush({ todos: [...tasks, ...padding], total: pageTotal, skip, limit });
  }
  async function settle(): Promise<void> { await harness.fixture.whenStable(); harness.detectChanges(); }
  async function navigateByClick(control: HTMLButtonElement): Promise<void> {
    // Wait for navigation, not application stability: the new page deliberately leaves HTTP open.
    const navigated = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof NavigationEnd)));
    control.click(); await navigated; harness.detectChanges();
  }
  async function renderPending(): Promise<void> {
    const injector = harness.routeDebugElement?.injector;
    if (!injector) throw new Error('Task component missing');
    // Observe the render after focus callbacks without waiting for the intentionally pending write.
    const rendered = new Promise<void>(resolve => afterNextRender({ read: () => resolve() }, { injector }));
    harness.detectChanges(); await rendered;
  }
  async function open(url = '/tasks', tasks: readonly Task[] = [task(1), task(2)], total?: number): Promise<void> {
    harness = await RouterTestingHarness.create(url); harness.fixture.autoDetectChanges();
    flushPage(http.expectOne(req => req.method === 'GET' && req.url.startsWith(base)), tasks, total);
    await settle();
  }
  function button(text: string): HTMLButtonElement {
    const button = [...element().querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text);
    if (!button) throw new Error(`Missing button ${text}`);
    return button;
  }
  function click(text: string): void { button(text).click(); harness.detectChanges(); }
  function action(id: number, name: string): HTMLButtonElement {
    const button = element().querySelector<HTMLButtonElement>(`[data-task-id="${id}"] button[aria-label^="${name} task ${id}"]`);
    if (!button) throw new Error(`Missing ${name} for task ${id}`);
    return button;
  }
  function checkbox(id: number): HTMLInputElement {
    const input = element().querySelector<HTMLInputElement>(`[data-task-id="${id}"] input[type="checkbox"]`);
    if (!input) throw new Error(`Missing checkbox ${id}`);
    return input;
  }
  function toggle(id: number): void { checkbox(id).click(); harness.detectChanges(); }
  function input(selector: string): HTMLInputElement | HTMLTextAreaElement {
    const control = element().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!control) throw new Error(`Missing input ${selector}`);
    return control;
  }
  async function edit(selector: string, value: string): Promise<void> {
    const control = input(selector); control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('blur')); harness.detectChanges(); await settle();
  }
  async function draft(text = '  New task  ', user = '1'): Promise<void> {
    await edit('textarea', text); await edit('input[type="number"]', user);
  }
  function create(): void {
    element().querySelector('form[aria-label="Create a task"]')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
  }
  async function confirm(value: boolean): Promise<void> {
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    if (!ref) throw new Error('Expected task confirmation');
    const closed = firstValueFrom(ref.afterClosed()); ref.close(value); await closed;
  }
  function expectRowActionsLocked(): void {
    const controls = element().querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-task-id] input[type="checkbox"], [data-task-id] button');
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control.disabled).withContext(control.getAttribute('aria-label') ?? control.textContent ?? '').toBeTrue();
  }
  function dropList(name: 'OPEN' | 'DONE'): CdkDropList<readonly TaskRow[]> {
    const view = harness.routeDebugElement?.query(By.css(`#task-list-${name}`));
    if (!view) throw new Error(`Missing ${name} drop list`);
    return view.injector.get<CdkDropList<readonly TaskRow[]>>(CdkDropList);
  }
  function drag(id: number): CdkDrag<TaskRow> {
    const view = harness.routeDebugElement?.query(By.css(`[data-task-id="${id}"]`));
    if (!view) throw new Error(`Missing drag ${id}`);
    return view.injector.get<CdkDrag<TaskRow>>(CdkDrag);
  }
  function dropEvent(id: number, currentIndex: number): CdkDragDrop<readonly TaskRow[], readonly TaskRow[], TaskRow> {
    const item = drag(id);
    const container = dropList(item.data.task.completed ? 'DONE' : 'OPEN');
    return { item, container, previousContainer: container, previousIndex: container.data.indexOf(item.data), currentIndex,
      isPointerOverContainer: true, distance: { x: 0, y: 100 }, dropPoint: { x: 20, y: 150 }, event: new MouseEvent('mouseup') };
  }
  function startDrop(id: number, currentIndex: number): CdkDragDrop<readonly TaskRow[], readonly TaskRow[], TaskRow> {
    const event = dropEvent(id, currentIndex);
    const started: CdkDragStart<TaskRow> = { source: event.item, event: new MouseEvent('mousedown') };
    event.item.started.emit(started);
    return event;
  }
  function columnIds(name: 'OPEN' | 'DONE'): (string | null)[] {
    return [...element().querySelectorAll(`#task-list-${name} [data-task-id]`)].map(row => row.getAttribute('data-task-id'));
  }

  it('loads a ten-row page for guests with explicit snapshot and public assignment semantics', async () => {
    harness = await RouterTestingHarness.create('/tasks'); harness.fixture.autoDetectChanges();
    const page = http.expectOne(req => req.url === base);
    expect(page.request.params.get('limit')).toBe('10'); expect(page.request.params.get('skip')).toBe('0');
    expect(element().textContent).toContain('Loading tasks');
    flushPage(page, [task(1), task(2, true)], 30); await settle();
    expect(element().querySelector('h1')?.textContent).toBe('Tasks');
    expect(element().querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    expect(element().textContent).toContain('30 tasks at last load');
    expect(element().textContent).toContain('not your authenticated identity');
    expect(element().textContent).toContain('all writes are simulated, not durable');
    expect(element().querySelector('#column-OPEN')?.textContent).toContain('OPEN · 9');
    expect(element().querySelector('#column-DONE')?.textContent).toContain('DONE · 1');
    expect(input('input[type="number"]').value).toBe('1');
    expect(TestBed.inject(Router).url).toBe('/tasks');
  });

  for (const size of [10, 25, 50]) {
    it(`loads explicit URL page/filter with pageSize ${size}`, async () => {
      harness = await RouterTestingHarness.create(`/tasks?userId=7&page=2${size === 10 ? '' : `&pageSize=${size}`}`);
      harness.fixture.autoDetectChanges();
      const page = http.expectOne(req => req.url === `${base}/user/7`);
      expect(page.request.params.get('skip')).toBe(String(size)); expect(page.request.params.get('limit')).toBe(String(size));
      flushPage(page, [task(7, false, 7)], 100); await settle();
      expect(input('input[type="number"]').value).toBe('7');
      expect(element().textContent).toContain(`offset ${size}`);
    });
  }

  it('canonicalizes page and size without a broad first request or search query', async () => {
    await open('/tasks?userId=1&page=0002&pageSize=25&q=ignored&extra=ignored');
    expect(TestBed.inject(Router).url).toBe('/tasks?userId=1&page=2&pageSize=25');
    expect(element().textContent).toContain('offset 25');
    http.expectNone(() => true);
  });

  for (const query of ['userId=0', 'userId=', 'userId=01', 'userId=-1', 'userId=NaN', 'userId=1.5', 'userId=1%0A', 'userId=1&userId=2', 'userId=9007199254740992']) {
    it(`does not issue HTTP for invalid filter ${query}`, async () => {
      harness = await RouterTestingHarness.create(`/tasks?${query}`); harness.fixture.autoDetectChanges(); await settle();
      expect(element().textContent).toContain('Invalid userId filter');
      expect(button('Create task').disabled).toBeTrue();
      http.expectNone(() => true);
    });
  }

  it('requires explicit recovery from invalid URL to all users', async () => {
    harness = await RouterTestingHarness.create('/tasks?userId=bad'); harness.fixture.autoDetectChanges();
    http.expectNone(() => true); await navigateByClick(button('All users'));
    flushPage(http.expectOne(req => req.url === base)); await settle();
    expect(TestBed.inject(Router).url).toBe('/tasks'); expect(element().textContent).not.toContain('Invalid userId filter');
  });

  it('validates a filter edit without HTTP and applies a valid public ID to page one', async () => {
    await open('/tasks?page=2');
    await edit('form[aria-label="Filter tasks"] input', '0'); click('Apply filter'); await settle();
    expect(element().textContent).toContain('Enter a positive whole-number public user ID');
    const filterInput = input('form[aria-label="Filter tasks"] input');
    expect(filterInput.getAttribute('aria-invalid')).toBe('true');
    expect(filterInput.getAttribute('aria-describedby')?.split(' ')).toContain('filter-error');
    expect(element().querySelector('#filter-error')?.getAttribute('role')).toBe('alert');
    expect(TestBed.inject(Router).url).toBe('/tasks?page=2'); http.expectNone(() => true);
    await edit('form[aria-label="Filter tasks"] input', '2'); await navigateByClick(button('Apply filter'));
    const page = http.expectOne(req => req.url === `${base}/user/2`);
    expect(page.request.params.get('skip')).toBe('0'); flushPage(page, [task(2, false, 2)]); await settle();
    expect(TestBed.inject(Router).url).toBe('/tasks?userId=2');
    expect(filterInput.getAttribute('aria-invalid')).not.toBe('true');
    expect(filterInput.getAttribute('aria-describedby')?.split(' ')).not.toContain('filter-error');
  });

  it('pages with the native paginator and cancels an older read when the URL changes', async () => {
    await open('/tasks', [task(1), task(2)], 30);
    const next = element().querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    if (!next) throw new Error('Missing paginator'); await navigateByClick(next);
    const second = http.expectOne(req => req.url === base);
    expect(second.request.params.get('skip')).toBe('10');
    await harness.navigateByUrl('/tasks?page=3');
    expect(second.cancelled).toBeTrue();
    const third = http.expectOne(req => req.url === base); expect(third.request.params.get('skip')).toBe('20');
    flushPage(third, []); await settle(); expect(element().textContent).toContain('No tasks in this local page snapshot');
    await navigateByClick(button('First page'));
    const first = http.expectOne(req => req.url === base); expect(first.request.params.get('skip')).toBe('0'); flushPage(first); await settle();
  });

  it('shows a load failure and explicit reload recovery without stale rows', async () => {
    await open(); click('Reload page');
    http.expectOne(req => req.url === base).error(new ProgressEvent('error')); await settle();
    expect(element().textContent).toContain('Task request failed (network)');
    expect(element().querySelector('[data-task-id]')).toBeNull(); expect(button('Create task').disabled).toBeTrue();
    click('Reload page'); flushPage(http.expectOne(req => req.url === base), [], 0); await settle();
    expect(element().textContent).toContain('0 tasks at last load'); expect(element().textContent).not.toContain('Task request failed');
  });

  it('shows touched validation errors and sends no invalid draft', async () => {
    await open(); create(); await settle();
    expect(element().textContent).toContain('Task text is required');
    await draft('valid', ''); create(); await settle();
    expect(element().textContent).toContain('user ID is required');
    http.expectNone(req => req.method !== 'GET');
  });

  it('blocks creation admission while validation is pending, including direct form submission', async () => {
    await open(); await draft();
    const view = harness.routeDebugElement;
    if (!view) throw new Error('Task component missing');
    const component = view.injector.get(TasksComponent);
    // Validators are currently synchronous; simulate pending at the form-state boundary.
    const pending = signal(true);
    spyOnProperty(component['taskForm'](), 'pending', 'get').and.returnValue(pending.asReadonly());
    // Replacing the getter does not itself dirty the OnPush view or register the new signal.
    view.injector.get(ChangeDetectorRef).markForCheck();
    harness.detectChanges();
    expect(button('Create task').disabled).toBeTrue();
    create(); await settle();
    http.expectNone(req => req.method !== 'GET');
    expect(input('textarea').value).toBe('  New task  ');
    expect(input('textarea').disabled).toBeFalse();
    expect(element().textContent).not.toContain('Creation queued');
    expect(element().textContent).not.toContain('Creation in-flight');
    pending.set(false); await settle();
    expect(button('Create task').disabled).toBeFalse();
    create(); http.expectOne(`${base}/add`).flush({ id: 999, todo: 'New task', userId: 1, completed: false }); await settle();
  });

  it('blocks duplicate creation, preserves failed draft, and clears only after successful explicit retry', async () => {
    await open(); await draft(); create(); create();
    const request = http.expectOne(`${base}/add`);
    expect(request.request.body).toEqual({ todo: 'New task', userId: 1, completed: false });
    expect(input('textarea').disabled).toBeTrue(); expect(input('input[type="number"]').disabled).toBeTrue();
    expect(await TestBed.inject(Router).navigateByUrl('/dashboard')).toBeFalse();
    request.flush({}, { status: 503, statusText: 'Unavailable' }); await settle();
    expect(input('textarea').value).toBe('  New task  ');
    expect(element().querySelector('#creation-result-heading')).toBeNull();
    expect(element().textContent).toContain('Your draft is kept'); expect(button('Create task').disabled).toBeFalse();
    create(); http.expectOne(`${base}/add`).flush({ id: 999, todo: 'New task', userId: 1, completed: false }); await settle();
    expect(input('textarea').value).toBe(''); expect(input('input[type="number"]').value).toBe('1');
    expect(document.activeElement).toBe(element().querySelector('#creation-result-heading'));
    expect(element().textContent).toContain('not a durable created ID');
    expect(element().querySelector('[data-task-id="999"]')).toBeNull();
    expect(element().querySelector('.result button')).toBeNull(); expect(element().querySelector('.result a')).toBeNull();
    expect(element().textContent).toContain('2 tasks at last load');
    expect(await TestBed.inject(Router).navigateByUrl('/dashboard')).toBeTrue();
  });

  it('keeps the draft after malformed creation response and renders returned text as text', async () => {
    await open(); await draft('<img src=x onerror=alert(1)>'); create();
    http.expectOne(`${base}/add`).flush({ id: 999 }); await settle();
    expect(input('textarea').value).toBe('<img src=x onerror=alert(1)>');
    create(); http.expectOne(`${base}/add`).flush({ id: 999, todo: '<img src=x onerror=alert(1)>', userId: 1, completed: false }); await settle();
    expect(element().querySelector('.result')?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element().querySelector('img[src="x"]')).toBeNull();
  });

  it('locks queued rows immediately, rolls back only a failed row, and continues serial dispatch', async () => {
    await open('/tasks', [task(1), task(2), task(3)]);
    toggle(1); toggle(2); toggle(3);
    const first = http.expectOne(`${base}/1`); http.expectNone(`${base}/2`); http.expectNone(`${base}/3`);
    expect(checkbox(2).checked).toBeTrue(); expect(checkbox(2).disabled).toBeTrue();
    expect(action(2, 'Delete').disabled).toBeTrue();
    expect(element().querySelector('[data-task-id="2"]')?.textContent).toContain('Queued — waiting');
    expect(element().querySelector('[data-task-id="1"]')?.textContent).toContain('In flight');
    first.flush(task(1, true));
    http.expectOne(`${base}/2`).flush({}, { status: 500, statusText: 'Failed' });
    http.expectOne(`${base}/3`).flush(task(3, true)); await settle();
    expect(checkbox(1).checked).toBeTrue(); expect(checkbox(2).checked).toBeFalse(); expect(checkbox(3).checked).toBeTrue();
    expect(element().querySelector('[data-task-id="2"]')?.textContent).toContain('No automatic retry');
    expect(checkbox(2).disabled).toBeFalse(); toggle(2); http.expectOne(`${base}/2`).flush(task(2, true)); await settle();
    expect(element().querySelector('[data-task-id="2"]')?.textContent).not.toContain('No automatic retry');
  });

  it('blocks query-only, paging, reload, and leaving while writes are active, then permits reload', async () => {
    await open(); toggle(1); const write = http.expectOne(`${base}/1`);
    expect(button('Reload page').disabled).toBeTrue(); expect(button('Apply filter').disabled).toBeTrue();
    expect(element().querySelector('button[aria-label="Next page"]')?.getAttribute('aria-disabled')).toBe('true');
    const router = TestBed.inject(Router);
    for (const url of ['/tasks?page=2', '/tasks?userId=2', '/dashboard']) expect(await router.navigateByUrl(url)).toBeFalse();
    harness.detectChanges();
    expect(router.url).toBe('/tasks'); expect(element().textContent).toContain('Finish queued writes');
    http.expectNone(req => req.method === 'GET'); write.flush(task(1, true)); await settle();
    click('Reload page'); flushPage(http.expectOne(req => req.url === base)); await settle();
    expect(checkbox(1).checked).toBeFalse(); expect(button('Reload page').disabled).toBeFalse();
  });

  it('admits creation behind an active row, disables the draft immediately, and dispatches it once', async () => {
    await open(); await draft(); toggle(1); const active = http.expectOne(`${base}/1`);
    create(); create();
    expect(element().textContent).toContain('Creation queued');
    expect(input('textarea').disabled).toBeTrue(); expect(button('Create task').disabled).toBeTrue();
    http.expectNone(`${base}/add`);
    active.flush(task(1, true));
    const creation = http.expectOne(`${base}/add`);
    expect(creation.request.body).toEqual({ todo: 'New task', userId: 1, completed: false });
    creation.flush({}, { status: 503, statusText: 'Failure' }); await settle();
    expect(input('textarea').value).toBe('  New task  '); expect(input('textarea').disabled).toBeFalse();
    expect(checkbox(1).checked).toBeTrue();
  });

  it('shows the ten-operation bound and prevents an eleventh row admission', async () => {
    await open('/tasks?pageSize=25', Array.from({ length: 12 }, (_, index) => task(index + 1)));
    for (let id = 1; id <= 10; id++) toggle(id);
    expect(element().textContent).toContain('10 / 10 operations pending');
    expect(element().textContent).toContain('Queue full');
    expect(checkbox(11).disabled).toBeTrue(); expect(checkbox(11).checked).toBeFalse();
    expect(button('Create task').disabled).toBeTrue();
    for (let id = 1; id <= 10; id++) {
      const current = http.expectOne(`${base}/${id}`);
      if (id < 10) http.expectNone(`${base}/${id + 1}`);
      current.flush(task(id, true));
    }
    await settle(); expect(checkbox(11).disabled).toBeFalse(); expect(element().textContent).not.toContain('Queue full');
  });

  it('requires delete confirmation, blocks query changes during it, and leaves totals as loaded', async () => {
    await open(); const remove = action(1, 'Delete'); remove.focus(); remove.click(); harness.detectChanges();
    expectRowActionsLocked();
    action(2, 'Delete').click(); checkbox(2).click();
    element().querySelector<HTMLButtonElement>('[data-task-id="1"] [data-focus="down"]')?.click();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    expect(checkbox(2).checked).toBeFalse();
    expect([...element().querySelectorAll('[data-task-id]')].map(row => row.getAttribute('data-task-id'))).toEqual(['1', '2']);
    http.expectNone(req => req.method !== 'GET');
    http.expectNone(req => req.method === 'DELETE');
    expect(await TestBed.inject(Router).navigateByUrl('/tasks?page=2')).toBeFalse();
    await confirm(false); await settle(); expect(document.activeElement).toBe(remove);
    expect(remove.disabled).toBeFalse(); expect(action(2, 'Delete').disabled).toBeFalse();
    expect(checkbox(2).disabled).toBeFalse();
    expect(element().querySelector<HTMLButtonElement>('[data-task-id="1"] [data-focus="down"]')?.disabled).toBeFalse();
    expect(element().querySelector('[data-task-id="1"]')).not.toBeNull();
    remove.click(); await confirm(true);
    http.expectOne(`${base}/1`).flush({}, { status: 503, statusText: 'Failure' }); await settle();
    expect(element().querySelector('[data-task-id="1"]')).not.toBeNull();
    action(1, 'Delete').click(); await confirm(true);
    http.expectOne(`${base}/1`).flush({ id: 1, isDeleted: true, deletedOn: '2026-09-27T00:00:00.000Z' }); await settle();
    expect(element().querySelector('[data-task-id="1"]')).toBeNull();
    expect(element().textContent).toContain('2 tasks at last load'); expect(element().textContent).toContain('1 rows in local page snapshot');
    expect(element().textContent).toContain('Remote deletion simulated');
    click('Reload page'); flushPage(http.expectOne(req => req.url === base)); await settle();
    expect(element().querySelector('[data-task-id="1"]')).not.toBeNull();
  });

  it('protects dirty query-only navigation and resets assignment only after discard consent', async () => {
    await open(); await draft();
    const router = TestBed.inject(Router); const dialog = TestBed.inject(MatDialog);
    let opened = firstValueFrom(dialog.afterOpened);
    const cancelled = router.navigateByUrl('/tasks?userId=2'); await opened;
    harness.detectChanges(); expectRowActionsLocked();
    http.expectNone(req => req.method === 'GET'); await confirm(false);
    expect(await cancelled).toBeFalse(); await settle(); expect(input('textarea').value).toBe('  New task  ');
    opened = firstValueFrom(dialog.afterOpened);
    const accepted = router.navigateByUrl('/tasks?userId=2'); await opened; await confirm(true);
    expect(await accepted).toBeTrue(); flushPage(http.expectOne(req => req.url === `${base}/user/2`), [task(2, false, 2)]); await settle();
    expect(input('textarea').value).toBe(''); expect(input('input[type="number"]').value).toBe('2');
  });

  it('does not strand a dialog lock when newer navigation cancels the dirty guard', async () => {
    await open(); await draft(); const router = TestBed.inject(Router);
    const opened = firstValueFrom(TestBed.inject(MatDialog).afterOpened);
    const first = router.navigateByUrl('/dashboard'); await opened;
    expect(await router.navigateByUrl('/tasks?page=2')).toBeFalse(); expect(await first).toBeFalse();
    await confirm(false); await settle();
    create(); http.expectOne(`${base}/add`).flush({ id: 99, todo: 'New task', userId: 1, completed: false }); await settle();
    expect(button('Reload page').disabled).toBeFalse();
  });

  it('supports native keyboard-order controls and focus retention without HTTP or server order fields', async () => {
    await open('/tasks', [task(1), task(2), task(3, true)]);
    const down = element().querySelector<HTMLButtonElement>('[data-task-id="1"] button[data-focus="down"]');
    if (!down) throw new Error('Move button missing'); down.focus(); down.click(); await settle();
    expect([...element().querySelectorAll('.column:first-child [data-task-id]')].map(row => row.getAttribute('data-task-id'))).toEqual(['2', '1']);
    expect(element().textContent).toContain('Local order only; no request sent');
    expect(document.activeElement).toBe(element().querySelector('[data-task-id="1"] h3'));
    expect(element().querySelector('.column:last-child [data-task-id="3"]')).not.toBeNull();
    http.expectNone(() => true);
  });

  it('wires actual CDK lists, row data and labeled button handles without connecting columns', async () => {
    await open('/tasks', [task(1), task(2), task(3, true)]);
    expect(harness.routeDebugElement?.queryAll(By.directive(CdkDropList)).length).toBe(2);
    expect(harness.routeDebugElement?.queryAll(By.directive(CdkDrag)).length).toBe(3);
    const handles = harness.routeDebugElement?.queryAll(By.directive(CdkDragHandle)) ?? [];
    expect(handles.length).toBe(3);
    for (const name of ['OPEN', 'DONE'] as const) {
      const list = dropList(name);
      expect(list.id).toBe(`task-list-${name}`); expect(list.connectedTo).toEqual([]);
      expect(list.orientation).toBe('vertical');
      expect(list.getSortedItems().map(item => item.getRootElement().getAttribute('data-task-id'))).toEqual(columnIds(name));
    }
    expect(drag(1).data.task.id).toBe(1); expect(drag(1).dropContainer).toBe(dropList('OPEN'));
    expect(drag(1).lockAxis).toBe('y'); expect(drag(1).disabled).toBeFalse();
    expect(drag(3).disabled).toBeTrue(); expect(action(3, 'Drag').disabled).toBeTrue();
    for (const view of handles) {
      const handle = view.injector.get(CdkDragHandle);
      const native = handle.element.nativeElement;
      expect(native.tagName).toBe('BUTTON'); expect(native.getAttribute('type')).toBe('button');
      expect(native.textContent?.trim()).toBe('Drag'); expect(native.getAttribute('aria-label')).toContain('Drag task');
      expect(native.getAttribute('aria-describedby')).toBe('task-order-help');
    }
    expect(element().querySelector('[aria-grabbed], [aria-dropeffect]')).toBeNull();
    expect(element().querySelector('#task-order-help')?.textContent).toContain('same column only');
    expect(element().querySelector('#task-order-help')?.textContent).toContain('CDK does not supply keyboard dragging');
    expect(element().querySelector('#task-order-help')?.textContent).toContain('at least two rows');
    action(1, 'Drag').focus(); action(1, 'Drag').click(); await settle();
    expect(element().textContent).toContain('For keyboard ordering, use this task’s Move up/down buttons');
    expect(columnIds('OPEN')).toEqual(['1', '2']); expect(document.activeElement).toBe(action(1, 'Drag'));
    http.expectNone(() => true);
  });

  it('handles typed CDK drop output over arbitrary distances in either column and restores handle focus', async () => {
    await open('/tasks', [task(1), task(2), task(3), task(4), task(5, true), task(6, true), task(7, true)]);
    const down = startDrop(1, 3);
    down.container.dropped.emit(down); await settle();
    expect(columnIds('OPEN')).toEqual(['2', '3', '4', '1']);
    expect(document.activeElement).toBe(action(1, 'Drag'));
    expect(element().textContent).toContain('position 4 in OPEN. Local order only; no request sent');
    const up = startDrop(1, 0);
    up.container.dropped.emit(up); await settle();
    expect(columnIds('OPEN')).toEqual(['1', '2', '3', '4']);
    const done = startDrop(7, 0);
    done.container.dropped.emit(done); await settle();
    expect(columnIds('DONE')).toEqual(['7', '5', '6']);
    expect(columnIds('OPEN')).toEqual(['1', '2', '3', '4']);
    expect(element().textContent).toContain('7 tasks at last load');
    expect(checkbox(1).checked).toBeFalse(); expect(checkbox(7).checked).toBeTrue();
    http.expectNone(() => true);
  });

  it('ignores cross-column, outside, no-op, invalid and unstarted drop events without HTTP', async () => {
    await open('/tasks', [task(1), task(2), task(3), task(4, true)]);
    const unstarted = dropEvent(1, 2);
    unstarted.container.dropped.emit(unstarted);
    const cross = { ...startDrop(1, 0), container: dropList('DONE') };
    cross.container.dropped.emit(cross);
    const outside = { ...startDrop(1, 2), isPointerOverContainer: false };
    outside.container.dropped.emit(outside);
    for (const currentIndex of [0, -1, 3, 100, 0.5, NaN, Infinity]) {
      const event = startDrop(1, currentIndex); event.container.dropped.emit(event);
    }
    for (const previousIndex of [-1, 2, 3, 0.5, NaN, Infinity]) {
      const event = { ...startDrop(1, 2), previousIndex }; event.container.dropped.emit(event);
    }
    const mismatched = { ...startDrop(1, 2), item: drag(2) };
    mismatched.container.dropped.emit(mismatched);
    await settle();
    expect(columnIds('OPEN')).toEqual(['1', '2', '3']); expect(columnIds('DONE')).toEqual(['4']);
    expect(checkbox(1).checked).toBeFalse(); http.expectNone(() => true);
  });

  it('rejects a stale drag after another native move while preserving that keyboard move', async () => {
    await open('/tasks', [task(1), task(2), task(3), task(4)]);
    const stale = startDrop(1, 3);
    const down = element().querySelector<HTMLButtonElement>('[data-task-id="3"] [data-focus="down"]');
    if (!down) throw new Error('Missing native move');
    down.click(); await settle();
    // Source ID and index still match; only the captured snapshot reveals the stale gesture.
    stale.container.dropped.emit(stale); await settle();
    expect(columnIds('OPEN')).toEqual(['1', '2', '4', '3']);
    stale.container.dropped.emit(stale); await settle();
    expect(columnIds('OPEN')).toEqual(['1', '2', '4', '3']); http.expectNone(() => true);
  });

  it('disables pointer dragging during writes and rejects a gesture that became busy without bypassing PATCH', async () => {
    await open('/tasks', [task(1), task(2), task(3), task(4)]);
    const event = startDrop(1, 1);
    toggle(4); toggle(3);
    const write = http.expectOne(`${base}/4`);
    expect(write.request.method).toBe('PATCH'); expect(write.request.body).toEqual({ completed: true });
    http.expectNone(`${base}/3`);
    expect(dropList('OPEN').disabled).toBeTrue(); expect(dropList('DONE').disabled).toBeTrue();
    for (const id of [1, 2, 3, 4]) {
      expect(drag(id).disabled).toBeTrue(); expect(action(id, 'Drag').disabled).toBeTrue();
    }
    const handles = harness.routeDebugElement?.queryAll(By.directive(CdkDragHandle)) ?? [];
    for (const view of handles) expect(view.injector.get(CdkDragHandle).disabled).toBeTrue();
    event.container.dropped.emit(event); await renderPending();
    expect(columnIds('OPEN')).toEqual(['1', '2']);
    expect(element().querySelector<HTMLButtonElement>('[data-task-id="1"] [data-focus="down"]')?.disabled).toBeFalse();
    write.flush(task(4, true)); http.expectOne(`${base}/3`).error(new ProgressEvent('error')); await settle();
    expect(columnIds('OPEN')).toEqual(['1', '2', '3']); expect(columnIds('DONE')).toEqual(['4']);
    expect(drag(1).disabled).toBeFalse(); expect(action(1, 'Drag').disabled).toBeFalse();
    http.expectNone(() => true);
  });

  it('rejects a gesture that meets a confirmation lock and leaves dialog focus alone', async () => {
    await open('/tasks', [task(1), task(2), task(3)]);
    const event = startDrop(1, 2);
    const dialog = TestBed.inject(MatDialog);
    const opened = firstValueFrom(dialog.afterOpened);
    action(2, 'Delete').click();
    const ref = await opened;
    await firstValueFrom(ref.afterOpened());
    // Opening schedules autofocus after render; flush it before capturing dialog focus.
    TestBed.tick();
    expectRowActionsLocked(); expect(dropList('OPEN').disabled).toBeTrue();
    const cancel = document.getElementById(ref.id)?.querySelector<HTMLButtonElement>('button[data-cancel]');
    if (!cancel) throw new Error('Missing task confirmation cancel button');
    const focused = document.activeElement;
    expect(focused).toBe(cancel);
    event.container.dropped.emit(event); TestBed.tick();
    expect(document.activeElement).toBe(focused);
    expect(columnIds('OPEN')).toEqual(['1', '2', '3']); http.expectNone(() => true);
    await confirm(false); await settle(); expect(action(1, 'Drag').disabled).toBeFalse();
  });

  it('retains row focus across optimistic column move and rollback without stealing another row focus', async () => {
    await open(); toggle(1); await renderPending();
    expect(document.activeElement).toBe(element().querySelector('[data-task-id="1"] h3'));
    http.expectOne(`${base}/1`).error(new ProgressEvent('error')); await settle();
    expect(document.activeElement).toBe(element().querySelector('[data-task-id="1"] h3'));
    toggle(1); await renderPending(); action(2, 'Delete').focus();
    http.expectOne(`${base}/1`).error(new ProgressEvent('error')); await settle();
    expect(document.activeElement).toBe(action(2, 'Delete'));
  });

  it('labels mock creation honestly and requires an explicit page read rather than inserting the new record', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('mock') }] });
    http = TestBed.inject(HttpTestingController);
    await open(); await draft(); create();
    http.expectOne(`${base}/add`).flush({ id: 31, todo: 'New task', userId: 1, completed: false }); await settle();
    expect(element().textContent).toContain('Session mock mode'); expect(element().textContent).toContain('it may not be on this page');
    expect(document.activeElement).toBe(element().querySelector('#creation-result-heading'));
    expect(element().querySelector('[data-task-id="31"]')).toBeNull(); http.expectNone(() => true);
    click('Reload page'); flushPage(http.expectOne(req => req.url === base)); await settle();
    expect(element().querySelector('[data-task-id="31"]')).toBeNull();
    toggle(1); http.expectOne(`${base}/1`).flush(task(1, true)); await settle();
    expect(element().querySelector('[data-task-id="1"]')?.textContent).toContain('Updated in session mock data');
  });

  it('shows the bounded-write learning guide without claiming a full operator timeline', async () => {
    await open();
    const guide = element().querySelector('aside[aria-label="Tasks learning guide"]');
    expect(guide).not.toBeNull();
    expect([...guide?.querySelectorAll('strong') ?? []].map(label => label.textContent)).toEqual([
      'Concept:', 'Try it:', 'Angular mechanism:', 'Common mistake:', 'Revision prompt:'
    ]);
    for (const text of ['concatMap', '10', 'no HTTP', 'catchError inside concatMap', 'only the failed row',
      'Remote writes are simulated', 'does not roll back server work', 'cdkDrag', 'cdkDragHandle', 'cdkDropList',
      'typed drop event', 'immutably', 'native Move up/down', 'stale drop', 'completion PATCH']) {
      expect(guide?.textContent).toContain(text);
    }
    expect(guide?.textContent).not.toContain('exhaustMap');
    expect(guide?.textContent).not.toContain('timeline');
  });

  it('cancels active HTTP and discards queued writes on forced view destruction', async () => {
    await open(); toggle(1); toggle(2); const request = http.expectOne(`${base}/1`);
    harness.fixture.destroy(); expect(request.cancelled).toBeTrue();
    http.expectNone(`${base}/2`);
  });

  it('cancels a pending read on view destruction', async () => {
    harness = await RouterTestingHarness.create('/tasks'); const request = http.expectOne(req => req.url === base);
    harness.fixture.destroy(); expect(request.cancelled).toBeTrue();
  });
});
