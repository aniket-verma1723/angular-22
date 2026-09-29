/** Complete fictional data, not browser timings or a server page. */
export const FICTIONAL_MEASUREMENTS: readonly number[] = Object.freeze(
  Array.from({ length: 200 }, (_, index) => index + 1)
);

export interface MeasurementSummary {
  readonly count: number;
  readonly totalMs: number;
  readonly averageMs: number | null;
}

export function summarizeMeasurements(values: readonly number[]): MeasurementSummary {
  const totalMs = values.reduce((total, value) => total + value, 0);
  return Object.freeze({
    count: values.length,
    totalMs,
    averageMs: values.length === 0 ? null : totalMs / values.length
  });
}
