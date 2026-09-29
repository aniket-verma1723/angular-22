import { PayloadLifetime } from './payload-lifetime.service';

describe('PayloadLifetime', () => {
  it('allocates increasing visit-local IDs and records each destruction once', () => {
    const owner = new PayloadLifetime();
    const first = owner.recordCreation();
    const second = owner.recordCreation();
    expect([first, second]).toEqual([1, 2]);
    owner.recordDestruction(first);
    owner.recordDestruction(first);
    owner.recordDestruction(999);
    expect(owner.snapshot()).toEqual({ created: 2, destroyed: 1, active: 1 });
    owner.recordDestruction(second);
    expect(owner.snapshot()).toEqual({ created: 2, destroyed: 2, active: 0 });
  });

  it('returns immutable snapshots rather than a live mutable counter', () => {
    const owner = new PayloadLifetime();
    const before = owner.snapshot();
    owner.recordCreation();
    expect(before).toEqual({ created: 0, destroyed: 0, active: 0 });
    expect(Object.isFrozen(before)).toBeTrue();
    expect(owner.snapshot()).not.toBe(before);
  });

  it('does not share counters between owners', () => {
    const first = new PayloadLifetime();
    const second = new PayloadLifetime();
    first.recordCreation();
    first.recordCreation();
    expect(second.snapshot()).toEqual({ created: 0, destroyed: 0, active: 0 });
    expect(second.recordCreation()).toBe(1);
  });
});
