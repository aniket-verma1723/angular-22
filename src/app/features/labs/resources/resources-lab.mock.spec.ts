import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { defer, finalize, tap } from 'rxjs';
import { provideAppData } from '../../../core/config/app-data.providers.mock';
import { MockProductBackend } from '../../../core/mock/mock-product-backend.service';
import { SessionStore } from '../../../core/session/session.store';
import { ResourcesLabComponent } from './resources-lab.component';

describe('Resources lab with the existing local mock pipeline', () => {
  let fixture: ComponentFixture<ResourcesLabComponent>;
  let element: HTMLElement;
  let mock: MockProductBackend;
  let http: HttpTestingController;
  let reads: { path: string; responded: boolean; finalized: boolean }[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ResourcesLabComponent], providers: [
      provideAppData(), provideHttpClientTesting()
    ] });
    mock = TestBed.inject(MockProductBackend);
    reads = [];
    const handle = mock.handle.bind(mock);
    spyOn(mock, 'handle').and.callFake((request, path, url) => defer(() => {
      const read = { path, responded: false, finalized: false };
      reads.push(read);
      return handle(request, path, url).pipe(
        tap(() => { read.responded = true; }),
        finalize(() => { read.finalized = true; })
      );
    }));
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResourcesLabComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    TestBed.inject(SessionStore).logout();
    // Even an accidental fallthrough is held by the test backend, never the public API.
    http.verify();
  });

  function sync(): void {
    // TestBed.tick runs ApplicationRef.tick: with fakeAsync, draining root work there can
    // re-enter the application tick through NgZone. Start component effects first, then
    // drain promises outside change detection. Only the test advances delayed mock timers.
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
  }

  function choose(value: string): void {
    const control = element.querySelector('select');
    if (!control) throw new Error('Missing variant');
    control.value = value;
    control.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    sync();
  }

  function click(label: string): void {
    const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
    if (!button) throw new Error(`Missing action: ${label}`);
    button.click();
    sync();
  }

  function load(id: number): void {
    const control = element.querySelector('input');
    if (!control) throw new Error('Missing product ID');
    control.value = String(id);
    control.dispatchEvent(new Event('input'));
    click('Load product');
  }

  for (const variant of ['rxjs', 'httpResource', 'rxResource', 'resource']) {
    it(`${variant} replaces a slow mock read and never publishes it after the fast read`, fakeAsync(() => {
      choose(variant);
      expect(element.textContent).toContain('Public read mode: local mock');
      mock.enqueue({ outcome: 'success', delayMs: 80 });
      load(1);
      expect(element.querySelector('[role="status"]')?.textContent).toContain('loading');
      expect(reads).toEqual([{ path: '/products/1', responded: false, finalized: false }]);
      mock.enqueue({ outcome: 'success', delayMs: 10 });
      load(2);
      expect(reads).toEqual([
        { path: '/products/1', responded: false, finalized: true },
        { path: '/products/2', responded: false, finalized: false }
      ]);
      tick(10);
      sync();
      expect(element.querySelector('article')?.textContent).toContain('Product 2');
      tick(70);
      sync();
      expect(element.querySelector('article')?.textContent).toContain('Product 2');
      expect(element.querySelector('article')?.textContent).not.toContain('Product 1');
      expect(reads).toEqual([
        { path: '/products/1', responded: false, finalized: true },
        { path: '/products/2', responded: true, finalized: true }
      ]);
      http.expectNone(() => true);
    }));

    it(`${variant} clears a delayed reload without stale publication`, fakeAsync(() => {
      choose(variant);
      load(1);
      sync();
      expect(element.querySelector('article')).not.toBeNull();
      mock.enqueue({ outcome: 'success', delayMs: 100 });
      click('Reload selected product');
      expect(element.querySelector('.stale')).not.toBeNull();
      expect(reads).toEqual([
        { path: '/products/1', responded: true, finalized: true },
        { path: '/products/1', responded: false, finalized: false }
      ]);
      click('Clear selection');
      expect(reads[1]?.finalized).toBeTrue();
      tick(100);
      sync();
      expect(element.querySelector('[role="status"]')?.textContent).toContain('idle');
      expect(element.querySelector('article')).toBeNull();
      expect(element.querySelector('.stale')).toBeNull();
      expect(reads.length).toBe(2);
      expect(reads[1]?.responded).toBeFalse();
      http.expectNone(() => true);
    }));

    it(`${variant} exposes missing 999 and recovers through a valid explicit Load`, fakeAsync(() => {
      choose(variant);
      load(999);
      sync();
      expect(element.querySelector('#resource-read-error')?.textContent).toContain('Product not found');
      expect(reads).toEqual([{ path: '/products/999', responded: false, finalized: true }]);
      load(1);
      sync();
      expect(element.querySelector('[role="status"]')?.textContent).toContain('resolved');
      expect(element.querySelector('#resource-read-error')).toBeNull();
      expect(reads).toEqual([
        { path: '/products/999', responded: false, finalized: true },
        { path: '/products/1', responded: true, finalized: true }
      ]);
      http.expectNone(() => true);
    }));

    it(`${variant} does not turn a public 401 into a session logout or authentication call`, fakeAsync(() => {
      const session = TestBed.inject(SessionStore);
      session.establish({ id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner', role: 'learner' },
        crypto.randomUUID(), Date.now() + 60_000);
      choose(variant);
      mock.enqueue({ outcome: 401 });
      load(1);
      sync();
      expect(element.querySelector('#resource-read-error')?.textContent).toContain('public read');
      expect(session.currentUser()?.id).toBe(2);
      expect(reads).toEqual([{ path: '/products/1', responded: false, finalized: true }]);
      http.expectNone(() => true);
      session.logout();
    }));
  }
});
