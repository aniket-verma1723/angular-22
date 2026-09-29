import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FocusMonitor, LiveAnnouncer } from '@angular/cdk/a11y';
import { Dir, Directionality } from '@angular/cdk/bidi';
import { Clipboard } from '@angular/cdk/clipboard';
import { BreakpointObserver } from '@angular/cdk/layout';
import type { BreakpointState } from '@angular/cdk/layout';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { BehaviorSubject, finalize } from 'rxjs';
import { labButton, labElement } from './cdk-lab.spec-helpers';
import { UtilitiesExperimentComponent } from './utilities-experiment.component';

describe('UtilitiesExperimentComponent', () => {
  let fixture: ComponentFixture<UtilitiesExperimentComponent>;
  let root: HTMLElement;
  let clipboard: jasmine.SpyObj<Clipboard>;
  let announcer: jasmine.SpyObj<LiveAnnouncer>;
  let breakpoints: BehaviorSubject<BreakpointState>;
  let breakpointTeardown: jasmine.Spy;
  let observe: jasmine.Spy<BreakpointObserver['observe']>;

  beforeEach(async () => {
    clipboard = jasmine.createSpyObj<Clipboard>('Clipboard', ['copy']);
    clipboard.copy.and.returnValue(false);
    announcer = jasmine.createSpyObj<LiveAnnouncer>('LiveAnnouncer', ['announce']);
    // Do not await the real announcer's 100ms pending timer from a harness stabilization loop.
    announcer.announce.and.callFake(() => Promise.resolve());
    breakpoints = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    breakpointTeardown = jasmine.createSpy('breakpoint teardown');
    const observer = jasmine.createSpyObj<BreakpointObserver>('BreakpointObserver', ['observe']);
    observe = observer.observe.and.returnValue(breakpoints.pipe(finalize(breakpointTeardown)));
    TestBed.configureTestingModule({
      imports: [UtilitiesExperimentComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: Clipboard, useValue: clipboard }, { provide: BreakpointObserver, useValue: observer }]
    }).overrideComponent(UtilitiesExperimentComponent, {
      set: { providers: [{ provide: LiveAnnouncer, useValue: announcer }] }
    });
    fixture = TestBed.createComponent(UtilitiesExperimentComponent);
    root = fixture.nativeElement;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
  });

  it('copies only the public constant link, announces false/success once each, and offers manual fallback', async () => {
    const textarea = labElement<HTMLTextAreaElement>(root, 'textarea');
    textarea.value = 'Fictional private scratch text must never be copied';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const copy = labButton(root, 'Copy public product link');
    copy.click();
    await fixture.whenStable();
    const expected = new URL('/products/1', document.location.origin).href;
    expect(clipboard.copy).toHaveBeenCalledOnceWith(expected);
    const link = labElement<HTMLInputElement>(root, '#cdk-public-link');
    expect(link.readOnly).toBeTrue();
    expect(link.disabled).toBeFalse();
    expect(link.value).toBe(expected);
    expect(labElement(root, '[data-copy-result]').textContent).toContain('Copy failed');
    expect(announcer.announce).toHaveBeenCalledOnceWith('Copy failed. Select and copy the public link manually.', 'polite');
    expect(root.querySelector('[role="status"], [aria-live]')).toBeNull();
    clipboard.copy.and.returnValue(true);
    copy.click();
    await fixture.whenStable();
    expect(clipboard.copy.calls.allArgs()).toEqual([[expected], [expected]]);
    expect(announcer.announce.calls.count()).toBe(2);
    expect(announcer.announce.calls.mostRecent().args).toEqual(['Public product link copied.', 'polite']);
    expect(labElement(root, '[data-copy-result]').textContent).toBe('Public product link copied.');
  });

  it('handles platform and announcement failures without logging raw errors or losing visible feedback', async () => {
    clipboard.copy.and.throwError('Platform detail must not reach the view');
    announcer.announce.and.callFake(() => Promise.reject(new Error('Announcement unavailable')));
    labButton(root, 'Copy public product link').click();
    await fixture.whenStable();
    expect(labElement(root, '[data-copy-result]').textContent).toContain('Copy failed');
    expect(labElement(root, '[data-copy-result]').textContent).toContain('Live announcement unavailable');
    expect(root.textContent).not.toContain('Platform detail');
    expect(announcer.announce).toHaveBeenCalledTimes(1);
  });

  it('emits actual local dirChange values and leaves the root Directionality untouched', async () => {
    const globalDirection = TestBed.inject(Directionality);
    const original = globalDirection.value;
    const originalHtmlDir = document.documentElement.getAttribute('dir');
    const local = fixture.debugElement.query(By.directive(Dir)).injector.get(Dir);
    const changes: string[] = [];
    const subscription = local.change.subscribe(value => changes.push(value));
    labButton(root, 'Preview RTL').click();
    await fixture.whenStable();
    expect(local.value).toBe('rtl');
    expect(labElement(root, '[data-effective-direction]').textContent).toBe('rtl');
    expect(labElement(root, '[data-direction-event]').textContent).toBe('rtl');
    expect(labElement(root, '.scratch').getAttribute('dir')).toBe('rtl');
    labButton(root, 'Preview LTR').click();
    await fixture.whenStable();
    expect(changes).toEqual(['rtl', 'ltr']);
    expect(labElement(root, '[data-effective-direction]').textContent).toBe('ltr');
    expect(globalDirection.value).toBe(original);
    expect(document.documentElement.getAttribute('dir')).toBe(originalHtmlDir);
    subscription.unsubscribe();
  });

  it('observes the real focus target and explicitly stops monitoring on destruction', async () => {
    const monitor = TestBed.inject(FocusMonitor);
    const stop = spyOn(monitor, 'stopMonitoring').and.callThrough();
    const target = labButton(root, 'Focus probe');
    monitor.focusVia(target, 'keyboard');
    await fixture.whenStable();
    expect(document.activeElement).toBe(target);
    expect(labElement(root, '[data-focus-origin]').textContent).toBe('keyboard');
    target.blur();
    await fixture.whenStable();
    expect(labElement(root, '[data-focus-origin]').textContent).toBe('not focused');
    labButton(root, 'Focus probe programmatically').click();
    await fixture.whenStable();
    expect(labElement(root, '[data-focus-origin]').textContent).toBe('program');
    fixture.destroy();
    expect(stop).toHaveBeenCalledTimes(1);
    // Jasmine infers the final ElementRef overload; the supported DOM overload ran here.
    const stoppedTarget: unknown = stop.calls.mostRecent().args[0];
    expect(stoppedTarget).toBe(target);
    expect(target.classList.contains('cdk-focused')).toBeFalse();
  });

  it('attaches real bounded autosizing and reacts to viewport changes with teardown', async () => {
    const autosize = fixture.debugElement.query(By.directive(CdkTextareaAutosize)).injector.get(CdkTextareaAutosize);
    const resize = spyOn(autosize, 'resizeToFitContent').and.callThrough();
    const textarea = labElement<HTMLTextAreaElement>(root, 'textarea');
    const initialHeight = textarea.getBoundingClientRect().height;
    textarea.value = 'One\nTwo\nThree\nFour\nFive';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(autosize.enabled).toBeTrue();
    expect(autosize.minRows).toBe(2);
    expect(autosize.maxRows).toBe(6);
    expect(textarea.maxLength).toBe(240);
    expect(resize).toHaveBeenCalled();
    expect(textarea.getBoundingClientRect().height).toBeGreaterThan(initialHeight);
    expect(observe).toHaveBeenCalledOnceWith('(max-width: 600px)');
    breakpoints.next({ matches: true, breakpoints: { '(max-width: 600px)': true } });
    await fixture.whenStable();
    expect(labElement(root, '[data-breakpoint]').textContent).toContain('600px or narrower');
    fixture.destroy();
    expect(breakpointTeardown).toHaveBeenCalledTimes(1);
  });
});
