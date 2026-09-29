import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideAppData } from '../config/app-data.providers';
import type { DemoRole, DemoUser } from './session.models';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';

describe('SessionService', () => {
  const baseUrl = 'https://dummyjson.com';
  const credentials = { username: 'emilys', password: 'emilyspass' };
  // Public fictional profile; response-only fields must never enter session state.
  const profile = { id: 1, username: 'emilys', firstName: 'Demo', lastName: 'User' };
  let service: SessionService;
  let store: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppData(), provideHttpClientTesting()] });
    service = TestBed.inject(SessionService);
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    store.logout();
    http.verify();
  });

  function signIn(role: DemoRole = 'learner'): string {
    const accessToken = crypto.randomUUID();
    service.login(credentials, role).subscribe({ error: () => fail('Expected demo login to succeed') });
    http.expectOne(`${baseUrl}/auth/login`).flush({ ...profile, accessToken });
    http.expectOne(`${baseUrl}/auth/me`).flush(profile);
    return accessToken;
  }

  it('starts anonymous and does not send HTTP until subscribed', () => {
    service.login(credentials, 'learner');
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expect(service.busy()).toBeFalse();
    http.expectNone(() => true);
  });

  it('atomically commits only matching login/me identities and projects unknown response fields', () => {
    const accessToken = crypto.randomUUID();
    const emitted: DemoUser[] = [];
    service.login(credentials, 'learner').subscribe({ next: user => emitted.push(user), error: () => fail('Expected verified login') });
    const login = http.expectOne(`${baseUrl}/auth/login`);
    expect(login.request.method).toBe('POST');
    expect(login.request.credentials).toBe('omit');
    expect(login.request.headers.has('Authorization')).toBeFalse();
    expect(service.busy()).toBeTrue();
    expect(store.currentUser()).toBeNull();
    login.flush({ ...profile, accessToken, refreshToken: crypto.randomUUID(), role: 'admin', extra: { ignored: true } });
    const me = http.expectOne(`${baseUrl}/auth/me`);
    expect(me.request.headers.get('Authorization') === `Bearer ${accessToken}`).toBeTrue();
    expect(me.request.credentials).toBe('omit');
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expect(emitted.length).toBe(0);
    me.flush({ ...profile, firstName: 'Verified', role: 'admin', accessToken: crypto.randomUUID(), extra: true });
    const expected = { ...profile, firstName: 'Verified', role: 'learner' } satisfies DemoUser;
    expect(emitted.length).toBe(1);
    for (const user of [emitted[0], store.currentUser()]) {
      // Check unknown keys without ever putting their potentially sensitive values in failure output.
      expect(Object.keys(user ?? {}).sort()).toEqual(Object.keys(expected).sort());
      expect(user ? { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, role: user.role } : null)
        .toEqual(expected);
    }
    expect(Object.isFrozen(store.currentUser())).toBeTrue();
    expect(store.accessToken() === accessToken).toBeTrue();
    expect(service.busy()).toBeFalse();
    http.expectNone(`${baseUrl}/auth/refresh`);
  });

  it('allowlists credential fields and never sends the locally selected practice role', () => {
    const input = { ...credentials, username: '  emilys  ', role: 'demo-admin', userId: 999, extra: true };
    service.login(input, 'demo-admin').subscribe();
    const login = http.expectOne(`${baseUrl}/auth/login`);
    expect(login.request.body).toEqual({ ...credentials, expiresInMins: 30 });
    login.flush({ ...profile, accessToken: crypto.randomUUID(), role: 'learner' });
    http.expectOne(`${baseUrl}/auth/me`).flush({ ...profile, role: 'learner' });
    expect(store.currentUser()?.role).toBe('demo-admin');
    expect(store.isAdmin()).toBeTrue();
  });

  for (const input of [
    { ...credentials, username: '' }, { ...credentials, username: ' ' },
    { ...credentials, username: 'x'.repeat(101) }, { ...credentials, password: '' },
    { ...credentials, password: ' ' }, { ...credentials, password: 'x'.repeat(201) }
  ]) {
    it('rejects invalid credentials locally without starting an operation', () => {
      const error = jasmine.createSpy('validation error');
      service.login(input, 'learner').subscribe({ error });
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'validation' }));
      expect(service.busy()).toBeFalse();
      expect(store.currentUser()).toBeNull();
      http.expectNone(() => true);
    });
  }

  for (const mismatch of [{ ...profile, id: 2 }, { ...profile, username: 'learner' }]) {
    it('rejects mismatched login/me identity without publishing a partial session', () => {
      const error = jasmine.createSpy('identity error');
      const next = jasmine.createSpy('user');
      service.login(credentials, 'learner').subscribe({ next, error });
      http.expectOne(`${baseUrl}/auth/login`).flush({ ...profile, accessToken: crypto.randomUUID() });
      http.expectOne(`${baseUrl}/auth/me`).flush(mismatch);
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'format' }));
      expect(next).not.toHaveBeenCalled();
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      expect(service.busy()).toBeFalse();
    });
  }

  for (const stage of ['login', 'me'] as const) {
    it(`rejects malformed ${stage} responses without a session`, () => {
      const error = jasmine.createSpy('format error');
      service.login(credentials, 'learner').subscribe({ error });
      const login = http.expectOne(`${baseUrl}/auth/login`);
      if (stage === 'login') login.flush({ ...profile, accessToken: `${crypto.randomUUID()} ` });
      else {
        login.flush({ ...profile, accessToken: crypto.randomUUID() });
        http.expectOne(`${baseUrl}/auth/me`).flush({ ...profile, id: 1.5 });
      }
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'format' }));
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      expect(service.busy()).toBeFalse();
    });

    it(`rejects a duplicate login while ${stage} is pending with conflict`, () => {
      service.login(credentials, 'learner').subscribe();
      let pending = http.expectOne(`${baseUrl}/auth/login`);
      if (stage === 'me') {
        pending.flush({ ...profile, accessToken: crypto.randomUUID() });
        pending = http.expectOne(`${baseUrl}/auth/me`);
      }
      const error = jasmine.createSpy('duplicate error');
      service.login(credentials, 'demo-admin').subscribe({ error });
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'conflict' }));
      expect(service.busy()).toBeTrue();
      http.expectNone(() => true);
      store.logout();
      expect(pending.cancelled).toBeTrue();
      expect(service.busy()).toBeFalse();
    });

    it(`logout during ${stage} cancels HTTP and cannot establish a session later`, fakeAsync(() => {
      const next = jasmine.createSpy('cancelled user');
      const complete = jasmine.createSpy('cancelled completion');
      service.login(credentials, 'learner').subscribe({ next, complete });
      let pending = http.expectOne(`${baseUrl}/auth/login`);
      if (stage === 'me') {
        pending.flush({ ...profile, accessToken: crypto.randomUUID() });
        pending = http.expectOne(`${baseUrl}/auth/me`);
      }
      store.logout();
      expect(pending.cancelled).toBeTrue();
      tick(15_000);
      expect(next).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      expect(service.busy()).toBeFalse();
    }));

    it(`unsubscribing during ${stage} cancels HTTP without retaining a candidate`, () => {
      const next = jasmine.createSpy('unsubscribed user');
      const subscription = service.login(credentials, 'learner').subscribe({ next });
      let pending = http.expectOne(`${baseUrl}/auth/login`);
      if (stage === 'me') {
        pending.flush({ ...profile, accessToken: crypto.randomUUID() });
        pending = http.expectOne(`${baseUrl}/auth/me`);
      }
      subscription.unsubscribe();
      expect(pending.cancelled).toBeTrue();
      expect(next).not.toHaveBeenCalled();
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      expect(service.busy()).toBeFalse();
      signIn();
      expect(store.currentUser()?.id).toBe(1);
    });

    it(`times out stalled ${stage} within the shared 15-second login budget`, fakeAsync(() => {
      const error = jasmine.createSpy('timeout error');
      service.login(credentials, 'learner').subscribe({ error });
      let pending = http.expectOne(`${baseUrl}/auth/login`);
      if (stage === 'me') {
        tick(5_000);
        pending.flush({ ...profile, accessToken: crypto.randomUUID() });
        pending = http.expectOne(`${baseUrl}/auth/me`);
      }
      tick(stage === 'login' ? 14_999 : 9_999);
      expect(error).not.toHaveBeenCalled();
      tick(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(pending.cancelled).toBeTrue();
      expect(service.busy()).toBeFalse();
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      http.expectNone(`${baseUrl}/auth/refresh`);
    }));

    it(`does not refresh or retry rejected ${stage} login requests`, () => {
      const error = jasmine.createSpy('unauthorized error');
      service.login(credentials, 'learner').subscribe({ error });
      let pending = http.expectOne(`${baseUrl}/auth/login`);
      if (stage === 'me') {
        pending.flush({ ...profile, accessToken: crypto.randomUUID() });
        pending = http.expectOne(`${baseUrl}/auth/me`);
      }
      pending.flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'unauthorized' }));
      expect(service.busy()).toBeFalse();
      expect(store.currentUser()).toBeNull();
      expect(store.accessToken() === null).toBeTrue();
      http.expectNone(() => true);
    });
  }

  it('expires the session at 30 minutes without refresh', fakeAsync(() => {
    signIn();
    tick(30 * 60_000 - 1);
    expect(store.user()?.id).toBe(1);
    tick(1);
    // Read the signal, not currentUser(): this specifically exercises the expiry timer.
    expect(store.user()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expect(store.notice()).toContain('expired');
    http.expectNone(() => true);
  }));

  it('clears the old expiry timer when a new session starts', fakeAsync(() => {
    signIn();
    tick(10 * 60_000);
    store.logout();
    signIn('demo-admin');
    tick(20 * 60_000);
    expect(store.user()?.role).toBe('demo-admin');
    tick(10 * 60_000);
    expect(store.user()).toBeNull();
  }));

  it('checks expiry synchronously even if the browser has throttled the timer', () => {
    signIn();
    const expiredTime = Date.now() + 30 * 60_000;
    spyOn(Date, 'now').and.returnValue(expiredTime);
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expect(store.isAdmin()).toBeFalse();
    expect(store.notice()).toContain('expired');
  });

  it('rejects verification without a session and login while already signed in', () => {
    const missing = jasmine.createSpy('missing session');
    service.verify().subscribe({ error: missing });
    expect(missing).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'unauthorized' }));
    http.expectNone(() => true);
    signIn();
    const duplicate = jasmine.createSpy('existing session');
    service.login(credentials, 'learner').subscribe({ error: duplicate });
    expect(duplicate).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: 'conflict' }));
    http.expectNone(() => true);
  });

  it('verifies projected identity with the local role and rejects concurrent service calls', () => {
    signIn('learner');
    const next = jasmine.createSpy('verified profile');
    service.verify().subscribe({ next });
    const pending = http.expectOne(`${baseUrl}/auth/me`);
    expect(service.busy()).toBeTrue();
    const error = jasmine.createSpy('operation conflict');
    service.verify().subscribe({ error });
    service.login(credentials, 'demo-admin').subscribe({ error });
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict' }));
    http.expectNone(() => true);
    pending.flush({ ...profile, role: 'admin', extra: true });
    expect(next).toHaveBeenCalledOnceWith({ ...profile, role: 'learner' });
    expect(service.busy()).toBeFalse();
  });

  it('clears a rejected current /me session even when ended$ completes before error delivery', () => {
    signIn();
    const next = jasmine.createSpy('rejected user');
    service.verify().subscribe({ next, error: () => { /* State is the contract, not error delivery. */ } });
    http.expectOne(`${baseUrl}/auth/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
    expect(store.accessToken() === null).toBeTrue();
    expect(store.notice()).toContain('rejected');
    expect(service.busy()).toBeFalse();
    http.expectNone(() => true);
  });

  it('clears the session on a changed verification identity without emitting it', () => {
    signIn();
    const next = jasmine.createSpy('changed user');
    service.verify().subscribe({ next, error: () => { /* Session ending can complete this stream. */ } });
    http.expectOne(`${baseUrl}/auth/me`).flush({ ...profile, id: 2 });
    expect(next).not.toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
    expect(service.busy()).toBeFalse();
  });

  for (const status of [0, 403]) {
    it(`preserves the session after verification failure with status ${status}`, () => {
      const accessToken = signIn();
      const error = jasmine.createSpy('verification failure');
      service.verify().subscribe({ error });
      const pending = http.expectOne(`${baseUrl}/auth/me`);
      if (status === 0) pending.error(new ProgressEvent('error'));
      else pending.flush({}, { status, statusText: 'Forbidden' });
      expect(error).toHaveBeenCalledOnceWith(jasmine.objectContaining({ kind: status === 0 ? 'network' : 'forbidden' }));
      expect(store.currentUser()).toEqual({ ...profile, role: 'learner' });
      expect(store.accessToken() === accessToken).toBeTrue();
      expect(service.busy()).toBeFalse();
      service.verify().subscribe();
      http.expectOne(`${baseUrl}/auth/me`).flush(profile);
    });
  }

  it('times out verification at 15 seconds while preserving the session', fakeAsync(() => {
    signIn();
    const error = jasmine.createSpy('verification timeout');
    service.verify().subscribe({ error });
    const pending = http.expectOne(`${baseUrl}/auth/me`);
    tick(14_999);
    expect(error).not.toHaveBeenCalled();
    tick(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(pending.cancelled).toBeTrue();
    expect(store.currentUser()?.id).toBe(1);
    expect(service.busy()).toBeFalse();
    store.logout();
  }));

  it('cancels active verification on logout', () => {
    signIn();
    const next = jasmine.createSpy('logged out verification');
    service.verify().subscribe({ next });
    const pending = http.expectOne(`${baseUrl}/auth/me`);
    store.logout();
    expect(pending.cancelled).toBeTrue();
    expect(next).not.toHaveBeenCalled();
    expect(service.busy()).toBeFalse();
    expect(store.currentUser()).toBeNull();
  });
});
