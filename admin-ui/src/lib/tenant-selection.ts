import { useEffect, useState } from 'react';

const STORAGE_KEY = 'abac:selectedTenant';
const EVENT_NAME = 'abac:tenant-selection-change';

type TenantSelectionEvent = CustomEvent<string>;

declare global {
  interface WindowEventMap {
    [EVENT_NAME]: TenantSelectionEvent;
  }
}

function readStoredTenant() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY) ?? '';
}

function writeStoredTenant(value: string) {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(STORAGE_KEY, value);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  const event: TenantSelectionEvent = new CustomEvent(EVENT_NAME, { detail: value });
  window.dispatchEvent(event);
}

export function useTenantSelection() {
  const [selectedTenant, setSelectedTenantState] = useState<string>('');

  useEffect(() => {
    setSelectedTenantState(readStoredTenant());

    const handleChange = (event: TenantSelectionEvent) => {
      setSelectedTenantState(event.detail ?? '');
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setSelectedTenantState(event.newValue ?? '');
      }
    };

    window.addEventListener(EVENT_NAME, handleChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EVENT_NAME, handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setSelectedTenant = (tenantId: string) => {
    const trimmed = tenantId.trim();
    setSelectedTenantState(trimmed);
    writeStoredTenant(trimmed);
  };

  const clearSelectedTenant = () => {
    setSelectedTenantState('');
    writeStoredTenant('');
  };

  return { selectedTenant, setSelectedTenant, clearSelectedTenant };
}

/*
 * Crafted by Jefferson Leon.
 * If you're reading this, I hope my code is clear. If not, it was probably written at 3 AM.
 */