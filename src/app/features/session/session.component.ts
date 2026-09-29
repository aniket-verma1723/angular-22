import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormField, disabled, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, firstValueFrom, map } from 'rxjs';
import { API_CONFIG } from '../../core/config/api-config';
import { toApiError } from '../../core/http/api-error';
import { safeReturnUrl } from '../../core/session/session.guard';
import type { DemoRole } from '../../core/session/session.models';
import { SessionService } from '../../core/session/session.service';
import { SessionStore } from '../../core/session/session.store';

interface LoginModel { username: string; password: string; role: DemoRole; }

@Component({
  selector: 'app-session',
  imports: [FormField, MatButton, MatCard, MatCardContent, MatError, MatFormField, MatHint, MatLabel,
    MatSuffix, MatInput, MatProgressBar, MatOption, MatSelect, RouterLink],
  templateUrl: './session.component.html',
  styleUrl: './session.component.css'
})
export class SessionComponent {
  private readonly service = inject(SessionService);
  private readonly store = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly model = signal<LoginModel>({ username: '', password: '', role: 'learner' });
  private readonly errorPanel = viewChild<ElementRef<HTMLElement>>('errorPanel');
  private readonly summaryHeading = viewChild<ElementRef<HTMLHeadingElement>>('summaryHeading');
  protected readonly mode = inject(API_CONFIG).mode;
  protected readonly user = this.store.user;
  protected readonly notice = this.store.notice;
  protected readonly error = signal('');
  protected readonly verification = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly busy = computed(() => this.service.busy() || this.loginForm().submitting());
  protected readonly returnUrl = toSignal(this.route.queryParamMap.pipe(map(params => {
    const values = params.getAll('returnUrl');
    return safeReturnUrl(values.length === 1 ? values[0] : null);
  })), { initialValue: '/dashboard' });
  protected readonly loginForm = form(this.model, path => {
    required(path.username, { message: 'Enter the public demo username.' });
    required(path.password, { message: 'Enter the public demo password.' });
    maxLength(path.username, 100, { message: 'Username must be at most 100 characters.' });
    maxLength(path.password, 200, { message: 'Password must be at most 200 characters.' });
    validate(path.username, ({ value }) => value().trim() ? undefined : { kind: 'blank', message: 'Username cannot be blank.' });
    validate(path.password, ({ value }) => value().trim() ? undefined : { kind: 'blank', message: 'Password cannot be blank.' });
    validate(path.role, ({ value }) => value() === 'learner' || value() === 'demo-admin'
      ? undefined : { kind: 'role', message: 'Choose a local practice role.' });
    disabled(path, { when: ({ state }) => state.submitting() || this.service.busy() });
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearPassword());
  }

  protected fillDemo(): void {
    if (this.busy() || this.user()) return;
    // These are deliberately public practice values, filled only on explicit request.
    this.model.update(value => ({ ...value, username: this.mode === 'mock' ? 'learner' : 'emilys',
      password: this.mode === 'mock' ? 'practice-only' : 'emilyspass' }));
    this.error.set('');
    this.passwordVisible.set(false);
    this.loginForm.username().focusBoundControl();
  }

  protected signIn(event: Event): void {
    event.preventDefault();
    if (this.busy() || this.user()) return;
    this.error.set(''); this.verification.set('');
    if (this.loginForm().pending()) {
      this.showError('Validation is still pending. Wait, then sign in again.');
      return;
    }
    void submit(this.loginForm, {
      ignoreValidators: 'none',
      onInvalid: field => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
      action: async field => {
        const { username, password, role } = field().value();
        // An empty completion is cancellation, not a failed login or a reason to retry.
        const user = await firstValueFrom(this.service.login({ username, password }, role).pipe(
          takeUntilDestroyed(this.destroyRef), finalize(() => this.clearPassword())
        ), { defaultValue: null });
        if (user && !this.destroyRef.destroyed) {
          afterNextRender(() => this.summaryHeading()?.nativeElement.focus(), { injector: this.injector });
        }
      }
    }).catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.showError(toApiError(error).message);
    });
  }

  protected verify(): void {
    if (this.busy() || !this.user()) return;
    this.error.set(''); this.verification.set('');
    this.service.verify().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.verification.set('Session verified with GET /auth/me. The original expiry is unchanged.'),
      error: (error: unknown) => this.showError(toApiError(error).message)
    });
  }

  protected logout(): void {
    this.store.logout();
    this.clearPassword(); this.error.set(''); this.verification.set('');
    afterNextRender(() => this.loginForm.username().focusBoundControl(), { injector: this.injector });
  }

  private clearPassword(): void {
    this.loginForm.password().reset('');
    this.passwordVisible.set(false);
  }

  private showError(message: string): void {
    this.error.set(message);
    afterNextRender(() => this.errorPanel()?.nativeElement.focus(), { injector: this.injector });
  }
}
