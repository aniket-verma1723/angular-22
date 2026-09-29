export interface LearningModule {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly phase: string;
  readonly description: string;
  readonly topics: readonly string[];
}

export const learningModules = {
  products: {
    id: 'M02', title: 'Products', path: '/products', phase: 'P03 · P05',
    description: 'From your first HTTP request to a complete product editor. Build the catalogue one interaction at a time.',
    topics: ['HTTP & runtime validation', 'URL search, sorting & pagination', 'Signal Forms & simulated CRUD']
  },
  cart: {
    id: 'M03', title: 'Cart', path: '/cart', phase: 'P04',
    description: 'One source of truth. Explore immutable updates and watch totals derive themselves from signal state.',
    topics: ['Private writable signals', 'Computed totals', 'Component inputs & outputs']
  },
  checkout: {
    id: 'M04', title: 'Checkout', path: '/checkout', phase: 'P06',
    description: 'Build a fictional checkout with typed controls and clear validation. No payments or real personal information.',
    topics: ['Typed Reactive Forms', 'Stepper & accessible validation', 'Duplicate-submit prevention']
  },
  session: {
    id: 'M05', title: 'Demo session', path: '/login', phase: 'P07',
    description: 'Understand a demo login lifecycle, in-memory tokens and navigation guards without claiming production authorization.',
    topics: ['Login & logout', 'Origin-scoped interceptors', 'Functional route guards']
  },
  users: {
    id: 'M06', title: 'Users & posts', path: '/users', phase: 'P08',
    description: 'Browse a searchable public directory, profiles, posts and comments. Profiles link to public user-filtered tasks, not nested tabs; overview widgets load on request.',
    topics: ['URL search & server pagination', 'Parallel reads & dependent author', 'Scoped sharing, section retries & cancellation']
  },
  tasks: {
    id: 'M07', title: 'Tasks', path: '/tasks', phase: 'P08 · P10',
    description: 'Public paged task CRUD retains its P08 verification. P10 adds same-column pointer drag/drop alongside native Move up/down, with no HTTP for order. Assignment is not session identity; completion still uses the PATCH queue.',
    topics: ['URL paging & public user filter', 'Bounded concatMap queue & row-only rollback', 'Snapshot-validated CDK ordering & native Move up/down']
  },
  settings: {
    id: 'M08', title: 'Settings', path: '/settings', phase: 'P09 · P14',
    description: 'The toolbar theme selector is session-only. Settings remain a placeholder; locale previews, saved preferences and global mock reset UI are deferred to settings/P14.',
    topics: ['Theme preference ownership', 'Locale & RTL', 'Development mock reset']
  },
  labs: {
    id: 'M09', title: 'Angular labs', path: '/labs', phase: 'P04 · P08 · P09–P14',
    description: 'P09 core comparisons remain ready alongside P04 and P08 experiments. P10 adds local Material interactions, independent date/time fixtures and CDK overlay, virtual selection and utilities. P11 full follow-up delivers animation, profiling and image lessons alongside defer, opt-in preloading and quality tooling, not full curriculum completion or certification. P12 adds zoneless application scheduling and a notification lab. P13 SSR, settings/P14 and advanced lessons remain deferred.',
    topics: ['Components, DI, state, resources & RxJS', 'Independent forms & Material date/time', 'Material interactions & owned CDK experiments', 'Defer, preloading, animation, profiling & images', 'Quality tooling & bounded measurements', 'Zoneless notifications & callback cleanup']
  }
} as const satisfies Record<string, LearningModule>;

export const learningModuleList: readonly LearningModule[] = Object.values(learningModules);
