import { Component, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-route-message',
  imports: [MatButton, RouterLink],
  template: `
    <p class="eyebrow muted">Let’s find your way</p>
    <h1 tabindex="-1">{{ heading() }}</h1>
    <p>{{ message() }}</p>
    <a mat-flat-button routerLink="/dashboard">Back to overview</a>
    @if (sessionRecovery()) { <a mat-button routerLink="/login">Manage demo session</a> }
  `
})
export class RouteMessageComponent {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly sessionRecovery = input(false);
}
