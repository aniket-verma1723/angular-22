import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardActions } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/config/api-config';
import { learningModuleList } from '../../core/learning/learning-modules';
import { DashboardWidgetsComponent } from './dashboard-widgets.component';

@Component({
  selector: 'app-dashboard',
  imports: [MatButton, MatCard, MatCardContent, MatCardActions, RouterLink, DashboardWidgetsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  protected readonly modules = learningModuleList;
  protected readonly dataModeLabel = inject(API_CONFIG).mode === 'mock'
    ? 'Local mock · session-only data' : 'Remote demo · simulated writes';
}
