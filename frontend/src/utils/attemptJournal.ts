/** Browser-local recovery journal. Contains study answers; never log or sync it. */
const PREFIX = 'fiscalstudy:prospective:v1:';
type Entry = { version: 1; questionId: string; sessionId: string; attemptId: string; payload?: Record<string, unknown>; result?: any };
const key = (questionId: string, sessionId: string) => PREFIX + JSON.stringify([sessionId, questionId]);
export function readAttemptJournal(questionId: string, sessionId: string): Entry | null {
  if (typeof localStorage === 'undefined') return null; // Non-browser legacy callers/tests.
  const text = localStorage.getItem(key(questionId, sessionId));
  if (text === null) return null;
  const data = JSON.parse(text);
  if (data.version !== 1 || data.questionId !== questionId || data.sessionId !== sessionId ||
      typeof data.attemptId !== 'string' || !/^[0-9a-f-]{36}$/.test(data.attemptId))
    throw new Error('Registro de recuperação inválido; não será substituído.');
  return data;
}
export function reserveAttempt(questionId: string, sessionId: string): Entry {
  const prior = readAttemptJournal(questionId, sessionId);
  if (prior) return prior;
  const entry: Entry = { version: 1, questionId, sessionId, attemptId: crypto.randomUUID() };
  localStorage.setItem(key(questionId, sessionId), JSON.stringify(entry));
  return entry;
}
export function freezeAttemptPayload(questionId: string, payload: Record<string, unknown>, attemptId: string) {
  const sessionId = String(payload.sessionId || '');
  const prior = readAttemptJournal(questionId, sessionId);
  if (!prior || prior.attemptId !== attemptId) throw new Error('Preparação durável da tentativa ausente.');
  if (prior.payload && JSON.stringify(prior.payload) !== JSON.stringify(payload))
    throw new Error('A tentativa pendente possui outro conteúdo. Recupere a resposta original.');
  localStorage.setItem(key(questionId, sessionId), JSON.stringify({ ...prior, payload: prior.payload || payload }));
}
export function confirmAttempt(questionId: string, sessionId: string, attemptId: string, result: any) {
  const prior = readAttemptJournal(questionId, sessionId);
  if (!prior || prior.attemptId !== attemptId || result.attemptId !== attemptId) throw new Error('Confirmação de identidade inválida.');
  localStorage.setItem(key(questionId, sessionId), JSON.stringify({ ...prior, result }));
}
export function restoreQuestionSession(sessionId: string) {
  const text = localStorage.getItem(PREFIX + 'session:' + sessionId);
  if (!text) return null;
  const data = JSON.parse(text);
  if (!Array.isArray(data.questions) || !Number.isInteger(data.index) || !data.questions[data.index])
    throw new Error('Sessão local inválida; preservada para recuperação.');
  return data;
}
export function saveQuestionSession(sessionId: string, questions: unknown[], index: number) {
  localStorage.setItem(PREFIX + 'session:' + sessionId, JSON.stringify({ questions, index }));
}
