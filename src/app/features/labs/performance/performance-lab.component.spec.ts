import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import type { ComponentFixture, DeferBlockFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PayloadLifetime } from './payload-lifetime.service';
import { PerformanceLabComponent } from './performance-lab.component';
import { FICTIONAL_MEASUREMENTS } from './performance-measurements';

describe('PerformanceLabComponent (manual defer states)', () => {
  let fixture: ComponentFixture<PerformanceLabComponent>;
  let root: HTMLElement;
  let lifetime: PayloadLifetime;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PerformanceLabComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      deferBlockBehavior: DeferBlockBehavior.Manual
    });
    fixture = TestBed.createComponent(PerformanceLabComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement;
    lifetime = fixture.debugElement.injector.get(PayloadLifetime);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
  });

  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing lab element: ${selector}`);
    return found;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
    if (!found) throw new Error(`Missing lab button: ${label}`);
    return found;
  }

  async function choose(value: string): Promise<void> {
    const select = element<HTMLSelectElement>('#performance-trigger');
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
  }

  async function block(): Promise<DeferBlockFixture> {
    // Initial rendering is required before discovering blocks inside @if/@switch.
    const blocks = await fixture.getDeferBlocks();
    expect(blocks.length).toBe(1);
    const current = blocks[0];
    if (!current) throw new Error('Missing selected defer block');
    return current;
  }

  it('starts with only interaction mounted, named native controls and visible learning guidance', async () => {
    expect(element('h1').textContent).toBe('Performance lab');
    expect(element('h1').getAttribute('tabindex')).toBe('-1');
    expect(element<HTMLSelectElement>('#performance-trigger').value).toBe('interaction');
    expect(element('label[for="performance-trigger"]').textContent).toBe('Deferred trigger');
    expect(Array.from(root.querySelectorAll('option'), option => option.value)).toEqual([
      'interaction', 'viewport', 'when', 'idle', 'timer', 'hover', 'immediate'
    ]);
    expect(element('a').getAttribute('href')).toBe('/labs');
    expect(element('a').textContent).toBe('All labs');
    expect(button('Load interaction summary').type).toBe('button');
    expect(root.querySelector('app-deferred-summary')).toBeNull();
    expect(root.querySelector('app-demand-lesson, app-preload-lesson')).toBeNull();
    expect(lifetime.snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
    for (const label of ['Concept', 'Try it', 'What Angular does', 'Common mistake', 'Revision question', 'Test observation', 'Image audit comparison', 'Image fill workbench']) {
      expect(root.textContent).toContain(label);
    }
    expect(root.textContent).toContain('JavaScript module is cached');
    expect(root.querySelectorAll('app-image-lesson').length).toBe(1);
    const image = element<HTMLImageElement>('app-image-lesson img');
    expect(image.getAttribute('src')).toBe('mock-product.svg');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('fetchpriority')).not.toBe('high');
    expect(image.hasAttribute('width')).toBeFalse();
    expect(image.hasAttribute('height')).toBeFalse();
    expect(element('aside[aria-labelledby="image-audit-heading"]').textContent).toContain('makes local image requests, not API calls');
    await block();
  });

  it('keeps fill-image controls independent of defer mounting and payload lifetimes', async () => {
    const frame = element('app-image-lesson [data-image-frame]');
    const image = element<HTMLImageElement>('app-image-lesson img');
    button('Crop image (cover)').click();
    await fixture.whenStable();
    expect(image.style.objectFit).toBe('cover');
    expect(root.querySelector('app-deferred-summary')).toBeNull();
    await block();
    button('Unmount experiment').click();
    await fixture.whenStable();
    expect((await fixture.getDeferBlocks()).length).toBe(0);
    expect(element('app-image-lesson [data-image-frame]')).toBe(frame);
    expect(element('app-image-lesson img')).toBe(image);
    button('Mount experiment').click();
    await fixture.whenStable();
    await block();
    expect(image.style.objectFit).toBe('cover');
    expect(root.querySelector('app-deferred-summary')).toBeNull();
    expect(lifetime.snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
  });

  for (const trigger of ['interaction', 'viewport', 'when', 'idle', 'timer', 'hover', 'immediate']) {
    it(`renders ${trigger} placeholder, loading and complete manually without eager creation`, async () => {
      await choose(trigger);
      const current = await block();
      await current.render(DeferBlockState.Placeholder);
      expect(element('[data-defer-state="placeholder"]').getAttribute('role')).toBe('status');
      expect(root.querySelector('app-deferred-summary')).toBeNull();
      expect(lifetime.snapshot().created).toBe(0);

      await current.render(DeferBlockState.Loading);
      expect(element('[data-defer-state="loading"]').textContent).toContain('Loading summary code');
      expect(root.querySelector('[data-defer-state="placeholder"]')).toBeNull();
      expect(lifetime.snapshot().created).toBe(0);

      await current.render(DeferBlockState.Complete);
      await fixture.whenStable();
      expect(root.querySelectorAll('app-deferred-summary').length).toBe(1);
      expect(element('[data-measurement-count]').textContent).toBe('200');
      expect(element('[data-total-ms]').textContent).toBe('20100');
      expect(element('[data-average-ms]').textContent).toBe('100.5');
      expect(root.querySelectorAll('tbody tr').length).toBe(10);
      expect(element('caption').textContent).toContain('totals include all 200');
      expect(root.querySelectorAll('thead th[scope="col"]').length).toBe(2);
      expect(root.querySelectorAll('tbody th[scope="row"]').length).toBe(10);
      expect(element('app-deferred-summary [role="status"]').textContent).toContain('ready');
      expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 0, active: 1 });
      expect(Object.isFrozen(FICTIONAL_MEASUREMENTS)).toBeTrue();
      expect(FICTIONAL_MEASUREMENTS.length).toBe(200);
      fixture.destroy();
      expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 1, active: 0 });
    });

    it(`renders a safe ${trigger} error without constructing the payload`, async () => {
      await choose(trigger);
      await (await block()).render(DeferBlockState.Error);
      expect(element('[data-defer-state="error"]').getAttribute('role')).toBe('alert');
      expect(element('[data-defer-state="error"]').textContent).toBe(
        'Summary code unavailable. Reload the page to try again.'
      );
      expect(root.querySelector('app-deferred-summary')).toBeNull();
      expect(lifetime.snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
      button('Unmount experiment').click();
      await fixture.whenStable();
      button('Mount experiment').click();
      await fixture.whenStable();
      await (await block()).render(DeferBlockState.Placeholder);
      expect(root.querySelector('[data-defer-state="error"]')).toBeNull();
    });
  }

  it('destroys a completed payload on selection and explicitly inspects real lifetimes', async () => {
    await (await block()).render(DeferBlockState.Complete);
    await fixture.whenStable();
    const first = element('[data-instance-id]').textContent;
    expect(element('[data-lifetime-observation]').textContent).toContain('created: 0');
    button('Inspect payload lifetimes').click();
    await fixture.whenStable();
    expect(element('[data-lifetime-observation]').textContent).toContain('created: 1');
    await choose('viewport');
    expect(root.querySelector('app-deferred-summary')).toBeNull();
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 1, active: 0 });
    await (await block()).render(DeferBlockState.Complete);
    await fixture.whenStable();
    expect(element('[data-instance-id]').textContent).not.toBe(first);
    button('Inspect payload lifetimes').click();
    await fixture.whenStable();
    const observation = element('[data-lifetime-observation]').textContent;
    expect(observation).toContain('created: 2');
    expect(observation).toContain('destroyed: 1');
    expect(observation).toContain('active: 1');
  });

  it('controls the signal gate, retains manually completed content on close, and resets on selection', async () => {
    await choose('when');
    expect(button('Open signal gate').getAttribute('aria-pressed')).toBe('false');
    button('Open signal gate').click();
    await fixture.whenStable();
    expect(button('Close signal gate').getAttribute('aria-pressed')).toBe('true');
    // Manual mode tests the gate control and rendered state, not automatic trigger scheduling.
    expect(root.querySelector('app-deferred-summary')).toBeNull();
    await (await block()).render(DeferBlockState.Complete);
    const summary = element('app-deferred-summary');
    button('Close signal gate').click();
    await fixture.whenStable();
    expect(element('app-deferred-summary')).toBe(summary);
    button('Open signal gate').click();
    await fixture.whenStable();
    await choose('interaction');
    await choose('when');
    expect(button('Open signal gate').getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('app-deferred-summary')).toBeNull();
  });

  it('unmounts the only block and clears an open gate before remounting', async () => {
    await choose('when');
    button('Open signal gate').click();
    await fixture.whenStable();
    await (await block()).render(DeferBlockState.Complete);
    button('Unmount experiment').click();
    await fixture.whenStable();
    expect((await fixture.getDeferBlocks()).length).toBe(0);
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 1, active: 0 });
    expect(button('Mount experiment').getAttribute('aria-expanded')).toBe('false');
    button('Mount experiment').click();
    await fixture.whenStable();
    expect(button('Open signal gate').getAttribute('aria-pressed')).toBe('false');
    expect(button('Unmount experiment').getAttribute('aria-expanded')).toBe('true');
    await block();
    expect(root.querySelector('app-deferred-summary')).toBeNull();
  });

  it('keeps a completed instance when reselecting the same trigger', async () => {
    await (await block()).render(DeferBlockState.Complete);
    const original = element('app-deferred-summary');
    await choose('interaction');
    expect(element('app-deferred-summary')).toBe(original);
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 0, active: 1 });
  });

  it('rejects an unlisted selection without replacing the active block and recovers', async () => {
    await (await block()).render(DeferBlockState.Complete);
    const original = element('app-deferred-summary');
    await choose('unlisted');
    expect(element('#trigger-error').textContent).toBe('Choose one of the listed triggers.');
    expect(element('#performance-trigger').getAttribute('aria-invalid')).toBe('true');
    expect(element('app-deferred-summary')).toBe(original);
    await choose('viewport');
    expect(element('#trigger-error').textContent).toBe('');
    expect(element('#performance-trigger').hasAttribute('aria-invalid')).toBeFalse();
    expect(root.querySelector('app-deferred-summary')).toBeNull();
  });

  it('provides visit-local instrumentation, not a root singleton', async () => {
    await (await block()).render(DeferBlockState.Complete);
    const other = TestBed.createComponent(PerformanceLabComponent);
    other.autoDetectChanges();
    await other.whenStable();
    const otherLifetime = other.debugElement.injector.get(PayloadLifetime);
    expect(otherLifetime).not.toBe(lifetime);
    expect(otherLifetime.snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
    expect(TestBed.inject(PayloadLifetime, null)).toBeNull();
    other.destroy();
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 0, active: 1 });
  });

  it('can destroy a loading owner without creating or retaining a child', async () => {
    await (await block()).render(DeferBlockState.Loading);
    fixture.destroy();
    expect(lifetime.snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
  });

  it('retains external native trigger buttons across deferred state changes', async () => {
    for (const [trigger, label] of [
      ['interaction', 'Load interaction summary'], ['hover', 'Hover or focus to load summary']
    ]) {
      await choose(trigger);
      const control = button(label);
      const current = await block();
      await current.render(DeferBlockState.Loading);
      expect(button(label)).toBe(control);
      await current.render(DeferBlockState.Complete);
      expect(button(label)).toBe(control);
      expect(control.type).toBe('button');
      expect(control.disabled).toBeFalse();
    }
  });
});
