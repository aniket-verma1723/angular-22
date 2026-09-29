import { NgOptimizedImage } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ImageLessonComponent } from './image-lesson.component';

describe('ImageLessonComponent', () => {
  let fixture: ComponentFixture<ImageLessonComponent>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ImageLessonComponent] });
    fixture = TestBed.createComponent(ImageLessonComponent);
    root = fixture.nativeElement;
    root.style.width = '320px';
    // These synchronous event tests do not wait for real image decoding; E2E covers that.
    fixture.detectChanges();
  });

  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing image lesson element: ${selector}`);
    return found;
  }

  function click(label: string): HTMLButtonElement {
    const button = Array.from(root.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
    if (!button) throw new Error(`Missing image lesson button: ${label}`);
    button.click();
    fixture.detectChanges();
    return button;
  }

  it('uses a real nonpriority fill directive with local source, responsive sizes and meaningful alt', () => {
    const image = element<HTMLImageElement>('img');
    const directive = fixture.debugElement.query(By.directive(NgOptimizedImage)).injector.get(NgOptimizedImage);
    expect(directive.fill).toBeTrue();
    expect(directive.priority).toBeFalse();
    expect(image.getAttribute('src')).toBe('/mock-product.svg');
    expect(image.alt).toBe('Purple fictional product cube on a pale background');
    expect(image.getAttribute('sizes')).toContain('(max-width: 600px) 80vw, 40vw');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('fetchpriority')).not.toBe('high');
    expect(image.hasAttribute('width')).toBeFalse();
    expect(image.hasAttribute('height')).toBeFalse();
    expect(element('[data-image-status]').textContent?.trim()).toBe('Local image loading.');
    expect(element('section').getAttribute('aria-labelledby')).toBe(element('h2').id);
    for (const button of root.querySelectorAll('button')) expect(button.type).toBe('button');
  });

  it('toggles contain and cover through a named native pressed button without replacing the image', () => {
    const image = element<HTMLImageElement>('img');
    expect(image.style.objectFit).toBe('contain');
    const toggle = click('Crop image (cover)');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-describedby')).toBe('image-fit-hint');
    expect(image.style.objectFit).toBe('cover');
    expect(element('#image-fit-hint').textContent).toContain('Object fit: cover.');
    click('Crop image (cover)');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(image.style.objectFit).toBe('contain');
    expect(element('img')).toBe(image);
  });

  it('announces a native load without removing the reserved frame', () => {
    const frame = element('[data-image-frame]');
    element('img').dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(element('[data-image-status]').textContent?.trim()).toBe('Local image ready.');
    expect(element('[data-image-frame]')).toBe(frame);
    expect(root.querySelector('[role="img"]')).toBeNull();
  });

  it('requests only the deliberate local failure and preserves positioned 16:9 geometry in its named fallback', () => {
    const frame = element('[data-image-frame]');
    const before = frame.getBoundingClientRect();
    expect(getComputedStyle(frame).position).toBe('relative');
    expect(before.width).toBeGreaterThan(0);
    expect(before.width / before.height).toBeCloseTo(16 / 9, 2);
    click('Try unavailable local image');
    const image = element<HTMLImageElement>('img');
    expect(image.getAttribute('src')).toBe('/mock-product-unavailable.svg');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    const fallback = element('[role="img"]');
    expect(fallback.getAttribute('aria-label')).toBe('Image unavailable: purple fictional product cube');
    expect(element('[data-image-status]').textContent?.trim()).toBe('Local image unavailable.');
    expect(root.querySelector('img')).toBeNull();
    expect(element('[data-image-frame]')).toBe(frame);
    expect(frame.getBoundingClientRect().width).toBe(before.width);
    expect(frame.getBoundingClientRect().height).toBe(before.height);
    expect(fallback.getBoundingClientRect().width).toBeCloseTo(before.width, 1);
    expect(fallback.getBoundingClientRect().height).toBeCloseTo(before.height, 1);
  });

  it('restores the local image after failure while retaining the chosen fit and frame', () => {
    click('Crop image (cover)');
    click('Try unavailable local image');
    element('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    const frame = element('[data-image-frame]');
    click('Restore local image');
    const image = element<HTMLImageElement>('img');
    expect(image.getAttribute('src')).toBe('/mock-product.svg');
    expect(image.style.objectFit).toBe('cover');
    expect(element('[data-image-frame]')).toBe(frame);
    expect(root.querySelector('[role="img"]')).toBeNull();
    expect(element('[data-image-status]').textContent?.trim()).toBe('Local image loading.');
    image.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(element('[data-image-status]').textContent?.trim()).toBe('Local image ready.');
  });

  it('recreates same-source retries and ignores detached image events after replacement and destruction', () => {
    const first = element<HTMLImageElement>('img');
    first.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    click('Restore local image');
    const retry = element<HTMLImageElement>('img');
    expect(retry).not.toBe(first);
    expect(retry.getAttribute('src')).toBe(first.getAttribute('src'));
    click('Restore local image');
    const current = element('img');
    expect(current).not.toBe(retry);
    for (const old of [first, retry]) {
      old.dispatchEvent(new Event('error'));
      old.dispatchEvent(new Event('load'));
    }
    fixture.detectChanges();
    expect(element('img')).toBe(current);
    expect(element('[data-image-status]').textContent?.trim()).toBe('Local image loading.');
    fixture.destroy();
    expect(() => current.dispatchEvent(new Event('error'))).not.toThrow();
  });
});
