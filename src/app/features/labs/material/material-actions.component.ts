import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MaterialLessonComponent } from './material-lesson.component';
import type { MaterialLesson } from './material-lesson.component';

@Component({
  selector: 'app-material-actions',
  imports: [MaterialLessonComponent, MatButtonModule, MatButtonToggleModule, MatMenuModule, MatTabsModule, MatTooltipModule],
  templateUrl: './material-actions.component.html',
  styleUrl: './material-actions.component.css'
})
export class MaterialActionsComponent {
  private readonly tabState = signal(0);
  private readonly modeState = signal<'brief' | 'detail'>('brief');
  private readonly pinnedState = signal(false);
  protected readonly tab = this.tabState.asReadonly();
  protected readonly mode = this.modeState.asReadonly();
  protected readonly pinned = this.pinnedState.asReadonly();
  protected readonly lesson: MaterialLesson = {
    title: 'Actions · menu, tabs and compact controls',
    concept: 'A menu performs an action; tabs switch related local panels. Button toggles choose a reading mode, while an icon button pins this fictional observation.',
    tryIt: 'Open Observation actions and choose Review notes. Switch Brief to Detail. Pin the observation, inspect its tooltip, then reset. Archived actions and the Locked tab are deliberately disabled.',
    mechanism: 'Material manages menu keyboard navigation, Escape and trigger focus restoration, plus tab selection and roving focus. Private signals drive the panel, exclusive toggle group and aria-pressed button. The icon is inline SVG: no font or request.',
    mistake: 'A tooltip is not an accessible name. Do not use menus for persistent selection or tabs as an unconfigured router. Disabled controls must not change state.',
    question: 'Which control changes a panel, which chooses a mode, and why does the icon button need a name even with a tooltip?',
    observation: 'Review notes selects Notes. Escape returns focus to the menu trigger. Detail changes the observation text, pinning updates visible text and aria-pressed, and Reset actions restores all three states.'
  };

  protected selectTab(index: number): void {
    if (index === 0 || index === 1) this.tabState.set(index);
  }

  protected selectMode(value: unknown): void {
    if (value === 'brief' || value === 'detail') this.modeState.set(value);
  }

  protected togglePin(): void { this.pinnedState.update(value => !value); }

  protected reset(): void {
    this.tabState.set(0);
    this.modeState.set('brief');
    this.pinnedState.set(false);
  }
}
