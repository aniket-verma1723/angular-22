import { calendarDateText, wallClockText } from './material-dates-values';

describe('Material date/time diagnostics', () => {
  it('distinguishes null from invalid dates without throwing', () => {
    expect(calendarDateText(null)).toBe('null');
    expect(wallClockText(null)).toBe('null');
    expect(calendarDateText(new Date(NaN))).toBe('invalid');
    expect(wallClockText(new Date(NaN))).toBe('invalid');
  });

  it('reports local calendar components at both ends of a day, not UTC components', () => {
    expect(calendarDateText(new Date(2026, 8, 15, 0, 5))).toBe('2026-09-15');
    expect(calendarDateText(new Date(2026, 8, 15, 23, 55))).toBe('2026-09-15');
    expect(calendarDateText(new Date(2026, 0, 2))).toBe('2026-01-02');
  });

  it('reports only hours/minutes independently of the carrier date or seconds', () => {
    expect(wallClockText(new Date(2026, 8, 15, 9, 5, 30))).toBe('09:05');
    expect(wallClockText(new Date(2027, 0, 1, 9, 5))).toBe('09:05');
    expect(wallClockText(new Date(2026, 8, 15, 0, 0))).toBe('00:00');
    expect(wallClockText(new Date(2026, 8, 15, 23, 59))).toBe('23:59');
  });
});
