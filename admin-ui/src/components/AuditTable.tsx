import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function AuditTableContent({ tenantId }: { tenantId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', tenantId],
    queryFn: () => api.listAudit(tenantId),
  });

  if (isLoading) return <p>Cargando…</p>;
  if (error) return <p>Error: {(error as Error).message}</p>;

  return (
    <table className="w-full text-xs">
      <thead className="text-left opacity-70">
        <tr>
          <th>time</th>
          <th>decision</th>
          <th>action</th>
          <th>principal</th>
          <th>resource</th>
        </tr>
      </thead>
      <tbody>
        {(data.items ?? []).map((r: any, i: number) => (
          <tr key={i} className="border-t border-white/10">
            <td className="py-1">{r.time}</td>
            <td>{r.decision}</td>
            <td>{r.action}</td>
            <td className="font-mono text-[11px]">{JSON.stringify(r.principal)}</td>
            <td className="font-mono text-[11px]">{JSON.stringify(r.resource)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AuditTable(props: { tenantId: string }) {
  return (
    <QueryProvider>
      <AuditTableContent {...props} />
    </QueryProvider>
  );
}
