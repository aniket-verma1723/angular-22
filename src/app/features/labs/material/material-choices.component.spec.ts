import { TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatChipListboxHarness, MatChipOptionHarness } from '@angular/material/chips/testing';
import { MatSliderHarness } from '@angular/material/slider/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MaterialChoicesComponent } from './material-choices.component';

describe('MaterialChoicesComponent', () => {
  let fixture: ComponentFixture<MaterialChoicesComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MaterialChoicesComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }] });
    fixture = TestBed.createComponent(MaterialChoicesComponent);
    fixture.detectChanges();
  });
  const loader = () => TestbedHarnessEnvironment.loader(fixture);
  const button = (text: string) => loader().getHarness(MatButtonHarness.with({ text }));
  const root = (): HTMLElement => fixture.nativeElement;

  it('filters typed input locally, selects an allowed subject and rejects unknown text', async () => {
    const autocomplete = await loader().getHarness(MatAutocompleteHarness);
    await autocomplete.enterText('co');
    expect(await Promise.all((await autocomplete.getOptions()).map(option => option.getText()))).toEqual(['Comet']);
    await autocomplete.selectOption({ text: 'Comet' });
    expect(root().querySelector('[data-choice-summary]')?.textContent).toContain('Comet');
    // enterText appends keystrokes; replacing a query requires clearing the current value.
    await autocomplete.clear();
    await autocomplete.enterText('Unknown');
    const [empty] = await autocomplete.getOptions();
    expect(await empty.isDisabled()).toBeTrue();
    expect(await empty.getText()).toBe('No matching fictional subjects');
    await autocomplete.blur();
    expect(root().querySelector('mat-error')?.textContent).toContain('local allowlist');
    expect(root().querySelector('[data-choice-summary]')?.textContent).toContain('No valid subject');
    await autocomplete.clear();
    await autocomplete.enterText('orbit');
    await autocomplete.selectOption({ text: 'Orbit' });
    expect(root().querySelector('[data-choice-summary]')?.textContent).toContain('Orbit');
    expect(root().querySelector('mat-error')).toBeNull();
  });

  it('closes autocomplete on Escape without moving focus or accepting a partial match', async () => {
    const autocomplete = await loader().getHarness(MatAutocompleteHarness);
    await autocomplete.enterText('Au');
    await (await autocomplete.host()).sendKeys(TestKey.ESCAPE);
    expect(await autocomplete.isOpen()).toBeFalse();
    expect(await autocomplete.isFocused()).toBeTrue();
    expect(root().querySelector('[data-choice-summary]')?.textContent).toContain('No valid subject');
  });

  it('uses selection chips, a bounded slider and a boolean toggle to change a real local preview', async () => {
    const chips = await loader().getHarness(MatChipListboxHarness);
    expect(await chips.isMultiple()).toBeTrue();
    await chips.selectChips({ text: 'Practice' });
    const archived = await loader().getHarness(MatChipOptionHarness.with({ text: 'Archived' }));
    expect(await archived.isDisabled()).toBeTrue();
    await archived.select();
    expect(await archived.isSelected()).toBeFalse();
    const slider = await loader().getHarness(MatSliderHarness);
    expect(await slider.getMinValue()).toBe(5);
    expect(await slider.getMaxValue()).toBe(30);
    expect(await slider.getStep()).toBe(5);
    await (await slider.getEndThumb()).setValue(25);
    await (await loader().getHarness(MatSlideToggleHarness)).uncheck();
    expect(root().querySelector('[data-choice-summary]')?.textContent).toContain('Read, Practice · 25 minutes');
    expect(root().querySelector('[data-caption]')?.textContent).toContain('Captions off');
    await (await loader().getHarness(MatChipOptionHarness.with({ text: 'Read' }))).deselect();
    await (await loader().getHarness(MatChipOptionHarness.with({ text: 'Practice' }))).deselect();
    expect(root().querySelector('[data-choice-summary]')?.textContent).toContain('No activities');
  });

  it('disables every CVA control, preserves values, and resets/enables without stale errors', async () => {
    const autocomplete = await loader().getHarness(MatAutocompleteHarness);
    await autocomplete.enterText('bad subject');
    await autocomplete.blur();
    await (await loader().getHarness(MatChipListboxHarness)).selectChips({ text: 'Practice' });
    const thumb = await (await loader().getHarness(MatSliderHarness)).getEndThumb();
    await thumb.setValue(30);
    const captions = await loader().getHarness(MatSlideToggleHarness);
    await captions.uncheck();
    await (await button('Disable choices')).click();
    expect(await autocomplete.isDisabled()).toBeTrue();
    expect(await (await loader().getHarness(MatChipListboxHarness)).isDisabled()).toBeTrue();
    expect(await thumb.isDisabled()).toBeTrue();
    expect(await captions.isDisabled()).toBeTrue();
    expect(await thumb.getValue()).toBe(30);
    await (await button('Reset choices')).click();
    expect(await autocomplete.isDisabled()).toBeFalse();
    expect(await autocomplete.getValue()).toBe('');
    expect(await thumb.isDisabled()).toBeFalse();
    expect(await thumb.getValue()).toBe(15);
    expect(await captions.isDisabled()).toBeFalse();
    expect(await captions.isChecked()).toBeTrue();
    const chips = await loader().getHarness(MatChipListboxHarness);
    expect(await chips.isDisabled()).toBeFalse();
    expect(await Promise.all((await chips.getChips({ selected: true })).map(chip => chip.getText()))).toEqual(['Read']);
    expect(root().querySelector('mat-error')).toBeNull();
  });

  it('closes an open panel on reset and disposes it on owner destruction', async () => {
    const autocomplete = await loader().getHarness(MatAutocompleteHarness);
    await autocomplete.enterText('co');
    expect(await autocomplete.isOpen()).toBeTrue();
    await (await button('Reset choices')).click();
    expect(await autocomplete.isOpen()).toBeFalse();
    expect(await autocomplete.getValue()).toBe('');
    await autocomplete.enterText('au');
    expect(await autocomplete.isOpen()).toBeTrue();
    // CDK 22 can place this popover beside the input, outside OverlayContainer.
    const panelId = await (await autocomplete.host()).getAttribute('aria-controls');
    if (!panelId) throw new Error('Expected an open autocomplete panel ID');
    const panel = document.getElementById(panelId);
    expect(panel?.getAttribute('role')).toBe('listbox');
    expect(panel?.isConnected).toBeTrue();
    fixture.destroy();
    expect(document.getElementById(panelId)).toBeNull();
    expect(panel?.isConnected).toBeFalse();
  });
});
