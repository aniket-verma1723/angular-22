import type { Routes } from '@angular/router';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{
		path: 'dashboard', title: 'Overview | Angular 22 Learning Store',
		loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
	},
	{ path: 'products', loadChildren: () => import('./features/products/products.routes').then(m => m.routes) },
	{ path: 'cart', loadChildren: () => import('./features/cart/cart.routes').then(m => m.routes) },
	{ path: 'checkout', loadChildren: () => import('./features/checkout/checkout.routes').then(m => m.routes) },
	{ path: 'login', loadChildren: () => import('./features/session/session.routes').then(m => m.routes) },
	{ path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.routes) },
	{ path: 'posts', loadChildren: () => import('./features/posts/posts.routes').then(m => m.routes) },
	{ path: 'tasks', loadChildren: () => import('./features/tasks/tasks.routes').then(m => m.routes) },
	{ path: 'settings', loadChildren: () => import('./features/settings/settings.routes').then(m => m.routes) },
	{ path: 'labs', loadChildren: () => import('./features/labs/labs.routes').then(m => m.routes) },
	{
		path: 'forbidden', title: 'Access denied | Angular 22 Learning Store',
		data: { heading: 'Access denied', message: 'Product editing requires the local demo-admin practice role. Sign out and choose Demo admin when signing in again. This is a navigation exercise, not server authorization.', sessionRecovery: true },
		loadComponent: () => import('./shared/ui/route-message/route-message.component').then(m => m.RouteMessageComponent)
	},
	{
		path: '**', title: 'Page not found | Angular 22 Learning Store',
		data: { heading: 'Page not found', message: 'This address does not match a learning page. Let’s get you back on track.' },
		loadComponent: () => import('./shared/ui/route-message/route-message.component').then(m => m.RouteMessageComponent)
	}
];
