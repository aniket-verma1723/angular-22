export type RecipeId = 'flattening' | 'subjects' | 'sources' | 'transform' | 'timing'
  | 'combination' | 'errors' | 'sharing' | 'promises';

interface Lesson {
  readonly id: RecipeId;
  readonly label: string;
  readonly prediction: string;
  readonly mechanism: string;
  readonly mistake: string;
  readonly revision: string;
}

export const RXJS_LESSONS: readonly Lesson[] = [
  {
    id: 'flattening', label: 'Four clicks: flattening strategies',
    prediction: 'Predict which of A/B/C/D will subscribe, emit, queue, cancel or be ignored. Latencies: A 31, B 13, C 23, D 9 virtual ms.',
    mechanism: 'switchMap replaces the active inner; concatMap buffers in order; mergeMap admits two inners and buffers the rest; exhaustMap ignores clicks while busy. Inner catchError returns EMPTY, preserving future clicks. Downstream takeUntil models navigation at 25 or 50 virtual ms.',
    mistake: 'Cancelling observation is not server rollback. A queued operation has not subscribed; an ignored or cancelled operation cannot later report success. Selecting an error on an ignored/cancelled operation need not produce an error event.',
    revision: 'Why must teardown follow the flattening operator, and why does inner catchError keep D available after a failure?'
  },
  {
    id: 'subjects', label: 'Hot sources: Subject / BehaviorSubject / ReplaySubject',
    prediction: 'Subscribers join at 0, 8 and 15 ms. A/B/C arrive at 1/5/11 ms; completion is at 13. Which values does each subscriber see?',
    mechanism: 'Subject multicasts only live values. BehaviorSubject starts with D and replays its current value while active. ReplaySubject(2) replays two values, even after completion. Subscribers share one producer. Signals represent synchronous current UI state, not every stream event; this view stores a completed trace in a signal.',
    mistake: 'A completed BehaviorSubject does not replay its value to new subscribers. Asynchronous operators after a BehaviorSubject also invalidate a blanket requireSync assumption. Do not create a Subject just to relay an existing source.',
    revision: 'Why does the subscriber at 15 ms see B/C only from ReplaySubject? How is a signal different from an event history?'
  },
  {
    id: 'sources', label: 'Cold sources and local event teardown',
    prediction: 'Will defer run before subscription? Will the local event at 19 ms still reach the view after teardown at 12?',
    mechanism: 'of and from(array) emit synchronously. defer runs its factory separately at the two subscriptions (5/17 ms). timer fires once at 10; interval(6) ends through take(3). fromEvent attaches to a local EventTarget and takeUntil removes the listener at 12.',
    mistake: 'Observable construction is not necessarily producer execution. Never leave interval or fromEvent subscribed when its owner ends. These virtual sources create no wall-clock timers or global DOM listeners.',
    revision: 'Which sources are lazy per subscription, and which producer can fire while no subscriber is listening?'
  },
  {
    id: 'transform', label: 'Transform, filter, observe and accumulate',
    prediction: 'From fixture IDs 1/2/3/4, double each, keep values above four, and accumulate. Predict the initial and final totals.',
    mechanism: 'map doubles; filter keeps 6/8; tap records a side effect without changing values; scan accumulates 6 then 14; startWith emits 0 immediately. Numeric IDs are synthetic counters, not user data.',
    mistake: 'tap is not a transformation and scan is not a separately writable total. Mutating an external accumulator would leak state across runs.',
    revision: 'Why is the first scan output 6 rather than 0, unless startWith is included?'
  },
  {
    id: 'timing', label: 'Debounce, throttle and audit policies',
    prediction: 'A0, B3, B11, C22, D35; source completes at 45. Compare a six-ms quiet window, leading-only throttle, and audit windows.',
    mechanism: 'debounceTime(6) waits for quiet; distinctUntilChanged removes the second B. throttleTime(6, leading true / trailing false) emits the window opener. auditTime(6) emits the latest value when its window ends. Every operator receives the same virtual scheduler.',
    mistake: 'Throttle does not promise the final intent with trailing disabled. Audit is not debounce: later events do not restart its existing window.',
    revision: 'Why does audit emit B at 6, debounce at 9, and throttle emit A at 0?'
  },
  {
    id: 'combination', label: 'combineLatest / forkJoin / withLatestFrom',
    prediction: 'Primary A2/C9/D21 completes at 24; secondary B6/C15 completes at 18. Which strategy can respond to the primary at 2?',
    mechanism: 'combineLatest emits after both inputs emit and reacts to either; seeded variants startWith S. forkJoin waits for every value-producing input to complete. withLatestFrom responds only to the primary, dropping clicks before a secondary value. Empty and bounded NEVER joins are included; JOIN-RECOVER catches a widget error before joining with synthetic E.',
    mistake: 'Completion without a value is not a successful empty value. A never-completing join cannot finish without a bound. Catching one combined error outside cannot preserve independent widget outcomes.',
    revision: 'Why can LATEST-SEED emit at 2, while LATEST first emits at 9 and JOIN only at 24?'
  },
  {
    id: 'errors', label: 'Bounded retry, recovery and timeout',
    prediction: 'Attempts take 7 ms; eligible transient retry delay is 5 ms, at most two retries. Compare success on attempt three, exhausted transient failure, and validation failure.',
    mechanism: 'defer recreates each attempt; throwError enters the error channel; retry admits only the synthetic transient reason. catchError recovers exhausted/validation failures with EMPTY. NEVER times out at 13. finalize runs after complete, error and unsubscribe.',
    mistake: 'Do not retry validation failures or blindly replay writes. A recovered empty stream is explicitly logged as an error first, not presented as successful data.',
    revision: 'Why does validation have one attempt, and transient recovery have at most three?'
  },
  {
    id: 'sharing', label: 'share / shareReplay: overlap, reset and late readers',
    prediction: 'Readers 1/2 join at 0/8 and leave at 11/13, before completion. Reader 3 joins at 20 and finishes; reader 4 joins at 47. Count producer subscriptions.',
    mechanism: 'The cold producer emits A at +5 and B at +15, then completes. share multicasts without replay and resets on completion. shareReplay({ bufferSize: 1, refCount: true }) replays A to reader 2; refCount zero at 13 cancels the unfinished source and resets it. After reader 3 completes, reader 4 gets cached B without a new producer.',
    mistake: 'refCount is not a TTL. Completed shareReplay data remains cached for this observable instance; deliberate owner replacement is the invalidation policy here. Run creates a fresh instance.',
    revision: 'Why does reader 4 restart share but not shareReplay, even though both had zero readers?'
  },
  {
    id: 'promises', label: 'firstValueFrom / lastValueFrom: bounded boundaries',
    prediction: 'A arrives at 7, B at 16, completion at 19. Predict first/last resolution, EMPTY rejection, and bounded NEVER rejection.',
    mechanism: 'firstValueFrom unsubscribes after A; lastValueFrom waits for completion and returns B. Both reject EmptyError for EMPTY. timeout({ first: 13, each: 13 }) bounds silent NEVER inputs. All timers flush synchronously; promise handlers run as microtasks. Settlement markers use the virtual subscription end time, not microtask wall time.',
    mistake: 'A timeout between emissions does not bound a forever-emitting source. This fixture has fixed completion; a general lastValueFrom boundary needs an absolute completion policy too. Never leave promise rejections unhandled.',
    revision: 'Why does FIRST log cancellation rather than source completion, and why can LAST not resolve at B before completion?'
  }
];
