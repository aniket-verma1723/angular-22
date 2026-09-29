import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatRadioButtonHarness } from '@angular/material/radio/testing';
import { MatStepperHarness } from '@angular/material/stepper/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { appConfig } from '../../app.config';
import { checkoutReceiptFixture, checkoutRequestFixture } from '../../testing/checkout-fixtures';
import { productFixture } from '../../testing/product-fixtures';
import { CartService } from '../cart/data/cart.service';
import { SessionStore } from '../../core/session/session.store';
import { establishSessionFixture } from '../../testing/session-fixtures';

describe('Reactive checkout journey', () => {
  const url = 'https://dummyjson.com/carts/add';
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let cart: CartService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); cart = TestBed.inject(CartService);
    establishSessionFixture(TestBed.inject(SessionStore));
  });
  afterEach(() => http.verify());
  async function open(populated = true): Promise<void> {
    if (populated) cart.add(productFixture(), 2);
    harness = await RouterTestingHarness.create('/checkout?userId=999'); harness.fixture.autoDetectChanges(); await settle();
  }
  function loader() { return TestbedHarnessEnvironment.loader(harness.fixture); }
  async function button(text: string) { return loader().getHarness(MatButtonHarness.with({ text })); }
  async function settle(): Promise<void> { await harness.fixture.whenStable(); harness.detectChanges(); }
  function send(): void {
    harness.routeNativeElement?.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); harness.detectChanges();
  }
  async function fill(): Promise<void> {
    await (await button('Use fictional sample')).click(); await (await button('Continue to delivery')).click();
    await (await loader().getHarness(MatRadioButtonHarness.with({ label: 'Standard · practice option' }))).check();
    await (await button('Continue to review')).click(); await (await loader().getHarness(MatCheckboxHarness)).check();
  }
  async function confirm(value: boolean): Promise<void> {
    const ref = TestBed.inject(MatDialog).openDialogs[0]; if (!ref) throw new Error('Expected checkout dialog');
    const closed = firstValueFrom(ref.afterClosed()); ref.close(value); await closed; await settle();
  }

  it('shows empty recovery and never sends on entry', async () => {
    await open(false); expect(harness.routeNativeElement?.textContent).toContain('Your cart is empty');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull(); http.expectNone(() => true);
  });
  it('prevents step advancement and submit on invalid or pending forms and focuses an invalid field', async () => {
    await open(); await (await button('Continue to delivery')).click();
    const stepper = await loader().getHarness(MatStepperHarness); expect(await (await stepper.getSteps())[0].isSelected()).toBeTrue();
    expect(harness.routeNativeElement?.textContent).toContain('Enter a non-blank fictional name');
    expect(document.activeElement?.getAttribute('formcontrolname')).toBe('recipient');
    send(); http.expectNone(url); await fill();
    const directive = harness.fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective);
    directive.form.markAsPending(); send(); http.expectNone(url);
    expect(cart.itemCount()).toBe(2);
  });
  it('submits one allowlisted request, disables custom controls, blocks leaving and clears only after validated success', async () => {
    await open(); await fill(); send(); send();
    const request = http.expectOne(url); expect(request.request.body).toEqual(checkoutRequestFixture());
    expect(cart.itemCount()).toBe(2);
    expect(harness.routeNativeElement?.querySelector('input')?.disabled).toBeTrue();
    expect(await TestBed.inject(Router).navigateByUrl('/cart')).toBeFalse();
    request.flush(checkoutReceiptFixture()); await settle();
    expect(cart.itemCount()).toBe(0); expect(harness.routeNativeElement?.textContent).toContain('Your simulated receipt');
    expect(harness.routeNativeElement?.textContent).toContain('$23.00');
    expect(harness.routeNativeElement?.textContent).not.toContain('123 Fictional Lane');
    expect(document.activeElement?.id).toBe('receipt-heading');
    expect(await TestBed.inject(Router).navigateByUrl('/cart')).toBeTrue();
  });
  for (const failure of [400, 401, 403, 404, 409, 429, 503, 'malformed', 'network'] as const) {
    it(`preserves form/cart on ${failure} and permits an explicit retry`, async () => {
      await open(); await fill(); send(); const request = http.expectOne(url);
      if (failure === 'malformed') request.flush({ id: 51 });
      else if (failure === 'network') request.error(new ProgressEvent('error'));
      else request.flush({}, { status: failure, statusText: 'Failure' });
      await settle(); expect(cart.itemCount()).toBe(2);
      expect(harness.routeNativeElement?.textContent).toContain('Checkout could not be confirmed');
      expect(harness.routeNativeElement?.textContent).toContain('123 Fictional Lane');
      expect(await (await button('Create simulated receipt')).isDisabled()).toBeFalse();
      send(); http.expectOne(url).flush(checkoutReceiptFixture()); await settle(); expect(cart.itemCount()).toBe(0);
    });
  }
  it('keeps a newer cart rather than clearing changes made during the request', async () => {
    await open(); await fill(); send(); const request = http.expectOne(url);
    cart.setQuantity(1, 3); request.flush(checkoutReceiptFixture()); await settle();
    expect(cart.itemCount()).toBe(3); expect(harness.routeNativeElement?.textContent).toContain('cart changed during submission and has been kept');
  });
  it('displays the service subtotal separately when snapshot prices differ', async () => {
    await open(); await fill(); send();
    http.expectOne(url).flush({ ...checkoutReceiptFixture(), products: [{ id: 1, quantity: 2, title: 'Updated price', price: 15, total: 30 }], total: 30 });
    await settle(); expect(harness.routeNativeElement?.textContent).toContain('Service prices differ');
    expect(harness.routeNativeElement?.textContent).toContain('$25.00'); expect(harness.routeNativeElement?.textContent).toContain('$30.00');
  });
  it('preserves the cart and cancels the request on forced destruction', async () => {
    await open(); await fill(); send(); const request = http.expectOne(url);
    harness.fixture.destroy(); expect(request.cancelled).toBeTrue(); expect(cart.itemCount()).toBe(2);
  });
  it('supports bounded dynamic notes, removes invalid notes and resets form without clearing the cart', async () => {
    await open(); await (await button('Use fictional sample')).click(); await (await button('Continue to delivery')).click();
    await (await loader().getHarness(MatRadioButtonHarness.with({ label: 'Express · practice option' }))).check();
    await (await button('Add fictional note')).click(); await (await button('Continue to review')).click();
    expect(harness.routeNativeElement?.textContent).toContain('Enter a non-blank note');
    await (await loader().getHarness(MatInputHarness.with({ selector: '#delivery-note-0' }))).setValue('Leave at the imaginary gate');
    await (await button('Add fictional note')).click(); await (await button('Add fictional note')).click();
    expect(await (await button('Add fictional note')).isDisabled()).toBeTrue();
    const removes = await loader().getAllHarnesses(MatButtonHarness.with({ text: 'Remove' })); await removes[2].click();
    expect(await (await button('Add fictional note')).isDisabled()).toBeFalse();
    await (await button('Reset checkout draft')).click(); await confirm(true);
    expect(harness.routeNativeElement?.querySelectorAll('[id^="delivery-note-"]').length).toBe(0);
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('');
    expect(cart.itemCount()).toBe(2);
    expect(await TestBed.inject(Router).navigateByUrl('/cart')).toBeTrue();
  });
  it('asks before leaving a dirty draft; cancel keeps it and discard keeps the cart', async () => {
    await open(); await (await button('Use fictional sample')).click();
    const router = TestBed.inject(Router); const dialogs = TestBed.inject(MatDialog);
    let opened = firstValueFrom(dialogs.afterOpened); const cancelled = router.navigateByUrl('/cart'); await opened;
    await confirm(false); expect(await cancelled).toBeFalse();
    expect(await (await loader().getAllHarnesses(MatInputHarness))[0].getValue()).toBe('Demo Learner');
    opened = firstValueFrom(dialogs.afterOpened); const accepted = router.navigateByUrl('/cart'); await opened;
    await confirm(true); expect(await accepted).toBeTrue(); expect(cart.itemCount()).toBe(2);
  });

  it('resets submitted state as well as values so pristine fields do not retain submission errors', async () => {
    await open(); send(); await settle();
    const directive = harness.fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective);
    expect(directive.submitted).toBeTrue();
    await (await button('Reset checkout draft')).click(); await confirm(true);
    expect(directive.submitted).toBeFalse(); expect(directive.form.pristine).toBeTrue();
    expect(harness.routeNativeElement?.querySelector('mat-error')).toBeNull();
    expect(cart.itemCount()).toBe(2);
  });

  it('uses the session identity instead of a query parameter and blocks submit after logout', async () => {
    establishSessionFixture(TestBed.inject(SessionStore), { id: 2, role: 'learner' });
    await open(); await fill(); send();
    const request = http.expectOne(url); expect(request.request.body.userId).toBe(2);
    request.flush({}, { status: 503, statusText: 'Failure' }); await settle();
    TestBed.inject(SessionStore).logout(); send(); await settle(); http.expectNone(url);
    expect(cart.itemCount()).toBe(2);
    expect(harness.routeNativeElement?.textContent).toContain('123 Fictional Lane');
    expect(await (await button('Create simulated receipt')).isDisabled()).toBeTrue();
  });
});
