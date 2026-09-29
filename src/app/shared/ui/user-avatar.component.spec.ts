import { TestBed } from '@angular/core/testing';
import { UserAvatarComponent } from './user-avatar.component';

describe('User avatar', () => {
  it('gives a named missing-image fallback without creating an image request', async () => {
    const fixture = TestBed.createComponent(UserAvatarComponent);
    fixture.componentRef.setInput('source', null);
    fixture.componentRef.setInput('name', 'Ada Reader');
    fixture.autoDetectChanges(); await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('No avatar for Ada Reader');
  });

  it('uses fixed dimensions and lazy priority, recovers from broken images on source changes', async () => {
    const fixture = TestBed.createComponent(UserAvatarComponent);
    fixture.componentRef.setInput('source', '/mock-product.svg');
    fixture.componentRef.setInput('name', 'Ada Reader');
    fixture.autoDetectChanges(); await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const image = element.querySelector('img');
    expect(image?.getAttribute('width')).toBe('48');
    expect(image?.getAttribute('height')).toBe('48');
    expect(image?.getAttribute('loading')).toBe('lazy');
    image?.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Avatar unavailable for Ada Reader');
    fixture.componentRef.setInput('source', '/mock-product.svg?v=2');
    fixture.componentRef.setInput('name', 'Grace Reader');
    await fixture.whenStable();
    expect(element.querySelector('img')?.alt).toBe('Avatar of Grace Reader');
    expect(element.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(element.querySelector('[role="img"]')).toBeNull();
  });
});
