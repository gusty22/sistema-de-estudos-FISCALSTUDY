/**
 * Utilitário de submissão idempotente e recuperação de sessões de estudo do FiscalStudy.
 *
 * POLÍTICA DE PRIVACIDADE E TAXONOMIA DE DADOS (ACHADO A):
 * O payload da sessão de estudos contém duas classes distintas de campos:
 * 1. Telemetria Estrutural e Operacional (Não-PII):
 *    - sessionId, concursoId, disciplina, topicoId, materialId, durationSeconds,
 *      paginaInicio, paginaFim, paginasLidas, questoesFeitas, questoesAcertadas,
 *      rendimentoPercentual, confiancaMedia, modo, activityType, interrupcoesCount,
 *      etapasConcluidas, totalEtapas, statusConclusao.
 * 2. Conteúdo Reflexivo e Notas de Estudo (Potencial PII / Informações Pessoais):
 *    - notas: anotações livres e reflexões técnicas do estudante.
 *    - dificuldadeRelatada: razões de dúvida ou travamento relatadas pelo usuário.
 *    - nextSessionHandoff: mensagem e direcionamentos para o próprio estudante no futuro.
 *
 * DIRETRIZ DE PERSISTÊNCIA LOCAL (sessionStorage):
 * - O journal local armazena o corpo serializado original em texto claro dentro do sessionStorage,
 *   restringindo-se estritamente ao processo e aba ativa do navegador (TTL de 24 horas).
 * - Não fazemos alegações falsas de segurança: este armazenamento NÃO é criptografado e NÃO é
 *   declarado livre de PII, pois contém as anotações inseridas pelo próprio usuário.
 * - A retenção do corpo serializado integral é estritamente necessária para garantir a idempotência
 *   em nível de transporte contra o backend (o SQLite rejeita retries que divirjam byte a byte).
 * - Caso a aba seja fechada ou o storage limpo, a operação pendente não é reconstituída a partir de
 *   suposições: a interface alerta sobre a ausência de dados para evitar reenvio com payload alterado.
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

const JOURNAL_PREFIX = 'fiscalstudy:study_session:v1:';
const JOURNAL_TTL_MS = 24 * 60 * 60 * 1000;

export type OperationLifecycleState =
  | 'PREPARED'
  | 'SENT_UNCONFIRMED'
  | 'CONFIRMED'
  | 'DISCARDED_BY_USER';

export interface JournalEntry {
  version: 1;
  sessionId: string;
  serializedBody: string;
  lifecycleState?: OperationLifecycleState;
  createdAt: number;
  expiresAt: number;
}

export type JournalStorageState =
  | 'DURABLE'                      // Persistido com sucesso no sessionStorage
  | 'MEMORY_ONLY'                  // Storage desabilitado, quota excedida ou erro de acesso
  | 'CORRUPTED_PRESERVED'          // Journal existente corrompido/inválido preservado para auditoria (não-sobrescrito)
  | 'DIVERGENT_PAYLOAD_PRESERVED'; // Journal existente com payload divergente preservado (não-sobrescrito)

export interface JournalSaveStatus {
  success: boolean;
  state: JournalStorageState;
  isDurable: boolean;
  warning?: string;
  existingSerializedBody?: string;
}

export function inspectPendingSession(sessionId: string): {
  exists: boolean;
  isCorrupted: boolean;
  isExpired: boolean;
  raw?: string;
  data?: JournalEntry;
} {
  if (typeof sessionStorage === 'undefined') {
    return { exists: false, isCorrupted: false, isExpired: false };
  }
  try {
    const raw = sessionStorage.getItem(JOURNAL_PREFIX + sessionId);
    if (!raw) return { exists: false, isCorrupted: false, isExpired: false };
    try {
      const data = JSON.parse(raw);
      if (
        data &&
        typeof data === 'object' &&
        data.version === 1 &&
        data.sessionId === sessionId &&
        typeof data.serializedBody === 'string'
      ) {
        const isExpired = Date.now() > data.expiresAt;
        return { exists: true, isCorrupted: false, isExpired, raw, data };
      }
      return { exists: true, isCorrupted: true, isExpired: false, raw };
    } catch {
      return { exists: true, isCorrupted: true, isExpired: false, raw };
    }
  } catch {
    return { exists: false, isCorrupted: false, isExpired: false };
  }
}

export function savePendingSessionDetailed(
  sessionId: string,
  serializedBody: string,
  lifecycleState: OperationLifecycleState = 'PREPARED'
): JournalSaveStatus {
  if (typeof sessionStorage === 'undefined') {
    return {
      success: false,
      state: 'MEMORY_ONLY',
      isDurable: false,
      warning: 'sessionStorage não disponível no ambiente. A operação está retida apenas em memória volátil.'
    };
  }

  // 1. Verifica se já existe um journal para este sessionId
  const inspect = inspectPendingSession(sessionId);
  if (inspect.exists && inspect.isCorrupted) {
    // ACHADO 2: Não sobrescrever silenciosamente um journal inválido contendo uma operação ainda não reconciliada
    return {
      success: false,
      state: 'CORRUPTED_PRESERVED',
      isDurable: false,
      warning: 'Journal local existente está corrompido ou em formato inválido. O registro anterior foi preservado para auditoria e a operação atual permanece em memória.'
    };
  }

  // ACHADO 2: Verificação de divergência de payload em operação existente não confirmada
  if (inspect.exists && !inspect.isCorrupted && inspect.data && !inspect.isExpired) {
    const existingBody = inspect.data.serializedBody;
    if (existingBody !== serializedBody) {
      // Impede sobrescrita silenciosa de journal válido com payload divergente!
      // Preserva a operação anterior para reconciliação e retorna erro explícito.
      return {
        success: false,
        state: 'DIVERGENT_PAYLOAD_PRESERVED',
        isDurable: false,
        existingSerializedBody: existingBody,
        warning: `Conflito de payload no journal: a sessão '${sessionId}' já possui uma operação pendente com dados divergentes. A operação anterior foi preservada para reconciliação.`
      };
    }
  }

  // 2. Grava ou atualiza a entrada válida
  try {
    const entry: JournalEntry = {
      version: 1,
      sessionId,
      serializedBody,
      lifecycleState,
      createdAt: inspect.data ? inspect.data.createdAt : Date.now(),
      expiresAt: Date.now() + JOURNAL_TTL_MS
    };
    sessionStorage.setItem(JOURNAL_PREFIX + sessionId, JSON.stringify(entry));
    return {
      success: true,
      state: 'DURABLE',
      isDurable: true
    };
  } catch {
    // QuotaExceededError ou Storage restrito
    return {
      success: false,
      state: 'MEMORY_ONLY',
      isDurable: false,
      warning: 'Falha ao gravar no armazenamento local do navegador (cota excedida ou restrição). A operação está preservada apenas em memória volátil e não será recuperada após recarregar a página.'
    };
  }
}

export function savePendingSession(sessionId: string, serializedBody: string): boolean {
  return savePendingSessionDetailed(sessionId, serializedBody).success;
}

export function readPendingJournalEntry(sessionId: string): JournalEntry | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(JOURNAL_PREFIX + sessionId);
    if (!raw) return null;
    let data: JournalEntry;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    if (data.version !== 1 || data.sessionId !== sessionId || typeof data.serializedBody !== 'string') {
      return null;
    }
    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(JOURNAL_PREFIX + sessionId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function readPendingSession(sessionId: string): {
  sessionId: string;
  serializedBody: string;
  lifecycleState: OperationLifecycleState;
} | null {
  const entry = readPendingJournalEntry(sessionId);
  if (!entry) return null;
  // ACHADO 1: Interpretação conservadora para journals legados sem lifecycleState:
  // Se não for possível demonstrar que a operação nunca foi enviada, trata como SENT_UNCONFIRMED
  const lifecycleState: OperationLifecycleState = entry.lifecycleState || 'SENT_UNCONFIRMED';
  return {
    sessionId: entry.sessionId,
    serializedBody: entry.serializedBody,
    lifecycleState
  };
}

/**
 * Exclui o journal pendente. Chamado exclusivamente após confirmação positiva da API
 * ou mediante descarte explícito pelo usuário.
 */
export function clearPendingSession(sessionId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(JOURNAL_PREFIX + sessionId);
  } catch {
    // Silencioso em caso de falha de storage
  }
}

/**
 * Descarte explícito de operação incerta ou conflito autorizado pelo usuário.
 */
export function discardPendingSession(sessionId: string): void {
  clearPendingSession(sessionId);
}

/**
 * Função compartilhada de avaliação de decisão para continuação / cancelamento
 * consumida tanto pelos componentes (ex: QuestionViewer) quanto pelos testes.
 */
export interface ContinuationDecision {
  canProceedSilently: boolean;
  requiresExplicitConfirmation: boolean;
  lifecycleState: OperationLifecycleState;
  reason: 'NOT_SENT' | 'SENT_UNCONFIRMED' | 'ALREADY_CONFIRMED' | 'DISCARDED';
  warningMessage?: string;
}

export function evaluateContinuationDecision(
  submission: StudySessionSubmission | null,
  sessionId?: string
): ContinuationDecision {
  // Se não houver submissão em memória e houver sessionId, consulta o journal persistido
  if (!submission && sessionId) {
    const inspected = inspectPendingSession(sessionId);
    if (!inspected.exists || !inspected.data) {
      return {
        canProceedSilently: true,
        requiresExplicitConfirmation: false,
        lifecycleState: 'PREPARED',
        reason: 'NOT_SENT'
      };
    }
    // Interpretação conservadora para journal existente
    const state: OperationLifecycleState = inspected.data.lifecycleState || 'SENT_UNCONFIRMED';
    if (state === 'PREPARED') {
      return {
        canProceedSilently: true,
        requiresExplicitConfirmation: false,
        lifecycleState: 'PREPARED',
        reason: 'NOT_SENT'
      };
    }
    return {
      canProceedSilently: false,
      requiresExplicitConfirmation: true,
      lifecycleState: state,
      reason: 'SENT_UNCONFIRMED',
      warningMessage: 'Uma tentativa de encerramento já foi transmitida ao servidor e o resultado é incerto. O descarte silencioso foi bloqueado.'
    };
  }

  if (!submission) {
    return {
      canProceedSilently: true,
      requiresExplicitConfirmation: false,
      lifecycleState: 'PREPARED',
      reason: 'NOT_SENT'
    };
  }

  if (submission.confirmed || submission.lifecycleState === 'CONFIRMED') {
    return {
      canProceedSilently: true,
      requiresExplicitConfirmation: false,
      lifecycleState: 'CONFIRMED',
      reason: 'ALREADY_CONFIRMED'
    };
  }

  // Se foi transmitido (ou marcado como SENT_UNCONFIRMED) e não está confirmado
  if (submission.lifecycleState === 'SENT_UNCONFIRMED' || submission.hasAttemptedSend) {
    return {
      canProceedSilently: false,
      requiresExplicitConfirmation: true,
      lifecycleState: 'SENT_UNCONFIRMED',
      reason: 'SENT_UNCONFIRMED',
      warningMessage: 'Uma tentativa de encerramento já foi transmitida ao servidor e o resultado é incerto. O descarte silencioso foi bloqueado para evitar perda de dados ou duplicidade.'
    };
  }

  // Preparado mas comprovadamente não enviado
  return {
    canProceedSilently: true,
    requiresExplicitConfirmation: false,
    lifecycleState: 'PREPARED',
    reason: 'NOT_SENT'
  };
}

export function executeConsciousDiscard(sessionId: string): {
  discarded: boolean;
  lifecycleState: OperationLifecycleState;
} {
  discardPendingSession(sessionId);
  return {
    discarded: true,
    lifecycleState: 'DISCARDED_BY_USER'
  };
}

export class StudySessionSubmission {
  readonly sessionId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly serializedBody: string;
  confirmed = false;
  hasAttemptedSend = false;
  lifecycleState: OperationLifecycleState = 'PREPARED';

  // Estado de durabilidade de armazenamento
  storageState: JournalStorageState = 'MEMORY_ONLY';
  isDurable = false;
  storageWarning?: string;

  private pendingPromise: Promise<StudySessionResult> | null = null;

  constructor(
    rawPayload: Record<string, unknown>,
    explicitSessionId?: string,
    options?: {
      restoredFromJournal?: boolean;
      initialLifecycleState?: OperationLifecycleState;
    }
  ) {
    const id = explicitSessionId || (rawPayload.sessionId as string) || ('study-' + crypto.randomUUID());
    this.sessionId = id;

    // Normaliza e congela a requisição em JSON imutável
    const normalized: Record<string, unknown> = { ...rawPayload, sessionId: id };
    this.serializedBody = JSON.stringify(normalized);
    this.payload = Object.freeze(JSON.parse(this.serializedBody));

    if (options?.restoredFromJournal) {
      this.lifecycleState = options.initialLifecycleState || 'SENT_UNCONFIRMED';
      this.hasAttemptedSend = this.lifecycleState === 'SENT_UNCONFIRMED';
      this.storageState = 'DURABLE';
      this.isDurable = true;
      return;
    }

    this.lifecycleState = 'PREPARED';
    this.hasAttemptedSend = false;

    // Persiste no journal do sessionStorage como PREPARED e registra durabilidade real
    const saveStatus = savePendingSessionDetailed(this.sessionId, this.serializedBody, 'PREPARED');
    this.storageState = saveStatus.state;
    this.isDurable = saveStatus.isDurable;
    this.storageWarning = saveStatus.warning;
  }

  /**
   * Reconstrói a submissão a partir do journal pendente no sessionStorage.
   * ACHADO 1: Recupera corretamente o lifecycleState e adota interpretação conservadora para legados.
   */
  static fromJournal(sessionId: string): StudySessionSubmission | null {
    const entry = readPendingJournalEntry(sessionId);
    if (!entry || !entry.serializedBody) return null;
    try {
      const parsed = JSON.parse(entry.serializedBody);
      // Interpretação conservadora: se não for comprovadamente PREPARED, trata como SENT_UNCONFIRMED
      const lifecycleState: OperationLifecycleState =
        entry.lifecycleState === 'PREPARED' ? 'PREPARED' : 'SENT_UNCONFIRMED';

      const sub = new StudySessionSubmission(parsed, sessionId, {
        restoredFromJournal: true,
        initialLifecycleState: lifecycleState
      });
      return sub;
    } catch {
      return null;
    }
  }

  send(url = '/api/v1/study-sessions/record'): Promise<StudySessionResult> {
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    // ACHADO 2: Bloqueia envio se a submissão carregar payload divergente de journal existente
    if (this.storageState === 'DIVERGENT_PAYLOAD_PRESERVED') {
      return Promise.reject(
        new StudySessionError(
          `Conflito local de journal: a sessão '${this.sessionId}' já possui uma operação pendente com dados divergentes. A operação anterior foi preservada para reconciliação.`,
          409,
          true,
          false
        )
      );
    }

    // ACHADO 1: A persistência do estado SENT_UNCONFIRMED DEVE ocorrer antes do envio da requisição
    this.lifecycleState = 'SENT_UNCONFIRMED';
    this.hasAttemptedSend = true;

    // Persiste SENT_UNCONFIRMED no journal do sessionStorage antes da requisição física
    const saveStatus = savePendingSessionDetailed(this.sessionId, this.serializedBody, 'SENT_UNCONFIRMED');
    this.storageState = saveStatus.state;
    this.isDurable = saveStatus.isDurable;
    this.storageWarning = saveStatus.warning;

    this.pendingPromise = (async () => {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: this.serializedBody
        });
      } catch {
        const networkErrorMessage = this.isDurable
          ? 'Falha de conexão com o servidor. A operação foi salva localmente no navegador e pode ser reenviada com segurança.'
          : 'Falha de conexão com o servidor. ATENÇÃO: o armazenamento local do navegador está indisponível (operação mantida apenas em memória volátil). NÃO recarregue a página antes de reenviar sob risco de perda dos dados.';

        throw new StudySessionError(
          networkErrorMessage,
          0,
          false,
          true
        );
      }

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      // Trata HTTP 409 (Conflito Legítimo):
      // IMPORTANTE (ACHADO D): NÃO expurgar o journal pendente automaticamente!
      // A evidência do conflito deve ser preservada para conciliação ou descarte explícito pelo usuário.
      if (res.status === 409) {
        throw new StudySessionError(
          (data && data.message) || 'Conflito de sessão: esta identidade já foi registrada no servidor com dados divergentes.',
          409,
          true,
          false
        );
      }

      if (!res.ok) {
        throw new StudySessionError(
          (data && (data.message || data.error)) || `Erro HTTP ${res.status} ao registrar sessão.`,
          res.status,
          false,
          false
        );
      }

      // Validação estrita do contrato de confirmação do backend (ACHADO E):
      // 1. Resposta positiva deve conter corpo JSON válido
      if (!data || typeof data !== 'object') {
        throw new StudySessionError(
          'Resposta inválida do servidor: corpo vazio ou formato não-JSON recebido em resposta 200.',
          res.status,
          false,
          false
        );
      }

      // 2. A resposta deve corresponder à identidade da operação enviada
      if (data.sessionId !== this.sessionId) {
        throw new StudySessionError(
          `Resposta ambígua do servidor: identidade da sessão confirmada ('${data.sessionId}') diverge da enviada ('${this.sessionId}').`,
          res.status,
          false,
          false
        );
      }

      // 3. O status retornado pelo contrato do backend deve ser estritamente "RECORDED"
      if (data.status !== 'RECORDED') {
        throw new StudySessionError(
          `Resposta ambígua do servidor: status de gravação inesperado ('${data.status}'). Esperado: 'RECORDED'.`,
          res.status,
          false,
          false
        );
      }

      // Sucesso confirmado pelo backend (200 / 201 com status RECORDED e sessionId idêntico)
      this.confirmed = true;
      this.lifecycleState = 'CONFIRMED';
      clearPendingSession(this.sessionId);
      return data as StudySessionResult;
    })().finally(() => {
      this.pendingPromise = null;
    });

    return this.pendingPromise;
  }
}
