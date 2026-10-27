import { requestJson } from './attemptSubmission.ts';
import { reserveAttempt } from './attemptJournal.ts';

/** Prepare before allowing an answer. A lost acknowledgment retries the SAME intent UUID. */
export class ProspectivePreparation {
  readonly attemptId: string;
  readonly questionId: string;
  readonly sessionId: string;
  ready = false;
  private pending: Promise<void> | null = null;
  constructor(questionId: string, sessionId: string, attemptId?: string) {
    this.questionId = questionId;
    this.sessionId = sessionId;
    this.attemptId = attemptId ?? reserveAttempt(questionId, sessionId).attemptId;
  }
  prepare(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = requestJson('/api/v1/questions/' + encodeURIComponent(this.questionId) + '/predictions', {
      method: 'POST', body: JSON.stringify({ attemptId: this.attemptId, sessionId: this.sessionId })
    }).then(data => {
      if (data.contractVersion !== 'prospective-question-v1' || data.attemptId !== this.attemptId ||
          data.questionId !== this.questionId || data.sessionId !== this.sessionId ||
          data.can_apply !== false || data.can_schedule !== false || !data.predictionId) {
        throw new Error('A previsão não foi confirmada com a identidade esperada.');
      }
      this.ready = true;
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
}
