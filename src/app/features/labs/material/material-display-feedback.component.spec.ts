import { BreakpointObserver } from '@angular/cdk/layout';
import type { BreakpointState } from '@angular/cdk/layout';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MatBadgeHarness } from '@angular/material/badge/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatExpansionPanelHarness } from '@angular/material/expansion/testing';
import { MatGridListHarness } from '@angular/material/grid-list/testing';
import { MatProgressBarHarness } from '@angular/material/progress-bar/testing';
import { MatProgressSpinnerHarness } from '@angular/material/progress-spinner/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { MatTreeHarness } from '@angular/material/tree/testing';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { MaterialDisplayFeedbackComponent } from './material-display-feedback.component';
import { materialButton, materialElement } from './material.spec-helpers';

describe('MaterialDisplayFeedbackComponent', () => {
  let fixture: ComponentFixture<MaterialDisplayFeedbackComponent>;
  let widths: BehaviorSubject<BreakpointState>;
  let layoutSubscriptions: number;
  beforeEach(() => {
    widths = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    layoutSubscriptions = 0;
    TestBed.configureTestingModule({ imports: [MaterialDisplayFeedbackComponent], providers: [
      { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      { provide: BreakpointObserver, useValue: {
        observe: (query: string | readonly string[]) => {
          // Root Material services also observe breakpoints; count only this layout's ownership.
          if (query !== '(max-width: 600px)') return widths.asObservable();
          return new Observable<BreakpointState>(subscriber => {
            layoutSubscriptions++;
            const subscription = widths.subscribe(subscriber);
            return () => {
              subscription.unsubscribe();
              layoutSubscriptions--;
            };
          });
        },
        isMatched: () => false
      } }
    ] });
    fixture = TestBed.createComponent(MaterialDisplayFeedbackComponent);
    fixture.detectChanges();
  });
  const loader = () => TestbedHarnessEnvironment.loader(fixture);
  const button = (text: string) => loader().getHarness(MatButtonHarness.with({ text }));
  const root = (): HTMLElement => fixture.nativeElement;

  it('announces the important notice only through the polite snackbar and retains nonlive text', async () => {
    const open = spyOn(TestBed.inject(MatSnackBar), 'open').and.callThrough();
    materialButton(root(), 'Show important notice').click();
    const ref = open.calls.mostRecent().returnValue;
    const opened = firstValueFrom(ref.afterOpened());
    TestBed.tick();
    await opened;
    const snack = await TestbedHarnessEnvironment.documentRootLoader(fixture).getHarness(MatSnackBarHarness);
    expect(await snack.getAriaLive()).toBe('polite');
    expect(open).toHaveBeenCalledTimes(1);
    const notice = materialElement(root(), '[data-important-notice]');
    // Check this message's channel, not unrelated progress or sheet-result regions.
    expect(notice.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    expect(notice.textContent).toContain('Do not use them for navigation');
    const dismissed = firstValueFrom(ref.afterDismissed());
    await snack.dismissWithAction();
    await dismissed;
    expect(notice.textContent).toContain('Do not use them for navigation');
  });

  it('adapts the two summary tiles to one column and tears down breakpoint observation', async () => {
    const grid = await loader().getHarness(MatGridListHarness);
    expect(await grid.getColumns()).toBe(2);
    expect((await grid.getTiles()).length).toBe(2);
    widths.next({ matches: true, breakpoints: { '(max-width: 600px)': true } });
    expect(await grid.getColumns()).toBe(1);
    const secondTile = await grid.getTileAtPosition({ row: 1, column: 0 });
    expect(await (await secondTile.host()).text()).toContain('Completed readings');
    widths.next({ matches: false, breakpoints: {} });
    expect(await grid.getColumns()).toBe(2);
    expect(layoutSubscriptions).toBe(1);
    fixture.destroy();
    expect(layoutSubscriptions).toBe(0);
  });

  it('expands current-API tree nodes, selects a leaf, and refuses the disabled archived leaf', async () => {
    const tree = await loader().getHarness(MatTreeHarness);
    const [branch] = await tree.getNodes({ text: /Sky notebook/ });
    expect(await branch.isExpandable()).toBeTrue();
    expect(await branch.isExpanded()).toBeFalse();
    expect(await branch.getLevel()).toBe(1);
    await branch.expand();
    const [comet] = await tree.getNodes({ text: 'Comet notes' });
    expect(await comet.getLevel()).toBe(2);
    expect(await comet.isExpandable()).toBeFalse();
    await (await loader().getHarness(MatButtonHarness.with({ selector: '[aria-label="Choose Comet notes"]' }))).click();
    expect(root().querySelector('[data-selected-node]')?.textContent).toBe('Comet notes');
    const [archived] = await tree.getNodes({ text: 'Archived notes' });
    // Material's isDisabled input guards interaction but does not bind this ARIA attribute.
    expect(await (await archived.host()).getAttribute('aria-disabled')).toBe('true');
    expect(await (await comet.host()).getAttribute('aria-disabled')).toBe('false');
    const unavailable = await loader().getHarness(MatButtonHarness.with({ selector: '[aria-label="Choose Archived notes"]' }));
    expect(await unavailable.isDisabled()).toBeTrue();
    await unavailable.click();
    expect(root().querySelector('[data-selected-node]')?.textContent).toBe('Comet notes');
    await branch.collapse();
    expect(await branch.isExpanded()).toBeFalse();
    await branch.expand();
    expect((await tree.getTreeStructure()).children?.[0].children?.length).toBe(3);
  });

  it('reveals relevant details and resets selection, tree expansion and panel together', async () => {
    const tree = await loader().getHarness(MatTreeHarness);
    const [branch] = await tree.getNodes({ text: /Sky notebook/ });
    await branch.expand();
    await (await loader().getHarness(MatButtonHarness.with({ selector: '[aria-label="Choose Comet notes"]' }))).click();
    const panel = await loader().getHarness(MatExpansionPanelHarness.with({ title: 'Reading details' }));
    expect(await panel.isExpanded()).toBeFalse();
    await panel.expand();
    expect(await panel.getTextContent()).toContain('Selected: Comet notes');
    await panel.collapse();
    expect(await panel.isExpanded()).toBeFalse();
    await panel.expand();
    await (await button('Reset display and feedback')).click();
    expect(await panel.isExpanded()).toBeFalse();
    expect(await branch.isExpanded()).toBeFalse();
    expect(root().querySelector('[data-selected-node]')?.textContent).toBe('Aurora notes');
  });

  it('advances bounded progress, mirrors its accessible count in the badge and resets busy state', async () => {
    const bar = await loader().getHarness(MatProgressBarHarness);
    const badge = await loader().getHarness(MatBadgeHarness);
    expect(await bar.getMode()).toBe('determinate');
    expect(await bar.getValue()).toBe(0);
    expect(await (await button('Advance one reading')).isDisabled()).toBeTrue();
    expect(await loader().hasHarness(MatProgressSpinnerHarness)).toBeFalse();
    await (await button('Start simulation')).click();
    expect(await (await button('Start simulation')).isDisabled()).toBeTrue();
    const spinner = await loader().getHarness(MatProgressSpinnerHarness);
    expect(await spinner.getMode()).toBe('determinate');
    expect(await spinner.getValue()).toBe(25);
    expect(root().querySelector('[aria-label="Simulated progress"]')?.getAttribute('aria-busy')).toBe('true');
    for (const expected of [50, 75, 100]) {
      await (await button('Advance one reading')).click();
      expect(await bar.getValue()).toBe(expected);
      expect(await badge.getText()).toBe(String(expected / 25));
      expect(root().querySelector('[data-reading-count]')?.textContent).toContain(`${expected / 25} of 4`);
    }
    expect(await loader().hasHarness(MatProgressSpinnerHarness)).toBeFalse();
    expect(await (await button('Advance one reading')).isDisabled()).toBeTrue();
    expect(root().querySelector('[aria-label="Simulated progress"]')?.getAttribute('aria-busy')).toBe('false');
    await (await button('Reset display and feedback')).click();
    expect(await bar.getValue()).toBe(0);
    expect(await badge.getText()).toBe('0');
    expect(await (await button('Start simulation')).isDisabled()).toBeFalse();
  });
});
