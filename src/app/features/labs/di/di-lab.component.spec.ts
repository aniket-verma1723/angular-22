import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DiLabComponent } from './di-lab.component';
import { ScopeProbeComponent } from './scope-probe.component';

describe('DiLabComponent', () => {
  let fixture: ComponentFixture<DiLabComponent>;
  let element: HTMLElement;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DiLabComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(DiLabComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });
  function click(text: string): void {
    const button = Array.from(element.querySelectorAll('button')).find(value => value.textContent?.includes(text));
    if (!button) throw new Error(`Missing button: ${text}`);
    button.click(); fixture.detectChanges();
  }

  it('renders actual view/content, self, skipSelf, optional and host observations', () => {
    const probes = fixture.debugElement.queryAll(By.directive(ScopeProbeComponent))
      .map(debug => debug.injector.get(ScopeProbeComponent));
    expect(probes.length).toBe(2);
    const view = probes.find(probe => probe.label() === 'Panel view child');
    const content = probes.find(probe => probe.label() === 'Projected content child');
    if (!view || !content) throw new Error('Both scope probes must render');
    expect(view?.view).toBe('panel-view');
    expect(view?.hostView).toBe('panel-view');
    expect(content?.view).toBe('parent-view');
    expect(content?.hostView).toBe('parent-view');
    expect(view?.hostOuter).toBeNull();
    expect(content?.hostOuter).toBe('outer-only');
    expect(view?.counter).toBe(content?.counter);
    click('Increment Panel view child counter');
    expect(content?.counter.count()).toBe(1);
    for (const probe of probes) {
      expect(probe.outer).toBe('outer-only');
      expect(probe.self).toBe('child');
      expect(probe.parent).toBe('component');
      expect(probe.absent).toBeNull();
      expect(probe.selfView).toBeNull();
    }
    click('Remove scope');
    expect(view?.counter.destroyed()).toBeTrue();
    expect(fixture.debugElement.queryAll(By.directive(ScopeProbeComponent))).toHaveSize(0);
    click('Recreate scope');
    expect(fixture.debugElement.queryAll(By.directive(ScopeProbeComponent))).toHaveSize(2);
    const recreated = fixture.debugElement.query(By.directive(ScopeProbeComponent)).injector.get(ScopeProbeComponent);
    expect(recreated.counter.count()).toBe(0);
    expect(recreated.counter).not.toBe(view.counter);
  });

  it('offers visible provider actions, handles await, and destroys on replacement/departure', fakeAsync(() => {
    click('Create successful'); tick(150); fixture.detectChanges();
    click('Increment alias');
    expect(element.textContent).toContain('Original 1 · alias 1 · separate 0');
    click('Probe synchronous'); flushMicrotasks(); fixture.detectChanges();
    expect(element.textContent).toContain('NG0203 caught');
    click('Destroy owned'); flushMicrotasks(); fixture.detectChanges();
    expect(element.textContent).toContain('DestroyRef fired: true');
    click('Create stalled');
    click('Create successful'); tick(150); fixture.detectChanges();
    expect(element.textContent).toContain('Original 0 · alias 0 · separate 0');
    expect(element.textContent).toContain('ready: local-config');
    fixture.destroy(); tick(600);
  }));

  it('provides all five learning labels for every topic group and native button types', () => {
    expect(element.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    for (const section of Array.from(element.querySelectorAll('section'))) {
      for (const label of ['Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question']) {
        expect(section.textContent).toContain(label);
      }
    }
    expect(Array.from(element.querySelectorAll('button')).every(button => button.type === 'button')).toBeTrue();
  });
});
