import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MinusCircle, MoreHorizontal, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';

import { api } from '../lib/api';
import { useTenantSelection } from '../lib/tenant-selection';
import QueryProvider from './QueryProvider';

type EntityRecord = {
  id: string;
  type?: 'principal' | 'resource';
  cedar_uid: string;
  attrs: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type EntityListResponse = {
  items?: EntityRecord[];
  total?: number;
};

const PAGE_SIZE = 20;

function EntityManagerContent() {
  const queryClient = useQueryClient();
  const [tenantInput, setTenantInput] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [typeFilter, setTypeFilter] = useState<'principal' | 'resource'>('principal');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEntity, setEditEntity] = useState<EntityRecord | null>(null);
  const [formUid, setFormUid] = useState('');
  const [formAttrs, setFormAttrs] = useState('{}');
  const [formType, setFormType] = useState<'principal' | 'resource'>('principal');
  const [formError, setFormError] = useState<string | null>(null);

  const normalizedTenantId = tenantId.trim();
  const { selectedTenant, setSelectedTenant } = useTenantSelection();
  const lastSelectedRef = useRef<string>('');

  useEffect(() => {
    if (selectedTenant !== lastSelectedRef.current) {
      setTenantId(selectedTenant);
      setTenantInput(selectedTenant);
      setPage(1);
      lastSelectedRef.current = selectedTenant;
    }
  }, [selectedTenant]);

  const queryKey = useMemo(() => ['entities', normalizedTenantId, typeFilter, page], [normalizedTenantId, typeFilter, page]);

  const { data, isLoading, isFetching, error } = useQuery<EntityListResponse>({
    queryKey,
    queryFn: () => api.listEntities(normalizedTenantId, typeFilter, page, PAGE_SIZE),
    enabled: normalizedTenantId.length > 0,
    keepPreviousData: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;
  const hasNextPage = items.length === PAGE_SIZE;
  const hasPreviousPage = page > 1;

  const invalidateEntities = () =>
    queryClient.invalidateQueries({ queryKey: ['entities', normalizedTenantId], exact: false });

  const upsert = useMutation({
    mutationFn: ({
      cedar_uid,
      attrs,
      type,
    }: {
      cedar_uid: string;
      attrs: unknown;
      type: 'principal' | 'resource';
    }) => api.upsertEntity({ tenantId: normalizedTenantId, type, cedar_uid, attrs }),
    onSuccess: () => {
      invalidateEntities();
      setCreateOpen(false);
      toast.success('Entity created', {
        description: 'A new entity was added to the tenant.',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error('The entity could not be created', {
        description: mutationError instanceof Error ? mutationError.message : 'Try again.',
      });
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      cedar_uid,
      attrs,
      type,
    }: {
      id: string;
      cedar_uid: string;
      attrs: unknown;
      type: 'principal' | 'resource';
    }) => api.updateEntity(normalizedTenantId, type, id, { cedar_uid, attrs }),
    onSuccess: () => {
      invalidateEntities();
      setEditOpen(false);
      toast.success('Entity updated', {
        description: 'Changes were saved successfully.',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error('The entity could not be updated', {
        description: mutationError instanceof Error ? mutationError.message : 'Please review the data and try again..',
      });
    },
  });

  const remove = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'principal' | 'resource' }) =>
      api.deleteEntity(normalizedTenantId, type, id),
    onSuccess: () => {
      invalidateEntities();
      toast.success('Entity deleted', {
        description: 'The entity was removed from the tenant.',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error('The entity could not be deleted', {
        description: mutationError instanceof Error ? mutationError.message : 'Try again.',
      });
    },
  });

  const resetForm = (kind: 'create' | 'edit', entity?: EntityRecord | null) => {
    if (kind === 'create') {
      setFormUid('');
      setFormAttrs('{}');
      setFormType(typeFilter);
      setFormError(null);
    } else if (entity) {
      setFormUid(entity.cedar_uid ?? '');
      setFormAttrs(JSON.stringify(entity.attrs ?? {}, null, 2));
      setFormType(entity.type ?? typeFilter);
      setFormError(null);
    }
  };

  const openCreateDialog = () => {
    resetForm('create');
    setCreateOpen(true);
  };

  const openEditDialog = (entity: EntityRecord) => {
    setEditEntity(entity);
    resetForm('edit', entity);
    setEditOpen(true);
  };

  const handleSubmitCreate = () => {
    try {
      setFormError(null);
      const parsedAttrs = formAttrs.trim() ? JSON.parse(formAttrs) : {};
      const cedar = formUid.trim();
      if (!cedar) {
        setFormError('Enter a valid cedar_uid.');
        return;
      }
      upsert.mutate({ cedar_uid: cedar, attrs: parsedAttrs, type: formType });
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const handleSubmitUpdate = () => {
    if (!editEntity) return;
    try {
      setFormError(null);
      const parsedAttrs = formAttrs.trim() ? JSON.parse(formAttrs) : {};
      const cedar = formUid.trim();
      if (!cedar) {
        setFormError('Enter a valid cedar_uid.');
        return;
      }
      update.mutate({ id: editEntity.id, cedar_uid: cedar, attrs: parsedAttrs, type: formType });
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const handleConfirmDelete = (entity: EntityRecord) => {
    remove.mutate({ id: entity.id, type: (entity.type ?? typeFilter) as 'principal' | 'resource' });
  };

  const handleApplyTenant = () => {
    const nextTenant = tenantInput.trim();
    setTenantId(nextTenant);
    setTenantInput(nextTenant);
    setSelectedTenant(nextTenant);
    setPage(1);
    lastSelectedRef.current = nextTenant;
  };

  const headerSection = (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Entities</p>
        <h1 className="text-3xl font-semibold text-slate-900">Cedar Entity Management</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Create, update, or delete parent entities and resources associated with a specific tenant.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          className="rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
          onClick={openCreateDialog}
          disabled={!normalizedTenantId}
        >
          <Plus aria-hidden className="mr-2 h-4 w-4" />
          New entity
        </Button>
      </div>
    </header>
  );

  if (!normalizedTenantId) {
    return (
      <div className="space-y-6">
        {headerSection}
        <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <CardContent className="space-y-6 py-12 text-center">
            <Pencil aria-hidden className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-900">Select a tenant</h2>
            <p className="text-sm text-slate-500">Enter the tenant ID to manage their entities.</p>
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

  return (
    <div className="space-y-6">
      {headerSection}

      <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-slate-900">Entities of {normalizedTenantId}</CardTitle>
            <CardDescription>
              Manages {typeFilter === 'principal' ? 'principals' : 'resources'}
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="tenant-id"
                  placeholder='TENANT ID'
                  value={tenantInput}
                  onChange={(event) => setTenantInput(event.target.value)}
                  className="h-10 rounded-full border-slate-200 bg-white text-sm"
                />
                <Button
                  variant="outline"
                  onClick={handleApplyTenant}
                  disabled={!tenantInput.trim()}
                  className="rounded-full border-slate-200"
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <Button
                  type="button"
                  variant={typeFilter === 'principal' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setTypeFilter('principal');
                    setPage(1);
                  }}
                >
                  Principals
                </Button>
                <Button
                  type="button"
                  variant={typeFilter === 'resource' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setTypeFilter('resource');
                    setPage(1);
                  }}
                >
                  Resources
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 text-sm text-red-600">
              {(error as Error).message}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded-2xl bg-slate-100" />
              <div className="h-10 rounded-2xl bg-slate-100" />
              <div className="h-10 rounded-2xl bg-slate-100" />
            </div>
          ) : (
            <>
             <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    ENTITIES: <span className="font-semibold text-slate-900">{total}</span>
                  </p>
                </div>
                {isFetching ? (
                  <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700">Refreshing…</Badge>
                ) : (
                  <Badge variant="secondary"  className="rounded-full">Up to date</Badge>
                )}
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[720px] overflow-hidden rounded-2xl border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-64 text-xs font-medium uppercase tracking-wide text-slate-500">Cedar UID</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">Attributes</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((entity) => (
                        <TableRow key={entity.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-xs text-slate-600 whitespace-pre-wrap break-words">
                            {entity.cedar_uid}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap break-words">
                            {JSON.stringify(entity.attrs ?? {}, null, 2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                  <MoreHorizontal aria-hidden className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => openEditDialog(entity)}>
                                  <Pencil aria-hidden className="mr-2 h-4 w-4" /> View / Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onSelect={() => handleConfirmDelete(entity)}
                                  disabled={remove.isPending}
                                >
                                  <Trash2 aria-hidden className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}

                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                            There are no entities to display with the current filters.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!hasPreviousPage || isFetching}
            >
              <MinusCircle aria-hidden className="mr-2 h-4 w-4" /> Previous page
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNextPage || isFetching}
            >
              Next page
              <Plus aria-hidden className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <span>Current page: {page}</span>
        </CardFooter>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New entity</DialogTitle>
            <DialogDescription>
              Defines the `cedar_uid` and attributes in JSON format to create the entity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="mr-1" htmlFor="create-type">Tipo</Label>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <Button
                  type="button"
                  variant={formType === 'principal' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setFormType('principal')}
                >
                  Principal
                </Button>
                <Button
                  type="button"
                  variant={formType === 'resource' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setFormType('resource')}
                >
                  Resource
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-cedar">Cedar UID</Label>
              <Input
                id="create-cedar"
                value={formUid}
                onChange={(event) => setFormUid(event.target.value)}
                placeholder='User::"123"'
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-attrs">Attributes (JSON)</Label>
              <Textarea
                id="create-attrs"
                value={formAttrs}
                onChange={(event) => setFormAttrs(event.target.value)}
                className="font-mono text-sm"
                rows={8}
              />
            </div>
            {formError ? <p className="text-sm text-red-500">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditEntity(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit entity</DialogTitle>
            <DialogDescription>Updates the cedar_uid or JSON attributes of the selected entity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={formType} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cedar">Cedar UID</Label>
              <Input
                id="edit-cedar"
                value={formUid}
                onChange={(event) => setFormUid(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-attrs">Attributes (JSON)</Label>
              <Textarea
                id="edit-attrs"
                value={formAttrs}
                onChange={(event) => setFormAttrs(event.target.value)}
                className="font-mono text-sm"
                rows={8}
              />
            </div>
            {formError ? <p className="text-sm text-red-500">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={update.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmitUpdate} disabled={update.isPending}>
              {update.isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EntityForm() {
  return (
    <QueryProvider>
      <EntityManagerContent />
    </QueryProvider>
  );
}
