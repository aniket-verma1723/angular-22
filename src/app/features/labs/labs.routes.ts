import type { Routes } from '@angular/router';
import { learningModules } from '../../core/learning/learning-modules';
import { FormsLabGuard } from './forms/forms-lab.guard';

const loadPage = () => import('../../shared/ui/planned-module/planned-module.component').then(m => m.PlannedModuleComponent);

export const routes: Routes = [
  { path: 'zoneless', title: 'Zoneless lab | Angular 22 Learning Store', loadComponent: () => import('./zoneless/zoneless-lab.component').then(m => m.ZonelessLabComponent) },
  { path: 'performance', loadChildren: () => import('./performance/performance.routes').then(m => m.routes) },
  { path: 'material', title: 'Material interaction lab | Angular 22 Learning Store', loadComponent: () => import('./material/material-lab.component').then(m => m.MaterialLabComponent) },
  { path: 'material-dates', title: 'Material dates and time lab | Angular 22 Learning Store', loadComponent: () => import('./material-dates/material-dates-lab.component').then(m => m.MaterialDatesLabComponent) },
  { path: 'cdk', title: 'CDK lab | Angular 22 Learning Store', loadComponent: () => import('./cdk/cdk-lab.component').then(m => m.CdkLabComponent) },
  { path: 'components', title: 'Components lab | Angular 22 Learning Store', loadComponent: () => import('./components/components-lab.component').then(m => m.ComponentsLabComponent) },
  { path: 'di', title: 'Dependency injection lab | Angular 22 Learning Store', loadComponent: () => import('./di/di-lab.component').then(m => m.DiLabComponent) },
  { path: 'state', title: 'Reactive state lab | Angular 22 Learning Store', loadComponent: () => import('./state/state-lab.component').then(m => m.StateLabComponent) },
  { path: 'routing', loadChildren: () => import('./routing/routing-lab.routes').then(m => m.routes) },
  { path: 'resources', title: 'Resources comparison lab | Angular 22 Learning Store', loadComponent: () => import('./resources/resources-lab.component').then(m => m.ResourcesLabComponent) },
  { path: 'forms-signal', title: 'Signal Forms lab | Angular 22 Learning Store', loadComponent: () => import('./forms/forms-signal-lab.component').then(m => m.FormsSignalLabComponent), canDeactivate: [FormsLabGuard] },
  { path: 'forms-reactive', title: 'Reactive Forms lab | Angular 22 Learning Store', loadComponent: () => import('./forms/forms-reactive-lab.component').then(m => m.FormsReactiveLabComponent), canDeactivate: [FormsLabGuard] },
  { path: 'forms-template', title: 'Template-driven forms lab | Angular 22 Learning Store', loadComponent: () => import('./forms/forms-template-lab.component').then(m => m.FormsTemplateLabComponent), canDeactivate: [FormsLabGuard] },
  { path: 'rxjs', title: 'RxJS operator lab | Angular 22 Learning Store', loadComponent: () => import('./rxjs/rxjs-lab.component').then(m => m.RxjsLabComponent) },
  { path: 'component-state', title: 'Component state lab | Angular 22 Learning Store', loadComponent: () => import('./component-state/component-state-lab.component').then(m => m.ComponentStateLabComponent) },
  { path: '', title: 'Angular labs | Angular 22 Learning Store', loadComponent: () => import('./labs-index.component').then(m => m.LabsIndexComponent) },
  { path: ':topic', title: 'Lab preview | Angular 22 Learning Store', loadComponent: loadPage, data: { plan: learningModules.labs, heading: 'Lab preview' } }
];
