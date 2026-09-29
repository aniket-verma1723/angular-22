import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LessonPanelComponent } from './lesson-panel.component';

@Component({
  imports: [LessonPanelComponent],
  template: `
    <app-lesson-panel>
      <h3 lesson-title>Caller heading</h3>
      <p>Caller content</p>
      <button lesson-actions type="button" (click)="clicks = clicks + 1">Caller action</button>
    </app-lesson-panel>
    <p data-clicks>{{ clicks }}</p>
  `
})
class ProjectionHostComponent {
  protected clicks = 0;
}

describe('LessonPanelComponent', () => {
  it('projects selected slots and default content while preserving caller bindings', async () => {
    TestBed.configureTestingModule({ imports: [ProjectionHostComponent] });
    const fixture = TestBed.createComponent(ProjectionHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('header h3')?.textContent).toBe('Caller heading');
    expect(element.querySelector('.lesson-content')?.textContent).toContain('Caller content');
    expect(element.querySelector('.lesson-content')?.textContent).not.toContain('Caller heading');
    const action = element.querySelector('footer button');
    if (!(action instanceof HTMLButtonElement)) throw new Error('Missing projected action');
    action.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-clicks]')?.textContent).toBe('1');
    expect(element.textContent).not.toContain('explanatory fallback');
  });

  it('renders explanatory fallback content for all unfilled slots', async () => {
    TestBed.configureTestingModule({ imports: [LessonPanelComponent] });
    const fixture = TestBed.createComponent(LessonPanelComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('header h3')?.textContent).toBe('Projection playground');
    expect(element.querySelector('.lesson-content')?.textContent).toContain('Default content appears here');
    expect(element.querySelector('footer')?.textContent).toContain('explanatory fallback');
  });
});
