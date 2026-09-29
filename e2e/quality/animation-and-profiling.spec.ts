import type { Locator, Page } from '@playwright/test';
import { expect, expectStableApp, test } from '../fixtures';

async function tabTo(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  for (let tabs = 0; tabs <= 80; tabs++) {
    const isFocused = await target.evaluate(element => element === element.ownerDocument.activeElement);
    if (isFocused) return;
    if (tabs < 80) await page.keyboard.press('Tab');
  }
  throw new Error(`Not reachable within 80 Tab presses: ${target}`);
}

async function openLesson(page: Page): Promise<void> {
  await page.goto('/labs/performance');
  await expect(page.getByRole('heading', { name: 'Performance lab', exact: true })).toBeFocused();
  // Remove unrelated deferred work through its public control before observing this lesson.
  await page.getByRole('button', { name: 'Unmount experiment', exact: true }).click();
  await expectStableApp(page);
}

test('real CSS enter/leave separates DestroyRef teardown from DOM removal and bounds re-entry', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openLesson(page);
  const toggle = page.locator('[data-animation-toggle]');
  const inspect = page.getByRole('button', { name: 'Inspect animation lifetime', exact: true });
  const observation = page.locator('[data-animation-observation]');
  const card = page.locator('#animation-stage > app-animation-card');
  const samples = await page.locator('#animation-stage').evaluateHandle(stage => {
    const snapshots: { nodes: number; classes: string[]; animations: { name: string; duration: number | string }[] }[] = [];
    const completed: string[] = [];
    const cancelled: string[] = [];
    const observed = new WeakSet<Animation>();
    const record = (): void => {
      const animations = stage.getAnimations({ subtree: true });
      for (const animation of animations) {
        if (observed.has(animation)) continue;
        observed.add(animation);
        const name = animation instanceof CSSAnimation ? animation.animationName : 'transition';
        void animation.finished.then(() => { completed.push(name); }, () => { cancelled.push(name); });
      }
      snapshots.push({
        nodes: stage.childElementCount,
        classes: Array.from(stage.children, node => node.className),
        animations: animations.map(animation => {
          const duration = animation.effect?.getComputedTiming().duration ?? 0;
          return {
            name: animation instanceof CSSAnimation ? animation.animationName : 'transition',
            duration: typeof duration === 'number' ? duration : String(duration),
          };
        }),
      });
    };
    const observer = new MutationObserver(record);
    observer.observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    record();
    return { snapshots, completed, cancelled, stop: () => observer.disconnect() };
  });
  try {
    await tabTo(page, toggle);
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(1);
    await expect.poll(() => samples.evaluate(state => state.snapshots.some(snapshot =>
      snapshot.classes.some(value => value.includes('card-enter')) &&
      snapshot.animations.some(animation => animation.name.endsWith('card-appear') && animation.duration === 240),
    ))).toBe(true);
    await expect.poll(() => samples.evaluate(state => state.completed.some(name => name.endsWith('card-appear')))).toBe(true);
    // Angular, not the test, must remove the enter class after genuine CSS completion.
    await expect(card).not.toHaveClass(/card-enter/);
    await expect(card).toHaveCSS('opacity', '1');
    await expect(toggle).toBeFocused();
    await expect.poll(() => toggle.evaluate(element => {
      const style = getComputedStyle(element);
      return element.matches(':focus-visible') && parseFloat(style.outlineWidth) >= 2 &&
        style.outlineStyle !== 'none' && style.outlineColor !== 'rgba(0, 0, 0, 0)';
    })).toBe(true);
    await page.keyboard.press('Tab');
    await expect(inspect).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(observation).toContainText('created: 1; destroyed: 0; active Angular instances: 1; card DOM nodes: 1;');
    await page.keyboard.press('Shift+Tab');
    await expect(toggle).toBeFocused();

    // Keep this short sequence inside the lesson's actual 600 ms leave interval.
    // No forced finish(), synthetic animationend, clock advance, or arbitrary sleep.
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(observation).toContainText('created: 1; destroyed: 1; active Angular instances: 0; card DOM nodes: 1;');
    const duringLeave = await observation.innerText();
    expect(duringLeave).toMatch(/created: 1; destroyed: 1;\s*active Angular instances: 0; card DOM nodes: 1;/);
    expect(duringLeave).toMatch(/DOM present at last destruction:\s*yes/);
    await expect(page.locator('[data-animation-request]')).toContainText('Previous card is still leaving.');
    await expect(inspect).toBeFocused();
    await expect.poll(() => samples.evaluate(state => state.snapshots.some(snapshot =>
      snapshot.nodes === 1 && snapshot.classes.some(value => value.includes('card-leave')) &&
      snapshot.animations.some(animation => animation.name.endsWith('card-disappear') && animation.duration === 600),
    ))).toBe(true);
    await expect.poll(() => samples.evaluate(state => state.completed.some(name => name.endsWith('card-disappear')))).toBe(true);
    await expect(card).toHaveCount(0);
    // An inspection is a snapshot, not a reactive count of the remaining DOM.
    await expect(observation).toHaveText(duringLeave);
    await page.keyboard.press('Enter');
    await expect(observation).toContainText('created: 1; destroyed: 1; active Angular instances: 0; card DOM nodes: 0;');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Re-entry is explicitly retried after removal; blocked requests never queue another card.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(1);
    await expect(card).not.toHaveClass(/card-enter/);
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(card).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(observation).toContainText('created: 2; destroyed: 2; active Angular instances: 0; card DOM nodes: 0;');
    expect(await samples.evaluate(state => state.snapshots.every(snapshot => snapshot.nodes <= 1))).toBe(true);
  } finally {
    await samples.evaluate(state => state.stop());
    await testInfo.attach('real-motion-dom-observations', {
      body: JSON.stringify(await samples.evaluate(state => ({
        snapshots: state.snapshots, completed: state.completed, cancelled: state.cancelled,
      })), null, 2),
      contentType: 'application/json',
    });
    await samples.dispose();
  }
});

test('reduced motion keeps keyboard focus and lifetime counts without requiring a visible leave interval', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLesson(page);
  const toggle = page.locator('[data-animation-toggle]');
  const card = page.locator('#animation-stage > app-animation-card');
  const observation = page.locator('[data-animation-observation]');
  await tabTo(page, toggle);
  for (let cycle = 1; cycle <= 3; cycle++) {
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(1);
    await expect(card).not.toHaveClass(/card-enter/);
    await expect(card).toHaveCSS('animation-name', 'none');
    await expect(card).toHaveCSS('transform', 'none');
    await expect(card).toHaveCSS('opacity', '1');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(observation).toContainText(`created: ${cycle}; destroyed: ${cycle - 1}; active Angular instances: 1; card DOM nodes: 1;`);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(card).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(observation).toContainText(`created: ${cycle}; destroyed: ${cycle}; active Angular instances: 0; card DOM nodes: 0;`);
    await page.keyboard.press('Shift+Tab');
  }
});

test('profiling modes agree, immutable weight updates refresh output, and reversal moves the same DOM nodes', async ({ page }, testInfo) => {
  await openLesson(page);
  const rows = page.locator('[data-profiling-id]');
  await expect(rows).toHaveCount(12);
  const baseline = await rows.allTextContents();
  const identities = await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-profiling-id')));
  const references = await rows.first().evaluateHandle(first => {
    const parent = first.parentElement;
    if (!parent) throw new Error('Profiling rows require their list.');
    return Array.from(parent.children);
  });
  try {
    await page.getByRole('button', { name: 'Use expensive template method', exact: true }).click();
    await expect(page.locator('[data-profiling-mode]')).toHaveText('Selected mode: method.');
    await expect(rows).toHaveText(baseline);
    await page.getByRole('button', { name: 'Toggle unrelated note', exact: true }).click();
    await expect(page.locator('[data-profiling-note]')).toContainText('Unrelated note: shown.');
    await expect(rows).toHaveText(baseline);

    // Optional read-only DevTools inspection of input references; never set private state.
    // Behavioral assertions below still run if public development inspection is unavailable.
    const inputIdentity = await page.locator('app-profiling-lesson').evaluateHandle(host => {
      const ng: unknown = 'ng' in window ? window.ng : undefined;
      if (!ng || typeof ng !== 'object' || !('getComponent' in ng) || typeof ng.getComponent !== 'function') return null;
      const component: unknown = ng.getComponent(host);
      if (!component || typeof component !== 'object' || !('itemsState' in component) || typeof component.itemsState !== 'function') return null;
      const read = component.itemsState;
      const before: unknown = read();
      if (!Array.isArray(before)) throw new Error('Expected profiling input array.');
      const original: readonly unknown[] = before;
      const saved = JSON.stringify(original);
      return () => {
        const after: unknown = read();
        if (!Array.isArray(after)) throw new Error('Expected updated profiling input array.');
        return {
          newArray: after !== before,
          newFirstItem: after[0] !== original[0],
          unchangedOtherItems: original.slice(1).every((item, index) => item === after[index + 1]),
          originalUnchanged: JSON.stringify(original) === saved,
        };
      };
    });
    try {
      await page.getByRole('button', { name: 'Toggle sample 1 weight', exact: true }).click();
      await expect(page.locator('[data-profiling-id="1"] [data-weight]')).toHaveText('2');
      await expect(page.locator('[data-profiling-id="1"] [data-score]')).not.toHaveText('191172');
      await expect(rows).toHaveCount(12);
      const updated = await rows.allTextContents();
      expect(updated.slice(1)).toEqual(baseline.slice(1));
      const inspected = await inputIdentity.evaluate(read => read ? read() : null);
      if (inspected) {
        expect(inspected).toEqual({ newArray: true, newFirstItem: true, unchangedOtherItems: true, originalUnchanged: true });
      } else {
        testInfo.annotations.push({ type: 'limitation', description: 'Public ng.getComponent input-reference inspection unavailable; DOM behavior still checked.' });
      }
      await page.getByRole('button', { name: 'Use computed memoization', exact: true }).click();
      await expect(page.locator('[data-profiling-mode]')).toHaveText('Selected mode: computed.');
      await expect(rows).toHaveText(updated);
      await page.getByRole('button', { name: 'Toggle unrelated note', exact: true }).click();
      await expect(rows).toHaveText(updated);
      await page.getByRole('button', { name: 'Reverse samples', exact: true }).click();
      await expect.poll(() => rows.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-profiling-id')))).toEqual([...identities].reverse());
      expect(await references.evaluate(original => original.every(node =>
        node.isConnected && document.querySelector(`[data-profiling-id="${node.getAttribute('data-profiling-id')}"]`) === node,
      ))).toBe(true);
      await expect(rows).toHaveText([...updated].reverse());
      await page.getByRole('button', { name: 'Toggle sample 1 weight', exact: true }).click();
      await expect(rows).toHaveText([...baseline].reverse());
    } finally {
      await inputIdentity.dispose();
    }
  } finally {
    await references.dispose();
  }
});

for (const mode of ['method', 'computed'] as const) {
  test(`official Angular Chrome profiling records actual ${mode} interactions`, async ({ page, context, browser }, testInfo) => {
    await openLesson(page);
    await page.getByRole('button', {
      name: mode === 'method' ? 'Use expensive template method' : 'Use computed memoization', exact: true,
    }).click();
    const note = page.getByRole('button', { name: 'Toggle unrelated note', exact: true });
    await note.click();
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    const available = await page.evaluate(() => {
      const ng: unknown = 'ng' in window ? window.ng : undefined;
      return !!ng && typeof ng === 'object' && 'enableProfiling' in ng && typeof ng.enableProfiling === 'function';
    });
    test.skip(!available, 'Public window.ng.enableProfiling requires an Angular development build.');

    // Angular 22.1.7 uses console.timeStamp, which does NOT create PerformanceMeasure entries.
    // Capture its genuine Chrome timeline as well as any genuinely observed User Timing measures.
    const session = await context.newCDPSession(page);
    const traceEvents: unknown[] = [];
    session.on('Tracing.dataCollected', (event: { value: unknown[] }) => traceEvents.push(...event.value));
    let complete = false;
    session.on('Tracing.tracingComplete', () => { complete = true; });
    let tracing = false;
    try {
      await session.send('Tracing.start', {
        categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline',
        transferMode: 'ReportEvents',
      });
      tracing = true;
      const recorder = await page.evaluateHandle(() => {
        const ng: unknown = 'ng' in window ? window.ng : undefined;
        if (!ng || typeof ng !== 'object' || !('enableProfiling' in ng) || typeof ng.enableProfiling !== 'function') {
          throw new Error('Public Angular profiling API disappeared.');
        }
        const entries: { name: string; entryType: string; startTime: number; duration: number; detail: unknown }[] = [];
        const collect = (observed: PerformanceEntry[]): void => {
          for (const entry of observed) {
            if (entry instanceof PerformanceMeasure) entries.push({
              name: entry.name, entryType: entry.entryType, startTime: entry.startTime,
              duration: entry.duration, detail: entry.detail,
            });
          }
        };
        const observer = new PerformanceObserver(list => collect(list.getEntries()));
        observer.observe({ type: 'measure' });
        let disable: unknown;
        try {
          disable = ng.enableProfiling();
          if (typeof disable !== 'function') throw new Error('Public enableProfiling did not return its documented cleanup function.');
        } catch (error: unknown) {
          observer.disconnect();
          throw error;
        }
        return {
          stop: () => {
            try {
              if (typeof disable === 'function') disable();
            } finally {
              collect(observer.takeRecords());
              observer.disconnect();
            }
            return entries;
          },
        };
      });
      try {
        const output = await page.locator('[data-profiling-id]').allTextContents();
        for (let index = 0; index < 5; index++) {
          await note.click();
          await expect(note).toHaveAttribute('aria-pressed', index % 2 === 0 ? 'false' : 'true');
          await expect(page.locator('[data-profiling-id]')).toHaveText(output);
        }
        await page.getByRole('button', { name: 'Toggle sample 1 weight', exact: true }).click();
        await expect(page.locator('[data-profiling-id="1"] [data-weight]')).toHaveText('2');
        await expect(page.locator('[data-profiling-id="1"] [data-score]')).not.toHaveText('191172');
      } finally {
        try {
          const measures = await recorder.evaluate(state => state.stop());
          await testInfo.attach(`${mode}-observed-performance-measures`, {
            body: JSON.stringify({
              mode, browser: browser.version(), build: 'mock development', viewport: page.viewportSize(),
              interactions: 'one unrecorded warm-up; five note toggles; one weight toggle',
              limitation: 'Empty measures are valid for console.timeStamp-based Angular profiling. No synthetic measures or speedup assertions.',
              entries: measures,
            }, null, 2),
            contentType: 'application/json',
          });
        } finally {
          await recorder.dispose();
        }
      }
    } finally {
      try {
        if (tracing) {
          await session.send('Tracing.end');
          await expect.poll(() => complete, { message: 'Chrome trace delivery completed' }).toBe(true);
          await testInfo.attach(`${mode}-chrome-trace`, {
            body: JSON.stringify({ traceEvents }), contentType: 'application/json',
          });
        }
      } finally {
        await session.detach();
      }
    }
    // Require a genuine Angular timeline entry, not merely "angular" in a source URL.
    // This proves framework activity, not an exact check count or performance gain.
    expect(traceEvents.some(event => {
      if (!event || typeof event !== 'object' || !('name' in event) || event.name !== 'TimeStamp' ||
          !('args' in event) || !event.args || typeof event.args !== 'object' || !('data' in event.args)) return false;
      const data: unknown = event.args.data;
      return !!data && typeof data === 'object' && 'track' in data && typeof data.track === 'string' &&
        data.track.includes('Angular') && 'name' in data && typeof data.name === 'string' &&
        data.name.includes('ProfilingLessonComponent');
    })).toBe(true);
  });
}
