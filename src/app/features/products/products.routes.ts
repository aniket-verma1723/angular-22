import type { Routes } from '@angular/router';
import { productEditorGuard } from './editor/product-editor.guard';
import { demoAdminGuard } from '../../core/session/session.guard';

const loadEditor = () => import('./editor/product-editor.component').then(m => m.ProductEditorComponent);

export const routes: Routes = [
  { path: '', title: 'Products | Angular 22 Learning Store', loadComponent: () => import('./catalogue/product-catalogue.component').then(m => m.ProductCatalogueComponent) },
  // Static paths must be declared before :id.
  { path: 'new', title: 'Create product | Angular 22 Learning Store', loadComponent: loadEditor, canActivate: [demoAdminGuard], canDeactivate: [productEditorGuard] },
  { path: ':id/edit', title: 'Edit product | Angular 22 Learning Store', loadComponent: loadEditor, canActivate: [demoAdminGuard], canDeactivate: [productEditorGuard] },
  { path: ':id', title: 'Product details | Angular 22 Learning Store', loadComponent: () => import('./detail/product-detail.component').then(m => m.ProductDetailComponent) }
];
