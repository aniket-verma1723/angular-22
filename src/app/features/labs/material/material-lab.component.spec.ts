import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MaterialLabComponent } from './material-lab.component';
import { materialButton } from './material.spec-helpers';

describe('MaterialLabComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [MaterialLabComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }]
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('exports the focusable route entry and six P09-style learning sections per experiment', () => {
    const fixture = TestBed.createComponent(MaterialLabComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h1')?.textContent).toBe('Material interaction lab');
    expect(root.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/labs');
    expect(root.querySelector('a')?.textContent).toBe('All labs');
    expect(root.querySelectorAll('article').length).toBe(4);
    for (const article of root.querySelectorAll('article')) {
      expect(Array.from(article.querySelectorAll('h3'), node => node.textContent)).toEqual([
        'Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question', 'Test observation'
      ]);
    }
    expect(root.querySelectorAll('app-material-table table[mat-table]').length).toBe(1);
    expect(root.querySelectorAll('app-material-table mat-paginator').length).toBe(1);
    expect(root.querySelector('mat-stepper, mat-checkbox, mat-radio-group, img')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('keeps actions local and recreates fresh state without storage or HTTP', () => {
    const writes = spyOn(Storage.prototype, 'setItem');
    const reads = spyOn(Storage.prototype, 'getItem');
    const fixture = TestBed.createComponent(MaterialLabComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    materialButton(root, 'Start simulation').click();
    fixture.detectChanges();
    materialButton(root, 'Advance one reading').click();
    materialButton(root, 'Disable choices').click();
    fixture.detectChanges();
    expect(root.querySelector('[data-reading-count]')?.textContent).toContain('2 of 4');
    fixture.destroy();
    const fresh = TestBed.createComponent(MaterialLabComponent);
    fresh.detectChanges();
    const freshRoot: HTMLElement = fresh.nativeElement;
    expect(freshRoot.querySelector('[data-reading-count]')?.textContent).toContain('0 of 4');
    expect(freshRoot.querySelector('input')?.disabled).toBeFalse();
    expect(reads).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
