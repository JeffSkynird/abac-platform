import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { api } from '../lib/api';

export default function PromoteDialog({ policySetId }: { policySetId: string }) {
  const promote = useMutation({
    mutationFn: () => api.promote(policySetId),
    onSuccess: () => {
      toast.success('Policy set promoted', {
        description: 'The current version was marked as active on the PDP.',
      });
    },
    onError: (error: unknown) => {
      toast.error('The policy set could not be promoted', {
        description: error instanceof Error ? error.message : 'Please try again in a few seconds.',
      });
    },
  });

  return (
    <Card className="border-none bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">Promote to active</CardTitle>
        <CardDescription>
          Publish the current set so the PDP uses the validated rules. Ensure the tests were successful.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={promote.isPending}
              className="rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600"
            >
              {promote.isPending ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpRight aria-hidden className="mr-2 h-4 w-4" />
              )}
              Promote production
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Promote this policy set?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will mark the current version as active. Make sure you've validated and tested the changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={promote.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={promote.isPending}
                onClick={() => promote.mutate()}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                Confirm promotion
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {promote.isSuccess ? (
          <p className="text-xs text-emerald-600">Promotion successful: the post was registered successfully.</p>
        ) : null}
        {promote.isError ? (
          <p className="text-xs text-red-500">{(promote.error as Error).message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
