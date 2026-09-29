import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuantityControlComponent } from './quantity-control.component';

@Component({ imports: [QuantityControlComponent], template: '<app-quantity-control [(quantity)]="value" [max]="3" label="Demo quantity" />' })
class Host { readonly value = signal(1); }

describe('QuantityControlComponent', () => {
  it('supports two-way model changes and parent reset with bounded buttons', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll('button');
    expect(buttons[0].disabled).toBeTrue();
    buttons[1].click(); await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe(2);
    buttons[1].click(); await fixture.whenStable();
    expect(buttons[1].disabled).toBeTrue();
    fixture.componentInstance.value.set(1); await fixture.whenStable();
    expect(element.querySelector('input')?.value).toBe('1');
  });

  for (const value of ['', '0', '-1', '1.5', '4']) {
    it(`rejects entry '${value}' and retains the committed quantity`, async () => {
      const fixture = TestBed.createComponent(Host);
      fixture.autoDetectChanges(); await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      const input = element.querySelector('input');
      if (!input) throw new Error('Quantity input missing');
      input.value = value; input.dispatchEvent(new Event('change')); await fixture.whenStable();
      expect(fixture.componentInstance.value()).toBe(1);
      expect(input.value).toBe('1');
      expect(element.querySelector('[role="alert"]')?.textContent).toContain('previous quantity was kept');
      input.value = '3'; input.dispatchEvent(new Event('change')); await fixture.whenStable();
      expect(fixture.componentInstance.value()).toBe(3);
      expect(element.querySelector('[role="alert"]')).toBeNull();
    });
  }

  it('disables every control when unavailable', async () => {
    const fixture = TestBed.createComponent(QuantityControlComponent);
    fixture.componentRef.setInput('max', 0);
    fixture.autoDetectChanges(); await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect([...element.querySelectorAll('button,input')].every(control => control.hasAttribute('disabled'))).toBeTrue();
    fixture.componentRef.setInput('max', 5); fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(element.querySelector('input')?.disabled).toBeTrue();
  });
});
