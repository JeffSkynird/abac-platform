import { useEffect, useState, type PropsWithChildren } from 'react';
import { ChevronLeft, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useTenantSelection } from '../lib/tenant-selection';
import Header from './Header';

function TenantSelectionPill() {
  const { selectedTenant, clearSelectedTenant } = useTenantSelection();
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateBreakpoint = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  useEffect(() => {
    if (!selectedTenant) {
      setIsExpanded(false);
    }
  }, [selectedTenant]);

  if (!selectedTenant) return null;

  if (!isMobile) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs text-slate-600 shadow-lg shadow-slate-900/10">
        <span className="font-medium text-slate-500">Active Tenant</span>
        <code className="max-w-[200px] truncate text-slate-800">{selectedTenant}</code>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-6 rounded-full px-2 text-xs"
          onClick={clearSelectedTenant}
        >
          <X aria-hidden className=" h-3 w-3" />
          Quit
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex transition-transform duration-200 ease-out"
      style={{ transform: isExpanded ? 'translateX(0)' : 'translateX(calc(100% - 52px))' }}
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 pl-3 pr-2 py-2 text-xs text-slate-600 shadow-lg shadow-slate-900/10">
        {isExpanded ? (
          <>
            <span className="font-medium text-slate-500">Tenant</span>
            <code className="max-w-[140px] truncate text-slate-800">{selectedTenant}</code>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-6 rounded-full px-2 text-xs"
              onClick={clearSelectedTenant}
            >
              <X aria-hidden className="mr-1 h-3 w-3" />
              Quitar
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 rounded-full px-2 text-xs"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <ChevronLeft
            aria-hidden
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>
    </div>
  );
}

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <TenantSelectionPill />
    </div>
  );
}
