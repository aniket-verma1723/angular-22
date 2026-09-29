import { AnimationLifetime } from './animation-lifetime.service';

describe('AnimationLifetime', () => {
  it('returns immutable detached snapshots and records attachment at destruction independently', () => {
    const lifetime = new AnimationLifetime();
    lifetime.recordCreation();
    const active = lifetime.snapshot();
    lifetime.recordDestruction(true);
    expect(active.active).toBe(1);
    expect(Object.isFrozen(active)).toBeTrue();
    expect(lifetime.snapshot()).toEqual({ created: 1, destroyed: 1, active: 0, domPresentAtLastDestruction: true });
    lifetime.recordCreation();
    lifetime.recordDestruction(false);
    expect(lifetime.snapshot().domPresentAtLastDestruction).toBeFalse();
  });

  it('saturates visit counters without losing the current active state', () => {
    const lifetime = new AnimationLifetime();
    for (let cycle = 0; cycle < 1005; cycle++) {
      lifetime.recordCreation();
      lifetime.recordDestruction(true);
    }
    expect(lifetime.snapshot()).toEqual({ created: 999, destroyed: 999, active: 0, domPresentAtLastDestruction: true });
    lifetime.recordCreation();
    expect(lifetime.snapshot().active).toBe(1);
  });
});
