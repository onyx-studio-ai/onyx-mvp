'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface SelectionContextType {
  selectedVoiceId: string | null;
  selectedVoiceName: string | null;
  selectedPlan: string | null;
  setSelectedVoice: (id: string | null, name: string | null) => void;
  setSelectedPlan: (plan: string | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const setSelectedVoice = (id: string | null, name: string | null) => {
    setSelectedVoiceId(id);
    setSelectedVoiceName(name);
  };

  const clearSelection = () => {
    setSelectedVoiceId(null);
    setSelectedVoiceName(null);
    setSelectedPlan(null);
  };

  return (
    <SelectionContext.Provider
      value={{
        selectedVoiceId,
        selectedVoiceName,
        selectedPlan,
        setSelectedVoice,
        setSelectedPlan,
        clearSelection,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
