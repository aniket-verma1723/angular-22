import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-labs-index',
  imports: [MatButton, MatCard, MatCardContent, RouterLink],
  template: `
    <p class="eyebrow muted">M09 · Learn by experiment</p><h1 tabindex="-1">Angular labs</h1>
    <mat-card appearance="outlined"><mat-card-content><h2>P04 · Component state</h2>
      <p>Try model inputs, content projection, scoped dependency injection and lifecycle cleanup.</p>
      <a mat-flat-button routerLink="/labs/component-state">Open component state lab</a>
    </mat-card-content></mat-card>
    <mat-card appearance="outlined"><mat-card-content><h2>P08 · RxJS operators</h2>
      <p>Predict four-click results, then inspect virtual-time subscriptions, errors, sharing and teardown.</p>
      <a mat-flat-button routerLink="/labs/rxjs">Open RxJS operator lab</a>
    </mat-card-content></mat-card>
    <h2>P09 · Framework and comparison labs</h2>
    @for (lab of labs; track lab.path) {
      <mat-card appearance="outlined"><mat-card-content><h3>{{ lab.title }}</h3>
        <p>{{ lab.description }}</p><a mat-flat-button [routerLink]="lab.path">Open {{ lab.title }}</a>
      </mat-card-content></mat-card>
    }
    <h2>P10 · Material and CDK</h2>
    @for (lab of materialLabs; track lab.path) {
      <mat-card appearance="outlined"><mat-card-content><h3>{{ lab.title }}</h3>
        <p>{{ lab.description }}</p><a mat-flat-button [routerLink]="lab.path">Open {{ lab.title }}</a>
      </mat-card-content></mat-card>
    }
    <p><a mat-button routerLink="/tasks">Try task drag/drop and keyboard moves</a></p>
    <mat-card appearance="outlined"><mat-card-content><h2>P11 · Quality and performance</h2>
      <p>P11 full follow-up: explore animation cleanup and reduced motion, method versus computed profiling,
        and reserved fill images alongside deferred rendering, cached code, opt-in preloading and quality checks.
        Local observations are not performance or accessibility certification.</p>
      <a mat-flat-button routerLink="/labs/performance">Open performance lab</a>
    </mat-card-content></mat-card>
    <mat-card appearance="outlined"><mat-card-content><h2>P12 · Zoneless Angular</h2>
      <p>Run a bounded callback with signal or markForCheck notifications. Compare scheduling with
        Eager/OnPush checking and inspect cancellation and cleanup without Zone.js in the application.</p>
      <a mat-flat-button routerLink="/labs/zoneless">Open zoneless lab</a>
    </mat-card-content></mat-card>
    <h2>Later lessons</h2><p>Settings/M08/P14 and advanced lessons remain deferred, as does P13 SSR.
      Experimental APIs are awareness-only.</p>
  `,
  styles: ':host { display: block; max-width: 900px; margin: auto; } h1 { font-size: 2.5rem; } mat-card { margin-block: 1rem; }'
})
export class LabsIndexComponent {
  protected readonly materialLabs = [
    { path: '/labs/material', title: 'Material interaction lab', description: 'Menus, tabs, choice controls, tree, layout and feedback with local fixtures and public harness tests.' },
    { path: '/labs/material-dates', title: 'Material dates and time lab', description: 'Independent Signal date and Reactive range/time fixtures with a scoped native adapter, parsing caveats and reset.' },
    { path: '/labs/cdk', title: 'CDK lab', description: 'Owned overlay/portal, fixed-height virtual people, selection, focus, clipboard, autosize and local RTL preview.' }
  ] as const;
  protected readonly labs = [
    { path: '/labs/components', title: 'Components lab', description: 'Typed templates, projection and queries, host directives, dynamic views, pipes and render callbacks.' },
    { path: '/labs/di', title: 'Dependency injection lab', description: 'Inspect provider identity, view/content boundaries, owned injectors and bounded initialization.' },
    { path: '/labs/state', title: 'Reactive state lab', description: 'Observe memoization, linked selection, effect cleanup, stabilized streams and output interop.' },
    { path: '/labs/routing', title: 'Routing lab', description: 'Explore local guards, resolvers, route reuse, named outlets and recovery without API calls.' },
    { path: '/labs/resources', title: 'Resources comparison', description: 'Run one product reader at a time: RxJS, httpResource, rxResource or a promise-loader resource.' },
    { path: '/labs/forms-signal', title: 'Signal Forms comparison', description: 'A local schema-owned draft with custom controls, blur updates and controlled async validation.' },
    { path: '/labs/forms-reactive', title: 'Reactive Forms comparison', description: 'An equivalent independent control tree: cross-field rules, dynamic controls, CVA and reset.' },
    { path: '/labs/forms-template', title: 'Template-driven comparison', description: 'A small isolated preference form. No shared draft, network or persisted settings.' }
  ] as const;
}
