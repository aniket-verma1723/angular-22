import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import type { CanActivateChildFn, CanActivateFn, CanDeactivateFn, CanMatchFn, ResolveFn, Routes, UrlMatcher } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ROUTING_LAB_BASE, RoutingLabSession, parseLabId } from './routing-lab-session.service';
import type { RouteFixture } from './routing-lab-session.service';
import type { RoutingDetailComponent } from './routing-detail.component';

export const labChildGuard: CanActivateChildFn = () => inject(RoutingLabSession).permission()
  || inject(Router).createUrlTree([ROUTING_LAB_BASE, 'recovery'], { queryParams: { reason: 'permission' } });

// Assigned to the installed three-argument CanMatchFn contract; unused arguments aren't fabricated.
export const labMatchGuard: CanMatchFn = () => inject(RoutingLabSession).matchAllowed()
  || inject(Router).createUrlTree([ROUTING_LAB_BASE, 'recovery'], { queryParams: { reason: 'match' } });

export const labIdGuard: CanActivateFn = route => parseLabId(route.paramMap.get('id')) !== null
  || inject(Router).createUrlTree([ROUTING_LAB_BASE, 'recovery'], { queryParams: { reason: 'invalid' } });

export const labLeaveGuard: CanDeactivateFn<RoutingDetailComponent> = component => !component.leaveBlocked();

export const labResolver: ResolveFn<RouteFixture> = route => {
  const router = inject(Router);
  const session = inject(RoutingLabSession);
  const id = parseLabId(route.paramMap.get('id'));
  const recovery = new RedirectCommand(router.createUrlTree([ROUTING_LAB_BASE, 'recovery'], {
    queryParams: { reason: id === null ? 'invalid' : 'resolver' }
  }));
  if (id === null) return recovery;
  return session.read(id).pipe(catchError(() => of(recovery)));
};

export const labRecipeMatcher: UrlMatcher = segments => {
  const [prefix, topic] = segments;
  if (segments.length !== 2 || prefix?.path !== 'recipe' || !topic
    || !['signals', 'di'].includes(topic.path)
    || segments.some(segment => Object.keys(segment.parameters).length > 0)) return null;
  return { consumed: segments, posParams: { topic } };
};

/** Mount beneath /labs/routing with the app's existing withComponentInputBinding option. */
export const routes: Routes = [{
  path: '',
  providers: [RoutingLabSession],
  loadComponent: () => import('./routing-lab.component').then(module => module.RoutingLabComponent),
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'workspace/1' },
    {
      path: 'workspace', canActivateChild: [labChildGuard], children: [{
        path: ':id', canActivate: [labIdGuard], canDeactivate: [labLeaveGuard],
        runGuardsAndResolvers: 'pathParamsOrQueryParamsChange', resolve: { fixture: labResolver },
        title: route => `Notebook ${route.paramMap.get('id')} | Routing lab | Angular 22 Learning Store`,
        loadComponent: () => import('./routing-detail.component').then(module => module.RoutingDetailComponent)
      }]
    },
    { path: 'matched', canMatch: [labMatchGuard], title: 'Matched route | Routing lab | Angular 22 Learning Store', loadComponent: () => import('./routing-pages.component').then(module => module.MatchedLabComponent) },
    { matcher: labRecipeMatcher, title: 'Recipe matcher | Routing lab | Angular 22 Learning Store', loadComponent: () => import('./routing-pages.component').then(module => module.RecipeLabComponent) },
    { path: 'recovery', title: 'Recovery | Routing lab | Angular 22 Learning Store', loadComponent: () => import('./routing-pages.component').then(module => module.RoutingRecoveryComponent) },
    { path: 'help', outlet: 'help', loadComponent: () => import('./routing-pages.component').then(module => module.RoutingHelpComponent) },
    { path: '**', title: 'Unknown local route | Routing lab | Angular 22 Learning Store', loadComponent: () => import('./routing-pages.component').then(module => module.RoutingRecoveryComponent) }
  ]
}];
