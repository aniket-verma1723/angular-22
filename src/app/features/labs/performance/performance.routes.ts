import type { Routes } from '@angular/router';
import { PerformanceLabComponent } from './performance-lab.component';

/** The owning labs router must loadChildren this file without preloading the parent. */
export const routes: Routes = [
  {
    path: '',
    component: PerformanceLabComponent,
    title: 'Performance lab | Angular 22 Learning Store',
    children: [
      {
        path: 'demand',
        title: 'On-demand lesson | Performance lab | Angular 22 Learning Store',
        loadComponent: () => import('./demand-lesson.component').then(module => module.DemandLessonComponent)
      },
      {
        path: 'preloaded',
        title: 'Preload candidate | Performance lab | Angular 22 Learning Store',
        data: { performancePreload: true },
        loadComponent: () => import('./preload-lesson.component').then(module => module.PreloadLessonComponent)
      }
    ]
  }
];
