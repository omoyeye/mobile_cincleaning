import { ApiError } from '../services/api';

/** Loose email check: enough to catch typos before we hit the server. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Turns API errors into plain wording for the sign in and sign up screens. */
export function friendlyAuthError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message;
    if (err.status === 401) return fallback;
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (err.status >= 500) return 'Something went wrong on our side. Please try again shortly.';
    if (err.message && !/^Request failed/.test(err.message)) return err.message;
  }
  return fallback;
}

/** 0 to 3: used for the password strength bar on sign up. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 8) return 0;
  let score = 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 3) as 1 | 2 | 3;
}
