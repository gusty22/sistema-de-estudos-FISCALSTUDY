/**
 * dashboardLogic.ts — Lógica pura e determinística do Dashboard do FiscalStudy
 * 
 * Regra Pedagógica Fundamental: Nenhuma disciplina, tópico ou atividade fictícia 
 * pode ser inventada ou apresentada ao estudante sem evidência real no edital
 * e no histórico de estudos.
 */

import { inspectPendingSession } from '../../utils/studySessionSubmission.ts';

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
  | 'HAS_ACTIVITIES'
  | 'PARTIAL_UNAVAILABLE';

export interface StudySessionRecord {
  sessionId?: string;
  concursoId?: string | number | null;
  disciplina?: string | null;
  topicoId?: string | null;
  nextSessionHandoff?: string | null;
  notas?: string | null;
  occurredAt?: string | null;
  durationSeconds?: number | null;
  questoesFeitas?: number | null;
  [key: string]: unknown;
}

export interface EligibleHandoff {
  sessionId: string;
  concursoId: string;
  disciplina: string;
  topicoId?: string;
  nextSessionHandoff: string;
  occurredAt?: string;
  timestampMs?: number;
  isFromLatestSession: boolean;
}

export interface ResumptionSafetyCheck {
  safe: boolean;
  reason?: 'SENT_UNCONFIRMED_PENDING' | 'CORRUPTED_JOURNAL';
  warning?: string;
}

export interface HandoffResumptionPayloadResult {
  safe: boolean;
  reason?: 'SENT_UNCONFIRMED_PENDING' | 'CORRUPTED_JOURNAL';
  warning?: string;
  newSessionId?: string;
  sessionStorageItems?: Record<string, string>;
  navigationParams?: { disciplina: string; assunto?: string; mode: string };
}

function parseOccurredAt(dateStr: unknown): number | null {
  if (typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Identifica o último recado de handoff elegível para o concurso ativo,
 * garantindo ordenação cronológica pura e isolamento estrito de concurso.
 */
export function extractLatestEligibleHandoff(
  sessions: unknown,
  activeConcursoId: unknown
): EligibleHandoff | null {
  if (activeConcursoId === null || activeConcursoId === undefined) return null;
  const targetCid = String(activeConcursoId).trim();
  if (!targetCid) return null;

  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  const concursoSessions: Array<{ session: StudySessionRecord; timestampMs: number | null }> = [];
  for (const s of sessions) {
    if (!s || typeof s !== 'object') continue;
    const rec = s as StudySessionRecord;
    if (rec.concursoId === null || rec.concursoId === undefined) continue;
    const sessionCid = String(rec.concursoId).trim();
    if (sessionCid !== targetCid) continue;

    const ts = parseOccurredAt(rec.occurredAt);
    concursoSessions.push({ session: rec, timestampMs: ts });
  }

  if (concursoSessions.length === 0) return null;

  // Ordena cronologicamente por occurredAt descrescente
  // Sessões sem data válida ficam no final (-Infinity)
  concursoSessions.sort((a, b) => {
    const timeA = a.timestampMs !== null ? a.timestampMs : -Infinity;
    const timeB = b.timestampMs !== null ? b.timestampMs : -Infinity;
    return timeB - timeA;
  });

  const latestSession = concursoSessions[0]?.session;

  const eligibleHandoffs = concursoSessions.filter(item => {
    const handoff = item.session.nextSessionHandoff;
    const hasText = typeof handoff === 'string' && handoff.trim().length > 0;
    const hasValidDate = item.timestampMs !== null;
    return hasText && hasValidDate;
  });

  if (eligibleHandoffs.length === 0) return null;

  const mostRecent = eligibleHandoffs[0];
  const target = mostRecent.session;

  const isFromLatest = Boolean(
    latestSession &&
    latestSession.sessionId &&
    latestSession.sessionId === target.sessionId
  );

  return {
    sessionId: target.sessionId ? String(target.sessionId) : '',
    concursoId: targetCid,
    disciplina: (target.disciplina && String(target.disciplina).trim()) || 'Geral',
    topicoId: (target.topicoId && String(target.topicoId).trim()) || undefined,
    nextSessionHandoff: String(target.nextSessionHandoff).trim(),
    occurredAt: target.occurredAt || undefined,
    timestampMs: mostRecent.timestampMs || undefined,
    isFromLatestSession: isFromLatest
  };
}

/**
 * Inspeciona journals da FS-01 para garantir que não sobrescreveremos
 * silenciosamente uma operação incerta ou registro local corrompido.
 */
export function checkResumptionSafety(currentActiveSessionId?: string | null): ResumptionSafetyCheck {
  if (!currentActiveSessionId) return { safe: true };

  const inspect = inspectPendingSession(currentActiveSessionId);
  if (inspect.exists) {
    if (inspect.isCorrupted) {
      return {
        safe: false,
        reason: 'CORRUPTED_JOURNAL',
        warning: 'Existe um registro local corrompido ou inválido no navegador. O início de uma nova sessão foi bloqueado para auditoria e conciliação explícita.'
      };
    }
    const state = inspect.data?.lifecycleState || 'SENT_UNCONFIRMED';
    if (state === 'SENT_UNCONFIRMED') {
      return {
        safe: false,
        reason: 'SENT_UNCONFIRMED_PENDING',
        warning: 'Existe uma sessão pendente de confirmação pelo servidor. Conclua ou descarte-a conscientemente antes de iniciar nova sessão.'
      };
    }
  }

  return { safe: true };
}

/**
 * Prepara com segurança a retomada a partir do handoff com nova identidade
 * exclusiva (fiscalstudy_active_session_id) e sem duplicação histórica.
 */
export function prepareHandoffResumptionPayload(
  handoff: EligibleHandoff,
  options?: {
    generatedSessionId?: string;
    checkSafety?: boolean;
    existingActiveSessionId?: string | null;
  }
): HandoffResumptionPayloadResult {
  if (options?.checkSafety) {
    const safety = checkResumptionSafety(options.existingActiveSessionId);
    if (!safety.safe) {
      return {
        safe: false,
        reason: safety.reason,
        warning: safety.warning
      };
    }
  }

  const newSessionId = options?.generatedSessionId || ('study-' + crypto.randomUUID());

  return {
    safe: true,
    newSessionId,
    sessionStorageItems: {
      fiscalstudy_active_session_id: newSessionId,
      fiscalstudy_session_discipline: handoff.disciplina,
      fiscalstudy_session_topic: handoff.topicoId || '',
      fiscalstudy_session_objective: handoff.nextSessionHandoff,
      fiscalstudy_session_type: 'ESTUDO_ORIENTADO',
      fiscalstudy_timer_session_id: newSessionId
    },
    navigationParams: {
      disciplina: handoff.disciplina,
      assunto: handoff.topicoId,
      mode: 'RESUMPTION'
    }
  };
}

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
 * ausência de edital de edital existente sem tópicos verticalizados,
 * e indisponibilidade parcial de fila comprovadamente vazia.
 */
export function getDashboardUIState(params: {
  hasActiveConcurso: boolean;
  isLoading: boolean;
  loadError: string | null;
  editaisCount?: number;
  topicsCount: number;
  queueActivitiesCount: number;
  isAgendaUnavailable?: boolean;
  isCycleUnavailable?: boolean;
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

  // Se a agenda ou o ciclo falharam na comunicação e a fila resultante está vazia,
  // NUNCA declarar falso estado de conclusão (NO_ACTIVITIES)
  if ((params.isAgendaUnavailable || params.isCycleUnavailable) && params.queueActivitiesCount === 0) {
    return 'PARTIAL_UNAVAILABLE';
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
