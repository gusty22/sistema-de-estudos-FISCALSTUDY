/**
 * Utilitário de submissão idempotente e recuperação de sessões de estudo do FiscalStudy.
 *
 * Garante:
 * 1. Estabilidade de identidade (sessionId) e imutabilidade de payload serializado em retries.
 * 2. Barreira síncrona contra clique duplo / envios concorrentes (compartilhamento de Promise).
 * 3. Validação estrita de resposta HTTP, diferenciando confirmação (200/201), conflito (409) e erro (500/offline).
 * 4. Salvaguarda local temporária (sessionStorage) respeitando a privacidade dos dados (sem PII, sem logging).
 */

export interface StudySessionPayload {
  sessionId: string;
  concursoId?: string | null;
  disciplina: string;
  topicoId?: string | null;
  materialId?: string | null;
  durationSeconds: number;
  paginaInicio?: number | null;
  paginaFim?: number | null;
  paginasLidas?: number;
  questoesFeitas?: number;
  questoesAcertadas?: number | null;
  rendimentoPercentual?: number | null;
  confiancaMedia?: number | null;
  modo?: string;
  activityType?: string;
  nextSessionHandoff?: string | null;
  notas?: string | null;
  [key: string]: unknown;
}

export interface StudySessionResult {
  sessionId: string;
  status: string;
  [key: string]: unknown;
}

export class StudySessionError extends Error {
  readonly status: number;
  readonly isConflict: boolean;
  readonly isNetworkError: boolean;

  constructor(message: string, status = 0, isConflict = false, isNetworkError = false) {
    super(message);
    this.name = 'StudySessionError';
    this.status = status;
    this.isConflict = isConflict;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Namespace e política de privacidade do Journal local em sessionStorage:
 * - Ciclo de vida: atrelado à aba ativa do navegador (descartado ao fechar a aba/janela).
 * - Não loga conteúdo em console e não sincroniza com storage compartilhado.
 * - Expiração: TTL de 24 horas.
 */
const JOURNAL_PREFIX = 'fiscalstudy:study_session:v1:';
const JOURNAL_TTL_MS = 24 * 60 * 60 * 1000;

interface JournalEntry {
  version: 1;
  sessionId: string;
  serializedBody: string;
  createdAt: number;
  expiresAt: number;
}

export function savePendingSession(sessionId: string, serializedBody: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const entry: JournalEntry = {
      version: 1,
      sessionId,
      serializedBody,
      createdAt: Date.now(),
      expiresAt: Date.now() + JOURNAL_TTL_MS
    };
    sessionStorage.setItem(JOURNAL_PREFIX + sessionId, JSON.stringify(entry));
    return true;
  } catch {
    // QuotaExceededError ou storage desabilitado: falha controlada sem interromper o fluxo em memória
    return false;
  }
}

export function readPendingSession(sessionId: string): { sessionId: string; serializedBody: string } | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(JOURNAL_PREFIX + sessionId);
    if (!raw) return null;
    const data = JSON.parse(raw) as JournalEntry;
    if (data.version !== 1 || data.sessionId !== sessionId || typeof data.serializedBody !== 'string') {
      return null;
    }
    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(JOURNAL_PREFIX + sessionId);
      return null;
    }
    return { sessionId: data.sessionId, serializedBody: data.serializedBody };
  } catch {
    return null;
  }
}

export function clearPendingSession(sessionId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(JOURNAL_PREFIX + sessionId);
  } catch {
    // Silencioso em caso de falha de storage
  }
}

export class StudySessionSubmission {
  readonly sessionId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly serializedBody: string;
  confirmed = false;
  private pendingPromise: Promise<StudySessionResult> | null = null;

  constructor(rawPayload: Record<string, unknown>, explicitSessionId?: string) {
    const id = explicitSessionId || (rawPayload.sessionId as string) || ('study-' + crypto.randomUUID());
    this.sessionId = id;

    // Normaliza e congela a requisição em JSON imutável
    const normalized: Record<string, unknown> = { ...rawPayload, sessionId: id };
    this.serializedBody = JSON.stringify(normalized);
    this.payload = Object.freeze(JSON.parse(this.serializedBody));
  }

  /**
   * Envia ou repete a submissão para a API.
   * Chamadas concorrentes durante uma requisição em andamento compartilham a mesma Promise (barreira síncrona).
   */
  send(): Promise<StudySessionResult> {
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    // Salva a intenção pendente no journal do navegador antes do dispatch de rede
    savePendingSession(this.sessionId, this.serializedBody);

    this.pendingPromise = (async () => {
      let res: Response;
      try {
        res = await fetch('/api/v1/study-sessions/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: this.serializedBody
        });
      } catch {
        throw new StudySessionError(
          'Falha de conexão com o servidor. A operação pendente foi preservada para nova tentativa.',
          0,
          false,
          true
        );
      }

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      if (res.status === 409) {
        throw new StudySessionError(
          data.message || 'Conflito de sessão: esta identidade já foi registrada no servidor com dados divergentes.',
          409,
          true,
          false
        );
      }

      if (!res.ok) {
        throw new StudySessionError(
          data.message || data.error || `Erro HTTP ${res.status} ao registrar sessão.`,
          res.status,
          false,
          false
        );
      }

      // Sucesso confirmado pelo backend (200 / 201)
      this.confirmed = true;
      clearPendingSession(this.sessionId);
      return (data as StudySessionResult) || { sessionId: this.sessionId, status: 'RECORDED' };
    })().finally(() => {
      this.pendingPromise = null;
    });

    return this.pendingPromise;
  }
}
