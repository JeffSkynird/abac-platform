import { logout } from '../lib/auth';

export default function Header() {
  return (
    <header className="border-b border-white/10 sticky top-0 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <span className="font-semibold">ABAC Admin</span>
        <nav className="flex gap-3 text-sm">
          <a href="/tenants">Tenants</a>
          <a href="/policy-sets">Policy Sets</a>
          <a href="/entities">Entities</a>
          <a href="/audit">Audit</a>
        </nav>
        <div className="ml-auto">
          <button onClick={() => logout()} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20">Logout</button>
        </div>
      </div>
    </header>
  );
}