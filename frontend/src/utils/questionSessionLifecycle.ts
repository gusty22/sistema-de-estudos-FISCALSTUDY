import {
  StudySessionSubmission,
  clearPendingSession
} from './studySessionSubmission.ts';
import type { StudySessionResult } from './studySessionSubmission.ts';

export interface QuestionHandoffPayload {
  sessionId: string;
  concursoId?: string | number | null;
  disciplina?: string | null;
  topicoId?: string | null;
  durationSeconds: number;
  questoesFeitas: number;
  questoesAcertadas: number;
  rendimentoPercentual: number;
  confiancaMedia: number;
  activityType: 'HE' | 'HRE';
  nextSessionHandoff: string;
  [key: string]: unknown;
}

export interface SessionSummary {
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  overconfidenceCount: number;
  concursoScore?: number;
  anuladasCount?: number;
  errorDistribution?: Record<string, number>;
  [key: string]: unknown;
}

export interface SolvedItemHistory {
  isCorrect?: boolean | null;
  activeTimeMs?: number;
  confidenceLevel?: number;
  gabaritoStatus?: string;
}

export interface EndSessionOptions {
  sessionId: string;
  history?: SolvedItemHistory[];
  fetchFn?: typeof fetch;
  sessionStore?: Pick<Storage, 'removeItem' | 'getItem'> | null;
  localStore?: Pick<Storage, 'removeItem' | 'getItem'> | null;
}

export interface EndSessionResult {
  ended: boolean;
  summary: SessionSummary | null;
  reconciledCognitively: boolean;
}

/**
 * Calcula reconciliação cognitiva local quando o resumo consolidado do backend
 * estiver indisponível (404, latência de banco ou falha temporária).
 */
export function reconcileCognitiveSummary(history: SolvedItemHistory[]): SessionSummary | null {
  if (!history || history.length === 0) return null;

  const totalAns = history.length;
  const corrects = history.filter((i) => i.isCorrect === true).length;
  const totalMs = history.reduce((acc, i) => acc + (i.activeTimeMs || 0), 0);
  const overconf = history.filter((i) => i.confidenceLevel === 5 && i.isCorrect !== true).length;
  const anuladas = history.filter((i) => i.gabaritoStatus === 'ANULADA').length;
  const nonAnuladas = history.filter((i) => i.gabaritoStatus !== 'ANULADA');
  const nonAnuladasCorrect = nonAnuladas.filter((i) => i.isCorrect === true).length;
  const accuracy = nonAnuladas.length > 0 ? (nonAnuladasCorrect / nonAnuladas.length) * 100 : 0;

  return {
    totalAnswered: totalAns,
    correctCount: corrects,
    accuracy,
    averageTimeMs: totalAns > 0 ? Math.round(totalMs / totalAns) : 0,
    overconfidenceCount: overconf,
    concursoScore: corrects + anuladas,
    anuladasCount: anuladas
  };
}

/**
 * Registra o handoff da sessão de questões de forma idempotente e com barreira síncrona.
 */
export async function recordQuestionHandoff(
  payload: QuestionHandoffPayload,
  sessionId: string,
  existingSubmission?: StudySessionSubmission | null
): Promise<{ submission: StudySessionSubmission; result: StudySessionResult }> {
  const submission = existingSubmission || new StudySessionSubmission(payload, sessionId);
  const result = await submission.send();
  return { submission, result };
}

/**
 * Encerra a sessão no backend com validação estrita de confirmação HTTP antes de
 * expurgar os identificadores locais do storage.
 */
export async function executeEndSession(options: EndSessionOptions): Promise<EndSessionResult> {
  const { sessionId, history = [] } = options;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const sessionStore = options.sessionStore ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  const localStore = options.localStore ?? (typeof localStorage !== 'undefined' ? localStorage : null);

  // 1. Finaliza no backend
  const res = await fetchFn(`/api/v1/sessions/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });

  if (!res.ok) {
    throw new Error(
      `Falha ao encerrar a sessão no servidor (status ${res.status}). A identidade da sessão foi preservada.`
    );
  }

  // 2. Obtém o resumo consolidado do backend (desacoplado da finalização)
  let summaryData: SessionSummary | null = null;
  let reconciledCognitively = false;

  try {
    const resSummary = await fetchFn(`/api/v1/sessions/${sessionId}/summary`);
    if (resSummary.ok) {
      summaryData = (await resSummary.json()) as SessionSummary;
      if (typeof summaryData.overconfidenceCount !== 'number') {
        summaryData.overconfidenceCount = 0;
      }
    }
  } catch (err) {
    console.error('Erro ao obter resumo consolidado do backend:', err);
  }

  // 3. Fallback de Reconciliação Cognitiva se o resumo do servidor não estiver pronto
  if (!summaryData || summaryData.totalAnswered === 0) {
    summaryData = reconcileCognitiveSummary(history);
    reconciledCognitively = true;
  }

  // 4. APENAS APÓS CONFIRMAÇÃO DA API: expurga identificadores do storage
  if (sessionStore) {
    sessionStore.removeItem('fiscalstudy_sessionStarted');
    sessionStore.removeItem('fiscalstudy_sessionId');
  }
  if (localStore && localStore.getItem('fiscalstudy_active_question_session') === sessionId) {
    localStore.removeItem('fiscalstudy_active_question_session');
  }

  // Limpa também eventuais journals pendentes associados à sessão finalizada
  clearPendingSession(sessionId);

  return {
    ended: true,
    summary: summaryData,
    reconciledCognitively
  };
}
