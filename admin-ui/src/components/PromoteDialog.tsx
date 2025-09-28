import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function PromoteDialogContent({ policySetId }: { policySetId: string }) {
  const promote = useMutation({ mutationFn: () => api.promote(policySetId) });
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => promote.mutate()} className="px-3 py-2 rounded bg-amber-600/80">Promote to Active</button>
      {promote.isSuccess && <span className="text-emerald-400">Promoted ✓</span>}
      {promote.isError && <span className="text-red-400">{(promote.error as Error).message}</span>}
    </div>
  );
}

export default function PromoteDialog(props: { policySetId: string }) {
  return (
    <QueryProvider>
      <PromoteDialogContent {...props} />
    </QueryProvider>
  );
}
