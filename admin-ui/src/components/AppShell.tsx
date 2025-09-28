import type { PropsWithChildren } from 'react';
import Header from './Header';

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
