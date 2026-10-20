import React, { createContext, useContext, useState, useEffect } from 'react';

export interface SimplifiedModeContextType {
  isSimplifiedMode: boolean;
  toggleSimplifiedMode: () => void;
  setSimplifiedMode: (val: boolean) => void;
}

const SimplifiedModeContext = createContext<SimplifiedModeContextType>({
  isSimplifiedMode: true,
  toggleSimplifiedMode: () => {},
  setSimplifiedMode: () => {}
});

export const SimplifiedModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSimplifiedMode, setIsSimplifiedModeState] = useState<boolean>(() => {
    const saved = localStorage.getItem('fiscalstudy_simplified_mode');
    if (saved === null) return true; // Padrão: Modo Aluno (Simplificado)
    return saved === 'true';
  });

  const setSimplifiedMode = (val: boolean) => {
    setIsSimplifiedModeState(val);
    localStorage.setItem('fiscalstudy_simplified_mode', String(val));
  };

  const toggleSimplifiedMode = () => {
    setSimplifiedMode(!isSimplifiedMode);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-student-mode', isSimplifiedMode ? 'simplified' : 'advanced');
  }, [isSimplifiedMode]);

  return (
    <SimplifiedModeContext.Provider value={{ isSimplifiedMode, toggleSimplifiedMode, setSimplifiedMode }}>
      {children}
    </SimplifiedModeContext.Provider>
  );
};

export const useSimplifiedMode = () => useContext(SimplifiedModeContext);
