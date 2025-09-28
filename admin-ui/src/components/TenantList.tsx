import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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

const TENANTS_PER_PAGE = 50;

function TenantListContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const { setSelectedTenant, selectedTenant } = useTenantSelection();

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(1, TENANTS_PER_PAGE),
  });

  const create = useMutation({
    mutationFn: () => api.createTenant(name),
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant created', {
        description: 'The tenant was added successfully.',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error('The tenant could not be created.', {
        description: mutationError instanceof Error ? mutationError.message : 'Try again.',
      });
    },
  });

  const filteredTenants = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;

    return data.items.filter((tenant: any) =>
      tenant.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      tenant.id.toLowerCase().includes(search.trim().toLowerCase()),
    );
  }, [data?.items, search]);

  const totalTenants = data?.total ?? filteredTenants.length;

  const headerSection = (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Tenants</p>
        <h1 className="text-3xl font-semibold text-slate-900">Tenant management</h1>
        <p className="text-sm text-slate-500">
          Manage registrations, filters, and exports of tenants that consume the platform.
        </p>
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {headerSection}
        <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <CardContent className="space-y-6 py-10 animate-pulse">
            <div className="space-y-4">
              <div className="h-4 w-40 rounded-full bg-slate-100" />
              <div className="h-3 w-64 rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-10 rounded-2xl bg-slate-100" />
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
            <h2 className="text-lg font-semibold text-slate-900">The list could not be loaded.</h2>
            <p className="text-sm text-slate-500">
              {(error as Error).message || 'Please try again in a few seconds..'}
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
            <CardTitle className="text-xl font-semibold text-slate-900">List of tenants</CardTitle>
            <CardDescription>Filter, create, and query enabled tenants in the ecosystem.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
            <div className="relative flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or ID"
                className="h-10 rounded-full border-slate-200 bg-slate-50 text-sm"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full border-slate-200">
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => toast('Export CSV', { description: 'In progress…' })}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast('Synchronize', { description: 'Synchronizing tenants…' })}>
                  Synchronize tenants
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Create new tenant</p>
              <p className="text-xs text-slate-500">
                Add a tenant to enable policies, entities, and decisions.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tenant name"
                className="h-10 rounded-full border-slate-200 bg-white text-sm"
              />
              <Button
                onClick={() => create.mutate()}
                disabled={!name || create.isPending}
                className="rounded-full"
              >
                {create.isPending ? 'Creating…' : 'Create tenant'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Total tenants: <span className="font-semibold text-slate-900">{totalTenants}</span>
            </p>
            {isFetching ? (
              <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700">Searching…</Badge>
            ) : (
              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600">Up to date</Badge>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-32 text-xs font-medium uppercase tracking-wide text-slate-500">
                ID
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Name
              </TableHead>
              <TableHead className="w-36 text-xs font-medium uppercase tracking-wide text-slate-500 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.map((tenant: any) => (
              <TableRow key={tenant.id} className="hover:bg-slate-50">
                <TableCell className="font-mono text-xs text-slate-500">{tenant.id}</TableCell>
                <TableCell className="text-sm font-medium text-slate-800">{tenant.name}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    {selectedTenant === tenant.id ? (
                      <Badge variant="secondary" className="rounded-full bg-emerald-100 text-emerald-700">Selected</Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setSelectedTenant(tenant.id);
                        toast.success('Tenant selected', {
                          description: 'You can now use it in Policy Sets, Entities and Audit.',
                        });
                      }}
                      disabled={selectedTenant === tenant.id}
                    >
                      Use
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-slate-500">
                  {search ? "Didn't find any tenants with that filter.." : 'There are no tenants loaded yet.'}
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

export default function TenantList() {
  return (
    <QueryProvider>
      <TenantListContent />
    </QueryProvider>
  );
}
