import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import type { Resource, debounced } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LOCAL_DEBOUNCE_MS, StateExperiment } from './state-experiment.service';

describe('StateExperiment', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [StateExperiment] }));

  it('evaluates lazily and memoizes until an actual dependency changes', () => {
    const state = TestBed.inject(StateExperiment);
    expect(state.observation()).toBeNull();
    state.inspect(); state.inspect();
    expect(state.observation()).toEqual({ result: 10, executions: 1, rawQuantity: 1 });
    state.increment(); state.inspect();
    expect(state.observation()).toEqual({ result: 20, executions: 2, rawQuantity: 2 });
    state.equalReplacement(); state.inspect();
    expect(state.observation()?.executions).toBe(2);
  });

  it('removes conditional dependencies then reads their latest value when enabled again', () => {
    const state = TestBed.inject(StateExperiment);
    state.inspect(); state.toggleDependency(); state.inspect();
    expect(state.observation()?.result).toBe(0);
    state.increment(); state.inspect();
    expect(state.observation()).toEqual({ result: 0, executions: 2, rawQuantity: 2 });
    state.toggleDependency(); state.inspect();
    expect(state.observation()).toEqual({ result: 20, executions: 3, rawQuantity: 2 });
  });

  it('exposes a stale cached result for nested mutation and recovers through immutable update', () => {
    const state = TestBed.inject(StateExperiment);
    state.inspect(); state.mutateWithoutNotification(); state.inspect();
    expect(state.observation()).toEqual({ result: 10, executions: 1, rawQuantity: 2 });
    state.equalReplacement(); state.inspect();
    expect(state.observation()?.executions).toBe(1);
    state.increment(); state.inspect();
    expect(state.observation()).toEqual({ result: 30, executions: 2, rawQuantity: 3 });
  });

  it('allows only available linked selections and resets on the actual choices source', () => {
    const state = TestBed.inject(StateExperiment);
    state.choose('Blue'); expect(state.selection()).toBe('Blue'); expect(state.radius()).toBe(24);
    state.choose('not-an-option'); expect(state.selection()).toBe('Blue');
    state.replaceChoices(); expect(state.selection()).toBe('Green'); expect(state.radius()).toBe(8);
    state.choose('Amber'); expect(state.selection()).toBe('Amber');
    state.replaceChoices(); expect(state.selection()).toBe('Violet');
  });

  it('observes only stabilized 3 for synchronous 1/2/3 writes and keeps a bounded trace', () => {
    const state = TestBed.inject(StateExperiment);
    TestBed.tick();
    state.batchThree(); TestBed.tick();
    expect(state.emissions()).toEqual([0, 3]);
    for (let index = 0; index < 12; index++) {
      state.resetBatch(); TestBed.tick(); state.batchThree(); TestBed.tick();
    }
    expect(state.emissions().length).toBe(8);
    expect(state.emissions()).not.toContain(1);
    expect(state.emissions()).not.toContain(2);
  });

  it('recovers inside the request boundary and retains the same toSignal for later intents', () => {
    const state = TestBed.inject(StateExperiment);
    const result = state.result;
    expect(result()).toContain('idle');
    state.emit('error'); expect(result()).toContain('error: recovered');
    state.emit('success'); expect(result()).toBe('success: local value');
    expect(state.result).toBe(result);
  });

  it('debounces bounded local text in virtual time and cancels replaced typing', fakeAsync(() => {
    const state = TestBed.inject(StateExperiment);
    state.setText('A'); TestBed.tick(); tick(100);
    state.setText('AB'); TestBed.tick(); tick(LOCAL_DEBOUNCE_MS - 1);
    expect(state.text()).toBe('AB'); expect(state.debouncedText()).toBe('');
    tick(1); expect(state.debouncedText()).toBe('AB');
    state.setText('x'.repeat(100)); TestBed.tick(); tick(LOCAL_DEBOUNCE_MS);
    expect(state.debouncedText().length).toBe(40);
    state.setText(''); TestBed.tick(); tick(LOCAL_DEBOUNCE_MS);
    expect(state.debouncedText()).toBe('');
  }));

  it('owns independent stores and unsubscribes boundaries and pending debounce on destroy', fakeAsync(() => {
    const owner = createEnvironmentInjector([StateExperiment], TestBed.inject(EnvironmentInjector));
    const state = owner.get(StateExperiment);
    const other = TestBed.inject(StateExperiment);
    state.choose('Blue'); expect(other.selection()).toBe('Violet');
    TestBed.tick(); tick(LOCAL_DEBOUNCE_MS);
    state.setText('pending'); TestBed.tick();
    const emissions = state.emissions();
    owner.destroy();
    state.emit('success'); state.batchThree(); tick(LOCAL_DEBOUNCE_MS); TestBed.tick();
    expect(state.debouncedText()).toBe('');
    expect(state.result()).toContain('idle');
    expect(state.emissions()).toEqual(emissions);
  }));

  it('checks the installed experimental helper return shape without executing it', () => {
    // core/types/core.d.ts ~9544: @experimental 22.0; declarations only, no runtime import.
    type DeclaredDebounced = ReturnType<typeof debounced<string>>;
    const declared: Pick<DeclaredDebounced, 'value'> = { value: signal('declaration only') };
    const resourceShape: Pick<Resource<string>, 'value'> = declared;
    expect(resourceShape.value()).toBe('declaration only');
  });
});
