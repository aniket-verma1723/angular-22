import { Component, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { QuantityControlComponent } from '../../cart/ui/quantity-control.component';
import { CounterExperimentComponent } from './counter-experiment.component';
import { LessonPanelComponent } from './lesson-panel.component';

@Component({
  selector: 'app-component-state-lab',
  imports: [MatButton, QuantityControlComponent, CounterExperimentComponent, LessonPanelComponent],
  templateUrl: './component-state-lab.component.html',
  styleUrl: './component-state-lab.component.css'
})
export class ComponentStateLabComponent {
  protected readonly draftQuantity = signal(1);
  protected readonly showFirstExperiment = signal(true);
}
