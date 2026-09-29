import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocalAvailabilityService } from './local-availability.service';

describe('LocalAvailabilityService', () => {
  it('is cold, explicitly resolved, rejects banned fixtures and ignores stale IDs', () => {
    const owner = createEnvironmentInjector([LocalAvailabilityService], TestBed.inject(EnvironmentInjector));
    const service = owner.get(LocalAvailabilityService);
    const values: boolean[] = [];
    const source$ = service.check('Notebook');
    expect(service.requests()).toEqual([]);
    const old = source$.subscribe(value => values.push(value));
    const oldId = service.requests()[0]?.id ?? -1;
    old.unsubscribe();
    expect(service.cancellations()).toBe(1);
    expect(service.resolve(oldId)).toBeFalse();
    service.check(' ReSeRvEd ').subscribe(value => values.push(value));
    expect(service.resolve(service.requests()[0]?.id ?? -1)).toBeTrue();
    expect(values).toEqual([false]);
    service.check('Notebook').subscribe(value => values.push(value));
    service.resolve(service.requests()[0]?.id ?? -1);
    expect(values).toEqual([false, true]);
    expect(service.requests()).toEqual([]);
    owner.destroy();
  });

  it('fails explicitly, isolates injectors and closes unfinished observations on destruction', () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const owner = createEnvironmentInjector([LocalAvailabilityService], parent);
    const other = createEnvironmentInjector([LocalAvailabilityService], parent);
    const service = owner.get(LocalAvailabilityService);
    const failure = jasmine.createSpy('failure');
    service.check('A').subscribe({ error: failure });
    service.fail(service.requests()[0]?.id ?? -1);
    expect(failure).toHaveBeenCalledTimes(1);
    const completed = jasmine.createSpy('completed');
    service.check('B').subscribe({ complete: completed });
    expect(other.get(LocalAvailabilityService).requests()).toEqual([]);
    owner.destroy();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(service.requests()).toEqual([]);
    other.destroy();
  });
});
