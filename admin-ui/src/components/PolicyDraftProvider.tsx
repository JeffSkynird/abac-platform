import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../lib/api';

const makeTempKey = () => `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export type DraftPolicy = {
  key: string;
  id?: string;
  cedar: string;
  originalCedar?: string;
  dirty: boolean;
  isNew: boolean;
};

type PolicyDraftContextValue = {
  policySetId: string;
  policies: DraftPolicy[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  updatePolicyCedar: (key: string, cedar: string) => void;
  addPolicy: () => void;
  resetPolicy: (key: string) => void;
  removePolicyLocal: (key: string) => void;
  markPolicySaved: (key: string, payload: { id?: string; cedar: string }) => void;
  refetchPolicies: () => Promise<void>;
};

const PolicyDraftContext = createContext<PolicyDraftContextValue | undefined>(undefined);

export function PolicyDraftProvider({ policySetId, children }: PropsWithChildren<{ policySetId: string }>) {
  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['policy-set', policySetId, 'policies'],
    queryFn: () => api.listPolicies(policySetId),
  });

  const [policies, setPolicies] = useState<DraftPolicy[]>([]);

  useEffect(() => {
    if (!data) return;

    setPolicies((prev) => {
      const prevById = new Map(prev.filter((policy) => policy.id).map((policy) => [policy.id as string, policy]));

      const fromServer = (data as Array<{ id: string; cedar: string }>).map((policy) => {
        const existing = prevById.get(policy.id);
        if (!existing) {
          return {
            key: policy.id,
            id: policy.id,
            cedar: policy.cedar,
            originalCedar: policy.cedar,
            dirty: false,
            isNew: false,
          } satisfies DraftPolicy;
        }

        if (existing.dirty) {
          return {
            ...existing,
            key: existing.id ?? existing.key,
            originalCedar: policy.cedar,
          } satisfies DraftPolicy;
        }

        return {
          key: policy.id,
          id: policy.id,
          cedar: policy.cedar,
          originalCedar: policy.cedar,
          dirty: false,
          isNew: false,
        } satisfies DraftPolicy;
      });

      const unsaved = prev.filter((policy) => !policy.id);
      return [...fromServer, ...unsaved];
    });
  }, [data]);

  const updatePolicyCedar = useCallback((key: string, cedar: string) => {
    setPolicies((prev) =>
      prev.map((policy) =>
        policy.key === key
          ? {
              ...policy,
              cedar,
              dirty: policy.isNew ? cedar.trim().length > 0 : cedar !== (policy.originalCedar ?? ''),
            }
          : policy
      )
    );
  }, []);

  const addPolicy = useCallback(() => {
    setPolicies((prev) => [
      ...prev,
      {
        key: makeTempKey(),
        cedar: '',
        originalCedar: '',
        dirty: false,
        isNew: true,
      },
    ]);
  }, []);

  const resetPolicy = useCallback((key: string) => {
    setPolicies((prev) =>
      prev.map((policy) =>
        policy.key === key
          ? policy.isNew
            ? { ...policy, cedar: '', dirty: false }
            : { ...policy, cedar: policy.originalCedar ?? '', dirty: false }
          : policy
      )
    );
  }, []);

  const removePolicyLocal = useCallback((key: string) => {
    setPolicies((prev) => prev.filter((policy) => policy.key !== key));
  }, []);

  const markPolicySaved = useCallback((key: string, payload: { id?: string; cedar: string }) => {
    setPolicies((prev) =>
      prev.map((policy) =>
        policy.key === key
          ? {
              ...policy,
              key: payload.id ?? policy.key,
              id: payload.id ?? policy.id,
              cedar: payload.cedar,
              originalCedar: payload.cedar,
              dirty: false,
              isNew: false,
            }
          : policy
      )
    );
  }, []);

  const value = useMemo<PolicyDraftContextValue>(
    () => ({
      policySetId,
      policies,
      isLoading,
      isFetching,
      error,
      updatePolicyCedar,
      addPolicy,
      resetPolicy,
      removePolicyLocal,
      markPolicySaved,
      refetchPolicies: async () => {
        await refetch();
      },
    }),
    [
      policySetId,
      policies,
      isLoading,
      isFetching,
      error,
      updatePolicyCedar,
      addPolicy,
      resetPolicy,
      removePolicyLocal,
      markPolicySaved,
      refetch,
    ]
  );

  return <PolicyDraftContext.Provider value={value}>{children}</PolicyDraftContext.Provider>;
}

export function usePolicyDraft() {
  const ctx = useContext(PolicyDraftContext);
  if (!ctx) {
    throw new Error('usePolicyDraft must be used within PolicyDraftProvider');
  }
  return ctx;
}
