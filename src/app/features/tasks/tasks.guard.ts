import type { CanDeactivateFn } from '@angular/router';
import type { TasksComponent } from './tasks.component';

export const tasksGuard: CanDeactivateFn<TasksComponent> = component => component.canLeave();
