import { provideZoneChangeDetection, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NotificationFixture, NotificationPreviewComponent } from './notification-preview.component';

for (const scheduling of [
  { name: 'Zone-based', provide: provideZoneChangeDetection },
  { name: 'zoneless', provide: provideZonelessChangeDetection }
]) {
describe(`Eager versus default OnPush with ${scheduling.name} scheduling`, () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [NotificationPreviewComponent], providers: [scheduling.provide()]
  }));

  it('checks Eager on the parent event but requires an explicit notification for the clean OnPush sibling', async () => {
    const fixture = TestBed.createComponent(NotificationPreviewComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const source = fixture.debugElement.injector.get(NotificationFixture);
    const buttons = root.querySelectorAll('button');
    const dispatch = buttons.item(0);
    const notify = buttons.item(1);
    if (!dispatch || !notify) throw new Error('Missing preview controls');
    expect(root.querySelector('[data-eager]')?.textContent).toContain('0');
    expect(root.querySelector('[data-on-push]')?.textContent).toContain('0');
    source.dispatch();
    expect(source.read()).toBe(1);
    expect(root.querySelector('[data-eager]')?.textContent).toContain('0');
    expect(root.querySelector('[data-on-push]')?.textContent).toContain('0');
    dispatch.click();
    await fixture.whenStable();
    expect(root.querySelector('[data-eager]')?.textContent).toContain('2');
    expect(root.querySelector('[data-on-push]')?.textContent).toContain('0');
    notify.click();
    await fixture.whenStable();
    expect(root.querySelector('[data-on-push]')?.textContent).toContain('2');
    fixture.destroy();
    source.dispatch();
    expect(source.read()).toBe(2);
  });

  it('owns independent fixtures and removes the external listener with the parent', async () => {
    const first = TestBed.createComponent(NotificationPreviewComponent);
    const second = TestBed.createComponent(NotificationPreviewComponent);
    first.autoDetectChanges(); second.autoDetectChanges();
    await first.whenStable();
    const source = first.debugElement.injector.get(NotificationFixture);
    const other = second.debugElement.injector.get(NotificationFixture);
    source.dispatch();
    expect(other.read()).toBe(0);
    first.destroy(); source.dispatch();
    expect(source.read()).toBe(1);
    other.dispatch();
    expect(other.read()).toBe(1);
    second.destroy(); other.dispatch();
    expect(other.read()).toBe(1);
  });
});
}
