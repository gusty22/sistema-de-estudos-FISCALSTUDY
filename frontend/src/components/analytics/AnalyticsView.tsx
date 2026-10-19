import React from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import { PainelDesempenho } from './PainelDesempenho';

export interface AnalyticsViewProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
  onNavigateToRevision?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  activeConcurso,
  onNavigateToStudy,
  onNavigateToRevision
}) => {
  return (
    <PainelDesempenho
      activeConcurso={activeConcurso}
      onNavigateToStudy={onNavigateToStudy}
      onNavigateToRevision={onNavigateToRevision}
    />
  );
};

export default AnalyticsView;
