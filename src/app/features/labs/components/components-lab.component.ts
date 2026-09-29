import { Component } from '@angular/core';
import { CompositionExperimentComponent } from './composition-experiment.component';
import { DynamicExperimentComponent } from './dynamic-experiment.component';
import { EncapsulationExperimentComponent } from './encapsulation-experiment.component';
import { PipesExperimentComponent } from './pipes-experiment.component';
import { QueriesExperimentComponent } from './queries-experiment.component';
import { RenderExperimentComponent } from './render-experiment.component';
import { TemplatesExperimentComponent } from './templates-experiment.component';

/** Lazy route entry for /labs/components; the owning route is wired outside this slice. */
@Component({
  selector: 'app-components-lab',
  imports: [TemplatesExperimentComponent, QueriesExperimentComponent, CompositionExperimentComponent,
    DynamicExperimentComponent, PipesExperimentComponent, EncapsulationExperimentComponent, RenderExperimentComponent],
  templateUrl: './components-lab.component.html',
  styleUrl: './components-lab.component.css'
})
export class ComponentsLabComponent {}
