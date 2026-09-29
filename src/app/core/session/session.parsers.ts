import { ApiError } from '../http/api-error';
import type { DemoCredentials, DemoProfile } from './session.models';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('Invalid text');
  return value.trim();
}
export function parseCredentials(value: DemoCredentials): DemoCredentials {
  if (typeof value.username !== 'string' || !value.username.trim() || value.username.length > 100 ||
      typeof value.password !== 'string' || !value.password.trim() || value.password.length > 200) {
    throw new ApiError('validation', 'Enter the public demo username and password.');
  }
  return { username: value.username.trim(), password: value.password };
}
export function parseProfile(value: unknown): DemoProfile {
  try {
    if (!record(value) || typeof value['id'] !== 'number' || !Number.isSafeInteger(value['id']) || value['id'] < 1) throw new Error('Invalid identity');
    return { id: value['id'], username: text(value['username'], 100), firstName: text(value['firstName'], 100), lastName: text(value['lastName'], 100) };
  } catch { throw new ApiError('format', 'The service returned an invalid demo profile.'); }
}
export function parseLogin(value: unknown): { readonly profile: DemoProfile; readonly accessToken: string } {
  const profile = parseProfile(value);
  if (!record(value) || typeof value['accessToken'] !== 'string' || !value['accessToken'].length ||
      value['accessToken'].length > 8192 || /[^A-Za-z0-9._~-]/.test(value['accessToken'])) {
    throw new ApiError('format', 'The service returned an invalid demo session.');
  }
  // Refresh is deferred: discard its token and all unneeded profile fields.
  return { profile, accessToken: value['accessToken'] };
}
