import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Copy, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import CedarEditor from './CedarEditor';
import PolicyTestForm from './PolicyTestForm';
import PromoteDialog from './PromoteDialog';
import QueryProvider from './QueryProvider';
import { PolicyDraftProvider, usePolicyDraft } from './PolicyDraftProvider';

function PolicySetDraftLayout({ policySetId }: { policySetId: string }) {
  const { policies, isFetching } = usePolicyDraft();

  const { total, dirty } = useMemo(() => {
    const totalPolicies = policies.length;
    const dirtyPolicies = policies.filter((policy) => policy.dirty).length;
    return { total: totalPolicies, dirty: dirtyPolicies };
  }, [policies]);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(policySetId);
      toast.success('ID copied', {
        description: 'The policy set identifier is on your clipboard.',
      });
    } catch (error) {
      toast.error('Could not copy ID', {
        description: (error as Error).message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge className="rounded-full">Draft in editing</Badge>
            <CardTitle className="text-2xl font-semibold text-slate-900">Policy set {policySetId}</CardTitle>
            <CardDescription>
              Manage Cedar policies, test decisions, and promote the package when ready.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-full border-slate-200 text-sm">
              <a href="/policy-sets">Return to list</a>
            </Button>
            <Button
              onClick={handleCopyId}
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-600 hover:bg-slate-100"
            >
              <Copy aria-hidden className="h-4 w-4" />
              <span className="sr-only">Copy policy set ID</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Policies</span>
            <Badge className="rounded-full">{total}</Badge>
          </div>
          <Separator orientation="vertical" className="h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Pending changes</span>
            <Badge
              variant={'secondary'}
              className={
                dirty > 0
                  ? 'rounded-full bg-amber-100 text-amber-700'
                  : 'rounded-full bg-emerald-100 text-emerald-700'
              }
            >
              {dirty > 0 ? `${dirty} unsaved` : 'Up to date'}
            </Badge>
          </div>
          <Separator orientation="vertical" className="h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <RefreshCcw
              aria-hidden
              className={`h-4 w-4 ${isFetching ? 'animate-spin text-slate-500' : 'text-slate-400'}`}
            />
            <span>{isFetching ? 'Synchronizing changes…' : 'Last synchronized upload'}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <CedarEditor />
        <div className="space-y-6">
          <PolicyTestForm />
          <PromoteDialog policySetId={policySetId} />
        </div>
      </div>
    </div>
  );
}

export default function PolicySetDraftClient({ policySetId }: { policySetId: string }) {
  return (
    <QueryProvider>
      <PolicyDraftProvider policySetId={policySetId}>
        <PolicySetDraftLayout policySetId={policySetId} />
      </PolicyDraftProvider>
    </QueryProvider>
  );
}
