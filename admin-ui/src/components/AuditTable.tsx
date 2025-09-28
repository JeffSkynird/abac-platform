import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, DownloadCloud, Filter, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { api } from '../lib/api';
import { useTenantSelection } from '../lib/tenant-selection';
import QueryProvider from './QueryProvider';

function formatDecision(decision: string) {
  switch (decision?.toLowerCase()) {
    case 'allow':
      return {
        label: 'Allow',
        className: 'bg-emerald-100 text-emerald-700',
      } as const;
    case 'deny':
      return {
        label: 'Deny',
        className: 'bg-red-100 text-red-700',
      } as const;
    default:
      return {
        label: decision ?? 'Unknown',
        className: 'bg-slate-100 text-slate-600',
      } as const;
  }
}

function getDateRange(period: string) {
  if (period === 'all') return undefined;
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now);
  if (period === '24h') {
    from.setHours(now.getHours() - 24);
  } else if (period === '7d') {
    from.setDate(now.getDate() - 7);
  }
  return { from: from.toISOString(), to };
}

function AuditTableContent({ tenantId }: { tenantId: string }) {
  const [tenantFilter, setTenantFilter] = useState(tenantId);
  const [tenantInput, setTenantInput] = useState(tenantId);
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'allow' | 'deny'>('all');
  const [periodFilter, setPeriodFilter] = useState<'24h' | '7d' | 'all'>('24h');
  const { selectedTenant, setSelectedTenant } = useTenantSelection();
  const lastSelectedRef = useRef<string>(tenantId);

  useEffect(() => {
    if (selectedTenant !== lastSelectedRef.current) {
      setTenantFilter(selectedTenant);
      setTenantInput(selectedTenant);
      lastSelectedRef.current = selectedTenant;
    }
  }, [selectedTenant]);

  const normalizedTenantId = tenantFilter.trim();

  const queryKey = useMemo(() => {
    const base = ['audit', normalizedTenantId];
    if (periodFilter !== 'all') {
      base.push(periodFilter);
    }
    return base;
  }, [normalizedTenantId, periodFilter]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => {
      const range = getDateRange(periodFilter);
      return api.listAudit(normalizedTenantId, { page: 1, limit: 50, ...(range ?? {}) });
    },
    enabled: normalizedTenantId.length > 0,
  });

  const auditItems = useMemo(() => {
    const entries = data?.items ?? [];
    if (decisionFilter === 'all') return entries;
    return entries.filter((item: any) => item.decision?.toLowerCase() === decisionFilter);
  }, [data?.items, decisionFilter]);

  const handleExport = () => {
    if (!auditItems.length) {
      toast('No data to export', {
        description: 'Apply a different filter or expand the date range.',
      });
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(auditItems, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const element = document.createElement('a');
      element.href = url;
      element.download = `audit-${normalizedTenantId || 'global'}.json`;
      element.click();
      URL.revokeObjectURL(url);
      toast.success('Export started', {
        description: 'Download a JSON file with the filtered events.',
      });
    } catch (ex) {
      toast.error('Could not export', {
        description: ex instanceof Error ? ex.message : 'Try again.',
      });
    }
  };

  const headerSection = (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Audit log</p>
        <h1 className="text-3xl font-semibold text-slate-900">Decision audit</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Analyze recent decisions issued by the PDP. Filter by tenant, status, and period to detect unusual behavior.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="rounded-full border-slate-200"
          onClick={() => refetch()}
          disabled={isFetching||!auditItems.length}
        >
          {isFetching ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw aria-hidden className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
        <Button
          className="rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
          onClick={handleExport}
        >
          <DownloadCloud aria-hidden className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
      </div>
    </header>
  );

  const handleApplyTenant = () => {
    const nextTenant = tenantInput.trim();
    setTenantFilter(nextTenant);
    setTenantInput(nextTenant);
    setSelectedTenant(nextTenant);
    lastSelectedRef.current = nextTenant;
  };

  if (!normalizedTenantId) {
    return (
      <div className="space-y-6">
        {headerSection}
        <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <CardContent className="space-y-6 py-12 text-center">
            <CalendarDays aria-hidden className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-900">Select a tenant</h2>
            <p className="text-sm text-slate-500">
              Enter a valid tenant ID to review the associated decision activity.
            </p>
            <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={tenantInput}
                onChange={(event) => setTenantInput(event.target.value)}
                placeholder="Tenant ID"
                className="h-10 rounded-full border-slate-200 bg-white text-sm"
              />
              <Button
                onClick={handleApplyTenant}
                disabled={!tenantInput.trim()}
                className="rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {headerSection}
        <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <CardContent className="space-y-4 py-10 animate-pulse">
            <div className="h-3 w-56 rounded-full bg-slate-100" />
            <div className="h-48 rounded-2xl bg-slate-100" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {headerSection}
        <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <CardContent className="space-y-4 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-900">The log could not be loaded.</h2>
            <p className="text-sm text-slate-500">
              {(error as Error).message || 'Intenta nuevamente en unos segundos.'}
            </p>
            <div className="flex justify-center">
              <Button
                onClick={() => refetch()}
                className="rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {headerSection}

      <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900">Events of {normalizedTenantId}</CardTitle>
            <CardDescription>
              {auditItems.length} results.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant ID</Label>
              <div className="flex gap-2">
                <Input
                  id="tenant"
                  value={tenantInput}
                  onChange={(event) => setTenantInput(event.target.value)}
                  className="h-10 rounded-full border-slate-200 bg-white text-sm"
                />
                <Button
                  variant="outline"
                  className="rounded-full border-slate-200"
                  onClick={handleApplyTenant}
                  disabled={!tenantInput.trim()}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full rounded-full border-slate-200 text-sm">
                    <Filter aria-hidden className="mr-2 h-4 w-4" />
                    {decisionFilter === 'all' ? 'All' : decisionFilter === 'allow' ? 'Allowed' : 'Denied'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Filter by state</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDecisionFilter('all')}>All</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDecisionFilter('allow')}>Allowed</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDecisionFilter('deny')}>Denied</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <Label>Range</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full rounded-full border-slate-200 text-sm">
                    <CalendarDays aria-hidden className="mr-2 h-4 w-4" />
                    {periodFilter === '24h' ? 'Last 24 hours' : periodFilter === '7d' ? 'Last 7 days' : 'All the historical'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Filter by period</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setPeriodFilter('24h')}>
                    Last 24 hours
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPeriodFilter('7d')}>
                    Last 7 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPeriodFilter('all')}>
                    All the historical
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
           <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Audit Logs: <span className="font-semibold text-slate-900">{auditItems.length}</span>
            </p>
            {isFetching ? (
              <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700">Searching…</Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full">Al día</Badge>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[720px] overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-48 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Timestamp
                    </TableHead>
                    <TableHead className="w-24 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Decision
                    </TableHead>
                    <TableHead className="w-24 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Action
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Principal
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Resource
                    </TableHead>
                    <TableHead className="w-32 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Policy set version
                    </TableHead>
                    <TableHead className="w-28 text-xs font-medium uppercase tracking-wide text-slate-500 text-right">
                      Latency (ms)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditItems.map((record: any, index: number) => {
                    const decisionBadge = formatDecision(record.decision);
                    return (
                      <TableRow key={`${record.ts}-${index}`} className="hover:bg-slate-50">
                        <TableCell className="text-xs text-slate-500">
                          {record.ts ? new Date(record.ts).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`rounded-full px-3 py-1 text-xs ${decisionBadge.className}`}>
                            {decisionBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{record.action}</TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap break-words">
                          {JSON.stringify(record.principal, null, 2)}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap break-words">
                          {JSON.stringify(record.resource, null, 2)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{record.policy_set_version}</TableCell>
                        <TableCell className="text-right text-sm text-slate-600">{record.latency_ms}</TableCell>
                      </TableRow>
                    );
                  })}

                  {auditItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        No events were found with the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuditTable({ tenantId }: { tenantId: string }) {
  return (
    <QueryProvider>
      <AuditTableContent tenantId={tenantId} />
    </QueryProvider>
  );
}
