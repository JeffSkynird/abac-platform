import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { getMissingAuthConfig, initAuth, isAuthenticated, isAuthConfigured, login } from '../lib/auth';

export default function AuthGuard({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthConfigured()) {
      const missing = getMissingAuthConfig().join(', ');
      setError(
        `Keycloak is not configured. Define the necessary public environment variables. (${missing || 'see documentation'}).`
      );
      setReady(true);
      return () => {
        cancelled = true;
      };
    }
    initAuth()
      .then(() => {
        if (!isAuthenticated()) {
          login();
          return;
        }
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error('Error initializing Keycloak', err);
        if (cancelled) return;
        setError('Automatic login failed. Please check Keycloak and try again.');
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center text-sm opacity-80">
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm opacity-80">Verifying session…</span>
      </div>
    );
  }

  return <>{children}</>;
}
