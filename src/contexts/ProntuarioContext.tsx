import { createContext, useContext } from 'react';
export type ProntuarioFormat = 'narrativo' | 'escaneavel';
export const ProntuarioFormatCtx = createContext<{
  format: ProntuarioFormat;
  setFormat: (f: ProntuarioFormat) => void;
}>({ format: 'narrativo', setFormat: () => {} });
export const useProntuarioFormat = () => useContext(ProntuarioFormatCtx);
