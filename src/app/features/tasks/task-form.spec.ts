import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { taskFormSchema } from './task-form';
import type { TaskFormModel } from './task-form';

describe('Task Signal Forms schema', () => {
  function valid(patch: Partial<TaskFormModel>): boolean {
    return TestBed.runInInjectionContext(() => form(signal<TaskFormModel>({ todo: 'Read a chapter', userId: 1, ...patch }), taskFormSchema)().valid());
  }
  it('accepts positive safe IDs and the 200-character boundary', () => {
    expect(valid({ todo: 'x'.repeat(200), userId: Number.MAX_SAFE_INTEGER })).toBeTrue();
  });
  for (const patch of [
    { todo: '' }, { todo: ' \n ' }, { todo: 'x'.repeat(201) },
    { userId: null }, { userId: 0 }, { userId: -1 }, { userId: 1.2 },
    { userId: Infinity }, { userId: NaN }, { userId: Number.MAX_SAFE_INTEGER + 1 }
  ]) {
    it(`rejects invalid draft ${JSON.stringify(patch)}`, () => expect(valid(patch)).toBeFalse());
  }
});
