import { CurrencyPipe } from '@angular/common';
import { Component, Injector, computed, inject, input, runInInjectionContext, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { RESOURCE_READ_PROVIDERS } from './resource-read';
import { IDLE_READ, createResourceReader } from './resource-readers';
import type { ResourceReader, ResourceVariant } from './resource-readers';

@Component({
  selector: 'app-resource-experiment',
  imports: [CurrencyPipe],
  providers: RESOURCE_READ_PROVIDERS,
  templateUrl: './resource-experiment.component.html',
  styleUrl: './resources-lab.component.css'
})
export class ResourceExperimentComponent implements OnInit {
  // The parent @switch recreates this owner, rather than changing its variant in place.
  readonly variant = input.required<ResourceVariant>();
  private readonly injector = inject(Injector);
  private readonly reader = signal<ResourceReader | undefined>(undefined);
  private readonly draftState = signal('1');
  private readonly validationState = signal(false);
  protected readonly draft = this.draftState.asReadonly();
  protected readonly invalid = this.validationState.asReadonly();
  protected readonly state = computed(() => this.reader()?.state() ?? IDLE_READ);
  protected readonly selectedId = computed(() => this.reader()?.selectedId());
  protected readonly busy = computed(() => {
    const status = this.state().status;
    return status === 'loading' || status === 'reloading';
  });

  ngOnInit(): void {
    this.reader.set(runInInjectionContext(this.injector, () => createResourceReader(this.variant())));
  }

  protected edit(value: string): void {
    this.draftState.set(value);
    this.validationState.set(false);
  }

  protected load(): void {
    const value = this.draft().trim();
    const id = Number(value);
    if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(id) || id < 1) {
      this.validationState.set(true);
      return;
    }
    this.validationState.set(false);
    this.reader()?.load(id);
  }

  protected reload(): void {
    const id = this.selectedId();
    if (id !== undefined) this.reader()?.load(id);
  }

  protected clear(input: HTMLInputElement): void {
    this.reader()?.clear();
    this.draftState.set('');
    this.validationState.set(false);
    input.focus();
  }
}
