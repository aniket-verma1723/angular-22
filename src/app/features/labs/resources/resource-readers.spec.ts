import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { API_CONFIG, createApiConfig } from '../../../core/config/api-config';
import { productFixture } from '../../../testing/product-fixtures';
import { RESOURCE_READ_PROVIDERS } from './resource-read';
import { createResourceReader } from './resource-readers';
import type { ResourceReader } from './resource-readers';

const BASE = 'https://example.test/resources';

@Component({
  selector: 'app-http-resource-reader-test',
  providers: RESOURCE_READ_PROVIDERS,
  template: '{{ reader.state().status }}'
})
class HttpResourceReaderHost {
  readonly reader = createResourceReader('httpResource');
}

describe('httpResource reactive request and publication boundary', () => {
  let fixture: ComponentFixture<HttpResourceReaderHost>;
  let reader: ResourceReader;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpResourceReaderHost],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: createApiConfig('remote', BASE) }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HttpResourceReaderHost);
    reader = fixture.componentInstance.reader;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function sync(): void {
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
  }

  it('invalidates state immediately but leaves replacement cancellation to the reactive effect', fakeAsync(() => {
    reader.load(1);
    sync();
    const old = http.expectOne(`${BASE}/products/1`);
    reader.load(2);
    // Destroy/recreate per ID would cancel immediately, rather than use the existing effect.
    expect(old.cancelled).toBeFalse();
    expect(reader.selectedId()).toBe(2);
    expect(reader.state()).toEqual({ status: 'loading', id: 2 });
    http.expectNone(() => true);
    sync();
    expect(old.cancelled).toBeTrue();
    http.expectOne(`${BASE}/products/2`).flush(productFixture({ id: 2 }));
    sync();
    expect(reader.state()).toEqual(jasmine.objectContaining({ status: 'resolved', id: 2 }));
  }));

  for (const response of ['old-id', 'new-id', 'malformed'] as const) {
    it(`discards an obsolete ${response} response between intent and effect without a transient error`, fakeAsync(() => {
      reader.load(1);
      sync();
      const old = http.expectOne(`${BASE}/products/1`);
      reader.load(2);
      expect(old.cancelled).toBeFalse();
      expect(reader.state()).toEqual({ status: 'loading', id: 2 });
      old.flush(response === 'malformed' ? { invalid: true }
        : productFixture({ id: response === 'old-id' ? 1 : 2, title: 'Obsolete response' }));
      expect(reader.state()).toEqual({ status: 'loading', id: 2 });
      flushMicrotasks();
      expect(reader.state()).toEqual({ status: 'loading', id: 2 });
      fixture.detectChanges();
      const current = http.expectOne(`${BASE}/products/2`);
      http.expectNone(() => true);
      expect(reader.state()).toEqual({ status: 'loading', id: 2 });
      current.flush(productFixture({ id: 2, title: 'Current response' }));
      sync();
      const state = reader.state();
      expect(state.status).toBe('resolved');
      if (state.status !== 'resolved') throw new Error('Expected the current read to resolve');
      expect(state.product.title).toBe('Current response');
      expect(state.product.id).toBe(2);
    }));
  }

  it('never exposes an invalid identity as a stale value during retry or overlapping same-ID Load', fakeAsync(() => {
    reader.load(1);
    sync();
    http.expectOne(`${BASE}/products/1`).flush(productFixture({ id: 2 }));
    sync();
    expect(reader.state()).toEqual({
      status: 'error', id: 1, message: 'The service returned an invalid product response.'
    });
    reader.load(1);
    expect(reader.state()).toEqual({ status: 'loading', id: 1 });
    sync();
    const retry = http.expectOne(`${BASE}/products/1`);
    reader.load(1);
    sync();
    http.expectNone(() => true);
    expect(retry.cancelled).toBeFalse();
    expect(reader.state()).toEqual({ status: 'loading', id: 1 });
    retry.flush(productFixture());
    sync();
    expect(reader.state().status).toBe('resolved');
    reader.load(1);
    expect(reader.state().status).toBe('reloading');
    sync();
    const reload = http.expectOne(`${BASE}/products/1`);
    reader.clear();
    expect(reload.cancelled).toBeTrue();
    expect(reader.state()).toEqual({ status: 'idle' });
    sync();
    http.expectNone(() => true);
  }));
});
