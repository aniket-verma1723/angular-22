import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { AnimationLessonComponent } from './animation-lesson.component';
import { AnimationLifetime } from './animation-lifetime.service';

describe('AnimationLessonComponent (animation timing left to the browser)', () => {
  let fixture: ComponentFixture<AnimationLessonComponent>;
  let root: HTMLElement;
  let lifetime: AnimationLifetime;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AnimationLessonComponent], animationsEnabled: false });
    fixture = TestBed.createComponent(AnimationLessonComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement;
    lifetime = fixture.debugElement.injector.get(AnimationLifetime);
  });

  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing animation element: ${selector}`);
    return found;
  }

  async function click(label: string): Promise<void> {
    const control = Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === label);
    if (!control) throw new Error(`Missing animation button: ${label}`);
    control.click();
    await fixture.whenStable();
  }

  it('starts empty with keyboard-native controls and all six lesson sections', () => {
    expect(root.querySelector('app-animation-card')).toBeNull();
    expect(element('[data-animation-toggle]').getAttribute('aria-expanded')).toBe('false');
    expect(element('[data-animation-toggle]').getAttribute('aria-controls')).toBe('animation-stage');
    expect(Array.from(root.querySelectorAll('button')).every(button => button.type === 'button')).toBeTrue();
    expect(Array.from(root.querySelectorAll('h3'), heading => heading.textContent)).toEqual([
      'Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question', 'Test observation'
    ]);
    expect(element('[data-animation-observation]').textContent).toContain('No animation inspection yet');
    expect(lifetime.snapshot().active).toBe(0);
  });

  it('inspects creation and destruction separately without live lifecycle signal writes', async () => {
    await click('Show animated card');
    expect(element('[data-animation-toggle]').getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelectorAll('app-animation-card').length).toBe(1);
    expect(element('app-animation-card').querySelector('button, a, input, [tabindex]')).toBeNull();
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 0, active: 1, domPresentAtLastDestruction: null });
    await click('Inspect animation lifetime');
    expect(element('[data-animation-observation]').textContent).toContain('card DOM nodes: 1');
    const observation = element('[data-animation-observation]').textContent;
    await click('Hide animated card');
    expect(root.querySelector('app-animation-card')).toBeNull();
    expect(lifetime.snapshot().destroyed).toBe(1);
    expect(lifetime.snapshot().active).toBe(0);
    expect(typeof lifetime.snapshot().domPresentAtLastDestruction).toBe('boolean');
    expect(element('[data-animation-observation]').textContent).toBe(observation);
    await click('Inspect animation lifetime');
    expect(element('[data-animation-observation]').textContent).toContain('destroyed: 1');
    expect(element('[data-animation-observation]').textContent).toContain('card DOM nodes: 0');
  });

  it('retains the toggle and never accumulates cards across repeated and same-turn toggles', async () => {
    const toggle = element<HTMLButtonElement>('[data-animation-toggle]');
    for (let cycle = 0; cycle < 12; cycle++) {
      await click('Show animated card');
      expect(root.querySelectorAll('app-animation-card').length).toBe(1);
      await click('Hide animated card');
      expect(root.querySelectorAll('app-animation-card').length).toBe(0);
    }
    expect(lifetime.snapshot().created).toBe(12);
    expect(lifetime.snapshot().destroyed).toBe(12);
    for (let clickIndex = 0; clickIndex < 20; clickIndex++) toggle.click();
    await fixture.whenStable();
    expect(element('[data-animation-toggle]')).toBe(toggle);
    expect(root.querySelectorAll('app-animation-card').length).toBe(0);
    expect(lifetime.snapshot().active).toBe(0);
  });

  it('rejects re-entry while the stage reports a retained host, without queuing work', async () => {
    // Model retained DOM without depending on CSS duration or adding real animation listeners.
    const count = spyOnProperty(element('#animation-stage'), 'childElementCount', 'get').and.returnValue(1);
    await click('Show animated card');
    expect(element('[data-animation-request]').textContent).toContain('Previous card is still leaving');
    expect(element('[data-animation-toggle]').getAttribute('aria-expanded')).toBe('false');
    expect(lifetime.snapshot().created).toBe(0);
    count.and.callThrough();
    await click('Inspect animation lifetime');
    expect(lifetime.snapshot().created).toBe(0);
    await click('Show animated card');
    expect(lifetime.snapshot().created).toBe(1);
    expect(element('[data-animation-request]').textContent).not.toContain('Previous card is still leaving');
  });

  it('cleans up an active card when its owner is destroyed and starts fresh on another visit', async () => {
    await click('Show animated card');
    fixture.destroy();
    expect(lifetime.snapshot().destroyed).toBe(1);
    expect(lifetime.snapshot().active).toBe(0);
    const other = TestBed.createComponent(AnimationLessonComponent);
    other.autoDetectChanges();
    await other.whenStable();
    const otherLifetime = other.debugElement.injector.get(AnimationLifetime);
    expect(otherLifetime).not.toBe(lifetime);
    expect(otherLifetime.snapshot().created).toBe(0);
    expect(TestBed.inject(AnimationLifetime, null)).toBeNull();
    other.destroy();
    expect(lifetime.snapshot().destroyed).toBe(1);
  });
});
