import { createContext, useContext } from 'react';
export const MobileCtx = createContext(false);
export const useIsMobile = () => useContext(MobileCtx);
