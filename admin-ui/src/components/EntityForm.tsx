import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function EntityFormContent() {
  const [tenantId, setTenantId] = useState('');
  const [type, setType] = useState<'principal' | 'resource'>('principal');
  const [cedarUid, setCedarUid] = useState('User::"123"');
  const [attrs, setAttrs] = useState('{"department":"sales","country":"EC"}');
  const upsert = useMutation({
    mutationFn: () => api.upsertEntity({ tenantId, type, cedar_uid: cedarUid, attrs: JSON.parse(attrs) }),
  });

  return (
    <div className="space-y-2">
      <input
        className="bg-white/5 rounded p-2"
        placeholder="Tenant ID"
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
      />
      <select className="bg-white/5 rounded p-2" value={type} onChange={(e) => setType(e.target.value as any)}>
        <option value="principal">principal</option>
        <option value="resource">resource</option>
      </select>
      <input className="bg-white/5 rounded p-2" value={cedarUid} onChange={(e) => setCedarUid(e.target.value)} />
      <textarea
        className="bg-white/5 rounded p-2 font-mono text-xs"
        rows={4}
        value={attrs}
        onChange={(e) => setAttrs(e.target.value)}
      />
      <button className="px-3 py-2 rounded bg-white/10" onClick={() => upsert.mutate()}>
        Upsert
      </button>
      {upsert.isSuccess && <div className="text-emerald-400">OK</div>}
      {upsert.isError && <div className="text-red-400">{(upsert.error as Error).message}</div>}
    </div>
  );
}

export default function EntityForm() {
  return (
    <QueryProvider>
      <EntityFormContent />
    </QueryProvider>
  );
}
