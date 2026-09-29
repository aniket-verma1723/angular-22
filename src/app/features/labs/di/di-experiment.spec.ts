import { EnvironmentInjector, Injectable, createEnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import type { injectAsync } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { CONFIG_LIMIT_MS, DI_LABEL, DiCounter, createDiExperiment, inspectContext } from './di-experiment';

@Injectable()
class ConstructorComparison {
  constructor(readonly counter: DiCounter) {}
}

describe('DI workbench providers and owned context', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('uses typed value/factory/multi providers and aliases identity rather than copying instances', fakeAsync(() => {
    const run = createDiExperiment(TestBed.inject(EnvironmentInjector), 'success');
    expect(run.alias).toBe(run.counter);
    expect(run.separate).not.toBe(run.counter);
    expect(run.steps).toEqual(['validate', 'preview']);
    expect(run.summary).toBe('local-config: validate → preview');
    run.alias.increment();
    expect(run.counter.count()).toBe(1);
    expect(run.separate.count()).toBe(0);
    run.injector.destroy();
    flushMicrotasks();
    expect(run.counter.destroyed()).toBeTrue();
    expect(run.separate.destroyed()).toBeTrue();
    run.alias.increment();
    expect(run.counter.count()).toBe(1);
    expect(() => run.injector.get(DiCounter)).toThrow();
  }));

  it('runs configuration only in the isolated environment and resolves bounded success', fakeAsync(() => {
    const parent = TestBed.inject(EnvironmentInjector);
    const run = createDiExperiment(parent, 'success');
    expect(parent.get(DI_LABEL, null)).toBeNull();
    expect(run.config.state()).toBe('loading');
    tick(149);
    expect(run.config.state()).toBe('loading');
    tick(1);
    expect(run.config.state()).toBe('ready: local-config');
    run.injector.destroy();
  }));

  for (const outcome of ['failure', 'timeout'] as const) {
    it(`handles ${outcome} without rejecting the published completion promise`, fakeAsync(() => {
      const run = createDiExperiment(TestBed.inject(EnvironmentInjector), outcome);
      let settled = false;
      let rejected = false;
      void run.config.settled().then(() => { settled = true; }, () => { rejected = true; });
      tick(CONFIG_LIMIT_MS);
      expect(run.config.state()).toContain('failed');
      expect(settled).toBeTrue();
      expect(rejected).toBeFalse();
      run.injector.destroy();
    }));
  }

  it('cancels pending configuration on explicit destroy without late publication', fakeAsync(() => {
    const run = createDiExperiment(TestBed.inject(EnvironmentInjector), 'timeout');
    run.injector.destroy();
    tick(CONFIG_LIMIT_MS + 1);
    expect(run.config.state()).toBe('destroyed');
  }));

  it('captures synchronously and catches the actual NG0203 after await', fakeAsync(() => {
    const run = createDiExperiment(TestBed.inject(EnvironmentInjector), 'success');
    let captured = '';
    let afterAwait = '';
    void inspectContext(run.injector).then(value => {
      captured = value.captured; afterAwait = value.afterAwait;
    });
    flushMicrotasks();
    expect(captured).toBe('local-config');
    expect(afterAwait).toBe('NG0203 caught');
    expect(() => inject(DI_LABEL)).toThrowError(/NG0203/);
    run.injector.destroy();
    flushMicrotasks();
  }));

  it('inherits from a parent without transferring ownership and compares constructor DI', () => {
    const parent = createEnvironmentInjector([DiCounter], TestBed.inject(EnvironmentInjector));
    const child = createEnvironmentInjector([ConstructorComparison], parent);
    const counter = parent.get(DiCounter);
    expect(child.get(ConstructorComparison).counter).toBe(counter);
    expect(runInInjectionContext(child, () => inject(DiCounter, { skipSelf: true }))).toBe(counter);
    expect(runInInjectionContext(child, () => inject(DiCounter, { self: true, optional: true }))).toBeNull();
    child.destroy();
    expect(counter.destroyed()).toBeFalse();
    parent.destroy();
    expect(counter.destroyed()).toBeTrue();
  });

  it('checks the installed advanced injectAsync return contract without invoking the helper', () => {
    // Declaration evidence: @angular/core/types/core.d.ts ~802, @publicApi 22.0.
    // This type-only import is erased. No prefetch or experimental runtime is introduced.
    type InstalledLazyCounter = ReturnType<typeof injectAsync<DiCounter>>;
    const declarationCheck: InstalledLazyCounter = async () => TestBed.runInInjectionContext(() => new DiCounter());
    const contract: () => Promise<DiCounter> = declarationCheck;
    expect(typeof contract).toBe('function');
  });
});
