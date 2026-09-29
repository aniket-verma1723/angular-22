import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import type { Observable } from 'rxjs';
import { FormsLabLeaveService } from './forms-lab.guard';
import type { FormsLabPage } from './forms-lab.guard';
import type { SaveStage } from './forms-lab.model';
import { FormsLessonComponent } from './forms-lesson.component';

interface LabPreferences { label: string; density: string; tips: boolean; }
function emptyPreferences(): LabPreferences { return { label: '', density: 'comfortable', tips: true }; }

@Component({
  selector: 'app-forms-template-lab',
  imports: [FormsModule, MatButton, MatCard, MatCardContent, FormsLessonComponent],
  providers: [FormsLabLeaveService],
  templateUrl: './forms-template-lab.component.html',
  styleUrl: './forms-lab.css',
  host: { '(window:beforeunload)': 'beforeUnload($event)' }
})
export class FormsTemplateLabComponent implements FormsLabPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly form = viewChild(NgForm);
  private readonly labelInput = viewChild<ElementRef<HTMLInputElement>>('labelInput');
  protected readonly leave = inject(FormsLabLeaveService);
  protected readonly stage = signal<SaveStage>('idle');
  protected preferences = emptyPreferences();

  canLeave(): boolean | Observable<boolean> { return this.leave.canLeave(this.dirty(), this.stage() === 'saving'); }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.stage() === 'saving') { event.preventDefault(); event.returnValue = ''; }
  }

  protected save(form: NgForm): void {
    if (this.stage() === 'saving' || this.leave.confirming()) return;
    form.control.markAllAsTouched();
    if (!form.valid || form.pending) { this.labelInput()?.nativeElement.focus(); return; }
    this.stage.set('saving');
  }

  protected completeSave(success: boolean): void {
    if (this.stage() !== 'saving' || this.destroyRef.destroyed) return;
    if (success) this.clearDraft();
    this.stage.set(success ? 'success' : 'failure');
  }

  protected resetDraft(): void {
    if (this.stage() === 'saving' || this.leave.confirming()) return;
    this.clearDraft();
    this.stage.set('idle');
  }

  protected review(form: NgForm): void {
    form.control.markAllAsTouched();
    this.labelInput()?.nativeElement.focus();
  }

  private clearDraft(): void {
    this.preferences = emptyPreferences();
    this.form()?.resetForm(this.preferences);
    afterNextRender(() => this.labelInput()?.nativeElement.focus(), { injector: this.injector });
  }

  private dirty(): boolean {
    return this.form()?.dirty === true || JSON.stringify(this.preferences) !== JSON.stringify(emptyPreferences());
  }
}
