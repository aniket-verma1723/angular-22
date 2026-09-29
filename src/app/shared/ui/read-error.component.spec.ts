import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/http/api-error';
import { ReadErrorComponent } from './read-error.component';

describe('Read error panel', () => {
  for (const [kind, label] of [
    ['validation', 'Invalid link or request'], ['not-found', 'Not found'],
    ['forbidden', 'Access denied'], ['unauthorized', 'Authentication required']
  ] as const) {
    it(`labels ${kind} and offers link recovery instead of a futile retry`, async () => {
      const fixture = TestBed.createComponent(ReadErrorComponent);
      fixture.componentRef.setInput('section', 'profile');
      fixture.componentRef.setInput('error', new ApiError(kind, 'Safe explanation'));
      fixture.autoDetectChanges(); await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(`profile: ${label}`);
      expect(element.querySelector('button')).toBeNull();
      expect(element.textContent).toContain('return to the users directory');
    });
  }

  for (const [kind, label] of [['network', 'Connection problem'], ['format', 'Invalid service response'], ['server', 'Service unavailable']] as const) {
    it(`emits a section-specific retry for ${kind}`, async () => {
      const fixture = TestBed.createComponent(ReadErrorComponent);
      fixture.componentRef.setInput('section', 'comments');
      fixture.componentRef.setInput('error', new ApiError(kind, 'Safe explanation'));
      const retry = jasmine.createSpy('retry');
      fixture.componentInstance.retry.subscribe(retry);
      fixture.autoDetectChanges(); await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      expect(element.textContent).toContain(`comments: ${label}`);
      const button = element.querySelector<HTMLButtonElement>('button');
      if (!button) throw new Error('Retry button missing');
      expect(button.textContent).toContain('Retry comments');
      button.click(); await fixture.whenStable();
      expect(retry).toHaveBeenCalledTimes(1);
    });
  }
});
