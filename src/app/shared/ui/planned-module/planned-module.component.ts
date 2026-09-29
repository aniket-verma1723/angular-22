import { Component, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import type { LearningModule } from '../../../core/learning/learning-modules';

@Component({
  selector: 'app-planned-module',
  imports: [MatButton, MatCard, MatCardContent, RouterLink],
  templateUrl: './planned-module.component.html',
  styleUrl: './planned-module.component.css'
})
export class PlannedModuleComponent {
  readonly plan = input.required<LearningModule>();
  readonly heading = input.required<string>();
}
