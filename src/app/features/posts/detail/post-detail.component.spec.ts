import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../../../app.config';
import { commentUiFixture, commentUiPage, postUiFixture, userUiFixture } from '../../../testing/user-ui-fixtures';

describe('Public post detail UI', () => {
  const base = 'https://dummyjson.com';
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let post: TestRequest;
  let comments: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/posts/11');
    harness.fixture.autoDetectChanges();
    post = http.expectOne(req => req.url === `${base}/posts/11`);
    comments = http.expectOne(req => req.url === `${base}/posts/11/comments`);
  });
  afterEach(() => http.verify());

  function element(): HTMLElement {
    const element = harness.routeNativeElement;
    if (!element) throw new Error('Post not routed');
    return element;
  }
  function click(text: string): void {
    const button = [...element().querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text));
    if (!button) throw new Error(`Missing button: ${text}`);
    button.click();
  }
  function next(): void {
    const button = element().querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    if (!button) throw new Error('Comment paginator missing');
    button.click();
  }
  function flushAuthor(id = 1): void {
    http.expectOne(req => req.url === `${base}/users/${id}`).flush(userUiFixture({ id }));
  }

  it('starts post/comments together, then requests the validated author without duplicating the post', async () => {
    http.expectNone(req => req.url.includes('/users/'));
    expect(element().textContent).toContain('Loading post');
    expect(element().textContent).toContain('Loading comments');
    comments.flush(commentUiPage()); harness.detectChanges();
    expect(element().textContent).toContain('A thoughtful comment');
    expect(element().textContent).toContain('Loading post');
    post.flush(postUiFixture());
    http.expectNone(req => req.url === `${base}/posts/11`);
    flushAuthor(); await harness.fixture.whenStable();
    expect(element().textContent).toContain('A public learning post');
    expect(element().querySelector('a[href="/users/1"]')?.textContent).toContain('Ada Reader');
    expect(element().querySelector('a[href="/users/2"]')?.textContent).toContain('Grace Reader');
  });

  it('preserves post/comments after author failure and retries only the author', async () => {
    post.flush(postUiFixture()); comments.flush(commentUiPage());
    http.expectOne(req => req.url === `${base}/users/1`).error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('author: Connection problem');
    expect(element().textContent).toContain('A public learning post');
    expect(element().textContent).toContain('A thoughtful comment');
    click('Retry author');
    http.expectNone(req => req.url.includes('/posts/'));
    flushAuthor(); await harness.fixture.whenStable();
    expect(element().textContent).toContain('Ada Reader');
  });

  it('retries failed comments independently of post and author', async () => {
    post.flush(postUiFixture()); flushAuthor();
    comments.flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('comments: Service unavailable');
    expect(element().textContent).toContain('Ada Reader');
    click('Retry comments');
    http.expectOne(req => req.url === `${base}/posts/11/comments`).flush(commentUiPage([]));
    http.expectNone(req => req.url.includes('/users/') || req.url === `${base}/posts/11`);
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('No comments yet');
    expect(element().textContent).toContain('0 comments · 0 on this page · offset 0');
  });

  it('keeps comments visible after post failure and follows the author only after a successful retry', async () => {
    comments.flush(commentUiPage()); post.error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('post: Connection problem');
    expect(element().textContent).toContain('A thoughtful comment');
    http.expectNone(req => req.url.includes('/users/'));
    click('Retry post');
    http.expectOne(req => req.url === `${base}/posts/11`).flush(postUiFixture({ userId: 2 }));
    flushAuthor(2);
    http.expectNone(req => req.url.endsWith('/comments'));
    await harness.fixture.whenStable();
    expect(element().querySelector('section[aria-labelledby="author-heading"] a')?.getAttribute('href')).toBe('/users/2');
  });

  for (const section of ['author', 'comments'] as const) {
    it(`retries only ${section} when author and comments have both failed`, async () => {
      post.flush(postUiFixture());
      http.expectOne(req => req.url === `${base}/users/1`).error(new ProgressEvent('error'));
      comments.flush({}, { status: 503, statusText: 'Unavailable' });
      await harness.fixture.whenStable();
      expect(element().textContent).toContain('author: Connection problem');
      expect(element().textContent).toContain('comments: Service unavailable');

      click(`Retry ${section}`);
      const retry = http.expectOne(req => req.url === `${base}/${section === 'author' ? 'users/1' : 'posts/11/comments'}`);
      http.expectNone(() => true);
      harness.detectChanges();
      const otherError = section === 'author' ? 'comments: Service unavailable' : 'author: Connection problem';
      const retriedError = section === 'author' ? 'author: Connection problem' : 'comments: Service unavailable';
      expect(element().textContent).toContain(`Loading ${section}`);
      expect(element().textContent).toContain(otherError);
      expect(element().textContent).not.toContain(retriedError);
      expect(element().textContent).toContain('A public learning post');

      if (section === 'author') retry.flush(userUiFixture());
      else retry.flush(commentUiPage());
      await harness.fixture.whenStable();
      expect(element().textContent).toContain(section === 'author' ? 'Ada Reader' : 'A thoughtful comment');
      expect(element().textContent).toContain('A public learning post');
      expect(element().textContent).toContain(otherError);
      expect(element().textContent).not.toContain(retriedError);
      expect(element().querySelectorAll('[role="alert"]').length).toBe(1);
      http.expectNone(() => true);
    });
  }

  for (const userId of [0, -1, 1.5, '1', 9007199254740992]) {
    it(`does not request an author when the post userId is invalid (${userId})`, async () => {
      post.flush({ ...postUiFixture(), userId }); comments.flush(commentUiPage());
      await harness.fixture.whenStable();
      expect(element().textContent).toContain('post: Invalid service response');
      expect(element().textContent).toContain('A thoughtful comment');
      http.expectNone(req => req.url.includes('/users/'));
    });
  }

  it('rejects comments for another post without losing the loaded post', async () => {
    post.flush(postUiFixture()); flushAuthor();
    comments.flush(commentUiPage([commentUiFixture({ postId: 12 })]));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('comments: Invalid service response');
    expect(element().textContent).toContain('A public learning post');
  });

  for (const [status, label] of [[404, 'Not found'], [403, 'Access denied']] as const) {
    it(`labels a post ${status} without requesting the author`, async () => {
      post.flush({}, { status, statusText: 'Failure' }); comments.flush(commentUiPage([]));
      await harness.fixture.whenStable();
      expect(element().textContent).toContain(`post: ${label}`);
      http.expectNone(req => req.url.includes('/users/'));
    });
  }

  it('cancels old post and comment reads when the route is reused', async () => {
    await harness.navigateByUrl('/posts/12');
    expect(post.cancelled).toBeTrue(); expect(comments.cancelled).toBeTrue();
    http.expectOne(req => req.url === `${base}/posts/12`).flush(postUiFixture({ id: 12, userId: 2, title: 'New post only' }));
    http.expectOne(req => req.url === `${base}/posts/12/comments`).flush(commentUiPage([commentUiFixture({ postId: 12, body: 'New comment only' })]));
    flushAuthor(2); await harness.fixture.whenStable();
    expect(element().textContent).toContain('New post only');
    expect(element().textContent).toContain('New comment only');
    expect(element().textContent).not.toContain('A public learning post');
  });

  it('cancels a dependent author and pending comments without mixing old/new sections', async () => {
    post.flush(postUiFixture());
    const author = http.expectOne(req => req.url === `${base}/users/1`);
    await harness.navigateByUrl('/posts/12');
    expect(author.cancelled).toBeTrue(); expect(comments.cancelled).toBeTrue();
    expect(element().textContent).not.toContain('A public learning post');
    const nextPost = http.expectOne(req => req.url === `${base}/posts/12`);
    const nextComments = http.expectOne(req => req.url === `${base}/posts/12/comments`);
    await harness.navigateByUrl('/dashboard');
    expect(nextPost.cancelled).toBeTrue(); expect(nextComments.cancelled).toBeTrue();
  });

  it('destroys active author and comments subscriptions', () => {
    post.flush(postUiFixture());
    const author = http.expectOne(req => req.url === `${base}/users/1`);
    harness.fixture.destroy();
    expect(author.cancelled).toBeTrue(); expect(comments.cancelled).toBeTrue();
  });

  it('cancels a loaded post’s pending author and comments on route reuse without stale output', async () => {
    const routedView = element();
    post.flush(postUiFixture());
    const oldAuthor = http.expectOne(req => req.url === `${base}/users/1`);
    expect(oldAuthor.cancelled).toBeFalse();
    expect(comments.cancelled).toBeFalse();
    harness.detectChanges();
    expect(element().textContent).toContain('A public learning post');
    expect(element().textContent).toContain('Loading author');
    expect(element().textContent).toContain('Loading comments');

    await harness.navigateByUrl('/posts/12');
    expect(element()).toBe(routedView);
    expect(oldAuthor.cancelled).toBeTrue();
    expect(comments.cancelled).toBeTrue();
    expect(element().textContent).toContain('Loading post');
    expect(element().textContent).not.toContain('A public learning post');
    http.expectNone(req => req.url.includes('/users/'));

    const nextPost = http.expectOne(req => req.url === `${base}/posts/12`);
    const nextComments = http.expectOne(req => req.url === `${base}/posts/12/comments`);
    nextPost.flush(postUiFixture({ id: 12, userId: 3, title: 'New post only' }));
    const nextAuthor = http.expectOne(req => req.url === `${base}/users/3`);
    nextComments.flush(commentUiPage([commentUiFixture({ postId: 12, body: 'New comment only' })]));
    harness.detectChanges();
    expect(element().textContent).toContain('New post only');
    expect(element().textContent).toContain('New comment only');
    expect(element().textContent).toContain('Loading author');
    expect(element().querySelector('section[aria-labelledby="author-heading"] a')).toBeNull();

    nextAuthor.flush(userUiFixture({ id: 3, firstName: 'New author' }));
    await harness.fixture.whenStable();
    expect(element().querySelector('section[aria-labelledby="author-heading"] a')?.getAttribute('href')).toBe('/users/3');
    expect(element().textContent).toContain('New author Reader');
    expect(element().textContent).toContain('New post only');
    expect(element().textContent).toContain('New comment only');
    expect(element().textContent).not.toContain('Ada Reader');
    expect(element().textContent).not.toContain('A public learning post');
    expect(element().textContent).not.toContain('A thoughtful comment');
    http.expectNone(() => true);
  });

  it('pages comments locally, exposes totals, recovers from a shrinking collection and resets on a new post', fakeAsync(() => {
    post.flush(postUiFixture()); flushAuthor(); comments.flush(commentUiPage([commentUiFixture()], 25)); tick();
    expect(element().textContent).toContain('25 comments · 10 on this page · offset 0');
    next(); tick();
    const page = http.expectOne(req => req.url === `${base}/posts/11/comments`);
    expect(page.request.params.get('skip')).toBe('10');
    page.flush(commentUiPage([], 0, 10)); tick();
    expect(element().textContent).toContain('No comments on this page');
    click('First comments page'); tick();
    http.expectOne(req => req.url === `${base}/posts/11/comments`).flush(commentUiPage([commentUiFixture()], 25)); tick();
    next(); tick();
    const stalePage = http.expectOne(req => req.url === `${base}/posts/11/comments`);
    void TestBed.inject(Router).navigateByUrl('/posts/12'); tick();
    expect(stalePage.cancelled).toBeTrue();
    const newPage = http.expectOne(req => req.url === `${base}/posts/12/comments`);
    expect(newPage.request.params.get('skip')).toBe('0'); newPage.flush(commentUiPage([]));
    http.expectOne(req => req.url === `${base}/posts/12`).flush(postUiFixture({ id: 12 })); flushAuthor(); tick();
    http.expectNone(req => req.url === `${base}/posts/11`);
  }));

  for (const id of ['0', '-1', '01', 'invalid', '1.5', '9007199254740992', '11%0A']) {
    it(`rejects invalid post ID ${id} without HTTP`, async () => {
      await harness.navigateByUrl(`/posts/${id}`);
      expect(post.cancelled).toBeTrue(); expect(comments.cancelled).toBeTrue();
      expect(element().textContent).toContain('Invalid post link');
      http.expectNone(() => true);
    });
  }

  it('renders post and comment markup as inert text and ignores query identity overrides', async () => {
    await harness.navigateByUrl('/posts/11?id=999&userId=99');
    http.expectNone(() => true);
    const markup = '<img src=x onerror=alert(1)>';
    post.flush(postUiFixture({ title: '<script>ignored()</script>', body: markup }));
    flushAuthor(); comments.flush(commentUiPage([commentUiFixture({ body: markup })]));
    await harness.fixture.whenStable();
    expect(element().textContent).toContain('<script>ignored()</script>');
    expect(element().textContent).toContain(markup);
    expect(element().querySelector('script, img[src="x"]')).toBeNull();
    expect(element().querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
  });
});
