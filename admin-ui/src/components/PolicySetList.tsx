import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function PolicySetListContent() {
  const [tenantId, setTenantId] = useState('');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['policySets', tenantId],
    queryFn: () => (tenantId ? api.listPolicySets(tenantId) : Promise.resolve({ items: [] })),
    enabled: !!tenantId,
  });
  const create = useMutation({
    mutationFn: () => api.createPolicySet(tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policySets', tenantId] }),
  });

  const items = Array.isArray(data) ? data : data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="bg-white/5 rounded px-3 py-2 w-[36rem]"
          placeholder="Tenant ID"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <button
          className="px-3 py-2 rounded bg-emerald-600/80"
          onClick={() => create.mutate()}
          disabled={!tenantId || create.isPending}
        >
          New Draft
        </button>
      </div>
      {isLoading && <p className="text-sm opacity-70">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}
      {!tenantId && <p className="text-sm opacity-70">Ingresa un tenant para ver sus policy sets.</p>}
      {tenantId && !isLoading && items.length === 0 && !error && (
        <p className="text-sm opacity-70">No hay policy sets para este tenant.</p>
      )}
      <ul className="space-y-1">
        {items.map((ps: any) => (
          <li key={ps.id} className="border border-white/10 rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-mono text-xs">{ps.id}</div>
              <div className="opacity-80">status: {ps.status} — version: {ps.version}</div>
            </div>
            <a className="px-3 py-2 rounded bg-white/10" href={`/policy-sets/${ps.id}`}>
              Open
            </a>
          </li>
        ))}
      </ul>
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
