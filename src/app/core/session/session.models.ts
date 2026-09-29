export type DemoRole = 'learner' | 'demo-admin';
export interface DemoCredentials { readonly username: string; readonly password: string; }
export interface DemoProfile {
  readonly id: number;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
}
export interface DemoUser extends DemoProfile { readonly role: DemoRole; }
export const SESSION_MINUTES = 30;
