import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function CedarEditorContent({ policySetId }: { policySetId: string }) {
  const [cedar, setCedar] = useState(
    'permit(principal == User::"123", action == Action::"read", resource == Document::"abc");'
  );
  const validate = useMutation({ mutationFn: () => api.validatePostDraft(policySetId) });
  const addPolicy = useMutation({
    mutationFn: () => api.addPolicy(policySetId, cedar),
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded bg-white/10" onClick={() => validate.mutate()} disabled={validate.isPending}>
          Validate
        </button>
        {validate.isSuccess && <span className="text-emerald-400">OK</span>}
        {validate.isError && <span className="text-red-400">{(validate.error as Error).message}</span>}
        <button
          className="px-3 py-2 rounded bg-emerald-600/80"
          onClick={() => addPolicy.mutate()}
          disabled={!cedar.trim() || addPolicy.isPending}
        >
          Add Policy
        </button>
        {addPolicy.isSuccess && <span className="text-emerald-400">Saved ✓</span>}
        {addPolicy.isError && <span className="text-red-400">{(addPolicy.error as Error).message}</span>}
      </div>
      <Editor
        height="50vh"
        language="rust"
        theme="vs-dark"
        options={{ fontSize: 14 }}
        value={cedar}
        onChange={(value) => setCedar(value ?? '')}
      />
    </div>
  );
}

export default function CedarEditor(props: { policySetId: string }) {
  return (
    <QueryProvider>
      <CedarEditorContent {...props} />
    </QueryProvider>
  );
}
