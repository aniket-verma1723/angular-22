import { Component, inject, input, output } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { LabCounter } from './lab-counter.service';

@Component({
  selector: 'app-counter-probe',
  imports: [MatButton],
  template: `
    <p>{{ name() }} reads shared count: <strong data-count>{{ counter.count() }}</strong></p>
    <button mat-stroked-button type="button" (click)="counter.increment()">
      Increment from {{ name() }}
    </button>
  `
})
export class CounterProbeComponent implements OnInit, OnDestroy {
  readonly name = input.required<string>();
  readonly lifecycle = output<string>();
  protected readonly counter = inject(LabCounter);

  ngOnInit(): void {
    this.counter.register(this.name());
    this.lifecycle.emit(`${this.name()}: OnInit`);
  }

  ngOnDestroy(): void {
    this.counter.unregister(this.name());
    this.lifecycle.emit(`${this.name()}: OnDestroy`);
  }
}
