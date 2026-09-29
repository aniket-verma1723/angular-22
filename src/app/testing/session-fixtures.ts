import type { DemoUser } from '../core/session/session.models';
import type { SessionStore } from '../core/session/session.store';

// Existing lesson tests bypass transport, not guards. Auth transport has its own controlled tests.
export function establishSessionFixture(store: SessionStore, overrides: Partial<DemoUser> = {}): void {
  store.establish({ id: 1, username: 'demo', firstName: 'Demo', lastName: 'Learner', role: 'demo-admin', ...overrides },
    crypto.randomUUID(), Date.now() + 30 * 60_000);
}
