import { FICTIONAL_MEASUREMENTS, summarizeMeasurements } from './performance-measurements';

describe('Performance measurements', () => {
  it('provides a complete frozen 200-value fictional fixture', () => {
    expect(FICTIONAL_MEASUREMENTS.length).toBe(200);
    expect(Object.isFrozen(FICTIONAL_MEASUREMENTS)).toBeTrue();
    expect(FICTIONAL_MEASUREMENTS.every((value, index) => value === index + 1)).toBeTrue();
  });

  it('summarizes all measurements, not merely the ten rendered samples', () => {
    expect(summarizeMeasurements(FICTIONAL_MEASUREMENTS)).toEqual({
      count: 200, totalMs: 20100, averageMs: 100.5
    });
  });

  it('preserves frozen inputs and returns independent immutable summaries', () => {
    const values = Object.freeze([0, 10, 20]);
    const first = summarizeMeasurements(values);
    const second = summarizeMeasurements(values);
    expect(first).toEqual({ count: 3, totalMs: 30, averageMs: 10 });
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBeTrue();
    expect(values).toEqual([0, 10, 20]);
  });

  it('distinguishes an empty fixture from a zero-valued measurement', () => {
    expect(summarizeMeasurements([])).toEqual({ count: 0, totalMs: 0, averageMs: null });
    expect(summarizeMeasurements([0])).toEqual({ count: 1, totalMs: 0, averageMs: 0 });
  });
});
