import { Component, input, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { CounterObservationComponent } from './counter-observation.component';
import { CounterProbeComponent } from './counter-probe.component';
import { LabCounter } from './lab-counter.service';

@Component({
  selector: 'app-counter-experiment',
  imports: [MatButton, CounterProbeComponent, CounterObservationComponent],
  providers: [LabCounter],
  templateUrl: './counter-experiment.component.html',
  styleUrl: './counter-experiment.component.css'
})
export class CounterExperimentComponent {
  readonly label = input.required<string>();
  protected readonly showProbes = signal(true);
}
