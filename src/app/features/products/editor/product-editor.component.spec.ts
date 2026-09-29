import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, filter, firstValueFrom, timeout } from 'rxjs';
import { appConfig } from '../../../app.config';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { productDraftFixture, productFixture } from '../../../testing/product-fixtures';
import { CartService } from '../../cart/data/cart.service';
import { SessionStore } from '../../../core/session/session.store';
import { establishSessionFixture } from '../../../testing/session-fixtures';

describe('Product Signal Forms editor', () => {
  const base = 'https://dummyjson.com/products';
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    establishSessionFixture(TestBed.inject(SessionStore));
  });
  afterEach(() => http.verify());

  async function open(url = '/products/new'): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    http.expectOne(`${base}/categories`).flush([{ slug: 'stationery', name: 'Stationery' }]);
    if (url.startsWith('/products/1/edit')) http.expectOne(`${base}/1`).flush(productFixture());
    harness.fixture.autoDetectChanges();
    await harness.fixture.whenStable();
  }
  function loader() { return TestbedHarnessEnvironment.loader(harness.fixture); }
  async function button(text: string) { return loader().getHarness(MatButtonHarness.with({ text })); }
  async function fill(): Promise<void> {
    const inputs = await loader().getAllHarnesses(MatInputHarness);
    for (const [index, value] of ['  New notebook  ', '  Practice product  ', '9.5', '4'].entries()) await inputs[index].setValue(value);
    await (await loader().getHarness(MatSelectHarness)).clickOptions({ text: 'Stationery' });
  }
  function send(): void {
    harness.routeNativeElement?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
  }
  async function settle(): Promise<void> { await harness.fixture.whenStable(); harness.detectChanges(); }
  function mutationErrorRendered(): Promise<void> {
    const root = harness.routeNativeElement;
    if (!root) throw new Error('Expected the product editor.');
    // whenStable does not own submit()'s promise chain. Observe its actual signal-driven
    // output without forcing a render; the deadline only fails missing notifications.
    return firstValueFrom(new Observable<void>(subscriber => {
      const observer = new MutationObserver(() => subscriber.next());
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      subscriber.next();
      return () => observer.disconnect();
    }).pipe(filter(() => root.textContent?.includes('Product operation failed') === true), timeout(3000)));
  }
  async function confirm(value: boolean): Promise<void> {
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    if (!ref) throw new Error('Expected a confirmation dialog.');
    const closed = firstValueFrom(ref.afterClosed());
    ref.close(value);
    await closed;
    await settle();
  }

  it('binds Material input/select values, submits only draft fields and labels remote create honestly', async () => {
    await open('/products/new?id=999&q=notebook'); await fill(); send();
    const request = http.expectOne(`${base}/add`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(productDraftFixture());
    request.flush({ ...productDraftFixture(), id: 301 }); await settle();
    expect(harness.routeNativeElement?.textContent).toContain('Simulated save only');
    expect(harness.routeNativeElement?.querySelector('a[href="#/products/301"]')).toBeNull();
    expect(await (await button('Save product')).isDisabled()).toBeTrue();
    expect(harness.routeNativeElement?.textContent).toContain('No unsaved field changes');
    await (await button('Create another product')).click();
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('');
    expect(await (await loader().getHarness(MatSelectHarness)).getValueText()).toContain('Choose a category');
  });

  it('shows touched Material errors and focuses the first invalid field without sending', async () => {
    await open(); send(); await settle();
    expect(harness.routeNativeElement?.querySelector('mat-error')?.textContent).toContain('Title is required');
    expect(document.activeElement?.getAttribute('name')).toBe(harness.routeNativeElement?.querySelector('input')?.name ?? null);
    http.expectNone(req => req.method !== 'GET');
  });

  it('prefills edit values; confirmed reset restores values, touched errors and select state', async () => {
    await open('/products/1/edit');
    const inputs = await loader().getAllHarnesses(MatInputHarness);
    expect(await inputs[0].getValue()).toBe('Test notebook');
    await inputs[0].setValue(''); await inputs[0].blur();
    expect(harness.routeNativeElement?.textContent).toContain('Title is required');
    await (await button('Reset draft')).click(); await confirm(false);
    expect(await inputs[0].getValue()).toBe('');
    await (await button('Reset draft')).click(); await confirm(true);
    expect(await inputs[0].getValue()).toBe('Test notebook');
    expect(harness.routeNativeElement?.querySelector('mat-error')).toBeNull();
    expect(await (await loader().getHarness(MatSelectHarness)).getValueText()).toBe('Stationery');
    expect(harness.routeNativeElement?.textContent).toContain('No unsaved field changes');
  });

  it('disables Material controls during a write, prevents duplicates and blocks leaving', async () => {
    await open('/products/1/edit'); await fill(); send(); send();
    const request = http.expectOne(`${base}/1`);
    expect(request.request.method).toBe('PATCH');
    expect(harness.routeNativeElement?.querySelector('input')?.disabled).toBeTrue();
    expect(harness.routeNativeElement?.querySelector('mat-select')?.getAttribute('aria-disabled')).toBe('true');
    expect(await TestBed.inject(Router).navigateByUrl('/dashboard')).toBeFalse();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
    request.flush({ ...productDraftFixture(), id: 1 }); await settle();
    expect(harness.routeNativeElement?.querySelector('input')?.disabled).toBeFalse();
    expect(await TestBed.inject(Router).navigateByUrl('/dashboard')).toBeTrue();
  });

  it('retains the draft after server failure and permits explicit retry without editing', async () => {
    await open(); await fill(); send();
    http.expectOne(`${base}/add`).flush({}, { status: 503, statusText: 'Unavailable' });
    await mutationErrorRendered(); await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Product operation failed');
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('  New notebook  ');
    send();
    http.expectOne(`${base}/add`).flush({ ...productDraftFixture(), id: 31 }); await settle();
    expect(harness.routeNativeElement?.textContent).toContain('Simulated save only');
  });

  it('protects dirty navigation including reused edit IDs and clears the old draft only after consent', async () => {
    await open('/products/1/edit'); await fill();
    const router = TestBed.inject(Router);
    const dialog = TestBed.inject(MatDialog);
    let opened = firstValueFrom(dialog.afterOpened);
    const cancelled = router.navigateByUrl('/products/2/edit'); await opened;
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    http.expectNone(`${base}/2`);
    await confirm(false); expect(await cancelled).toBeFalse();
    expect(router.url).toBe('/products/1/edit');
    opened = firstValueFrom(dialog.afterOpened);
    const accepted = router.navigateByUrl('/products/2/edit'); await opened; await confirm(true);
    expect(await accepted).toBeTrue();
    http.expectOne(`${base}/2`).flush(productFixture({ id: 2, title: 'Second product' })); await settle();
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('Second product');
  });

  it('does not reload or overwrite drafts on query-only navigation', async () => {
    await open('/products/1/edit'); await fill();
    await harness.navigateByUrl('/products/1/edit?q=kept&id=999');
    http.expectNone(() => true);
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('  New notebook  ');
  });

  it('cancels stale detail reads and category requests on teardown', async () => {
    harness = await RouterTestingHarness.create('/products/1/edit');
    const categories = http.expectOne(`${base}/categories`);
    const first = http.expectOne(`${base}/1`);
    await harness.navigateByUrl('/products/2/edit');
    expect(first.cancelled).toBeTrue();
    const second = http.expectOne(`${base}/2`);
    await harness.navigateByUrl('/dashboard');
    expect(second.cancelled).toBeTrue(); expect(categories.cancelled).toBeTrue();
  });

  it('cancels an active write on forced destruction without leaving an unhandled rejection', async () => {
    await open(); await fill(); send();
    const request = http.expectOne(`${base}/add`);
    harness.fixture.destroy();
    expect(request.cancelled).toBeTrue(); await Promise.resolve();
  });

  it('requires delete confirmation, preserves dirty data on failure and reports remote deletion', async () => {
    await open('/products/1/edit'); await fill();
    await (await button('Delete product')).click(); await confirm(false);
    http.expectNone(req => req.method === 'DELETE');
    await (await button('Delete product')).click(); await confirm(true);
    http.expectOne(`${base}/1`).flush({}, { status: 403, statusText: 'Forbidden' }); await settle();
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('  New notebook  ');
    await (await button('Delete product')).click(); await confirm(true);
    http.expectOne(`${base}/1`).flush({ id: 1, isDeleted: true, deletedOn: '2026-09-27T00:00:00.000Z' }); await settle();
    expect(harness.routeNativeElement?.textContent).toContain('Simulated deletion only');
    expect(harness.routeNativeElement?.textContent).toContain('original remote product still exists');
    expect(await (await button('Delete product')).isDisabled()).toBeTrue();
    expect(await TestBed.inject(Router).navigateByUrl('/dashboard')).toBeTrue();
  });

  it('exposes fetchable links only for session saves and preserves cart snapshots', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: createApiConfig('mock') }] });
    http = TestBed.inject(HttpTestingController);
    const cart = TestBed.inject(CartService); cart.add(productFixture());
    establishSessionFixture(TestBed.inject(SessionStore));
    await open('/products/1/edit'); await fill(); send();
    http.expectOne(`${base}/1`).flush({ ...productDraftFixture(), id: 1 }); await settle();
    expect(harness.routeNativeElement?.querySelector('a[href="#/products/1"]')).not.toBeNull();
    expect(cart.lines()[0].unitPriceCents).toBe(1250);
    expect(cart.lines()[0].title).toBe('Test notebook');
  });

  for (const id of ['0', 'abc', '1.5', '9007199254740992']) {
    it(`rejects invalid edit ID ${id}`, async () => {
      await open(`/products/${id}/edit`);
      expect(harness.routeNativeElement?.textContent).toContain('Invalid product link');
      http.expectNone(req => req.url !== `${base}/categories`);
    });
  }

  it('retains a draft while independently retrying category loading', async () => {
    harness = await RouterTestingHarness.create('/products/new'); harness.fixture.autoDetectChanges();
    http.expectOne(`${base}/categories`).error(new ProgressEvent('error')); await settle();
    await (await loader().getAllHarnesses(MatInputHarness))[0].setValue('Keep this');
    await (await button('Try again')).click();
    http.expectOne(`${base}/categories`).flush([{ slug: 'stationery', name: 'Stationery' }]); await settle();
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('Keep this');
    http.expectNone(req => req.method !== 'GET');
  });

  it('sends only changed PATCH fields and avoids a no-op write after success', async () => {
    await open('/products/1/edit');
    await (await loader().getAllHarnesses(MatInputHarness))[0].setValue('Updated title'); send();
    const request = http.expectOne(`${base}/1`);
    expect(request.request.body).toEqual({ title: 'Updated title' });
    request.flush(productFixture({ title: 'Updated title' })); await settle(); send(); await settle();
    http.expectNone(req => req.method !== 'GET');
    expect(harness.routeNativeElement?.textContent).toContain('No product changes to save');
  });

  it('unlocks a confirmation even when a newer navigation unsubscribes its guard', async () => {
    await open('/products/1/edit'); await fill();
    const router = TestBed.inject(Router);
    const opened = firstValueFrom(TestBed.inject(MatDialog).afterOpened);
    const leaving = router.navigateByUrl('/dashboard'); await opened;
    await router.navigateByUrl('/products/1/edit?q=new');
    expect(await leaving).toBeFalse(); await confirm(false);
    send(); http.expectOne(`${base}/1`).flush({ ...productDraftFixture(), id: 1 }); await settle();
    expect(harness.routeNativeElement?.textContent).toContain('Simulated save only');
  });

  it('uses cancel as the dialog default and restores the reset button focus', async () => {
    await open('/products/1/edit');
    const reset = await button('Reset draft'); await reset.focus(); await reset.click();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    if (!ref) throw new Error('Expected reset confirmation');
    await firstValueFrom(ref.afterOpened());
    // Material schedules focus with afterNextRender after its opened event.
    await harness.fixture.whenStable();
    expect(document.activeElement?.textContent).toContain('Keep editing');
    await confirm(false);
    expect(await reset.isFocused()).toBeTrue();
  });

  it('keeps unknown existing categories selectable but requires loaded choices before saving', async () => {
    harness = await RouterTestingHarness.create('/products/1/edit'); harness.fixture.autoDetectChanges();
    http.expectOne(`${base}/1`).flush(productFixture({ category: 'legacy-category' }));
    await settle();
    expect(await (await button('Save product')).isDisabled()).toBeTrue();
    http.expectOne(`${base}/categories`).flush([]); await settle();
    expect(await (await loader().getHarness(MatSelectHarness)).getValueText()).toContain('legacy-category (existing)');
    expect(await (await button('Save product')).isDisabled()).toBeFalse();
  });

  for (const status of [401, 403, 404, 500]) {
    it(`shows an edit load failure for HTTP ${status} without a writable form`, async () => {
      harness = await RouterTestingHarness.create('/products/1/edit');
      http.expectOne(`${base}/categories`).flush([]);
      http.expectOne(`${base}/1`).flush({}, { status, statusText: 'Failed' }); harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
      expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
    });
  }

  it('does not clear a dirty draft for a malformed mutation response', async () => {
    await open(); await fill(); send();
    http.expectOne(`${base}/add`).flush({ id: 31 });
    await mutationErrorRendered(); await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Product operation failed');
    expect(harness.routeNativeElement?.textContent).toContain('Unsaved changes');
    expect(await (await button('Save product')).isDisabled()).toBeFalse();
  });

  it('blocks new writes after session loss while keeping the draft', async () => {
    await open(); await fill(); TestBed.inject(SessionStore).logout(); send(); await settle();
    http.expectNone(req => req.method !== 'GET');
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('  New notebook  ');
    expect(await (await button('Save product')).isDisabled()).toBeTrue();
  });

  it('rechecks session access after delete confirmation', async () => {
    await open('/products/1/edit'); await (await button('Delete product')).click();
    TestBed.inject(SessionStore).logout(); await confirm(true);
    http.expectNone(req => req.method === 'DELETE');
    expect(harness.routeNativeElement?.textContent).toContain('active local demo-admin session is required');
  });
});
