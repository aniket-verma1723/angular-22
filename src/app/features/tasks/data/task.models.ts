export const TASK_TEXT_MAX_LENGTH = 200;

export interface Task {
  readonly id: number;
  readonly todo: string;
  readonly completed: boolean;
  readonly userId: number;
}

export interface TaskQuery {
  readonly userId: number | null;
  readonly pageIndex: number;
  readonly pageSize: 10 | 25 | 50;
}

export interface TaskDraft {
  readonly todo: string;
  readonly userId: number;
}

export interface TaskDeletion {
  readonly id: number;
  readonly isDeleted: true;
  readonly deletedOn: string;
}

export interface TaskMutation<T> {
  readonly value: T;
  readonly persistence: 'simulated' | 'session';
}
