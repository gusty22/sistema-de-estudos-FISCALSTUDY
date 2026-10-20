import React from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import { PainelDesempenho } from './PainelDesempenho';

export interface AnalyticsViewProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
  onNavigateToRevision?: () => void;
  onNavigateToCycle?: () => void;
  onNavigateToQuestions?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  activeConcurso,
  onNavigateToStudy,
  onNavigateToRevision,
  onNavigateToCycle,
  onNavigateToQuestions
}) => {
  return (
    <PainelDesempenho
      activeConcurso={activeConcurso}
      onNavigateToStudy={onNavigateToStudy}
      onNavigateToRevision={onNavigateToRevision}
      onNavigateToCycle={onNavigateToCycle}
      onNavigateToQuestions={onNavigateToQuestions}
    />
  );
};

export default AnalyticsView;
