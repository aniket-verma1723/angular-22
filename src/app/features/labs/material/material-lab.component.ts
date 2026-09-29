import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MaterialActionsComponent } from './material-actions.component';
import { MaterialChoicesComponent } from './material-choices.component';
import { MaterialDisplayFeedbackComponent } from './material-display-feedback.component';
import { MaterialTableComponent } from './material-table.component';

@Component({
  selector: 'app-material-lab',
  imports: [
    RouterLink,
    MaterialActionsComponent,
    MaterialChoicesComponent,
    MaterialDisplayFeedbackComponent,
    MaterialTableComponent
  ],
  templateUrl: './material-lab.component.html',
  styleUrl: './material-lab.component.css'
})
export class MaterialLabComponent {}
