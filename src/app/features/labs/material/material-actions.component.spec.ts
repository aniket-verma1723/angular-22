import { OverlayContainer } from '@angular/cdk/overlay';
import { TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { MaterialActionsComponent } from './material-actions.component';

describe('MaterialActionsComponent', () => {
  let fixture: ComponentFixture<MaterialActionsComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MaterialActionsComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }] });
    fixture = TestBed.createComponent(MaterialActionsComponent);
    fixture.detectChanges();
  });
  const loader = () => TestbedHarnessEnvironment.loader(fixture);

  it('performs a menu action and keeps disabled menu entries inert', async () => {
    const menu = await loader().getHarness(MatMenuHarness);
    await menu.open();
    const [archived] = await menu.getItems({ text: 'Publish archived observation' });
    expect(await archived.isDisabled()).toBeTrue();
    await archived.click();
    const tabs = await loader().getHarness(MatTabGroupHarness);
    expect(await (await tabs.getSelectedTab()).getLabel()).toBe('Preview');
    await menu.clickItem({ text: 'Review notes' });
    expect(await (await tabs.getSelectedTab()).getLabel()).toBe('Notes');
    expect(await menu.isOpen()).toBeFalse();
  });

  it('closes the menu on Escape and restores trigger focus', async () => {
    const menu = await loader().getHarness(MatMenuHarness);
    await menu.focus();
    await menu.open();
    const [item] = await menu.getItems({ text: 'Review notes' });
    await item.focus();
    await (await item.host()).sendKeys(TestKey.ESCAPE);
    expect(await menu.isOpen()).toBeFalse();
    expect(await menu.isFocused()).toBeTrue();
  });

  it('switches panels and modes while refusing disabled tabs and toggles', async () => {
    const tabs = await loader().getHarness(MatTabGroupHarness);
    await tabs.selectTab({ label: 'Notes' });
    const [locked] = await tabs.getTabs({ label: 'Locked' });
    expect(await locked.isDisabled()).toBeTrue();
    await locked.select();
    expect(await (await tabs.getSelectedTab()).getLabel()).toBe('Notes');
    const detail = await loader().getHarness(MatButtonToggleHarness.with({ text: 'Detail' }));
    await detail.check();
    expect(await detail.isChecked()).toBeTrue();
    const live = await loader().getHarness(MatButtonToggleHarness.with({ text: 'Live' }));
    expect(await live.isDisabled()).toBeTrue();
    await live.check();
    expect(await live.isChecked()).toBeFalse();
    await tabs.selectTab({ label: 'Preview' });
    expect(await (await tabs.getSelectedTab()).getTextContent()).toContain('three practice readings');
  });

  it('provides a named inline-SVG pin button independently of its tooltip and resets all action state', async () => {
    const pin = await loader().getHarness(MatButtonHarness.with({ selector: '[aria-label="Pin observation"]' }));
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    const tooltip = await loader().getHarness(MatTooltipHarness);
    await tooltip.show();
    expect(await tooltip.getTooltipText()).toBe('Pin only this fictional observation');
    await tooltip.hide();
    await pin.click();
    expect(await (await pin.host()).getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-pin-status]')?.textContent).toBe('Pinned locally');
    await (await loader().getHarness(MatButtonToggleHarness.with({ text: 'Detail' }))).check();
    const menu = await loader().getHarness(MatMenuHarness);
    await menu.clickItem({ text: 'Review notes' });
    await (await loader().getHarness(MatButtonHarness.with({ text: 'Reset actions' }))).click();
    expect(await (await pin.host()).getAttribute('aria-pressed')).toBe('false');
    expect(await (await loader().getHarness(MatButtonToggleHarness.with({ text: 'Brief' }))).isChecked()).toBeTrue();
    expect(await (await (await loader().getHarness(MatTabGroupHarness)).getSelectedTab()).getLabel()).toBe('Preview');
  });

  it('disposes an open menu when its owner is destroyed', async () => {
    await (await loader().getHarness(MatMenuHarness)).open();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[role="menu"]')).not.toBeNull();
    fixture.destroy();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
  });
});
