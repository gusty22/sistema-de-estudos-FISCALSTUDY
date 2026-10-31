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

    // Persiste imediatamente no journal do sessionStorage para salvaguardar a operação
    savePendingSession(this.sessionId, this.serializedBody);
  }

  /**
   * Reconstrói a submissão a partir do journal pendente no sessionStorage.
   * Garante que o payload recuperado seja idêntico ao gravado anteriormente (sem reconstrução alterada).
   */
  static fromJournal(sessionId: string): StudySessionSubmission | null {
    const pending = readPendingSession(sessionId);
    if (!pending || !pending.serializedBody) return null;
    try {
      const parsed = JSON.parse(pending.serializedBody);
      return new StudySessionSubmission(parsed, sessionId);
    } catch {
      return null;
    }
  }

  /**
   * Envia ou repete a submissão para a API.
   * Chamadas concorrentes durante uma requisição em andamento compartilham a mesma Promise (barreira síncrona).
   */
  send(url = '/api/v1/study-sessions/record'): Promise<StudySessionResult> {
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    // Salva a intenção pendente no journal do navegador antes do dispatch de rede
    savePendingSession(this.sessionId, this.serializedBody);

    this.pendingPromise = (async () => {
      let res: Response;
      try {
        res = await fetch(url, {
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
        clearPendingSession(this.sessionId);
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
      clearPendingSession(this.sessionId);
      return data as StudySessionResult;
    })().finally(() => {
      this.pendingPromise = null;
    });

    return this.pendingPromise;
  }
}
