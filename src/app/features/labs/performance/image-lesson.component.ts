import { NgOptimizedImage } from '@angular/common';
import { Component, computed, linkedSignal, signal } from '@angular/core';

const LOCAL_IMAGE = '/mock-product.svg';
const UNAVAILABLE_IMAGE = '/mock-product-unavailable.svg';
type ImageStatus = 'loading' | 'ready' | 'failed';

@Component({
  selector: 'app-image-lesson',
  imports: [NgOptimizedImage],
  templateUrl: './image-lesson.component.html',
  styleUrl: './image-lesson.component.css'
})
export class ImageLessonComponent {
  private readonly requestState = signal({ id: 0, source: LOCAL_IMAGE });
  private readonly statusState = linkedSignal({
    source: this.requestState,
    computation: (): ImageStatus => 'loading'
  });
  private readonly fitState = signal<'contain' | 'cover'>('contain');
  // A fresh keyed image also permits retrying the same URL after a native error.
  protected readonly requests = computed(() => [this.requestState()]);
  protected readonly status = this.statusState.asReadonly();
  protected readonly fit = this.fitState.asReadonly();

  protected toggleFit(): void {
    this.fitState.update(value => value === 'contain' ? 'cover' : 'contain');
  }

  protected tryUnavailable(): void { this.requestImage(UNAVAILABLE_IMAGE); }
  protected restore(): void { this.requestImage(LOCAL_IMAGE); }

  protected settle(id: number, status: 'ready' | 'failed'): void {
    if (id === this.requestState().id) this.statusState.set(status);
  }

  private requestImage(source: string): void {
    this.requestState.update(request => ({ id: request.id + 1, source }));
  }
}
