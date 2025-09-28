import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  ArrowDownToLine,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

import { api } from '../lib/api';
import type { DraftPolicy } from './PolicyDraftProvider';
import { usePolicyDraft } from './PolicyDraftProvider';

function PolicyEditorCard({ policy, index }: { policy: DraftPolicy; index: number }) {
  const {
    policySetId,
    updatePolicyCedar,
    resetPolicy,
    removePolicyLocal,
    markPolicySaved,
    refetchPolicies,
  } = usePolicyDraft();

  const savePolicy = useMutation({
    mutationFn: async (payload: { cedar: string; id?: string; isNew: boolean }) => {
      const hasContent = payload.cedar.trim().length > 0;
      if (!hasContent) {
        throw new Error('The policy cannot be empty.');
      }
      if (payload.isNew || !payload.id) {
        const created = await api.addPolicy(policySetId, payload.cedar);
        return { ...created };
      }
      const updated = await api.updatePolicy(policySetId, payload.id, payload.cedar);
      return { ...updated };
    },
    onSuccess: async (saved: any, variables) => {
      const fallbackId = variables?.id ?? policy.id;
      const responseId = saved?.id ?? fallbackId;
      const responseCedar = saved?.cedar ?? variables?.cedar ?? policy.cedar;
      if (responseId) {
        markPolicySaved(policy.key, { id: responseId, cedar: responseCedar });
      } else if (variables?.isNew) {
        removePolicyLocal(policy.key);
      }
      toast.success('Policy saved', {
        description: 'Changes were synchronized successfully.',
      });
      await refetchPolicies();
    },
    onError: (error: unknown) => {
      toast.error('The policy could not be saved.', {
        description: error instanceof Error ? error.message : 'Try again.',
      });
    },
  });

  const deletePolicy = useMutation({
    mutationFn: async (payload: { id?: string }) => {
      if (!payload.id) return;
      await api.deletePolicy(policySetId, payload.id);
    },
    onSuccess: async (_data, variables) => {
      if (!variables?.id) return;
      removePolicyLocal(policy.key);
      toast.success('Policy removed', {
        description: 'The selected version was discarded.',
      });
      await refetchPolicies();
    },
    onError: (error: unknown) => {
      toast.error('The policy could not be deleted', {
        description: error instanceof Error ? error.message : 'Please try again in a few seconds..',
      });
    },
  });

  const handleSave = () => {
    savePolicy.mutate({ cedar: policy.cedar, id: policy.id, isNew: policy.isNew });
  };

  const handleDelete = () => {
    if (policy.isNew || !policy.id) {
      removePolicyLocal(policy.key);
      toast('Policy discarded', {
        description: 'The new draft was deleted locally.',
      });
      return;
    }
    deletePolicy.mutate({ id: policy.id });
  };

  const disableSave = !policy.dirty || savePolicy.isPending;
  const disableActions = savePolicy.isPending || deletePolicy.isPending;

  const statusBadge = useMemo(() => {
    if (savePolicy.isPending) {
      return {
        label: 'Saving…',
        className: 'bg-blue-100 text-blue-700',
      };
    }
    if (deletePolicy.isPending) {
      return {
        label: 'Deleting…',
        className: 'bg-amber-100 text-amber-700',
      };
    }
    if (policy.dirty) {
      return {
        label: 'Unsaved changes',
        className: 'bg-amber-100 text-amber-700',
      };
    }
    return {
      label: 'Synchronized',
      className: 'bg-emerald-100 text-emerald-700',
    };
  }, [deletePolicy.isPending, policy.dirty, savePolicy.isPending]);

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold text-slate-900">Policy {index + 1}</CardTitle>
          <CardDescription>
            {policy.id ? (
              <span className="font-mono text-xs text-slate-500">ID: {policy.id}</span>
            ) : (
              'Nuevo borrador sin publicar'
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={`rounded-full px-3 py-1 text-xs ${statusBadge.className}`}>{statusBadge.label}</Badge>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={disableSave}
            className="rounded-full"
          >
            {savePolicy.isPending ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save aria-hidden className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resetPolicy(policy.key)}
            disabled={disableActions}
            className="rounded-full"
          >
            <RotateCcw aria-hidden className="mr-2 h-4 w-4" />
            Restore
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={disableActions}
            className="rounded-full"
          >
            <Trash2 aria-hidden className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <Editor
            height="42vh"
            language="rust"
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
            value={policy.cedar}
            onChange={(value) => updatePolicyCedar(policy.key, value ?? '')}
          />
        </div>
        {savePolicy.isError ? (
          <p className="text-sm text-red-500">{(savePolicy.error as Error).message}</p>
        ) : null}
        {deletePolicy.isError ? (
          <p className="text-sm text-red-500">{(deletePolicy.error as Error).message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function CedarEditor() {
  const { policies, isLoading, isFetching, error, addPolicy } = usePolicyDraft();
  const validate = useMutation({
    mutationFn: (payload: string[]) => api.preValidatePolicies(payload),
    onSuccess: (result: any) => {
      const ok = typeof result === 'object' && result?.ok === true;
      toast.success(ok ? 'Error-free validation' : 'Validation completed with observations', {
        description: ok
          ? 'The policies are ready to promote.'
          : 'Review the details to resolve the findings.',
      });
    },
    onError: (mutationError: unknown) => {
      toast.error('The set could not be validated', {
        description: mutationError instanceof Error ? mutationError.message : 'Try again.',
      });
    },
  });

  const policyPayload = useMemo(
    () => policies.map((policy) => policy.cedar).filter((cedar) => cedar.trim().length > 0),
    [policies]
  );

  const canValidate = policyPayload.length > 0 && !validate.isPending;

  return (
    <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold text-slate-900">Policy Editor Cedar</CardTitle>
          <CardDescription>
            Manage the policies included in this policy set. Save your changes and validate before promoting.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => validate.mutate(policyPayload)}
            disabled={!canValidate}
            className="rounded-full border-slate-200"
          >
            {validate.isPending ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine aria-hidden className="mr-2 h-4 w-4" />
            )}
            Validate policies
          </Button>
          <Button
            size="sm"
            onClick={addPolicy}
            className="rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
          >
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {error ? <p className="text-sm text-red-500">{(error as Error).message}</p> : null}
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map((policy, index) => (
              <PolicyEditorCard key={policy.key} policy={policy} index={index} />
            ))}
            {policies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
                There are no policies yet. Add a new one to get started..
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge className="rounded-full">
            {policies.length} policies in the dataset
          </Badge>
          <Separator orientation="vertical" className="hidden h-4 bg-slate-200 sm:block" />
          {isFetching && !isLoading ? <span>Synchronizing recent changes…</span> : <span>Updated data.</span>}
        </div>
        {validate.isSuccess && validate.data ? (
          <Button
            variant="link"
            className="h-auto p-0 text-xs text-slate-600"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(validate.data, null, 2));
              toast.success('Copied result', {
                description: 'The validation JSON was copied to the clipboard.',
              });
            }}
          >
            Copy validation report
          </Button>
        ) : null}
      </CardFooter>
      {validate.isSuccess && validate.data ? (
        <div className="border-t border-slate-100 bg-slate-50/60">
          <pre className="max-h-64 overflow-auto px-6 py-4 text-xs text-slate-600 whitespace-pre-wrap break-words">
            {JSON.stringify(validate.data, null, 2)}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}
