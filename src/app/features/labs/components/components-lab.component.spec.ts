import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../core/session/session.store';
import { CartService } from '../../cart/data/cart.service';
import { labButton, labElement, labInput } from './component-lab.spec-helpers';
import { ComponentsLabComponent } from './components-lab.component';

function unexpectedStore(): never { throw new Error('Component labs must not resolve application stores'); }

describe('ComponentsLabComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [ComponentsLabComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: CartService, useFactory: unexpectedStore },
      { provide: SessionStore, useFactory: unexpectedStore }]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('exports a cohesive route entry with five learning sections and observations for every group', async () => {
    const fixture = TestBed.createComponent(ComponentsLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h1')?.textContent).toBe('Components lab');
    expect(root.querySelectorAll('article').length).toBe(7);
    for (const article of root.querySelectorAll('article')) {
      expect(Array.from(article.querySelectorAll('h3'), node => node.textContent)).toEqual([
        'Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question', 'Test observation'
      ]);
    }
    expect(root.querySelector('app-render-probe')).toBeNull();
    expect(root.querySelector('app-shadow-sample')).toBeNull();
    expect(root.querySelector('[data-widget]')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('keeps interactions local and recreates fresh fixture state without HTTP or store effects', async () => {
    const fixture = TestBed.createComponent(ComponentsLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    labInput(labElement(root, 'app-templates-experiment'), 'input[type="checkbox"]').click();
    labButton(root, 'Update template context').click();
    labButton(root, 'Reverse projected targets').click();
    labButton(root, 'Composed toggle').click();
    labButton(root, 'Create note').click();
    labButton(root, 'Append 3 in place (fixture only)').click();
    labButton(root, 'Create encapsulation samples').click();
    labButton(root, 'Create render probe').click();
    await fixture.whenStable();
    labButton(root, 'Update widget input').click();
    labButton(root, 'Change probe padding').click();
    await fixture.whenStable();
    labButton(root, 'Read measurements').click();
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(() => fixture.checkNoChanges()).not.toThrow();
    fixture.destroy();
    const recreated = TestBed.createComponent(ComponentsLabComponent);
    recreated.autoDetectChanges();
    await recreated.whenStable();
    const freshRoot: HTMLElement = recreated.nativeElement;
    expect(freshRoot.querySelector('[data-notice]')?.textContent).toContain('revision 0');
    expect(freshRoot.querySelector('[data-composed]')?.textContent).toBe('false');
    expect(freshRoot.querySelector('[data-pure]')?.textContent).toBe('3');
    expect(freshRoot.querySelector('[data-created]')?.textContent).toBe('0');
    expect(freshRoot.querySelector('app-render-probe')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
