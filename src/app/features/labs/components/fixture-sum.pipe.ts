import { Pipe } from '@angular/core';
import type { PipeTransform } from '@angular/core';

@Pipe({ name: 'fixturePureSum' })
export class FixturePureSumPipe implements PipeTransform {
  transform(values: readonly number[]): number {
    return values.reduce((sum, value) => sum + value, 0);
  }
}

/** Deliberately impure comparison, not a recommended fix for mutable business state. */
@Pipe({ name: 'fixtureImpureSum', pure: false })
export class FixtureImpureSumPipe implements PipeTransform {
  transform(values: readonly number[]): number {
    return values.reduce((sum, value) => sum + value, 0);
  }
}
