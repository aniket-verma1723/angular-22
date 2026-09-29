import { NgOptimizedImage } from '@angular/common';
import { Component, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  imports: [NgOptimizedImage],
  templateUrl: './user-avatar.component.html',
  styleUrl: './user-avatar.component.css'
})
export class UserAvatarComponent {
  readonly source = input.required<string | null>();
  readonly name = input.required<string>();
  private readonly failedState = linkedSignal({ source: this.source, computation: () => false });
  protected readonly failed = this.failedState.asReadonly();
  protected markFailed(): void { this.failedState.set(true); }
}
