/**
 * dashboardLogic.ts — Lógica pura e determinística do Dashboard do FiscalStudy
 * 
 * Regra Pedagógica Fundamental: Nenhuma disciplina, tópico ou atividade fictícia 
 * pode ser inventada ou apresentada ao estudante sem evidência real no edital
 * e no histórico de estudos.
 */

export interface QueueActivity {
  id: string;
  type: 'Revisão' | 'Questões' | 'Novo Conteúdo';
  discipline: string;
  topic: string;
  reason: string;
  duration: number;
  material: string;
  strategy: string;
  pedagogyNote: string;
}

export interface RevisionAgendaItem {
  id: string;
  disciplina: string;
  topico: string;
  justificativa_pedagogica?: string;
  estagio_intervencao?: string;
  intervalo_dias?: number;
}

export interface RobinHoodBlock {
  sequenceOrder: number;
  type: string;
  disciplina: string;
  duracaoMinutos?: number;
  horasTransferidasRobinHood?: number;
  mensagemEuDoPassado?: string;
}

export type DashboardUIState =
  | 'NO_CONCURSO'
  | 'LOADING'
  | 'ERROR'
  | 'NO_EDITAL'
  | 'NO_TOPICS_IN_EDITAL'
  | 'NO_ACTIVITIES'
  | 'HAS_ACTIVITIES';

/**
 * Constrói a fila de atividades unificada estritamente baseada em evidências.
 * Se não houver revisões pendentes nem blocos de ciclo, retorna lista vazia [].
 * NENHUMA ATIVIDADE FICTÍCIA É INVENTADA.
 */
export function computeQueueActivities(
  revisionAgenda?: { hoje?: RevisionAgendaItem[] } | null,
  robinHoodCycle?: { blocos?: RobinHoodBlock[] } | null
): QueueActivity[] {
  const list: QueueActivity[] = [];

  // 1. Prioridade Máxima: Revisões Adaptativas do dia registradas no banco
  if (revisionAgenda && Array.isArray(revisionAgenda.hoje) && revisionAgenda.hoje.length > 0) {
    revisionAgenda.hoje.forEach((rev, idx) => {
      if (!rev.disciplina || !rev.topico) return;
      const stage = rev.estagio_intervencao || 'Intervenção Corretiva';
      list.push({
        id: `rev-${rev.id || idx}`,
        type: 'Revisão',
        discipline: rev.disciplina,
        topic: rev.topico,
        reason: rev.justificativa_pedagogica || 'Dificuldade recorrente + Alta prioridade',
        duration: Math.min(30, (rev.intervalo_dias ? 20 : 15)),
        material: 'Resumo Teórico & Caderno de Erros',
        strategy: `${stage} (Robin Hood)`,
        pedagogyNote: rev.justificativa_pedagogica || 'Revisão priorizada pelo histórico recente de retenção para evitar a curva do esquecimento.'
      });
    });
  }

  // 2. Blocos do Ciclo de Estudo (Robin Hood & Feedback Loop SWOT)
  if (robinHoodCycle && Array.isArray(robinHoodCycle.blocos) && robinHoodCycle.blocos.length > 0) {
    robinHoodCycle.blocos.forEach((b, idx) => {
      if (!b.disciplina) return;
      const isEmergency = b.type === 'EMERGENCIA_ROBIN_HOOD';
      list.push({
        id: `cycle-${idx}`,
        type: (b.type === 'REVISAO' || isEmergency) ? 'Revisão' : 'Questões',
        discipline: b.disciplina,
        topic: isEmergency ? 'Intervenção Emergencial de Erros' : `Bloco Estratégico #${b.sequenceOrder}`,
        reason: isEmergency
          ? '🚨 Pós-Simulado SWOT (Tempo Injetado)'
          : ((b.horasTransferidasRobinHood ?? 0) > 0
            ? `Robin Hood (+${b.horasTransferidasRobinHood}h alocadas)`
            : 'Consolidação de Dificuldades'),
        duration: b.duracaoMinutos || 35,
        material: 'Material Vinculado da Biblioteca',
        strategy: isEmergency ? 'Intervenção Crítica Pós-Simulado' : 'Prática de Questões e Fixação',
        pedagogyNote: b.mensagemEuDoPassado || 'Tópico prioritário de acordo com a distribuição ponderada do seu edital.'
      });
    });
  }

  // Retorna estritamente o que foi computado, sem adicionar dados artificiais
  return list;
}

/**
 * Determina o estado explícito da interface do Dashboard, diferenciando
 * ausência de edital de edital existente sem tópicos verticalizados.
 */
export function getDashboardUIState(params: {
  hasActiveConcurso: boolean;
  isLoading: boolean;
  loadError: string | null;
  editaisCount?: number;
  topicsCount: number;
  queueActivitiesCount: number;
}): DashboardUIState {
  if (!params.hasActiveConcurso) return 'NO_CONCURSO';
  if (params.isLoading) return 'LOADING';
  if (params.loadError) return 'ERROR';

  const editaisCount = params.editaisCount ?? 0;
  if (editaisCount === 0 && params.topicsCount === 0) {
    return 'NO_EDITAL';
  }
  if (editaisCount > 0 && params.topicsCount === 0) {
    return 'NO_TOPICS_IN_EDITAL';
  }
  if (params.topicsCount === 0) {
    return 'NO_EDITAL';
  }
  if (params.queueActivitiesCount === 0) {
    return 'NO_ACTIVITIES';
  }
  return 'HAS_ACTIVITIES';
}

/**
 * Retorna a atividade em destaque garantindo proteção contra índice NaN ou array vazio.
 */
export function getCurrentActivity(
  queueActivities: QueueActivity[],
  activeQueueIndex: number
): QueueActivity | undefined {
  if (!queueActivities || queueActivities.length === 0) {
    return undefined;
  }
  const safeIndex = Number.isFinite(activeQueueIndex) ? Math.max(0, activeQueueIndex) : 0;
  return queueActivities[safeIndex % queueActivities.length] || queueActivities[0];
}

/**
 * Calcula o próximo índice de forma segura contra divisão/módulo por zero.
 */
export function getNextQueueIndex(currentIndex: number, queueLength: number): number {
  if (queueLength <= 0) return 0;
  const safeCurrent = Number.isFinite(currentIndex) ? currentIndex : 0;
  return (safeCurrent + 1) % queueLength;
}

/**
 * Prepara com segurança os dados de sessão para sessionStorage e navegação.
 * Se a atividade não existir, retorna null e não autoriza criação de sessão.
 */
export function prepareSessionPayload(
  activity: QueueActivity | undefined,
  modeOnlyQuestions: boolean
): {
  sessionStorageItems: Record<string, string>;
  navigationParams: { disciplina: string; assunto: string; mode: string };
} | null {
  if (!activity || !activity.discipline || !activity.topic) {
    return null;
  }

  const sessionType = activity.type === 'Revisão'
    ? 'REVISAO'
    : (activity.type === 'Questões' || modeOnlyQuestions ? 'QUESTOES' : 'ESTUDO_ORIENTADO');

  return {
    sessionStorageItems: {
      fiscalstudy_session_discipline: activity.discipline,
      fiscalstudy_session_topic: activity.topic,
      fiscalstudy_session_objective: activity.pedagogyNote || activity.reason,
      fiscalstudy_session_type: sessionType
    },
    navigationParams: {
      disciplina: activity.discipline,
      assunto: activity.topic,
      mode: modeOnlyQuestions ? 'ONLY_QUESTIONS' : 'STANDARD'
    }
  };
}
