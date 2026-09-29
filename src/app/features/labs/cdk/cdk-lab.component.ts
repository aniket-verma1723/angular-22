import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverlayExperimentComponent } from './overlay-experiment.component';
import { UtilitiesExperimentComponent } from './utilities-experiment.component';
import { VirtualPeopleExperimentComponent } from './virtual-people-experiment.component';

type Experiment = 'overlay' | 'virtual' | 'utilities';

/** Entry exported for the owning router to lazy-load at /labs/cdk. */
@Component({
  selector: 'app-cdk-lab',
  imports: [
    RouterLink,
    OverlayExperimentComponent,
    UtilitiesExperimentComponent,
    VirtualPeopleExperimentComponent
  ],
  templateUrl: './cdk-lab.component.html',
  styleUrl: './cdk-experiment.css'
})
export class CdkLabComponent {
  private readonly experimentState = signal<Experiment>('overlay');
  protected readonly experiment = this.experimentState.asReadonly();

  protected choose(experiment: Experiment): void {
    this.experimentState.set(experiment);
  }
}
