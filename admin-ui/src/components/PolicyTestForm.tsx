import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2, Play } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { api } from '../lib/api';
import { usePolicyDraft } from './PolicyDraftProvider';

export default function PolicyTestForm() {
  const { policySetId, policies } = usePolicyDraft();
  const [principal, setPrincipal] = useState('{"type":"User","id":"123"}');
  const [resource, setResource] = useState('{"type":"Document","id":"abc"}');
  const [action, setAction] = useState('read');
  const [context, setContext] = useState('{}');
  const [formError, setFormError] = useState<string | null>(null);

  const policyPayload = policies.map((policy) => policy.cedar).filter((cedar) => cedar.trim().length > 0);

  const test = useMutation({
    mutationFn: (payload: {
      policies: string[];
      principal: unknown;
      resource: unknown;
      action: string | { type: string; id: string };
      context?: unknown;
    }) => api.preTestDraft(policySetId, payload),
    onMutate: () => setFormError(null),
    onSuccess: () => {
      toast.success('Test executed', {
        description: 'Review the result to validate the decision.',
      });
    },
    onError: (error: unknown) => {
      toast.error('The test could not be executed', {
        description: error instanceof Error ? error.message : 'Please check the data and try again..',
      });
    },
  });

  const handleTest = () => {
    if (policyPayload.length === 0) {
      setFormError('You need at least one policy to run a test.');
      return;
    }

    try {
      const principalObj = JSON.parse(principal);
      const resourceObj = JSON.parse(resource);
      const contextObj = context.trim() ? JSON.parse(context) : undefined;

      test.mutate({
        policies: policyPayload,
        principal: principalObj,
        resource: resourceObj,
        action,
        context: contextObj,
      });
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const disableTest = test.isPending || policyPayload.length === 0;
  const hasResult = test.isSuccess && !!test.data;

  return (
    <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">What-if test</CardTitle>
        <CardDescription>
          Runs a simulated decision against this policy set using custom principal, resource, and context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="principal">Principal</Label>
            <Textarea
              id="principal"
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
              className="font-mono text-sm"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource">Resource</Label>
            <Textarea
              id="resource"
              value={resource}
              onChange={(event) => setResource(event.target.value)}
              className="font-mono text-sm"
              rows={4}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Input
                id="action"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="context">Optional context</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                className="font-mono text-sm"
                rows={4}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleTest}
              disabled={disableTest}
              className="rounded-full bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800"
            >
              {test.isPending ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play aria-hidden className="mr-2 h-4 w-4" />
              )}
              Run test
            </Button>
            <Badge variant='secondary' className="rounded-full bg-slate-100 text-slate-600">
              {policyPayload.length} active policies in the test
            </Badge>
          </div>
          {policyPayload.length === 0 ? (
            <p className="text-xs text-slate-500">Add and save a policy to enable testing.</p>
          ) : null}
          {formError ? <p className="text-xs text-red-500">{formError}</p> : null}
          {test.isError ? (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle aria-hidden className="h-4 w-4" />
              {(test.error as Error).message}
            </p>
          ) : null}
          {test.isPending ? <p className="text-xs text-slate-500">Running test…</p> : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-500 gap-1">
          <span>Result of the last execution</span>
          {hasResult ? (
            <Badge className="rounded-full bg-emerald-100 text-emerald-700">Available data</Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600">Not executed</Badge>
          )}
        </div>
        <pre className="max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-700 whitespace-pre-wrap break-words">
          {hasResult ? JSON.stringify(test.data, null, 2) : 'No results yet. Run a test to see the response.'}
        </pre>
      </CardFooter>
    </Card>
  );
}
