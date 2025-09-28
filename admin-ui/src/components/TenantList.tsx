import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function TenantListContent() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['tenants'], queryFn: () => api.listTenants(1, 50) });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api.createTenant(name),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  if (isLoading) return <p>Cargando…</p>;
  if (error) return <p>Error: {(error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="bg-white/5 rounded px-3 py-2 w-64"
          placeholder="Tenant name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="px-3 py-2 rounded bg-emerald-600/80"
          onClick={() => create.mutate()}
          disabled={!name || create.isPending}
        >
          Create
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left opacity-70">
          <tr>
            <th>ID</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {data.items?.map((t: any) => (
            <tr key={t.id} className="border-t border-white/10">
              <td className="py-2 font-mono text-xs">{t.id}</td>
              <td>{t.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
