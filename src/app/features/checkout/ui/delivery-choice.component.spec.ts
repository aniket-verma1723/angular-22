import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatRadioButtonHarness } from '@angular/material/radio/testing';
import { DeliveryChoiceComponent } from './delivery-choice.component';
import type { DeliveryMethod } from './delivery-choice.component';

@Component({ selector: 'app-delivery-test', imports: [ReactiveFormsModule, DeliveryChoiceComponent],
  template: '<app-delivery-choice [formControl]="control" />' })
class TestHost { readonly control = new FormControl<DeliveryMethod | null>(null); }

describe('Delivery choice ControlValueAccessor', () => {
  it('writes/resets programmatically without extra change events; reports user selection and blur', async () => {
    const fixture = TestBed.createComponent(TestHost); fixture.autoDetectChanges();
    const control = fixture.componentInstance.control; const changed = jasmine.createSpy('valueChanges');
    control.valueChanges.subscribe(changed);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const standard = await loader.getHarness(MatRadioButtonHarness.with({ label: 'Standard · practice option' }));
    control.setValue('standard'); await fixture.whenStable(); expect(await standard.isChecked()).toBeTrue(); expect(changed).toHaveBeenCalledTimes(1);
    control.reset(); await fixture.whenStable(); expect(await standard.isChecked()).toBeFalse(); expect(changed).toHaveBeenCalledTimes(2);
    await standard.check(); expect(control.value).toBe('standard'); expect(changed).toHaveBeenCalledTimes(3);
    await standard.focus(); await standard.blur(); expect(control.touched).toBeTrue();
    control.disable(); await fixture.whenStable(); expect(await standard.isDisabled()).toBeTrue();
    control.enable(); await fixture.whenStable(); expect(await standard.isDisabled()).toBeFalse();
  });
});
