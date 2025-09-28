import { initAuth, isAuthenticated, login } from '../lib/auth';

export async function requireAuth() {
  await initAuth();
  if (!isAuthenticated()) await login();
}