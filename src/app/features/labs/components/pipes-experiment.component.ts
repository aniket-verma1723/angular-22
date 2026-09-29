import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, UpperCasePipe } from '@angular/common';
import { Component, LOCALE_ID, inject } from '@angular/core';
import { UsdCentsPipe } from '../../cart/ui/usd-cents.pipe';
import { ExperimentCardComponent } from './experiment-card.component';
import type { ComponentLesson } from './experiment-card.component';
import { FixtureImpureSumPipe, FixturePureSumPipe } from './fixture-sum.pipe';

@Component({
  selector: 'app-pipes-experiment',
  imports: [ExperimentCardComponent, FixturePureSumPipe, FixtureImpureSumPipe,
    CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, UpperCasePipe, UsdCentsPipe],
  templateUrl: './pipes-experiment.component.html',
  styleUrl: './experiment-controls.css'
})
export class PipesExperimentComponent {
  // This one plain array is intentionally mutable to demonstrate a broken reference contract.
  // Never copy this pattern into business signals, cart snapshots, or application data owners.
  protected values = [1, 2];
  protected eventCount = 0;
  protected readonly locale = inject(LOCALE_ID);
  protected readonly timestamp = '2026-09-27T12:00:00Z';
  protected readonly lesson: ComponentLesson = {
    title: 'A cached pipe is not a deep observer', coverage: 'C01–C03 · C16 · C17 · §8.4',
    concept: 'Pure pipes rerun when an argument reference/value changes. Impure pipes run on each eligible view check. This deliberately mutable, bounded local fixture is not business state.',
    tryIt: 'Predict both sums for [1, 2]. Append in place, request an unrelated event check, then replace the array reference. Reset before repeating.',
    mechanism: 'A template event makes this default-OnPush view eligible for checking. A same-reference pure-pipe argument stays cached even while interpolation and the impure pipe update. A new array invalidates the pure binding. Existing root Eager/Zone scheduling is unchanged.',
    mistake: 'Do not mutate business signals in place or choose an impure pipe to hide broken data flow. An arbitrary async plain-field mutation is not a reliable notification; OnPush eligibility and Zone scheduling are different concerns.',
    revision: 'Why can the raw list update while the pure sum stays stale? Does making a pipe impure make an otherwise skipped OnPush view run?',
    observation: 'Specs spy on real transform calls: unrelated checks and mutation reuse the pure result, a new reference reruns it. Formatting reuses the existing USD-cent pipe and current LOCALE_ID; USD and UTC are explicit, with no fees or currency conversion.'
  };

  protected mutateFixture(): void {
    if (this.values.length < 6) this.values.push(3);
  }

  protected replaceReference(): void { this.values = [...this.values]; }
  protected reset(): void { this.values = [1, 2]; this.eventCount = 0; }
}
