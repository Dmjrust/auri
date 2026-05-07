import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import * as db from '../lib/db';
import type { Patient } from '../data/mock';

interface PatientCtxValue {
  patients: Patient[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const PatientContext = createContext<PatientCtxValue>({
  patients: [], loading: true, refetch: async () => {},
});

export function PatientProvider({ children, initialPatients = [] }: {
  children: React.ReactNode;
  initialPatients?: Patient[];
}) {
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [loading, setLoading] = useState(initialPatients.length === 0);

  const refetch = useCallback(async () => {
    setLoading(true);
    try { setPatients(await db.fetchPatients()); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // Auto-fetch on mount (only when no initial data was provided)
  useEffect(() => {
    if (initialPatients.length === 0) { refetch(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ patients, loading, refetch }), [patients, loading, refetch]);

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
}

export const usePatients = () => useContext(PatientContext);
