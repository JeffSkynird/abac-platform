import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import QueryProvider from './QueryProvider';

function PolicyTestFormContent({ policySetId }: { policySetId: string }) {
  const [principal, setP] = useState('{"type":"User","id":"123"}');
  const [resource, setR] = useState('{"type":"Document","id":"abc"}');
  const [action, setA] = useState('read');
  const [context, setC] = useState('{}');

  const test = useMutation({
    mutationFn: () =>
      api.testDraft(policySetId, {
        principal: JSON.parse(principal),
        resource: JSON.parse(resource),
        action,
        context: JSON.parse(context),
      }),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <textarea
        className="bg-white/5 rounded p-2 font-mono text-xs"
        rows={4}
        value={principal}
        onChange={(e) => setP(e.target.value)}
      />
      <textarea
        className="bg-white/5 rounded p-2 font-mono text-xs"
        rows={4}
        value={resource}
        onChange={(e) => setR(e.target.value)}
      />
      <input
        className="bg-white/5 rounded p-2 font-mono text-sm"
        value={action}
        onChange={(e) => setA(e.target.value)}
      />
      <textarea
        className="bg-white/5 rounded p-2 font-mono text-xs"
        rows={4}
        value={context}
        onChange={(e) => setC(e.target.value)}
      />
      <button className="px-3 py-2 rounded bg-white/10" onClick={() => test.mutate()} disabled={test.isPending}>
        Test
      </button>
      <pre className="bg-black/40 rounded p-2 overflow-auto text-xs">
        {test.isSuccess ? JSON.stringify(test.data, null, 2) : 'Resultado...'}
      </pre>
    </div>
  );
}

export default function PolicyTestForm(props: { policySetId: string }) {
  return (
    <QueryProvider>
      <PolicyTestFormContent {...props} />
    </QueryProvider>
  );
}
