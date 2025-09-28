import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCcw, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTenantSelection } from '../lib/tenant-selection';
import QueryProvider from './QueryProvider';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-slate-200 text-slate-600',
};

function PolicySetListContent() {
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState('');
  const [tenantInput, setTenantInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { selectedTenant, setSelectedTenant } = useTenantSelection();
  const lastSelectedRef = useRef<string>('');

  useEffect(() => {
    if (selectedTenant !== lastSelectedRef.current) {
      setTenantId(selectedTenant);
      setTenantInput(selectedTenant);
      lastSelectedRef.current = selectedTenant;
    }
  }, [selectedTenant]);

  const {
    data,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['policySets', tenantId],
    queryFn: () => (tenantId ? api.listPolicySets(tenantId) : Promise.resolve({ items: [] })),
    enabled: !!tenantId,
  });

  const create = useMutation({
    mutationFn: () => api.createPolicySet(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policySets', tenantId] });
      toast.success('Policy set created', {
        description: 'A new draft was generated for the tenant.',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error('The policy set could not be created', {
        description: mutationError instanceof Error ? mutationError.message : 'Try again.',
      });
    },
  });

  const items = useMemo(() => {
    const list = Array.isArray(data) ? data : data?.items ?? [];
    if (statusFilter === 'all') return list;
    return list.filter((item: any) => item.status === statusFilter);
  }, [data, statusFilter]);

  const headerSection = (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Policy sets</p>
        <h1 className="text-3xl font-semibold text-slate-900">Policy Sets Management</h1>
        <p className="max-w-xl text-sm text-slate-500">
          View and create new policy sets per tenant. Filter by status and quickly access each version..
        </p>
      </div>
    </header>
  );

  const handleApplyTenant = () => {
    const nextTenant = tenantInput.trim();
    setTenantId(nextTenant);
    setTenantInput(nextTenant);
    setSelectedTenant(nextTenant);
    lastSelectedRef.current = nextTenant;
  };

  if (!tenantId) {
    return (
      <div className="space-y-6">
        {headerSection}
        <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <CardContent className="space-y-6 py-12 text-center">
            <Shield aria-hidden className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-900">Select a tenant</h2>
            <p className="text-sm text-slate-500">
              Enter the tenant ID to list its associated policy sets.
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
          <CardContent className="space-y-6 py-10 animate-pulse">
            <div className="h-4 w-40 rounded-full bg-slate-100" />
            <div className="space-y-2">
              <div className="h-10 rounded-2xl bg-slate-100" />
              <div className="h-10 rounded-2xl bg-slate-100" />
            </div>
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
            <h2 className="text-lg font-semibold text-slate-900">The list could not be loaded</h2>
            <p className="text-sm text-slate-500">
              {(error as Error).message || 'Inténtalo nuevamente en unos segundos.'}
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

  const badgeClass = (status: string) => STATUS_BADGE[status] ?? '';

  return (
    <div className="space-y-6">
      {headerSection}

      <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900">Policy sets per tenant</CardTitle>
            <CardDescription>
              Entered <strong className="text-slate-800">{tenantId}</strong>.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                value={tenantInput}
                onChange={(event) => setTenantInput(event.target.value)}
                placeholder="Tenant ID"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full border-slate-200 text-sm">
                  {statusFilter === 'all' ? 'All statuses' : `Status: ${statusFilter}`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Filter by state</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setStatusFilter('all')}>
                  All statuses
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter('draft')}>
                  In draft
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter('active')}>
                  Published
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatusFilter('archived')}>
                  Archived
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
           
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Create new policy set</p>
              <p className="text-xs text-slate-500">
                The new policies have draft status.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={() => create.mutate()}
                disabled={!tenantId || create.isPending}
                className="rounded-full"
              >
                {create.isPending ? 'Creating…' : 'New draft'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Policy sets: <span className="font-semibold text-slate-900">{items.length}</span>
            </p>
            {isFetching ? (
              <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700">Searching…</Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full">Up to date</Badge>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-40 text-xs font-medium uppercase tracking-wide text-slate-500">
                    ID
                  </TableHead>
                  <TableHead className="w-32 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="w-24 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Version
                  </TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((policySet: any) => (
                  <TableRow key={policySet.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-500">{policySet.id}</TableCell>
                    <TableCell>
                      <Badge className={`rounded-full px-3 py-1 text-xs ${badgeClass(policySet.status)}`}>
                        {policySet.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">v{policySet.version}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" className="rounded-full text-sm">
                        <a href={`/policy-sets/${policySet.id}`}>Abrir</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      We did not find policy sets with the filters applied.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PolicySetList() {
  return (
    <QueryProvider>
      <PolicySetListContent />
    </QueryProvider>
  );
}
