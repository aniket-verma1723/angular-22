import { Injectable } from '@angular/core';

export interface ProfilingItem {
  readonly id: number;
  readonly label: string;
  readonly weight: number;
}

export interface ProfilingResult extends ProfilingItem {
  readonly score: number;
}

export const PROFILING_ITEM_LIMIT = 12;
export const PROFILING_ROUNDS = 4000;
export const PROFILING_ITEMS: readonly ProfilingItem[] = Object.freeze(
  Array.from({ length: PROFILING_ITEM_LIMIT }, (_, index) => Object.freeze({
    id: index + 1,
    label: `Fictional sample ${index + 1}`,
    weight: index + 1
  }))
);

/** Pure, deterministic local workload; scoped to the lesson for injector inspection and tests. */
@Injectable()
export class ProfilingCalculator {
  calculate(items: readonly ProfilingItem[]): readonly ProfilingResult[] {
    return items.slice(0, PROFILING_ITEM_LIMIT).map(item => {
      let score = 0;
      for (let round = 1; round <= PROFILING_ROUNDS; round++) {
        score += (item.weight * round) % 97;
      }
      return { ...item, score };
    });
  }
}
