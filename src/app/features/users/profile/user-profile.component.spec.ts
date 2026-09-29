import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { postUiFixture, postUiPage, userUiFixture } from '../../../testing/user-ui-fixtures';

describe('Public user profile UI', () => {
  const base = 'https://dummyjson.com';
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let profile: TestRequest;
  let posts: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/users/1');
    harness.fixture.autoDetectChanges();
    profile = http.expectOne(req => req.url === `${base}/users/1`);
    posts = http.expectOne(req => req.url === `${base}/posts/user/1`);
  });
  afterEach(() => http.verify());

  function element(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) throw new Error('Profile not routed');
    return element;
  }
  function click(text: string): void {
    const button = [...element().querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text));
    if (!button) throw new Error(`Missing button: ${text}`);
    button.click();
  }
  function next(): void {
    const button = element().querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    if (!button) throw new Error('Post paginator missing');
    button.click();
  }

  it('starts both HTTP reads in parallel and renders posts before the profile arrives', async () => {
    expect(element().textContent).toContain('Loading profile');
    expect(element().textContent).toContain('Loading posts');
    posts.flush(postUiPage()); harness.detectChanges();
    expect(element().textContent).toContain('A public learning post');
    expect(element().textContent).toContain('Loading profile');
    expect(element().querySelector('a[href="#/posts/11"]')).not.toBeNull();
    profile.flush(userUiFixture()); await harness.fixture.whenStable();
    expect(element().textContent).toContain('Ada Reader');
    expect(element().textContent).toContain('1 posts · 1 on this page · offset 0');
    expect(element().querySelector('a[href="#/tasks?userId=1"]')?.textContent).toContain("View this user's tasks");
    expect(element().querySelector('[role="tab"]')).toBeNull();
  });

  it('keeps posts visible when the profile fails and retries only the profile', async () => {
    posts.flush(postUiPage()); profile.error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('profile: Connection problem');
    expect(element().textContent).toContain('A public learning post');
    click('Retry profile');
    http.expectNone(req => req.url.includes('/posts/'));
    http.expectOne(req => req.url === `${base}/users/1`).flush(userUiFixture());
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('Ada Reader');
  });

  it('keeps the profile when posts fail validation and retries only posts', async () => {
    profile.flush(userUiFixture());
    posts.flush(postUiPage([postUiFixture({ userId: 2 })]));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('posts: Invalid service response');
    expect(element().textContent).toContain('Ada Reader');
    click('Retry posts');
    http.expectNone(req => req.url.includes('/users/'));
    http.expectOne(req => req.url === `${base}/posts/user/1`).flush(postUiPage([]));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('No posts yet');
  });

  for (const [status, label] of [[404, 'Not found'], [403, 'Access denied']] as const) {
    it(`labels profile ${status} while preserving successful posts`, async () => {
      profile.flush({}, { status, statusText: 'Failure' }); posts.flush(postUiPage());
      await harness.fixture.whenStable();
      expect(element().textContent).toContain(`profile: ${label}`);
      expect(element().textContent).toContain('A public learning post');
      expect(element().textContent).not.toContain('Retry profile');
    });
  }

  for (const section of ['profile', 'posts'] as const) {
    it(`retries only ${section} when profile and posts have both failed`, async () => {
      profile.error(new ProgressEvent('error'));
      posts.flush({}, { status: 503, statusText: 'Unavailable' });
      await harness.fixture.whenStable();
      expect(element().textContent).toContain('profile: Connection problem');
      expect(element().textContent).toContain('posts: Service unavailable');

      click(`Retry ${section}`);
      const retry = http.expectOne(req => req.url === `${base}/${section === 'profile' ? 'users/1' : 'posts/user/1'}`);
      http.expectNone(() => true);
      harness.detectChanges();
      const otherError = section === 'profile' ? 'posts: Service unavailable' : 'profile: Connection problem';
      const retriedError = section === 'profile' ? 'profile: Connection problem' : 'posts: Service unavailable';
      expect(element().textContent).toContain(`Loading ${section}`);
      expect(element().textContent).toContain(otherError);
      expect(element().textContent).not.toContain(retriedError);

      if (section === 'profile') retry.flush(userUiFixture());
      else retry.flush(postUiPage());
      await harness.fixture.whenStable();
      expect(element().textContent).toContain(section === 'profile' ? 'Ada Reader' : 'A public learning post');
      expect(element().textContent).toContain(otherError);
      expect(element().textContent).not.toContain(retriedError);
      expect(element().querySelectorAll('[role="alert"]').length).toBe(1);
      http.expectNone(() => true);
    });
  }

  it('pages posts without repeating the profile, and resets pages when the route is reused', fakeAsync(() => {
    profile.flush(userUiFixture()); posts.flush(postUiPage([postUiFixture()], 25)); tick();
    next(); tick();
    const page = http.expectOne(req => req.url === `${base}/posts/user/1`);
    expect(page.request.params.get('skip')).toBe('10');
    http.expectNone(req => req.url === `${base}/users/1`);
    void TestBed.inject(Router).navigateByUrl('/users/2'); tick();
    expect(page.cancelled).toBeTrue();
    const secondPosts = http.expectOne(req => req.url === `${base}/posts/user/2`);
    expect(secondPosts.request.params.get('skip')).toBe('0');
    secondPosts.flush(postUiPage([postUiFixture({ id: 12, userId: 2, title: 'Second user post' })]));
    http.expectOne(req => req.url === `${base}/users/2`).flush(userUiFixture({ id: 2, firstName: 'Grace' })); tick();
    expect(element().textContent).toContain('Grace Reader');
    expect(element().textContent).toContain('Second user post');
    expect(element().textContent).not.toContain('Ada Reader');
    expect(element().textContent).not.toContain('A public learning post');
  }));

  it('shows empty page metadata and offers recovery if a paged collection shrinks', fakeAsync(() => {
    profile.flush(userUiFixture()); posts.flush(postUiPage([postUiFixture()], 25)); tick();
    next(); tick();
    http.expectOne(req => req.url === `${base}/posts/user/1`).flush(postUiPage([], 0, 10)); tick();
    expect(element().textContent).toContain('No posts on this page');
    expect(element().textContent).toContain('0 posts · 0 on this page · offset 10');
    click('First posts page'); tick();
    const first = http.expectOne(req => req.url === `${base}/posts/user/1`);
    expect(first.request.params.get('skip')).toBe('0'); first.flush(postUiPage([])); tick();
    expect(element().textContent).toContain('No posts yet');
    http.expectNone(req => req.url.includes('/users/'));
  }));

  it('cancels both reads on reused IDs and on leaving the profile', async () => {
    await harness.navigateByUrl('/users/2');
    expect(profile.cancelled).toBeTrue(); expect(posts.cancelled).toBeTrue();
    const secondProfile = http.expectOne(req => req.url === `${base}/users/2`);
    const secondPosts = http.expectOne(req => req.url === `${base}/posts/user/2`);
    expect(element().textContent).toContain('Loading profile');
    await harness.navigateByUrl('/dashboard');
    expect(secondProfile.cancelled).toBeTrue(); expect(secondPosts.cancelled).toBeTrue();
  });

  it('cancels both subscriptions when the fixture is destroyed', () => {
    harness.fixture.destroy();
    expect(profile.cancelled).toBeTrue(); expect(posts.cancelled).toBeTrue();
  });

  for (const id of ['0', '-1', '01', 'nope', '1.5', '9007199254740992', '1%0A']) {
    it(`rejects invalid user ID ${id} without starting either HTTP read`, async () => {
      await harness.navigateByUrl(`/users/${id}`);
      expect(profile.cancelled).toBeTrue(); expect(posts.cancelled).toBeTrue();
      expect(element().textContent).toContain('Invalid user link');
      http.expectNone(() => true);
    });
  }

  it('ignores query ID overrides, preserves directory return state and renders text safely', async () => {
    await harness.navigateByUrl('/users/1?id=999&q=Ada&page=2&pageSize=25&extra=ignored');
    http.expectNone(() => true);
    profile.flush({ ...userUiFixture({ firstName: '<img src=x onerror=alert(1)>' }), email: 'private@example.test', address: { city: 'Private city' } });
    posts.flush(postUiPage()); await harness.fixture.whenStable();
    expect(element().querySelector('a')?.getAttribute('href')).toBe('#/users?q=Ada&page=2&pageSize=25');
    expect(element().textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element().querySelector('img[src="x"]')).toBeNull();
    expect(element().textContent).not.toContain('private@example.test');
    expect(element().textContent).not.toContain('Private city');
    expect(element().querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
  });
});
