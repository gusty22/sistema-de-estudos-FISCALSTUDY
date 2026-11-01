import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordQuestionHandoff,
  executeEndSession,
  reconcileCognitiveSummary
} from '../src/utils/questionSessionLifecycle.ts';
import {
  StudySessionSubmission,
  StudySessionError,
  readPendingSession,
  clearPendingSession,
  discardPendingSession,
  evaluateContinuationDecision,
  executeConsciousDiscard
} from '../src/utils/studySessionSubmission.ts';

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// Polyfills controlados de storage para Node
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const localStore = new Map();
  globalThis.localStorage = {
    getItem: (key) => localStore.get(key) ?? null,
    setItem: (key, val) => localStore.set(key, String(val)),
    removeItem: (key) => localStore.delete(key),
    clear: () => localStore.clear(),
    get length() { return localStore.size; },
    key: (i) => Array.from(localStore.keys())[i] ?? null
  };
}

test('FS-01C: recordQuestionHandoff rejeita HTTP 500 sem falso sucesso e preserva journal pendente para retry', async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  };

  const sessionId = 'qv-real-500';
  const payload = {
    sessionId,
    disciplina: 'Direito Tributario',
    durationSeconds: 1200,
    questoesFeitas: 10,
    questoesAcertadas: 8,
    rendimentoPercentual: 80,
    confiancaMedia: 4.2,
    activityType: 'HE',
    nextSessionHandoff: 'Revisar tema 4 de ICMS'
  };

  let caughtError = null;
  try {
    await recordQuestionHandoff(payload, sessionId);
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError instanceof StudySessionError, 'Erro deve ser do tipo StudySessionError');
  assert.equal(caughtError.isConflict, false, 'Erro 500 nao e conflito de dados');
  assert.equal(!caughtError.isConflict, true, 'Erro 500 e retryable');

  // Journal pendente deve permanecer no storage para recuperação/retry
  const pending = readPendingSession(sessionId);
  assert.ok(pending, 'Journal pendente deve existir no storage');
  assert.equal(pending.sessionId, sessionId);
});

test('FS-01C (Achado D): recordQuestionHandoff trata HTTP 409 preservando journal para conciliacao/auditoria', async () => {
  globalThis.fetch = async () =>
    jsonResponse({ error: 'Session already recorded' }, 409);

  const sessionId = 'qv-real-409';
  const payload = {
    sessionId,
    disciplina: 'Contabilidade',
    durationSeconds: 600,
    questoesFeitas: 5,
    questoesAcertadas: 4,
    rendimentoPercentual: 80,
    confiancaMedia: 3.5,
    activityType: 'HRE',
    nextSessionHandoff: 'Concluido'
  };

  let caughtError = null;
  try {
    await recordQuestionHandoff(payload, sessionId);
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError instanceof StudySessionError);
  assert.equal(caughtError.isConflict, true, 'Status 409 e conflito real');
  assert.equal(!caughtError.isConflict, false, 'Status 409 nao e retryable');

  // Journal deve ser preservado para conciliação ou descarte explícito
  const pending = readPendingSession(sessionId);
  assert.notEqual(pending, null, 'Journal pendente NAO deve ser limpo em 409');
  discardPendingSession(sessionId);
  assert.equal(readPendingSession(sessionId), null, 'Descarte explicito limpa o journal');
});

test('FS-01C: Falha de rede em recordQuestionHandoff preserva sessionId e dados para retry identico', async () => {
  let attempts = 0;
  const requests = [];

  globalThis.fetch = async (url, options) => {
    attempts++;
    requests.push({ url, body: JSON.parse(options.body) });
    if (attempts === 1) {
      throw new TypeError('Failed to fetch (offline)');
    }
    return jsonResponse({ sessionId: 'qv-real-retry', status: 'RECORDED' }, 201);
  };

  const sessionId = 'qv-real-retry';
  const payload = {
    sessionId,
    disciplina: 'Auditoria',
    durationSeconds: 900,
    questoesFeitas: 8,
    questoesAcertadas: 7,
    rendimentoPercentual: 87,
    confiancaMedia: 4.0,
    activityType: 'HE',
    nextSessionHandoff: 'Continuar amanhã'
  };

  // Tentativa 1: falha de rede
  let caughtNetErr = null;
  let firstSubmission = null;
  try {
    const res = await recordQuestionHandoff(payload, sessionId);
    firstSubmission = res.submission;
  } catch (err) {
    caughtNetErr = err;
  }
  assert.ok(caughtNetErr instanceof StudySessionError);
  assert.equal(caughtNetErr.isNetworkError, true);

  // Tentativa 2: reenvio utilizando a mesma instância subjacente
  const { submission, result } = await recordQuestionHandoff(payload, sessionId, firstSubmission);
  assert.equal(result.status, 'RECORDED');
  assert.equal(submission.confirmed, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].body, requests[1].body, 'Payload e sessionId devem ser identicos no retry');
});

test('FS-01C: Barreira sincrona em recordQuestionHandoff compartilha a mesma Promise em chamadas paralelas', async () => {
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls++;
    await new Promise((r) => setTimeout(r, 25));
    return jsonResponse({ sessionId, status: 'RECORDED' }, 200);
  };

  const sessionId = 'qv-real-concurrent';
  const payload = {
    sessionId,
    disciplina: 'TI',
    durationSeconds: 400,
    questoesFeitas: 3,
    questoesAcertadas: 3,
    rendimentoPercentual: 100,
    confiancaMedia: 5.0,
    activityType: 'HE',
    nextSessionHandoff: 'Barreira testada'
  };

  const sharedSubmission = new StudySessionSubmission(payload, sessionId);
  const [res1, res2] = await Promise.all([
    recordQuestionHandoff(payload, sessionId, sharedSubmission),
    recordQuestionHandoff(payload, sessionId, sharedSubmission)
  ]);

  assert.equal(networkCalls, 1, 'Chamadas paralelas devem compartilhar a mesma requisicao fisica');
  assert.deepEqual(res1.result, res2.result);
  assert.equal(res1.submission.confirmed, true);
});

test('FS-01C: executeEndSession real falha em HTTP 500 sem expurgar chaves do storage', async () => {
  const sessionId = 'qv-real-fail-end';
  sessionStorage.setItem('fiscalstudy_sessionId', sessionId);
  localStorage.setItem('fiscalstudy_active_question_session', sessionId);

  globalThis.fetch = async (url) => {
    if (url.includes('/api/v1/sessions/end')) {
      return jsonResponse({ error: 'Server crash on end' }, 500);
    }
    return jsonResponse({}, 200);
  };

  let caughtErr = null;
  try {
    await executeEndSession({ sessionId });
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr instanceof Error, 'Deve lancar erro ao receber 500 da API');
  assert.match(caughtErr.message, /status 500/);

  // Storage DEVE ser preservado intacto
  assert.equal(sessionStorage.getItem('fiscalstudy_sessionId'), sessionId, 'fiscalstudy_sessionId nao pode ser removido em falha');
  assert.equal(localStorage.getItem('fiscalstudy_active_question_session'), sessionId, 'fiscalstudy_active_question_session nao pode ser removido');
});

test('FS-01C: executeEndSession real expurga identificadores do storage estritamente apos confirmacao da API', async () => {
  const sessionId = 'qv-real-success-end';
  sessionStorage.setItem('fiscalstudy_sessionId', sessionId);
  localStorage.setItem('fiscalstudy_active_question_session', sessionId);

  let endCalled = false;
  globalThis.fetch = async (url) => {
    if (url.includes('/api/v1/sessions/end')) {
      endCalled = true;
      return jsonResponse({ status: 'ENDED', sessionId }, 200);
    }
    if (url.includes('/summary')) {
      return jsonResponse({ totalAnswered: 8, accuracy: 87.5, averageTimeMs: 45000 }, 200);
    }
    return jsonResponse({}, 200);
  };

  const endResult = await executeEndSession({ sessionId });

  assert.equal(endCalled, true);
  assert.equal(endResult.ended, true);
  assert.equal(endResult.summary.totalAnswered, 8);
  assert.equal(endResult.reconciledCognitively, false, 'Quando o resumo remoto responde 200, nao aciona fallback');

  // Chaves limpas exclusivamente apos sucesso
  assert.equal(sessionStorage.getItem('fiscalstudy_sessionId'), null);
  assert.equal(localStorage.getItem('fiscalstudy_active_question_session'), null);
});

test('FS-01C: executeEndSession real aciona Reconciliacao Cognitiva quando resumo falha sem quebrar o encerramento', async () => {
  const sessionId = 'qv-real-summary-decoupled';
  sessionStorage.setItem('fiscalstudy_sessionId', sessionId);

  globalThis.fetch = async (url) => {
    if (url.includes('/api/v1/sessions/end')) {
      return jsonResponse({ status: 'ENDED' }, 200);
    }
    if (url.includes('/summary')) {
      // Falha 404/500 no resumo consolidado
      return jsonResponse({ error: 'Summary service temporarily unavailable' }, 503);
    }
    return jsonResponse({}, 200);
  };

  const history = [
    { isCorrect: true, activeTimeMs: 20000, confidenceLevel: 4, gabaritoStatus: 'DEFINITIVO' },
    { isCorrect: false, activeTimeMs: 40000, confidenceLevel: 2, gabaritoStatus: 'DEFINITIVO' },
    { isCorrect: true, activeTimeMs: 30000, confidenceLevel: 5, gabaritoStatus: 'DEFINITIVO' },
    { isCorrect: false, activeTimeMs: 15000, confidenceLevel: 3, gabaritoStatus: 'ANULADA' }
  ];

  const endResult = await executeEndSession({ sessionId, history });

  assert.equal(endResult.ended, true);
  assert.equal(endResult.reconciledCognitively, true, 'Reconciliacao Cognitiva deve ser acionada');
  assert.ok(endResult.summary);
  assert.equal(endResult.summary.totalAnswered, 4);
  assert.equal(endResult.summary.anuladasCount, 1);
  // Das 3 nao-anuladas, 2 estao corretas = 66.666...%
  assert.ok(Math.abs(endResult.summary.accuracy - 66.67) < 0.1);
  assert.equal(sessionStorage.getItem('fiscalstudy_sessionId'), null);
});

test('FS-01C: reconcileCognitiveSummary expurga questoes anuladas do denominador de acuracia', () => {
  const history = [
    { isCorrect: true, activeTimeMs: 10000, gabaritoStatus: 'DEFINITIVO' },
    { isCorrect: false, activeTimeMs: 20000, gabaritoStatus: 'ANULADA' },
    { isCorrect: false, activeTimeMs: 30000, gabaritoStatus: 'DEFINITIVO' }
  ];

  const summary = reconcileCognitiveSummary(history);
  assert.equal(summary.totalAnswered, 3);
  assert.equal(summary.anuladasCount, 1);
  // Denominador nao-anuladas = 2 questoes; 1 correta -> acuracia = 50%
  assert.equal(summary.accuracy, 50);
});

test('FS-01C (Comportamento Real): Diferenciação entre cancelamento seguro antes do envio e preservação de operação incerta', async () => {
  const sessionId = 'qv-real-lifecycle-flow';
  const payload = {
    sessionId,
    disciplina: 'Economia',
    durationSeconds: 600,
    questoesFeitas: 5,
    questoesAcertadas: 4,
    rendimentoPercentual: 80,
    confiancaMedia: 4.0,
    activityType: 'HE',
    nextSessionHandoff: 'Revisar elasticidade'
  };

  // 1. Cancelamento antes de qualquer envio: não cria operação pendente indevida e cancela com segurança
  let pendingRef = new StudySessionSubmission(payload, sessionId);
  assert.equal(pendingRef.hasAttemptedSend, false);

  let showDiscardConfirm = false;
  const onContinue1 = () => {
    const decision = evaluateContinuationDecision(pendingRef, sessionId);
    if (decision.requiresExplicitConfirmation) {
      showDiscardConfirm = true;
      return;
    }
    clearPendingSession(sessionId);
    pendingRef = null;
  };

  onContinue1();
  assert.equal(showDiscardConfirm, false, 'Não deve exigir confirmação dramática se o envio nunca foi tentado');
  assert.equal(pendingRef, null);
  assert.equal(readPendingSession(sessionId), null, 'Rascunho não-enviado pode ser descartado com segurança');

  // 2. Falha de rede após possível commit: "Continuar Estudando" NÃO apaga o journal
  globalThis.fetch = async () => { throw new Error('Network timeout (possible server commit)'); };

  pendingRef = new StudySessionSubmission(payload, sessionId);
  let networkCaught = false;
  try {
    await recordQuestionHandoff(payload, sessionId, pendingRef);
  } catch (err) {
    networkCaught = true;
  }
  assert.equal(networkCaught, true);
  assert.equal(pendingRef.hasAttemptedSend, true);
  assert.equal(pendingRef.confirmed, false);
  assert.notEqual(readPendingSession(sessionId), null, 'Journal DEVE existir no storage');

  // Usuário clica em "Continuar Estudando" enquanto operação está incerta:
  const onContinue2 = () => {
    const decision = evaluateContinuationDecision(pendingRef, sessionId);
    if (decision.requiresExplicitConfirmation) {
      showDiscardConfirm = true;
      return;
    }
    clearPendingSession(sessionId);
    pendingRef = null;
  };

  onContinue2();
  assert.equal(showDiscardConfirm, true, 'Deve ativar o aviso de confirmação e bloquear descarte silencioso');
  assert.notEqual(readPendingSession(sessionId), null, 'Journal NÃO pode ser apagado silenciosamente em operação incerta');

  // 3. Retorno à finalização (reconciliação): mesma identidade e mesmo corpo JSON no retry
  const sentPayloads = [];
  globalThis.fetch = async (url, options) => {
    sentPayloads.push(options.body);
    return jsonResponse({ sessionId, status: 'RECORDED' }, 200);
  };

  const { submission: reconciledSub, result } = await recordQuestionHandoff(payload, sessionId, pendingRef);
  assert.equal(result.status, 'RECORDED');
  assert.equal(reconciledSub.confirmed, true);
  assert.equal(sentPayloads.length, 1);
  const sentJson = JSON.parse(sentPayloads[0]);
  assert.equal(sentJson.sessionId, sessionId);
  assert.equal(sentJson.nextSessionHandoff, payload.nextSessionHandoff);

  // 4. Confirmação RECORDED: limpeza permitida
  assert.equal(readPendingSession(sessionId), null, 'Após confirmação RECORDED, o journal é limpo com segurança');

  // 5. HTTP 409: conflito preservado, sem geração automática de ID substituto
  const conflictPayload = { ...payload, durationSeconds: 9999 };
  globalThis.fetch = async () => jsonResponse({ message: 'Session already recorded with different data' }, 409);

  let conflictSub = new StudySessionSubmission(conflictPayload, sessionId);
  let caughtConflict = false;
  try {
    await recordQuestionHandoff(conflictPayload, sessionId, conflictSub);
  } catch (err) {
    caughtConflict = true;
  }
  assert.equal(caughtConflict, true);
  assert.equal(conflictSub.confirmed, false);
  assert.notEqual(readPendingSession(sessionId), null, 'Conflito 409 DEVE preservar o journal');
  assert.equal(conflictSub.sessionId, sessionId, 'Nenhum ID substituto deve ser gerado automaticamente');

  discardPendingSession(sessionId);
  assert.equal(readPendingSession(sessionId), null);
});

test('FS-01C (Achado C): fromJournal recupera fielmente o payload de handoff sem reconstruir a partir de novos valores', async () => {
  const sessionId = 'qv-journal-recovery-c';
  const originalPayload = {
    sessionId,
    disciplina: 'Direito Tributario',
    topicoId: 'Processo Administrativo Fiscal',
    durationSeconds: 3100,
    questoesFeitas: 15,
    questoesAcertadas: 13,
    rendimentoPercentual: 87,
    confiancaMedia: 4.5,
    activityType: 'HE',
    nextSessionHandoff: 'Atenção para prazo de recurso voluntário no CARF'
  };

  // Simula gravação prévia no journal
  new StudySessionSubmission(originalPayload, sessionId);

  // Recupera via fromJournal
  const recovered = StudySessionSubmission.fromJournal(sessionId);
  assert.notEqual(recovered, null, 'fromJournal deve retornar a submissao persistida');
  assert.equal(recovered.sessionId, sessionId);
  assert.equal(recovered.payload.durationSeconds, 3100);
  assert.equal(recovered.payload.nextSessionHandoff, originalPayload.nextSessionHandoff);
  assert.equal(recovered.payload.activityType, 'HE');

  // Envio subsequente com a submissão recuperada
  globalThis.fetch = async () => jsonResponse({ sessionId, status: 'RECORDED' }, 200);
  const { result } = await recordQuestionHandoff(originalPayload, sessionId, recovered);
  assert.equal(result.status, 'RECORDED');
  assert.equal(recovered.confirmed, true);
  assert.equal(readPendingSession(sessionId), null);
});

test('FS-01C (Achado E): recordQuestionHandoff rejeita confirmacao ambigua ou status nao-RECORDED', async () => {
  const sessionId = 'qv-strict-http-e';
  const payload = {
    sessionId,
    disciplina: 'Economia',
    durationSeconds: 500,
    questoesFeitas: 5,
    questoesAcertadas: 5,
    rendimentoPercentual: 100,
    confiancaMedia: 5.0,
    activityType: 'HE',
    nextSessionHandoff: 'Equilíbrio de Nash'
  };

  // Resposta HTTP 200 com status inesperado (diferente de RECORDED)
  globalThis.fetch = async () => jsonResponse({ sessionId, status: 'PENDING_REVIEW' }, 200);

  let caught = null;
  try {
    await recordQuestionHandoff(payload, sessionId);
  } catch (err) {
    caught = err;
  }

  assert.ok(caught instanceof StudySessionError);
  assert.match(caught.message, /status de gravação inesperado/i);
  assert.notEqual(readPendingSession(sessionId), null, 'Journal deve permanecer para nova tentativa');

  discardPendingSession(sessionId);
});

test('FS-01C (Achado 1): Reload de pagina apos falha de envio restaura SENT_UNCONFIRMED e impede cancelamento silencioso', async () => {
  const sessionId = 'qv-reload-sent-unconfirmed-test';
  const payload = {
    sessionId,
    disciplina: 'Auditoria Fiscal',
    durationSeconds: 900,
    questoesFeitas: 10,
    questoesAcertadas: 9,
    rendimentoPercentual: 90,
    confiancaMedia: 4.5,
    activityType: 'HE',
    nextSessionHandoff: 'Planejamento de auditoria concluido'
  };

  // 1. Cria a submissão e tenta enviar; rede falha
  globalThis.fetch = async () => { throw new Error('HTTP 504 Gateway Timeout'); };
  const sub = new StudySessionSubmission(payload, sessionId);
  let caughtError = false;
  try {
    await recordQuestionHandoff(payload, sessionId, sub);
  } catch (err) {
    caughtError = true;
  }
  assert.equal(caughtError, true);
  assert.equal(sub.hasAttemptedSend, true);
  assert.equal(sub.lifecycleState, 'SENT_UNCONFIRMED');

  // 2. Simula recarregamento completo da página (memória limpa, apenas storage preservado)
  let pendingHandoffSubmissionRefCurrent = null;

  // QuestionViewer useEffect é acionado no mount:
  const recoveredFromJournal = StudySessionSubmission.fromJournal(sessionId);
  assert.ok(recoveredFromJournal);
  assert.equal(recoveredFromJournal.hasAttemptedSend, true);
  assert.equal(recoveredFromJournal.lifecycleState, 'SENT_UNCONFIRMED');
  pendingHandoffSubmissionRefCurrent = recoveredFromJournal;

  // 3. Usuário clica em "Continuar Estudando" no modal recuperado
  let showDiscardModal = false;
  const handleContinueStudying = () => {
    const decision = evaluateContinuationDecision(pendingHandoffSubmissionRefCurrent, sessionId);
    if (decision.requiresExplicitConfirmation) {
      showDiscardModal = true;
      return;
    }
    clearPendingSession(sessionId);
    pendingHandoffSubmissionRefCurrent = null;
  };

  handleContinueStudying();

  // Comprova que o descarte silencioso foi categoricamente bloqueado
  assert.equal(showDiscardModal, true, 'Deve exigir confirmação explícita pois a operação já foi enviada ao backend');
  assert.notEqual(readPendingSession(sessionId), null, 'Journal pendente DEVE continuar preservado');

  // 4. Usuário cancela o descarte e decide tentar reenviar (retry): backend agora responde 200
  globalThis.fetch = async () => jsonResponse({ sessionId, status: 'RECORDED' }, 200);
  const { submission: confirmedSub, result } = await recordQuestionHandoff(payload, sessionId, pendingHandoffSubmissionRefCurrent);
  assert.equal(result.status, 'RECORDED');
  assert.equal(confirmedSub.confirmed, true);
  assert.equal(confirmedSub.lifecycleState, 'CONFIRMED');

  // Após confirmação, journal é limpo com integridade
  assert.equal(readPendingSession(sessionId), null);
});

test('FS-01C (Gate Final 2): Journal corrompido bloqueia cancelamento silencioso em Continuar Estudando do QuestionViewer', () => {
  const sessionId = 'qv-corrupted-journal-test';
  const prefix = 'fiscalstudy:study_session:v1:';

  // Injeta journal corrompido no storage
  globalThis.sessionStorage.setItem(prefix + sessionId, '{"version":1,"sessionId":"corrupted",INVALID_JSON');

  // QuestionViewer tenta carregar fromJournal(sessionId) -> retorna null
  const fromJ = StudySessionSubmission.fromJournal(sessionId);
  assert.equal(fromJ, null);

  // Usuário clica em "Continuar Estudando"
  let pendingHandoffSubmissionRefCurrent = null;
  let showDiscardConfirm = false;

  const handleContinueStudying = () => {
    const decision = evaluateContinuationDecision(pendingHandoffSubmissionRefCurrent, sessionId);
    if (decision.requiresExplicitConfirmation) {
      showDiscardConfirm = true;
      return;
    }
    clearPendingSession(sessionId);
    pendingHandoffSubmissionRefCurrent = null;
  };

  handleContinueStudying();

  // Comprova que o descarte silencioso foi bloqueado categoricamente
  assert.equal(showDiscardConfirm, true, 'Journal corrompido DEVE exibir modal de confirmação explícita');
  assert.equal(globalThis.sessionStorage.getItem(prefix + sessionId), '{"version":1,"sessionId":"corrupted",INVALID_JSON');

  // Usuário confirma conscientemente o descarte
  executeConsciousDiscard(sessionId);
  assert.equal(globalThis.sessionStorage.getItem(prefix + sessionId), null);
});
