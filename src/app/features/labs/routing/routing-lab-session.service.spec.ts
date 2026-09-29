import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RoutingLabSession } from './routing-lab-session.service';

describe('Local resolver source lifetime', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [RoutingLabSession] }));

  it('bounds controlled completion to 15 seconds and cleans up the pending subscriber', fakeAsync(() => {
    const session = TestBed.inject(RoutingLabSession);
    session.setMode('controlled');
    let failed = false;
    const values: number[] = [];
    const subscription = session.read(1).subscribe({ next: value => values.push(value.id), error: () => { failed = true; } });
    tick(14999); expect(session.status()).toBe('resolving');
    tick(1); expect(failed).toBeTrue(); expect(subscription.closed).toBeTrue(); expect(session.status()).toBe('failed');
    session.release(); expect(values).toEqual([]);
  }));

  it('cleans up on unsubscribe without completing stale requests later', () => {
    const session = TestBed.inject(RoutingLabSession); session.setMode('controlled');
    const values: number[] = [];
    const subscription = session.read(1).subscribe(value => values.push(value.id));
    subscription.unsubscribe(); session.release(); session.fail();
    expect(values).toEqual([]); expect(session.status()).toBe('cancelled');
  });

  it('ignores unsupported modes and exposes no fabricated remote data', () => {
    const session = TestBed.inject(RoutingLabSession); session.setMode('invalid');
    expect(session.mode()).toBe('immediate');
    let failed = false;
    session.read(999).subscribe({ error: () => { failed = true; } });
    expect(failed).toBeTrue();
  });
});
