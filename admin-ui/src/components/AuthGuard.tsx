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
        `Keycloak no está configurado. Define las variables de entorno públicas necesarias (${missing || 'ver documentación'}).`
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
        console.error('Error inicializando Keycloak', err);
        if (cancelled) return;
        setError('No se pudo iniciar sesión automáticamente. Verifica Keycloak y vuelve a intentar.');
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
        <span className="text-sm opacity-80">Verificando sesión…</span>
      </div>
    );
  }

  return <>{children}</>;
}
