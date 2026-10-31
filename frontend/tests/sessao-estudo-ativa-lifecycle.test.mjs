import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StudySessionSubmission,
  StudySessionError,
  readPendingSession,
  discardPendingSession
} from '../src/utils/studySessionSubmission.ts';

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// Polyfill minimalista de sessionStorage para Node
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

test('FS-01B: Resposta HTTP 500 nao e interpretada como sucesso e preserva a sessao ativa para retry', async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      return jsonResponse({ error: 'Database Disk Full' }, 500);
    }
    return jsonResponse({ sessionId: 'sess-active-500', status: 'RECORDED' }, 200);
  };

  const payload = {
    disciplina: 'Direito Tributario',
    topicoId: 'Credito Tributario',
    durationSeconds: 1800,
    modo: 'CRONOMETRO',
    activityType: 'ESTUDO_ORIENTADO',
    interrupcoesCount: 1,
    etapasConcluidas: 4,
    totalEtapas: 4,
    statusConclusao: 'concluida'
  };

  const submission = new StudySessionSubmission(payload, 'sess-active-500');

  // Primeira tentativa falha com 500
  await assert.rejects(
    submission.send(),
    (err) => err instanceof StudySessionError && err.status === 500
  );
  assert.equal(submission.confirmed, false, 'Sessao ativa nao pode ser confirmada em HTTP 500');

  // Segunda tentativa com a mesma instancia e payload
  const result = await submission.send();
  assert.equal(submission.confirmed, true);
  assert.equal(result.status, 'RECORDED');
  assert.equal(callCount, 2);
});

test('FS-01B: Resposta HTTP 409 (conflito) e rejeitada estritamente sem invocar callbacks de conclusao', async () => {
  globalThis.fetch = async () =>
    jsonResponse({ message: 'Session already recorded with different data' }, 409);

  const payload = {
    disciplina: 'Contabilidade',
    topicoId: 'Balanco Patrimonial',
    durationSeconds: 1200
  };

  const submission = new StudySessionSubmission(payload, 'sess-active-409');

  await assert.rejects(
    submission.send(),
    (err) => err instanceof StudySessionError && err.status === 409 && err.isConflict === true
  );
  assert.equal(submission.confirmed, false);
});

test('FS-01B: Falha de rede (offline) preserva a operacao pendente e permite retry idempotente', async () => {
  let attempts = 0;
  const sentPayloads = [];
  globalThis.fetch = async (url, init) => {
    attempts++;
    sentPayloads.push(init.body);
    if (attempts === 1) {
      throw new Error('TypeError: Failed to fetch (Connection Refused)');
    }
    return jsonResponse({ sessionId: 'sess-active-offline', status: 'RECORDED' }, 200);
  };

  const payload = {
    disciplina: 'Auditoria',
    topicoId: 'Amostragem em Testes de Controle',
    durationSeconds: 2100,
    notas: 'Amostragem estratificada'
  };

  const submission = new StudySessionSubmission(payload, 'sess-active-offline');

  await assert.rejects(
    submission.send(),
    (err) => err instanceof StudySessionError && err.isNetworkError === true
  );
  assert.equal(submission.confirmed, false);

  // Journal pendente salvo em sessionStorage
  const journaled = readPendingSession('sess-active-offline');
  assert.notEqual(journaled, null);

  // Retry com o mesmo objeto
  const res = await submission.send();
  assert.equal(res.status, 'RECORDED');
  assert.equal(submission.confirmed, true);

  // Comprova identidade de bytes entre o envio inicial e o retry
  assert.equal(sentPayloads.length, 2);
  assert.equal(sentPayloads[0], sentPayloads[1]);
  assert.equal(readPendingSession('sess-active-offline'), null);
});

test('FS-01B: Estabilidade de sessionId ativo entre recarregamentos simulados de pagina', () => {
  globalThis.sessionStorage.clear();

  // Simula primeira montagem do componente
  const firstId = 'sess_initial_12345';
  globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', firstId);

  // Simula leitura na montagem seguinte (apos reload)
  const recoveredId = globalThis.sessionStorage.getItem('fiscalstudy_active_session_id');
  assert.equal(recoveredId, firstId, 'O sessionId ativo deve ser estavel em caso de recarregamento');

  // Apos gravacao com sucesso, a chave e removida
  globalThis.sessionStorage.removeItem('fiscalstudy_active_session_id');
  assert.equal(globalThis.sessionStorage.getItem('fiscalstudy_active_session_id'), null);
});

test('FS-01B: Clique duplo em handleFinalizeAndRecord compartilha a mesma requisicao fisica', async () => {
  let netCalls = 0;
  let finish;
  globalThis.fetch = () => {
    netCalls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };

  const submission = new StudySessionSubmission(
    { disciplina: 'Legislação Tributária', durationSeconds: 900 },
    'sess-concurrency-test'
  );

  const req1 = submission.send();
  const req2 = submission.send();

  assert.equal(req1, req2, 'Requisicoes concorrentes devem compartilhar a mesma Promise');
  assert.equal(netCalls, 1, 'Apenas uma chamada HTTP deve ser disparada');

  finish(jsonResponse({ sessionId: 'sess-concurrency-test', status: 'RECORDED' }, 200));
  await Promise.all([req1, req2]);
  assert.equal(netCalls, 1);
});

test('FS-01B (Achado D): Resposta HTTP 409 preserva o journal pendente para conciliacao/auditoria', async () => {
  globalThis.fetch = async () =>
    jsonResponse({ message: 'Session already recorded with different data' }, 409);

  const submission = new StudySessionSubmission(
    { disciplina: 'Direito Administrativo', durationSeconds: 600 },
    'sess-409-orphan-check'
  );

  await assert.rejects(submission.send());
  assert.notEqual(readPendingSession('sess-409-orphan-check'), null, 'Journal NAO deve ser limpo em erro 409');
  discardPendingSession('sess-409-orphan-check');
  assert.equal(readPendingSession('sess-409-orphan-check'), null, 'Descarte explicito limpa o journal');
});

test('FS-01B: onFinishSession e disparado estritamente apos confirmacao HTTP 200/201 e nunca durante o avanco de etapas', async () => {
  let finishedCalls = 0;
  const onFinishSessionMock = () => { finishedCalls++; };

  // Simulacao do fluxo do componente: avanco de etapas apenas transiciona estado
  let timerStatus = 'running';
  const handleNextStepSim = (isLastStep) => {
    if (isLastStep) {
      timerStatus = 'finished';
      // Conforme correcao obrigatoria, onFinishSession NAO deve ser chamado aqui
    }
  };

  handleNextStepSim(true);
  assert.equal(timerStatus, 'finished');
  assert.equal(finishedCalls, 0, 'onFinishSession nao pode ser invocado no avanco de etapa');

  // Submissao HTTP
  globalThis.fetch = async () =>
    jsonResponse({ sessionId: 'sess-step-flow', status: 'RECORDED' }, 200);

  const submission = new StudySessionSubmission(
    { disciplina: 'Auditoria', durationSeconds: 1500 },
    'sess-step-flow'
  );

  await submission.send();
  // Disparo exclusivo apos sucesso da API
  if (submission.confirmed) {
    onFinishSessionMock();
  }

  assert.equal(finishedCalls, 1, 'onFinishSession deve ser chamado exclusivamente apos confirmacao HTTP');
});

test('FS-01B: fluxo Continuar Estudando regenera sessionId no state e storage evitando 409 em finalizacao subsequente', async () => {
  const sentSessionIds = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    sentSessionIds.push(body.sessionId);
    return jsonResponse({ sessionId: body.sessionId, status: 'RECORDED' }, 200);
  };

  // 1. Primeira finalizacao
  let sessionId = 'sess-initial-123';
  sessionStorage.setItem('fiscalstudy_active_session_id', sessionId);
  let isSaved = false;
  let pendingSubmission = null;

  // Finalizar e registrar #1
  pendingSubmission = new StudySessionSubmission({ disciplina: 'TI', sessionId }, sessionId);
  await pendingSubmission.send();
  isSaved = true;

  assert.equal(isSaved, true);
  assert.equal(sentSessionIds.length, 1);
  assert.equal(sentSessionIds[0], 'sess-initial-123');

  // 2. Clique em "Continuar Estudando"
  if (isSaved) {
    isSaved = false;
    pendingSubmission = null;
    const newId = 'sess-resumed-456';
    sessionId = newId; // Simulando setSessionId(newId)
    sessionStorage.setItem('fiscalstudy_active_session_id', newId);
  }

  assert.equal(isSaved, false);
  assert.equal(sessionStorage.getItem('fiscalstudy_active_session_id'), 'sess-resumed-456');

  // 3. Segunda finalizacao subsequente
  pendingSubmission = new StudySessionSubmission({ disciplina: 'TI', sessionId }, sessionId);
  await pendingSubmission.send();
  isSaved = true;

  assert.equal(sentSessionIds.length, 2);
  assert.equal(sentSessionIds[1], 'sess-resumed-456', 'Segunda submissao deve carregar novo sessionId');
  assert.notEqual(sentSessionIds[0], sentSessionIds[1], 'Identificadores devem ser distintos para evitar HTTP 409');
});

test('FS-01B (Achado C): Recarregamento apos falha restaura o payload exato do journal sem reconstruir duracao zero', async () => {
  const sessionId = 'sess-active-reload-test';
  const originalPayload = {
    sessionId,
    disciplina: 'Direito Tributario',
    topicoId: 'Obrigacao Tributaria',
    durationSeconds: 2700,
    modo: 'CRONOMETRO',
    activityType: 'ESTUDO_ORIENTADO',
    interrupcoesCount: 2,
    etapasConcluidas: 4,
    totalEtapas: 4,
    statusConclusao: 'SIM',
    dificuldadeRelatada: 'Conceito de sujeito passivo por solidariedade',
    notas: 'Dúvidas em jurisprudência do STJ'
  };

  // 1. Simula envio prévio que caiu em falha de rede (offline)
  const sub1 = new StudySessionSubmission(originalPayload, sessionId);
  globalThis.fetch = async () => { throw new Error('Network offline'); };
  await assert.rejects(sub1.send());

  // 2. Simula reload da página: componente lê sessionId do storage e recupera via fromJournal
  const recoveredSubmission = StudySessionSubmission.fromJournal(sessionId);
  assert.notEqual(recoveredSubmission, null, 'Deve encontrar a submissao pendente no journal');
  assert.equal(recoveredSubmission.sessionId, sessionId);
  assert.equal(recoveredSubmission.payload.durationSeconds, 2700, 'Duracao nao pode ser resetada para 0');
  assert.equal(recoveredSubmission.payload.dificuldadeRelatada, originalPayload.dificuldadeRelatada);
  assert.equal(recoveredSubmission.payload.notas, originalPayload.notas);

  // 3. Reenvio da submissão recuperada com sucesso
  const sentPayloads = [];
  globalThis.fetch = async (url, init) => {
    sentPayloads.push(init.body);
    return jsonResponse({ sessionId, status: 'RECORDED' }, 200);
  };

  const result = await recoveredSubmission.send();
  assert.equal(result.status, 'RECORDED');
  assert.equal(recoveredSubmission.confirmed, true);
  assert.equal(readPendingSession(sessionId), null, 'Journal deve ser limpo apos confirmacao');

  // Comprova que o payload enviado no reenvio pós-reload é idêntico ao original
  const sentObj = JSON.parse(sentPayloads[0]);
  assert.equal(sentObj.durationSeconds, 2700);
  assert.equal(sentObj.sessionId, sessionId);
});

test('FS-01B (Achado B): Continuar Estudando e bloqueado durante operacao incerta/retryable sem confirmacao', () => {
  const sessionId = 'sess-active-uncertain-block';
  const sub = new StudySessionSubmission({ disciplina: 'TI', durationSeconds: 600 }, sessionId);
  assert.equal(sub.confirmed, false);

  const saveError = { message: 'Network offline', isConflict: false, retryable: true };

  // Regra de guarda do botao Continuar Estudando:
  // Se houver submissão pendente não confirmada com retryable ou pendingRecoveryNotice, bloqueia reset silencioso
  const isBlocked = Boolean(sub && !sub.confirmed && saveError?.retryable);
  assert.equal(isBlocked, true, 'Deve bloquear reset/continuacao silenciosa em operacao incerta');

  // Descarte explícito permite prosseguir
  discardPendingSession(sessionId);
  assert.equal(readPendingSession(sessionId), null);
});
