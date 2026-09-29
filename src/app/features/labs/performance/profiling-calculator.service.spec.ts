import { PROFILING_ITEMS, PROFILING_ITEM_LIMIT, ProfilingCalculator } from './profiling-calculator.service';

describe('ProfilingCalculator', () => {
  it('returns deterministic fictional scores without mutating its input', () => {
    const calculator = new ProfilingCalculator();
    const before = PROFILING_ITEMS.map(item => ({ ...item }));
    const first = calculator.calculate(PROFILING_ITEMS);
    const second = calculator.calculate(PROFILING_ITEMS);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).toEqual({ id: 1, label: 'Fictional sample 1', weight: 1, score: 191172 });
    expect(first.every(item => Number.isFinite(item.score))).toBeTrue();
    expect(PROFILING_ITEMS).toEqual(before);
    expect(Object.isFrozen(PROFILING_ITEMS)).toBeTrue();
    expect(PROFILING_ITEMS.every(Object.isFrozen)).toBeTrue();
  });

  it('handles empty data and caps calculation at the fixed lesson size', () => {
    const calculator = new ProfilingCalculator();
    expect(calculator.calculate([])).toEqual([]);
    expect(calculator.calculate([...PROFILING_ITEMS, ...PROFILING_ITEMS]).length).toBe(PROFILING_ITEM_LIMIT);
    expect(new Set(PROFILING_ITEMS.map(item => item.id)).size).toBe(PROFILING_ITEM_LIMIT);
  });
});
