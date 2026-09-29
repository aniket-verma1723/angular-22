import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import type { HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, defer, map, of, throwError, timer } from 'rxjs';
import type { Observable } from 'rxjs';
import { ApiError } from '../http/api-error';
import type { DemoProfile } from '../session/session.models';
import { parseCheckoutRequest } from '../../features/checkout/data/checkout.parsers';
import type { ProductDto } from '../../features/products/data/product.models';
import { parseCategorySlug, parseProductDraft, parseProductId, parseProductPatch } from '../../features/products/data/product.parsers';
import { createProductSeeds, MOCK_CATEGORIES, MOCK_IMAGE, MOCK_TIMESTAMP } from './product-seeds';
import { dispatchRelationshipRead } from './relationship-mock';
import { TaskMock } from './task-mock';

export type MockOutcome = 'success' | 'empty' | 'malformed' | 'network' |
  400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

export interface MockScenario {
  readonly outcome: MockOutcome;
  readonly delayMs?: number;
}

interface MockResult {
  readonly body: unknown;
  readonly status?: number;
}

// Explicitly provided only by the mock entry point; never imported by the production provider.
@Injectable()
export class MockProductBackend {
  private products = createProductSeeds();
  private readonly tasks = new TaskMock();
  private nextId = 31;
  private nextReceiptId = 1;
  private readonly sessions = new Map<string, { readonly profile: DemoProfile; readonly expiresAt: number }>();
  private generation = 0;
  private scenario: MockScenario = { outcome: 'success' };
  private queued: readonly MockScenario[] = [];

  setScenario(scenario: MockScenario): void {
    this.scenario = this.validateScenario(scenario);
  }

  enqueue(scenario: MockScenario): void {
    this.queued = [...this.queued, this.validateScenario(scenario)];
  }

  reset(): void {
    this.products = createProductSeeds();
    this.tasks.reset();
    this.nextId = 31;
    this.nextReceiptId = 1;
    this.sessions.clear();
    this.scenario = { outcome: 'success' };
    this.queued = [];
    this.generation++;
  }

  handle(request: HttpRequest<unknown>, path: string, url: URL): Observable<HttpResponse<unknown>> {
    return defer(() => {
      const scenario = this.queued[0] ?? this.scenario;
      this.queued = this.queued.slice(1);
      const generation = this.generation;
      const respond = (): HttpResponse<unknown> => {
        // A delayed operation must not restore stale data after a reset.
        if (generation !== this.generation) throw this.failure(409);
        const outcome = scenario.outcome;
        if (typeof outcome === 'number') throw this.failure(outcome);
        if (outcome === 'network') throw this.failure(0);
        // Failure scenarios never commit a mutation, including malformed success responses.
        if (outcome === 'malformed') return new HttpResponse({ body: { invalid: true } });
        const result = this.dispatch(request, path, url.searchParams, outcome === 'empty');
        // HttpResponse bodies are not deeply immutable. Do not expose references to the database.
        return new HttpResponse({ body: structuredClone(result.body), status: result.status ?? 200 });
      };
      const delayMs = scenario.delayMs ?? 0;
      // Commit at response time: unsubscribe before the timer fires cancels mock writes too.
      return (delayMs === 0 ? of(0) : timer(delayMs)).pipe(map(respond));
    }).pipe(catchError((error: unknown) => throwError(() => error instanceof HttpErrorResponse
      ? error : this.failure(error instanceof ApiError ? 422 : 500))));
  }

  private dispatch(request: HttpRequest<unknown>, path: string, params: URLSearchParams, empty: boolean): MockResult {
    if (/^\/todos(?:\/|$)/.test(path)) {
      return this.tasks.dispatch(request, path, params, empty);
    }
    if (/^\/(?:users|posts)(?:\/|$)/.test(path)) {
      return dispatchRelationshipRead(request.method, path, params, empty);
    }
    if (request.method === 'GET') {
      if (path === '/products/categories') {
        return { body: empty ? [] : MOCK_CATEGORIES };
      }
      if (path === '/products' || path === '/products/search' || path.startsWith('/products/category/')) {
        return { body: this.list(path, params, empty) };
      }
    }
    if (empty) throw this.failure(400);
    if (request.method === 'POST' && path === '/auth/login') {
      const body = request.body;
      if (typeof body !== 'object' || body === null || !('username' in body) || !('password' in body) ||
          !('expiresInMins' in body) || body.expiresInMins !== 30) throw this.failure(422);
      // Public fictional credentials only. Tokens are generated at runtime, never committed fixtures.
      const profile = body.username === 'emilys' && body.password === 'emilyspass'
        ? { id: 1, username: 'emilys', firstName: 'Emily', lastName: 'Johnson' }
        : body.username === 'learner' && body.password === 'practice-only'
          ? { id: 2, username: 'learner', firstName: 'Demo', lastName: 'Learner' } : null;
      if (!profile) throw this.failure(401);
      for (const [token, session] of this.sessions) {
        if (session.profile.id === profile.id || session.expiresAt <= Date.now()) this.sessions.delete(token);
      }
      const accessToken = crypto.randomUUID();
      this.sessions.set(accessToken, { profile, expiresAt: Date.now() + 30 * 60_000 });
      return { body: { ...profile, accessToken } };
    }
    if (request.method === 'GET' && path === '/auth/me') {
      const authorization = request.headers.get('Authorization') ?? '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const session = this.sessions.get(token);
      if (!session || session.expiresAt <= Date.now()) { this.sessions.delete(token); throw this.failure(401); }
      return { body: session.profile };
    }
    if (request.method === 'POST' && path === '/carts/add') {
      const draft = parseCheckoutRequest(request.body);
      if (draft.userId !== 1 && draft.userId !== 2) throw this.failure(422);
      const products = draft.products.map(item => {
        const product = this.products.find(product => product.id === item.id);
        if (!product) throw this.failure(404);
        if (item.quantity > product.stock) throw this.failure(409);
        const priceCents = Math.round((product.price + Number.EPSILON * product.price) * 100);
        return { id: item.id, quantity: item.quantity, title: product.title, price: priceCents / 100,
          total: priceCents * item.quantity / 100 };
      });
      const total = products.reduce((sum, item) => sum + Math.round(item.total * 100), 0) / 100;
      // Receipt simulation only: no order storage, payment or inventory deduction.
      return { status: 201, body: { id: this.nextReceiptId++, userId: draft.userId, products, total,
        discountedTotal: total, totalProducts: products.length,
        totalQuantity: products.reduce((sum, item) => sum + item.quantity, 0) } };
    }
    if (request.method === 'POST' && path === '/products/add') {
      const draft = parseProductDraft(request.body);
      this.requireCategory(draft.category);
      const product: ProductDto = { ...draft, id: this.nextId++, rating: 0,
        thumbnail: MOCK_IMAGE, images: [MOCK_IMAGE], reviews: [] };
      this.products = [...this.products, product];
      return { body: product, status: 201 };
    }
    const match = /^\/products\/(\d+)$/.exec(path);
    if (!match) throw this.failure(501);
    const id = parseProductId(Number(match[1]));
    const product = this.products.find(item => item.id === id);
    if (!product) throw this.failure(404);
    switch (request.method) {
      case 'GET': return { body: product };
      case 'PATCH': {
        const patch = parseProductPatch(request.body);
        if (patch.category !== undefined) this.requireCategory(patch.category);
        const updated = { ...product, ...patch };
        this.products = this.products.map(item => item.id === id ? updated : item);
        return { body: updated };
      }
      case 'DELETE': {
        this.products = this.products.filter(item => item.id !== id);
        return { body: { id, isDeleted: true, deletedOn: MOCK_TIMESTAMP } };
      }
      default: throw this.failure(501);
    }
  }

  private list(path: string, params: URLSearchParams, empty: boolean): unknown {
    const allowed = ['skip', 'limit', 'sortBy', 'order', ...(path === '/products/search' ? ['q'] : [])];
    params.forEach((_, key) => {
      if (!allowed.includes(key) || params.getAll(key).length !== 1) throw this.failure(400);
    });
    const skip = this.pageNumber(params.get('skip'), 0);
    const limit = this.pageNumber(params.get('limit'), 12);
    if (limit > 100) throw this.failure(400);
    const sortBy = params.get('sortBy') ?? 'title';
    const order = params.get('order') ?? 'asc';
    if ((sortBy !== 'title' && sortBy !== 'price' && sortBy !== 'rating') ||
        (order !== 'asc' && order !== 'desc')) throw this.failure(400);
    let products = this.products;
    if (path === '/products/search') {
      const term = (params.get('q') ?? '').trim().toLowerCase();
      products = products.filter(product => `${product.title} ${product.description}`.toLowerCase().includes(term));
    } else if (path.startsWith('/products/category/')) {
      const category = parseCategorySlug(decodeURIComponent(path.slice('/products/category/'.length)));
      this.requireCategory(category);
      products = products.filter(product => product.category === category);
    }
    if (empty) products = [];
    const sorted = [...products].sort((a, b) => {
      const first = a[sortBy];
      const second = b[sortBy];
      const compared = typeof first === 'number' && typeof second === 'number'
        ? first - second : String(first).localeCompare(String(second), 'en');
      return (order === 'asc' ? compared : -compared) || a.id - b.id;
    });
    return { products: sorted.slice(skip, limit === 0 ? undefined : skip + limit), total: products.length, skip, limit };
  }

  private pageNumber(value: string | null, fallback: number): number {
    if (value === null) return fallback;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw this.failure(400);
    return Number(value);
  }

  private requireCategory(slug: string): void {
    if (!MOCK_CATEGORIES.some(category => category.slug === slug)) throw this.failure(422);
  }

  private validateScenario(scenario: MockScenario): MockScenario {
    if (!['success', 'empty', 'malformed', 'network', 400, 401, 403, 404, 409, 422, 429, 500, 503].includes(scenario.outcome) ||
        !Number.isSafeInteger(scenario.delayMs ?? 0) || (scenario.delayMs ?? 0) < 0 || (scenario.delayMs ?? 0) > 10000) {
      throw new Error('Mock scenarios require a supported outcome and an integer delay between 0 and 10000 ms.');
    }
    return { ...scenario };
  }

  private failure(status: number): HttpErrorResponse {
    return new HttpErrorResponse({ status, statusText: 'Mock response', error: { message: 'Simulated API failure.' },
      headers: status === 429 ? new HttpHeaders({ 'Retry-After': '2' }) : new HttpHeaders() });
  }
}
