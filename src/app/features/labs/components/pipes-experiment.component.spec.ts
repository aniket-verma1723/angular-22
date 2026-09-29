import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { labButton } from './component-lab.spec-helpers';
import { FixtureImpureSumPipe, FixturePureSumPipe } from './fixture-sum.pipe';
import { PipesExperimentComponent } from './pipes-experiment.component';

describe('PipesExperimentComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [PipesExperimentComponent], providers: [{ provide: LOCALE_ID, useValue: 'en-US' }]
  }));

  it('demonstrates actual pure-pipe caching under event checks and in-place mutation, then immutable replacement', async () => {
    const pure = spyOn(FixturePureSumPipe.prototype, 'transform').and.callThrough();
    const impure = spyOn(FixtureImpureSumPipe.prototype, 'transform').and.callThrough();
    const fixture = TestBed.createComponent(PipesExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-pure]')?.textContent).toBe('3');
    const initialPureCalls = pure.calls.count();
    const initialImpureCalls = impure.calls.count();
    labButton(root, 'Append 3 in place (fixture only)').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-raw]')?.textContent).toContain('1, 2, 3');
    expect(root.querySelector('[data-pure]')?.textContent).toBe('3');
    expect(root.querySelector('[data-impure]')?.textContent).toBe('6');
    expect(pure.calls.count()).toBe(initialPureCalls);
    expect(impure.calls.count()).toBeGreaterThan(initialImpureCalls);
    const beforeEvent = impure.calls.count();
    labButton(root, 'Unrelated event check').click();
    await fixture.whenStable();
    expect(pure.calls.count()).toBe(initialPureCalls);
    expect(impure.calls.count()).toBeGreaterThan(beforeEvent);
    labButton(root, 'Replace array reference').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-pure]')?.textContent).toBe('6');
    expect(pure.calls.count()).toBe(initialPureCalls + 1);
    labButton(root, 'Reset pipe fixture').click();
    await fixture.whenStable();
    expect(root.querySelector('[data-pure]')?.textContent).toBe('3');
    expect(root.querySelector('[data-impure]')?.textContent).toBe('3');
  });

  it('bounds the mutable exercise and formats existing USD cents, UTC dates, numbers and text', async () => {
    const fixture = TestBed.createComponent(PipesExperimentComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    for (let index = 0; index < 4; index++) {
      labButton(root, 'Append 3 in place (fixture only)').click();
      await fixture.whenStable();
    }
    expect(labButton(root, 'Append 3 in place (fixture only)').disabled).toBeTrue();
    expect(root.querySelector('[data-cents]')?.textContent).toContain('$12.50; zero: $0.00');
    expect(root.querySelector('[data-currency]')?.textContent).toContain('$12.50');
    expect(root.querySelector('[data-date]')?.textContent).toContain('Sep 27, 2026');
    expect(root.querySelector('[data-date]')?.textContent).toContain('12:00:00');
    expect(root.querySelector('[data-number]')?.textContent).toContain('1,234.5; proportion: 25%');
    expect(root.querySelector('[data-text]')?.textContent).toBe('LOCAL FIXTURE');
  });
});
