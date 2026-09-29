import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { EMPTY, defer, finalize } from 'rxjs';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { productFixture } from '../../../testing/product-fixtures';
import { ResourcesLabComponent } from './resources-lab.component';
import type { ResourceVariant } from './resource-readers';

const BASE = 'https://example.test/public/v1';
const VARIANTS: readonly ResourceVariant[] = ['rxjs', 'httpResource', 'rxResource', 'resource'];

describe('ResourcesLabComponent: four actual HTTP readers', () => {
  let fixture: ComponentFixture<ResourcesLabComponent>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let intercepted: string[];
  let emptyNextResponse: boolean;
  let emptySubscriptions: number;
  let emptyTeardowns: number;

  beforeEach(() => {
    intercepted = [];
    emptyNextResponse = false;
    emptySubscriptions = 0;
    emptyTeardowns = 0;
    TestBed.configureTestingModule({
      imports: [ResourcesLabComponent],
      providers: [
        provideHttpClient(withInterceptors([(request, next) => {
          intercepted.push(request.url);
          if (emptyNextResponse) {
            emptyNextResponse = false;
            return defer(() => {
              emptySubscriptions++;
              return EMPTY.pipe(finalize(() => { emptyTeardowns++; }));
            });
          }
          return next(request);
        }])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: createApiConfig('remote', BASE) }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResourcesLabComponent);
    element = fixture.nativeElement;
    sync();
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    http.verify();
  });

  // Trigger resource effects before expecting HTTP. Never await stability with an unflushed read.
  function sync(): void {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable(); // Only after response/error/cancellation.
    sync();
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  }

  function click(label: string): void {
    button(label).click();
    sync();
  }

  function select(variant: string): void {
    const control = element.querySelector('select');
    if (!control) throw new Error('Missing read variant');
    control.value = variant;
    control.dispatchEvent(new Event('change'));
    sync();
  }

  function input(): HTMLInputElement {
    const control = element.querySelector('input');
    if (!control) throw new Error('Missing product ID');
    return control;
  }

  function edit(value: string): void {
    const control = input();
    control.value = value;
    control.dispatchEvent(new Event('input'));
  }

  function request(id = 1): TestRequest {
    const pending = http.expectOne(`${BASE}/products/${id}`);
    http.expectNone(() => true); // Also detects accidentally instantiated competing variants.
    return pending;
  }

  function status(): string {
    return element.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  }

  it('renders five learning sections, public mode, native labels and one idle owner', () => {
    expect(Array.from(element.querySelectorAll('h2')).map(item => item.textContent?.trim())).toEqual([
      'Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question'
    ]);
    expect(element.textContent).toContain('Public read mode: remote demo');
    expect(element.querySelector('label[for="resource-variant"]')).not.toBeNull();
    expect(element.querySelector('label[for="resource-product-id"]')).not.toBeNull();
    expect(element.querySelectorAll('app-resource-experiment').length).toBe(1);
    const ids = Array.from(element.querySelectorAll('[id]')).map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(status()).toContain('idle');
    expect(button('Retry read').disabled).toBeTrue();
    http.expectNone(() => true);
  });

  it('rejects an invalid variant without starting another reader', () => {
    select('invalid');
    expect(element.querySelector('#resource-variant-error')?.getAttribute('role')).toBe('alert');
    expect(element.querySelector('select')?.getAttribute('aria-describedby')).toContain('resource-variant-error');
    expect(element.querySelectorAll('app-resource-experiment').length).toBe(1);
    select('resource');
    expect(element.querySelector('#resource-variant-error')).toBeNull();
    http.expectNone(() => true);
  });

  for (const variant of VARIANTS) {
    describe(variant, () => {
      beforeEach(() => select(variant));

      it('stays idle until explicit Load, including edits and reselecting the variant', () => {
        edit('2');
        sync();
        select(variant);
        expect(input().value).toBe('2');
        expect(status()).toContain('idle');
        expect(button('Reload selected product').disabled).toBeTrue();
        http.expectNone(() => true);
      });

      it('sends exactly one correctly scoped public GET and renders validated safe text and zeroes', async () => {
        click('Load product');
        const pending = request();
        expect(status()).toContain('loading');
        expect(pending.request.method).toBe('GET');
        expect(pending.request.body).toBeNull();
        expect(pending.request.params.keys()).toEqual([]);
        expect(pending.request.credentials).toBe('omit');
        expect(pending.request.withCredentials).toBeFalse();
        expect(pending.request.transferCache).toBeFalse();
        expect(pending.request.cache).toBe('no-store');
        expect(pending.request.timeout).toBe(15_000);
        expect(pending.request.headers.has('Authorization')).toBeFalse();
        expect(intercepted).toEqual([`${BASE}/products/1`]);
        pending.flush({ ...productFixture({ title: '<img src=x onerror=alert(1)>', stock: 0, price: 0, rating: 0 }), privateField: 'not-rendered' });
        await settle();
        expect(status()).toContain('resolved');
        expect(element.querySelector('article')?.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(element.querySelector('article img')).toBeNull();
        expect(element.querySelector('article')?.textContent).toContain('$0.00');
        expect(element.textContent).not.toContain('not-rendered');
        expect(element.querySelector('[aria-busy="true"]')).toBeNull();
      });

      for (const invalid of ['', '0', '-1', '1.5', '1e2', 'NaN', 'Infinity', '9007199254740992', '1/2']) {
        it(`rejects invalid ID ${JSON.stringify(invalid)} before HTTP`, () => {
          edit(invalid);
          click('Load product');
          expect(input().getAttribute('aria-invalid')).toBe('true');
          expect(input().getAttribute('aria-describedby')).toContain('resource-id-error');
          expect(element.querySelector('#resource-id-error')?.getAttribute('role')).toBe('alert');
          expect(status()).toContain('idle');
          http.expectNone(() => true);
        });
      }

      it('recovers from invalid input through native form submission', async () => {
        edit('bad');
        click('Load product');
        edit('2');
        const form = element.querySelector('form');
        if (!form) throw new Error('Missing form');
        expect(form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))).toBeFalse();
        sync();
        request(2).flush(productFixture({ id: 2 }));
        await settle();
        expect(input().getAttribute('aria-invalid')).toBe('false');
        expect(status()).toContain('resolved');
      });

      for (const failure of ['404', 'network', 'format', 'identity', 'null', 'unsafe-image'] as const) {
        it(`handles ${failure} safely and permits explicit same-ID retry`, async () => {
          click('Load product');
          const pending = request();
          switch (failure) {
            case '404': pending.flush({ message: 'private-upstream-details' }, { status: 404, statusText: 'Missing' }); break;
            case 'network': pending.error(new ProgressEvent('error')); break;
            case 'format': pending.flush({ id: 1, title: 'private-upstream-details' }); break;
            case 'identity': pending.flush(productFixture({ id: 2 })); break;
            case 'null': pending.flush(null); break;
            case 'unsafe-image': pending.flush(productFixture({ thumbnail: 'javascript:alert(1)' })); break;
          }
          await settle();
          expect(status()).toContain('error');
          expect(element.querySelector('article')).toBeNull();
          expect(element.textContent).not.toContain('private-upstream-details');
          const error = element.querySelector('#resource-read-error');
          expect(error?.getAttribute('role')).toBe('alert');
          expect(button('Retry read').getAttribute('aria-describedby')).toBe('resource-read-error');
          if (failure === '404') expect(error?.textContent).toContain('Product not found');
          if (failure === 'identity' || failure === 'format' || failure === 'null' || failure === 'unsafe-image') {
            expect(error?.textContent).toContain('invalid product response');
          }
          http.expectNone(() => true); // No automatic retry.
          click('Retry read');
          expect(status()).toContain('loading');
          expect(element.querySelector('article')).toBeNull();
          expect(element.querySelector('.stale')).toBeNull();
          request().flush(productFixture());
          await settle();
          expect(status()).toContain('resolved');
          expect(element.querySelector('#resource-read-error')).toBeNull();
        });
      }

      for (const phase of ['initial', 'reload'] as const) {
        it(`turns EMPTY on ${phase} into a settled error without stale data and permits retry`, async () => {
          if (phase === 'reload') {
            click('Load product');
            request().flush(productFixture());
            await settle();
            expect(element.querySelector('article')).not.toBeNull();
          }
          emptyNextResponse = true;
          click(phase === 'initial' ? 'Load product' : 'Reload selected product');
          await settle();
          expect(emptySubscriptions).toBe(1);
          expect(emptyTeardowns).toBe(1);
          expect(fixture.isStable()).toBeTrue();
          expect(status()).toContain('error');
          expect(element.querySelector('[aria-busy="true"]')).toBeNull();
          expect(element.querySelector('article')).toBeNull();
          expect(element.querySelector('.stale')).toBeNull();
          expect(element.querySelector('#resource-read-error')?.textContent).toContain('The read failed or timed out. Try again.');
          expect(button('Retry read').disabled).toBeFalse();
          const attempts = phase === 'initial' ? 1 : 2;
          expect(intercepted.length).toBe(attempts);
          http.expectNone(() => true); // EMPTY came from the interceptor, with no automatic retry.
          click('Retry read');
          expect(status()).toContain('loading');
          expect(element.querySelector('article')).toBeNull();
          request().flush(productFixture({ title: 'Recovered from EMPTY' }));
          await settle();
          expect(intercepted.length).toBe(attempts + 1);
          expect(emptySubscriptions).toBe(1);
          expect(status()).toContain('resolved');
          expect(element.querySelector('#resource-read-error')).toBeNull();
          expect(element.querySelector('article')?.textContent).toContain('Recovered from EMPTY');
        });
      }

      it('times out at 15 seconds, cancels HTTP, and can retry', fakeAsync(() => {
        click('Load product');
        const pending = request();
        tick(14_999);
        sync();
        expect(pending.cancelled).toBeFalse();
        expect(status()).toContain('loading');
        tick(1);
        flushMicrotasks();
        sync();
        expect(pending.cancelled).toBeTrue();
        expect(status()).toContain('error');
        expect(element.querySelector('#resource-read-error')?.textContent).toContain('timed out');
        click('Retry read');
        request().flush(productFixture());
        flushMicrotasks();
        sync();
        expect(status()).toContain('resolved');
      }));

      it('ignores busy same-ID Loads but reloads the same completed ID without a cache', async () => {
        click('Load product');
        const first = request();
        click('Load product');
        http.expectNone(() => true);
        expect(first.cancelled).toBeFalse();
        first.flush(productFixture());
        await settle();
        click('Load product');
        const reload = request();
        expect(status()).toContain('reloading');
        expect(element.querySelector('.stale')?.textContent).toContain('previous result is stale');
        expect(element.querySelector('article')?.textContent).toContain('Test notebook');
        click('Load product');
        http.expectNone(() => true);
        reload.flush(productFixture({ title: 'Updated notebook' }));
        await settle();
        expect(element.querySelector('.stale')).toBeNull();
        expect(element.querySelector('article')?.textContent).toContain('Updated notebook');
        click('Reload selected product');
        request().flush(productFixture());
        await settle();
        expect(intercepted.length).toBe(3);
      });

      it('drops stale data after a failed reload', async () => {
        click('Load product');
        request().flush(productFixture());
        await settle();
        click('Reload selected product');
        request().flush({}, { status: 503, statusText: 'Unavailable' });
        await settle();
        expect(status()).toContain('error');
        expect(element.querySelector('article')).toBeNull();
        expect(element.querySelector('.stale')).toBeNull();
      });

      it('cancels replacement reads and never publishes the old response', async () => {
        click('Load product');
        const old = request();
        edit('2');
        click('Load product');
        expect(old.cancelled).toBeTrue();
        expect(() => old.flush(productFixture({ title: 'Obsolete product' }))).toThrow();
        request(2).flush(productFixture({ id: 2, title: 'Latest product' }));
        await settle();
        expect(element.querySelector('article')?.textContent).toContain('Latest product');
        expect(element.textContent).not.toContain('Obsolete product');
      });

      it('rejects a new response with the previous ID after replacement', async () => {
        click('Load product');
        request().flush(productFixture());
        await settle();
        edit('2');
        click('Load product');
        expect(element.querySelector('article')).toBeNull();
        request(2).flush(productFixture({ id: 1 }));
        await settle();
        expect(status()).toContain('error');
        expect(element.querySelector('#resource-read-error')?.textContent).toContain('invalid product response');
      });

      it('does not publish a response delivered between a new intent and its resource effect', async () => {
        click('Load product');
        const old = request();
        edit('2');
        button('Load product').click(); // Intentionally do not tick effects yet.
        if (!old.cancelled) old.flush(productFixture({ title: 'Old in-flight result' }));
        sync();
        expect(status()).toContain('loading');
        expect(element.querySelector('article')).toBeNull();
        expect(element.querySelector('#resource-read-error')).toBeNull();
        request(2).flush(productFixture({ id: 2, title: 'Current result' }));
        await settle();
        expect(element.querySelector('article')?.textContent).toContain('Current result');
        expect(element.textContent).not.toContain('Old in-flight result');
        expect(status()).toContain('resolved');
      });

      it('Clear cancels pending HTTP immediately, restores input focus and permits the same ID again', async () => {
        click('Load product');
        const pending = request();
        click('Clear selection');
        expect(pending.cancelled).toBeTrue();
        await settle();
        expect(status()).toContain('idle');
        expect(element.textContent).toContain('Selected ID: none');
        expect(input().value).toBe('');
        expect(document.activeElement).toBe(input());
        expect(element.querySelector('article')).toBeNull();
        click('Clear selection');
        http.expectNone(() => true);
        edit('1');
        click('Load product');
        request().flush(productFixture());
        await settle();
        expect(status()).toContain('resolved');
      });

      it('clears a successful value back to a genuine idle/empty view', async () => {
        click('Load product');
        request().flush(productFixture());
        await settle();
        click('Clear selection');
        await settle();
        expect(status()).toContain('idle');
        expect(element.querySelector('article')).toBeNull();
        http.expectNone(() => true);
      });

      it('cancels pending HTTP when the entire lab is destroyed', async () => {
        click('Load product');
        const pending = request();
        fixture.destroy();
        expect(pending.cancelled).toBeTrue();
        await Promise.resolve();
        http.expectNone(() => true);
      });

      for (const next of VARIANTS.filter(value => value !== variant)) {
        it(`destroys ${variant} on switching to ${next}, leaving the new owner idle`, async () => {
          click('Load product');
          const old = request();
          select(next);
          expect(old.cancelled).toBeTrue();
          await settle();
          expect(status()).toContain('idle');
          expect(element.textContent).toContain('Selected ID: none');
          expect(element.querySelectorAll('app-resource-experiment').length).toBe(1);
          http.expectNone(() => true);
          click('Load product');
          request().flush(productFixture());
          await settle();
          expect(status()).toContain('resolved');
        });
      }
    });
  }
});
