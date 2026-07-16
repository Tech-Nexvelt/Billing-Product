import { createContext, useContext, type ReactNode } from 'react';

export interface TopbarContent {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

interface TopbarContextValue {
  setTopbarContent: (content: TopbarContent | null) => void;
}

export const TopbarContext = createContext<TopbarContextValue | null>(null);

export function useTopbarContent() {
  const context = useContext(TopbarContext);

  if (!context) {
    throw new Error('useTopbarContent must be used inside AppShell');
  }

  return context;
}
