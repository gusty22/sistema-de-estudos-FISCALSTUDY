import { requestJson } from './attemptSubmission.ts';
import { reserveAttempt, readAttemptJournal } from './attemptJournal.ts';

/** Prepare before allowing an answer. A lost acknowledgment retries the SAME intent UUID. */
export class ProspectivePreparation {
  readonly attemptId: string;
  readonly questionId: string;
  readonly sessionId: string;
  ready = false;
  recoveredResult: any = null;
  private pending: Promise<void> | null = null;
  constructor(questionId: string, sessionId: string, attemptId?: string) {
    this.questionId = questionId;
    this.sessionId = sessionId;
    this.attemptId = attemptId ?? reserveAttempt(questionId, sessionId).attemptId;
  }
  prepare(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.pending) return this.pending;
    const prior = readAttemptJournal(this.questionId, this.sessionId);
    const endpoint = '/api/v1/questions/' + encodeURIComponent(this.questionId) + '/predictions';
    const request = prior?.payload || prior?.result
      ? requestJson(endpoint + '/' + encodeURIComponent(this.attemptId) + '?sessionId=' + encodeURIComponent(this.sessionId)).then(state => {
          if (prior.result && state.state !== 'ANSWER_RECORDED') throw new Error('O servidor não confirmou a resposta local. O registro foi preservado.');
          if (state.state === 'ANSWER_RECORDED') this.recoveredResult = state.feedback;
          return state.prediction;
        })
      : requestJson(endpoint, { method: 'POST', body: JSON.stringify({ attemptId: this.attemptId, sessionId: this.sessionId }) });
    this.pending = request.then(data => {
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
