import { maxLength, required, schema, validate } from '@angular/forms/signals';
import { TASK_TEXT_MAX_LENGTH } from './data/task.models';

export interface TaskFormModel {
  todo: string;
  userId: number | null;
}

export const taskFormSchema = schema<TaskFormModel>(path => {
  required(path.todo, { message: 'Task text is required.' });
  maxLength(path.todo, TASK_TEXT_MAX_LENGTH, { message: `Use at most ${TASK_TEXT_MAX_LENGTH} characters.` });
  validate(path.todo, ({ value }) => value().trim() ? undefined : { kind: 'blank', message: 'Enter non-blank task text.' });
  required(path.userId, { message: 'Public assignment user ID is required.' });
  validate(path.userId, ({ value }) => {
    const id = value();
    return id !== null && Number.isSafeInteger(id) && id > 0
      ? undefined : { kind: 'userId', message: 'Use a positive safe whole-number public user ID.' };
  });
});
