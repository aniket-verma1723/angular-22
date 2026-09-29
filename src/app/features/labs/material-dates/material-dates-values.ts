/** Calendar and wall-clock diagnostics, deliberately not UTC/instant serialization. */
export function calendarDateText(value: Date | null): string {
  if (value === null) return 'null';
  if (!Number.isFinite(value.getTime())) return 'invalid';
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function wallClockText(value: Date | null): string {
  if (value === null) return 'null';
  if (!Number.isFinite(value.getTime())) return 'invalid';
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
