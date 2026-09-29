import { TestBed } from '@angular/core/testing';
import { LAB_EVENT_LIMIT, LabCounter } from './lab-counter.service';

describe('LabCounter', () => {
  it('has no implicit root provider', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(LabCounter, null)).toBeNull();
  });

  it('exposes immutable observations and derives active registrations', () => {
    const counter = new LabCounter();
    const initialEvents = counter.events();
    counter.register('A');
    counter.register('B');
    counter.increment();
    expect(counter.activeProbes()).toBe(2);
    expect(counter.count()).toBe(1);
    expect(initialEvents).toEqual([]);
    counter.unregister('A');
    expect(counter.activeProbes()).toBe(1);
    expect(counter.events().map(event => event.message)).toEqual([
      'A: OnInit', 'B: OnInit', 'A: OnDestroy'
    ]);
  });

  it('bounds event retention with stable unique identities', () => {
    const counter = new LabCounter();
    for (let index = 0; index < LAB_EVENT_LIMIT; index++) {
      counter.register('A');
      counter.unregister('A');
    }
    expect(counter.activeProbes()).toBe(0);
    expect(counter.events().length).toBe(LAB_EVENT_LIMIT);
    expect(new Set(counter.events().map(event => event.id)).size).toBe(LAB_EVENT_LIMIT);
    expect(counter.events()[0]?.id).toBe(LAB_EVENT_LIMIT);
    expect(counter.events().at(-1)?.message).toBe('A: OnDestroy');
  });
});
