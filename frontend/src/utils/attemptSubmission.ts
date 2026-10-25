/** A pending submission keeps its identity and payload after transport failures. */
export class AttemptSubmission {
  readonly attemptId: string;
  readonly payload: Record<string, unknown>;
  private pending: Promise<any> | null = null;
  constructor(payload: Record<string, unknown>, id = crypto.randomUUID()) {
    this.attemptId = id;
    this.payload = Object.freeze({ ...payload, attemptId: id });
  }
  send(questionId: string): Promise<any> {
    if (this.pending) return this.pending;
    this.pending = requestJson('/api/v1/questions/' + encodeURIComponent(questionId) + '/attempts', {
      method: 'POST', body: JSON.stringify(this.payload)
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
}

export async function requestJson(url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  const text = await response.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('O servidor retornou uma resposta inválida.'); }
  if (!response.ok) throw new Error(data.message || data.error || ('Falha HTTP ' + response.status));
  return data;
}

export function annotateAttempt(questionId: string, attemptId: string, sessionId: string, causaErro: string, annotationId = crypto.randomUUID()) {
  return requestJson('/api/v1/questions/' + encodeURIComponent(questionId) + '/attempts/' + encodeURIComponent(attemptId) + '/annotations', {
    method: 'POST', body: JSON.stringify({ annotationId, sessionId, causaErro })
  });
}
