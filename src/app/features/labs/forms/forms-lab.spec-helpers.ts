import { flushMicrotasks } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

// Call within fakeAsync. Drain only microtasks; never wait for the deliberately
// unfinished resource or manual save with fixture.whenStable().
export function renderLab<T>(fixture: ComponentFixture<T>): void {
  fixture.detectChanges();
  flushMicrotasks();
  fixture.detectChanges();
}

export function labElement<T>(fixture: ComponentFixture<T>): HTMLElement { return fixture.nativeElement; }

export function labButton<T>(fixture: ComponentFixture<T>, text: string): HTMLButtonElement {
  const button = Array.from(labElement(fixture).querySelectorAll('button')).find(item => item.textContent?.trim() === text);
  if (!button) throw new Error(`Missing lab button: ${text}`);
  return button;
}

export function labInput<T>(fixture: ComponentFixture<T>, selector: string): HTMLInputElement {
  const input = labElement(fixture).querySelector(selector);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing lab input: ${selector}`);
  return input;
}

export function typeLab<T>(fixture: ComponentFixture<T>, selector: string, value: string, blur = true): void {
  const input = labInput(fixture, selector);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (blur) input.dispatchEvent(new Event('blur'));
  renderLab(fixture);
}

export function submitLab<T>(fixture: ComponentFixture<T>): void {
  const form = labElement(fixture).querySelector('form');
  if (!form) throw new Error('Missing lab form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  renderLab(fixture);
}

export function clickLab<T>(fixture: ComponentFixture<T>, text: string): void {
  labButton(fixture, text).click();
  renderLab(fixture);
}
