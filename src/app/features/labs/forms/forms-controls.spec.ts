import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, debounce, disabled, form, required } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { ReactiveStockControlComponent } from './reactive-stock-control.component';
import { SignalAckControlComponent } from './signal-ack-control.component';
import { SignalStockControlComponent } from './signal-stock-control.component';

@Component({
  imports: [FormField, SignalStockControlComponent, SignalAckControlComponent],
  template: `<app-signal-stock-control [formField]="fields.stock" /><app-signal-ack-control [formField]="fields.ack" />`
})
class ControlHost {
  readonly locked = signal(false);
  readonly model = signal<{ stock: number | null; ack: boolean }>({ stock: 4, ack: false });
  readonly fields = form(this.model, path => {
    debounce(path.stock, 'blur');
    required(path.ack);
    disabled(path, { when: () => this.locked() });
  });
}

describe('Separate forms custom controls', () => {
  it('binds Signal value/checked, commits custom blur, touches, focuses and disables both', () => {
    const fixture = TestBed.createComponent(ControlHost);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const stock = fixture.debugElement.query(By.directive(SignalStockControlComponent)).injector.get(SignalStockControlComponent);
    const ack = fixture.debugElement.query(By.directive(SignalAckControlComponent)).injector.get(SignalAckControlComponent);
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector('input[type=number]');
    const checkbox = element.querySelector('input[type=checkbox]');
    if (!(input instanceof HTMLInputElement) || !(checkbox instanceof HTMLInputElement)) throw new Error('Missing native controls');
    stock.focus();
    expect(document.activeElement).toBe(input);
    input.value = '12'; input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.model().stock).toBe(4);
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.model().stock).toBe(12);
    expect(host.fields.stock().touched()).toBeTrue();
    ack.focus();
    expect(document.activeElement).toBe(checkbox);
    checkbox.checked = true; checkbox.dispatchEvent(new Event('change')); checkbox.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.model().ack).toBeTrue();
    expect(host.fields.ack().touched()).toBeTrue();
    host.locked.set(true); fixture.detectChanges();
    expect(input.disabled).toBeTrue(); expect(checkbox.disabled).toBeTrue();
    input.value = '25'; input.dispatchEvent(new Event('input'));
    checkbox.checked = false; checkbox.dispatchEvent(new Event('change'));
    expect(host.model()).toEqual({ stock: 12, ack: true });
    host.locked.set(false);
    host.fields().reset({ stock: 4, ack: false }); fixture.detectChanges();
    expect(input.value).toBe('4'); expect(checkbox.checked).toBeFalse();
    expect(host.fields().touched()).toBeFalse();
  });

  it('does not echo Signal model input writes as output events', () => {
    const fixture = TestBed.createComponent(SignalStockControlComponent);
    const changed = jasmine.createSpy('changed');
    fixture.componentInstance.value.subscribe(changed);
    fixture.componentRef.setInput('value', 9);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(9);
    expect(changed).not.toHaveBeenCalled();
  });

  it('implements a legitimate standalone CVA: writeValue never echoes, user input does', () => {
    const fixture = TestBed.createComponent(ReactiveStockControlComponent);
    const control = fixture.componentInstance;
    const changed = jasmine.createSpy('changed');
    const touched = jasmine.createSpy('touched');
    control.registerOnChange(changed); control.registerOnTouched(touched);
    control.writeValue(7); fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector('input');
    if (!input) throw new Error('Missing CVA input');
    expect(input.value).toBe('7'); expect(changed).not.toHaveBeenCalled();
    control.focus(); expect(document.activeElement).toBe(input);
    input.value = '8'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    expect(changed).toHaveBeenCalledOnceWith(8); expect(touched).toHaveBeenCalledTimes(1);
    control.setDisabledState(true); fixture.detectChanges();
    expect(input.disabled).toBeTrue();
    input.value = '9'; input.dispatchEvent(new Event('input'));
    expect(changed).toHaveBeenCalledTimes(1);
    control.writeValue(null); fixture.detectChanges();
    expect(input.value).toBe(''); expect(changed).toHaveBeenCalledTimes(1);
  });
});
