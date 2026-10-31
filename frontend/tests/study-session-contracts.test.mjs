import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StudySessionSubmission,
  StudySessionError,
  savePendingSession,
  readPendingSession,
  clearPendingSession,
  discardPendingSession,
  savePendingSessionDetailed,
  inspectPendingSession,
  readPendingJournalEntry,
  evaluateContinuationDecision,
  executeConsciousDiscard
} from '../src/utils/studySessionSubmission.ts';

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// Polyfill minimalista de sessionStorage para o ambiente de testes em Node
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

test('FS-01A: Submissao bem-sucedida (HTTP 200/201) confirma a sessao e limpa o journal pendente', async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: init.body });
    return jsonResponse({ sessionId: 'study-123', status: 'RECORDED' }, 200);
  };

  const payload = {
    disciplina: 'Direito Tributario',
    durationSeconds: 1500,
    paginasLidas: 15,
    questoesFeitas: 10,
    modo: 'CRONOMETRO'
  };

  const submission = new StudySessionSubmission(payload, 'study-123');
  assert.equal(submission.sessionId, 'study-123');
  assert.equal(submission.confirmed, false);

  const result = await submission.send();
  assert.equal(submission.confirmed, true);
  assert.equal(result.status, 'RECORDED');
  assert.equal(sent.length, 1);
  assert.match(sent[0].url, /\/api\/v1\/study-sessions\/record/);

  // Journal pendente foi limpo apos confirmacao
  assert.equal(readPendingSession('study-123'), null);
});

test('FS-01A: Reenvio (retry) apos falha de rede preserva rigorosamente o mesmo sessionId e o payload byte a byte', async () => {
  const sent = [];
  let attempt = 0;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: init.body });
    attempt++;
    if (attempt === 1) {
      throw new Error('Network offline or socket timeout');
    }
    return jsonResponse({ sessionId: 'study-retry-1', status: 'RECORDED' }, 200);
  };

  const payload = {
    disciplina: 'Contabilidade Geral',
    durationSeconds: 3600,
    paginasLidas: 20,
    questoesFeitas: 15,
    notas: 'Duvida na DVA e DFC metodo indireto'
  };

  const submission = new StudySessionSubmission(payload, 'study-retry-1');

  // Primeira tentativa falha por rede
  await assert.rejects(
    submission.send(),
    (err) => err instanceof StudySessionError && err.isNetworkError === true
  );
  assert.equal(submission.confirmed, false);

  // O journal preserva o payload exato apos a falha
  const journaled = readPendingSession('study-retry-1');
  assert.notEqual(journaled, null);
  assert.equal(journaled.sessionId, 'study-retry-1');
  assert.equal(journaled.serializedBody, submission.serializedBody);

  // Segunda tentativa (retry) reutiliza a mesma instancia e payload
  const result = await submission.send();
  assert.equal(submission.confirmed, true);
  assert.equal(result.status, 'RECORDED');

  // Comprova que as duas requisicoes enviaram exatamente os mesmos bytes
  assert.equal(sent.length, 2);
  assert.equal(sent[0].body, sent[1].body);
  assert.equal(JSON.parse(sent[0].body).sessionId, 'study-retry-1');
  assert.equal(JSON.parse(sent[1].body).sessionId, 'study-retry-1');
});

test('FS-01A: Barreira sincrona contra clique duplo: chamadas paralelas compartilham a mesma Promise em voo', async () => {
  let callCount = 0;
  let finishRequest;
  globalThis.fetch = () => {
    callCount++;
    return new Promise((resolve) => {
      finishRequest = resolve;
    });
  };

  const submission = new StudySessionSubmission(
    { disciplina: 'Auditoria', durationSeconds: 1200 },
    'study-double-click'
  );

  // Simula dois cliques concorrentes no botao Salvar
  const p1 = submission.send();
  const p2 = submission.send();

  assert.equal(p1, p2, 'A segunda chamada concorrente deve retornar a exata mesma Promise em voo');
  assert.equal(callCount, 1, 'Exatamente uma chamada HTTP deve ser disparada');

  finishRequest(jsonResponse({ sessionId: 'study-double-click', status: 'RECORDED' }, 200));
  const [res1, res2] = await Promise.all([p1, p2]);

  assert.equal(res1.status, 'RECORDED');
  assert.equal(res2.status, 'RECORDED');
  assert.equal(callCount, 1);
});

test('FS-01A: HTTP 409 e tratado como conflito real de dados e nunca como sucesso', async () => {
  globalThis.fetch = async () =>
    jsonResponse(
      { message: 'Session already recorded with different data' },
      409
    );

  const submission = new StudySessionSubmission(
    { disciplina: 'Direito Administrativo', durationSeconds: 600 },
    'study-conflict-409'
  );

  await assert.rejects(
    submission.send(),
    (err) =>
      err instanceof StudySessionError &&
      err.status === 409 &&
      err.isConflict === true &&
      /diferentes|divergentes|different/i.test(err.message)
  );

  assert.equal(submission.confirmed, false, 'Erro 409 nao pode marcar a sessao como confirmada');
  // Achado D: Conflito HTTP 409 preserva journal pendente para conciliacao
  assert.notEqual(readPendingSession('study-conflict-409'), null, 'HTTP 409 nao pode expurgar o journal');
  discardPendingSession('study-conflict-409');
  assert.equal(readPendingSession('study-conflict-409'), null, 'Descarte explicito limpa o journal');
});

test('FS-01A: HTTP 500 do servidor nao marca sucesso e preserva a operacao pendente para retry', async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    if (attempts === 1) {
      return jsonResponse({ error: 'Internal Database Locked' }, 500);
    }
    return jsonResponse({ sessionId: 'study-500-recovery', status: 'RECORDED' }, 200);
  };

  const submission = new StudySessionSubmission(
    { disciplina: 'Legislacao Tributaria', durationSeconds: 2400 },
    'study-500-recovery'
  );

  await assert.rejects(
    submission.send(),
    (err) => err instanceof StudySessionError && err.status === 500
  );
  assert.equal(submission.confirmed, false);

  // Journal foi preservado no storage
  const pending = readPendingSession('study-500-recovery');
  assert.notEqual(pending, null);

  // Retry subsequente com a mesma operacao
  const success = await submission.send();
  assert.equal(success.status, 'RECORDED');
  assert.equal(submission.confirmed, true);
  assert.equal(readPendingSession('study-500-recovery'), null);
});

test('FS-01A: Imutabilidade: alteracao posterior de campos no objeto original nao altera o payload congelado', () => {
  const mutableObj = {
    disciplina: 'Economia',
    durationSeconds: 1800,
    notas: 'Curva IS-LM'
  };

  const submission = new StudySessionSubmission(mutableObj, 'study-immutable-1');
  const originalSerialized = submission.serializedBody;

  // Tenta mutar o objeto apos criacao da submissao
  mutableObj.disciplina = 'Outra Materia Modificada';
  mutableObj.durationSeconds = 99999;
  mutableObj.notas = 'Texto Injetado Posteriormente';

  assert.equal(
    submission.serializedBody,
    originalSerialized,
    'O corpo serializado para envio deve permanecer estritamente inalterado'
  );
  assert.equal(submission.payload.disciplina, 'Economia');
  assert.equal(submission.payload.durationSeconds, 1800);
});

test('FS-01A: Corrupcao ou cota no sessionStorage degrada com seguranca sem quebrar a execucao em memoria', () => {
  const origSetItem = globalThis.sessionStorage.setItem;
  const origGetItem = globalThis.sessionStorage.getItem;
  try {
    // Simula QuotaExceededError
    globalThis.sessionStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    const saved = savePendingSession('study-quota-err', '{"test":1}');
    assert.equal(saved, false, 'Deve retornar false sem lancar excecao');

    // Simula registro corrompido no storage
    globalThis.sessionStorage.getItem = () => 'CORRUPTED_NON_JSON_{{';
    const recovered = readPendingSession('study-quota-err');
    assert.equal(recovered, null, 'Leitura de registro corrompido deve retornar null sem crash');
  } finally {
    globalThis.sessionStorage.setItem = origSetItem;
    globalThis.sessionStorage.getItem = origGetItem;
  }
});

test('FS-01A: Politica de privacidade: dados ficam restritos ao namespace do sessionStorage e nao vazam em logs', () => {
  const sessionId = 'study-privacy-test';
  const serialized = JSON.stringify({
    sessionId,
    disciplina: 'Direito Constitucional',
    durationSeconds: 900,
    notas: 'Texto de estudo particular do estudante'
  });

  savePendingSession(sessionId, serialized);
  const entry = readPendingSession(sessionId);
  assert.notEqual(entry, null);
  assert.equal(entry.sessionId, sessionId);

  // Confirma chave de namespace versionada e isolada
  const rawStored = globalThis.sessionStorage.getItem('fiscalstudy:study_session:v1:' + sessionId);
  assert.notEqual(rawStored, null);
  const parsed = JSON.parse(rawStored);
  assert.equal(parsed.version, 1);
  assert.ok(parsed.expiresAt > Date.now());

  clearPendingSession(sessionId);
  assert.equal(readPendingSession(sessionId), null);
});

test('FS-01A (Achado A): Taxonomia de dados e conservacao integral de reflexoes do estudante no journal', () => {
  const sessionId = 'study-taxonomy-reflective';
  const originalPayload = {
    sessionId,
    disciplina: 'Auditoria Fiscal',
    durationSeconds: 1800,
    activityType: 'LEITURA_TEORIA',
    questoesFeitas: 0,
    // Conteudo Reflexivo / User-authored (potencial PII)
    notas: 'Dúvidas em testes de amostragem estatística e cálculo de materialidade.',
    dificuldadeRelatada: 'Alta complexidade no cálculo de intervalo de confiança.',
    nextSessionHandoff: 'Revisar NBC TA 530 itens 4 a 12 antes de fazer exercícios.'
  };

  const submission = new StudySessionSubmission(originalPayload, sessionId);
  assert.equal(submission.sessionId, sessionId);
  assert.equal(submission.payload.notas, originalPayload.notas);
  assert.equal(submission.payload.dificuldadeRelatada, originalPayload.dificuldadeRelatada);
  assert.equal(submission.payload.nextSessionHandoff, originalPayload.nextSessionHandoff);

  const pending = readPendingSession(sessionId);
  assert.notEqual(pending, null);
  const parsed = JSON.parse(pending.serializedBody);
  assert.equal(parsed.notas, originalPayload.notas);
  assert.equal(parsed.nextSessionHandoff, originalPayload.nextSessionHandoff);

  discardPendingSession(sessionId);
  assert.equal(readPendingSession(sessionId), null);
});

test('FS-01A (Achado C): fromJournal recupera fielmente o payload original sem reconstruir a partir de valores default', () => {
  const sessionId = 'study-recovery-c';
  const originalPayload = {
    sessionId,
    disciplina: 'Direito Administrativo',
    durationSeconds: 3600,
    questoesFeitas: 25,
    questoesAcertadas: 22,
    notas: 'Atos administrativos - anulação e revogação'
  };

  new StudySessionSubmission(originalPayload, sessionId);

  // Recupera diretamente do journal
  const recovered = StudySessionSubmission.fromJournal(sessionId);
  assert.notEqual(recovered, null, 'fromJournal deve reconstruir objeto valido');
  assert.equal(recovered.sessionId, sessionId);
  assert.equal(recovered.payload.durationSeconds, 3600);
  assert.equal(recovered.payload.questoesFeitas, 25);
  assert.equal(recovered.payload.notas, originalPayload.notas);
  assert.equal(recovered.confirmed, false);

  // Tentativa de recuperacao de ID inexistente
  assert.equal(StudySessionSubmission.fromJournal('inexistent-id'), null);

  discardPendingSession(sessionId);
});

test('FS-01A (Achado D): Journal e preservado em falhas e 409, sendo removido apenas sob confirmacao estrita ou descarte explicito', async () => {
  const sessionId = 'study-lifecycle-d';
  const payload = { disciplina: 'Contabilidade Geral', durationSeconds: 1200 };

  const submission = new StudySessionSubmission(payload, sessionId);
  assert.notEqual(readPendingSession(sessionId), null, 'Journal deve existir logo apos instanciacao');

  // 1. Falha de rede: nao expurga o journal
  globalThis.fetch = async () => { throw new Error('Offline'); };
  await assert.rejects(submission.send());
  assert.notEqual(readPendingSession(sessionId), null, 'Journal deve ser mantido apos falha de rede');

  // 2. Erro 500 do servidor: nao expurga o journal
  globalThis.fetch = async () => jsonResponse({ error: 'Server error' }, 500);
  await assert.rejects(submission.send());
  assert.notEqual(readPendingSession(sessionId), null, 'Journal deve ser mantido apos 500');

  // 3. Conflito 409: nao expurga o journal automaticamente
  globalThis.fetch = async () => jsonResponse({ message: 'Conflict' }, 409);
  await assert.rejects(submission.send());
  assert.notEqual(readPendingSession(sessionId), null, 'Journal deve ser mantido apos 409 para auditoria/conciliacao');

  // 4. Descarte explicito pelo usuario
  discardPendingSession(sessionId);
  assert.equal(readPendingSession(sessionId), null, 'Descarte explicito deve expurgar o journal');
});

test('FS-01A (Achado E): Validacao estrita de resposta 200 rejeita corpo vazio, formato nao-JSON, sessionId divergente ou status invalido', async () => {
  const sessionId = 'study-strict-http-e';
  const payload = { disciplina: 'Direito Constitucional', durationSeconds: 900 };

  // Subcaso 1: HTTP 200 com corpo vazio
  {
    globalThis.fetch = async () => new Response('', { status: 200 });
    const sub = new StudySessionSubmission(payload, sessionId);
    await assert.rejects(
      sub.send(),
      (err) => err instanceof StudySessionError && /corpo vazio|formato não-JSON/i.test(err.message)
    );
    assert.equal(sub.confirmed, false);
    assert.notEqual(readPendingSession(sessionId), null);
    discardPendingSession(sessionId);
  }

  // Subcaso 2: HTTP 200 com HTML de proxy/gateway (formato nao-JSON)
  {
    globalThis.fetch = async () =>
      new Response('<html><body>502 Bad Gateway masquerading as 200</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    const sub = new StudySessionSubmission(payload, sessionId);
    await assert.rejects(
      sub.send(),
      (err) => err instanceof StudySessionError && /corpo vazio|formato não-JSON/i.test(err.message)
    );
    assert.equal(sub.confirmed, false);
    assert.notEqual(readPendingSession(sessionId), null);
    discardPendingSession(sessionId);
  }

  // Subcaso 3: HTTP 200 com sessionId divergente
  {
    globalThis.fetch = async () =>
      jsonResponse({ sessionId: 'study-different-id', status: 'RECORDED' }, 200);
    const sub = new StudySessionSubmission(payload, sessionId);
    await assert.rejects(
      sub.send(),
      (err) => err instanceof StudySessionError && /diverge da enviada/i.test(err.message)
    );
    assert.equal(sub.confirmed, false);
    assert.notEqual(readPendingSession(sessionId), null);
    discardPendingSession(sessionId);
  }

  // Subcaso 4: HTTP 200 com status nao-RECORDED
  {
    globalThis.fetch = async () =>
      jsonResponse({ sessionId, status: 'QUEUED' }, 200);
    const sub = new StudySessionSubmission(payload, sessionId);
    await assert.rejects(
      sub.send(),
      (err) => err instanceof StudySessionError && /status de gravação inesperado/i.test(err.message)
    );
    assert.equal(sub.confirmed, false);
    assert.notEqual(readPendingSession(sessionId), null);
    discardPendingSession(sessionId);
  }

  // Subcaso 5: HTTP 200 valido com RECORDED e sessionId identico -> sucesso confirmado e journal limpo
  {
    globalThis.fetch = async () =>
      jsonResponse({ sessionId, status: 'RECORDED' }, 200);
    const sub = new StudySessionSubmission(payload, sessionId);
    const result = await sub.send();
    assert.equal(sub.confirmed, true);
    assert.equal(result.status, 'RECORDED');
    assert.equal(readPendingSession(sessionId), null);
  }
});

test('FS-01A: Distinção rigorosa de durabilidade (DURABLE vs MEMORY_ONLY) e hasAttemptedSend', async () => {
  const sessionId = 'study-durability-check';
  const payload = { disciplina: 'Direito Civil', durationSeconds: 600 };

  // 1. Em ambiente normal com storage funcional -> DURABLE
  const subDurable = new StudySessionSubmission(payload, sessionId);
  assert.equal(subDurable.storageState, 'DURABLE');
  assert.equal(subDurable.isDurable, true);
  assert.equal(subDurable.hasAttemptedSend, false);

  // 2. Simula QuotaExceededError no storage -> MEMORY_ONLY
  const origSetItem = globalThis.sessionStorage.setItem;
  try {
    globalThis.sessionStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    const detail = savePendingSessionDetailed('study-quota-mem-only', '{"test":1}');
    assert.equal(detail.success, false);
    assert.equal(detail.state, 'MEMORY_ONLY');
    assert.equal(detail.isDurable, false);
    assert.match(detail.warning, /armazenamento local.*memória volátil/i);

    const subMem = new StudySessionSubmission(payload, 'study-quota-mem-sub');
    assert.equal(subMem.storageState, 'MEMORY_ONLY');
    assert.equal(subMem.isDurable, false);
    assert.ok(subMem.storageWarning);

    // Falha de rede quando em MEMORY_ONLY deve advertir claramente contra reload
    globalThis.fetch = async () => { throw new Error('Network offline'); };
    await assert.rejects(
      subMem.send(),
      (err) => err instanceof StudySessionError && /ATENÇÃO: o armazenamento local.*NÃO recarregue a página/i.test(err.message)
    );
    assert.equal(subMem.hasAttemptedSend, true);
  } finally {
    globalThis.sessionStorage.setItem = origSetItem;
  }

  // 3. Falha de rede quando em DURABLE declara que a operação foi salva localmente
  globalThis.fetch = async () => { throw new Error('Network offline'); };
  await assert.rejects(
    subDurable.send(),
    (err) => err instanceof StudySessionError && /salva localmente no navegador e pode ser reenviada/i.test(err.message)
  );
  assert.equal(subDurable.hasAttemptedSend, true);

  discardPendingSession(sessionId);
});

test('FS-01A: Nao sobrescrever silenciosamente um journal invalido ou corrompido existente', () => {
  const sessionId = 'study-corrupt-preservation';
  const prefix = 'fiscalstudy:study_session:v1:';

  // Grava entrada manifestamente corrompida / inválida no storage
  globalThis.sessionStorage.setItem(prefix + sessionId, 'CORRUPTED_NON_JSON_{{');

  // Verifica inspeção
  const insp = inspectPendingSession(sessionId);
  assert.equal(insp.exists, true);
  assert.equal(insp.isCorrupted, true);

  // Tentativa de salvar nova sessão sob o mesmo ID não deve sobrescrever
  const saveRes = savePendingSessionDetailed(sessionId, '{"sessionId":"study-corrupt-preservation","disciplina":"TI"}');
  assert.equal(saveRes.success, false);
  assert.equal(saveRes.state, 'CORRUPTED_PRESERVED');
  assert.equal(saveRes.isDurable, false);
  assert.match(saveRes.warning, /Journal local existente está corrompido.*preservado para auditoria/i);

  // Comprova que o registro bruto corrompido no storage NÃO foi alterado
  assert.equal(globalThis.sessionStorage.getItem(prefix + sessionId), 'CORRUPTED_NON_JSON_{{');

  // Descarte explícito pelo usuário expurga
  discardPendingSession(sessionId);
  assert.equal(globalThis.sessionStorage.getItem(prefix + sessionId), null);
});

test('FS-01A (Achado 1 - Test A): Falha de envio -> reload -> restaura SENT_UNCONFIRMED e impede descarte silencioso', async () => {
  const sessionId = 'study-reload-recovery-01';
  const payload = { sessionId, disciplina: 'Direito Tributário', tempoSegundos: 1200 };
  const sub = new StudySessionSubmission(payload, sessionId);
  assert.equal(sub.lifecycleState, 'PREPARED');

  // Simula falha de envio de rede
  globalThis.fetch = async () => { throw new Error('Network timeout'); };
  await assert.rejects(sub.send());
  assert.equal(sub.hasAttemptedSend, true);
  assert.equal(sub.lifecycleState, 'SENT_UNCONFIRMED');

  // Simula reload da página: instância anterior em memória é perdida, recria via fromJournal
  const recovered = StudySessionSubmission.fromJournal(sessionId);
  assert.ok(recovered);
  assert.equal(recovered.sessionId, sessionId);
  assert.equal(recovered.hasAttemptedSend, true);
  assert.equal(recovered.lifecycleState, 'SENT_UNCONFIRMED');

  // Continuação sem confirmação deve exigir confirmação explícita
  const decision = evaluateContinuationDecision(recovered, sessionId);
  assert.equal(decision.canProceedSilently, false);
  assert.equal(decision.requiresExplicitConfirmation, true);
  assert.equal(decision.lifecycleState, 'SENT_UNCONFIRMED');

  // Descarte consciente explícito autorizado pelo usuário
  const discardResult = executeConsciousDiscard(sessionId);
  assert.equal(discardResult.discarded, true);
  assert.equal(discardResult.lifecycleState, 'DISCARDED_BY_USER');
  assert.equal(inspectPendingSession(sessionId).exists, false);
});

test('FS-01A (Achado 2 - Test B): Sobrescrita de journal com payload divergente e bloqueada preservando dados anteriores', async () => {
  const sessionId = 'study-divergent-payload-02';
  const payloadA = { sessionId, disciplina: 'Contabilidade', questoesRespondidas: 10 };
  const subA = new StudySessionSubmission(payloadA, sessionId);
  assert.equal(subA.storageState, 'DURABLE');

  // Tentativa de instanciar nova submissão com mesmo sessionId e payload divergente
  const payloadB = { sessionId, disciplina: 'Contabilidade', questoesRespondidas: 25 };
  const subB = new StudySessionSubmission(payloadB, sessionId);
  assert.equal(subB.storageState, 'DIVERGENT_PAYLOAD_PRESERVED');
  assert.equal(subB.isDurable, false);
  assert.match(subB.storageWarning, /Conflito de payload no journal/i);

  // Journal no storage ainda retém payload A intacto
  const entry = readPendingJournalEntry(sessionId);
  assert.ok(entry);
  assert.equal(entry.serializedBody, JSON.stringify(payloadA));

  // Tentativa de send() da submissão B rejeita imediatamente com 409 Conflict sem chamar a rede
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return jsonResponse({ status: 'RECORDED' });
  };

  await assert.rejects(
    subB.send(),
    (err) => err instanceof StudySessionError && err.status === 409 && /Conflito local de journal/i.test(err.message)
  );
  assert.equal(fetchCalled, false, 'Fetch não deve ter sido chamado para envio com payload conflitante');

  discardPendingSession(sessionId);
});

test('FS-01A (Test C): Safe retry de operacao identica com confirmacao RECORDED limpa o journal', async () => {
  const sessionId = 'study-safe-retry-03';
  const payload = { sessionId, disciplina: 'Legislação Tributária', tempoSegundos: 1800 };
  const sub = new StudySessionSubmission(payload, sessionId);

  // 1ª tentativa falha
  globalThis.fetch = async () => { throw new Error('503 Service Unavailable'); };
  await assert.rejects(sub.send());
  assert.equal(sub.lifecycleState, 'SENT_UNCONFIRMED');
  assert.equal(inspectPendingSession(sessionId).exists, true);

  // 2ª tentativa (retry com mesmo payload): servidor agora responde 200 RECORDED
  globalThis.fetch = async () => jsonResponse({
    status: 'RECORDED',
    sessionId,
    recordedAt: '2026-10-31T20:00:00Z',
    duracaoSegundos: 1800
  });

  const res = await sub.send();
  assert.equal(res.status, 'RECORDED');
  assert.equal(sub.confirmed, true);
  assert.equal(sub.lifecycleState, 'CONFIRMED');

  // Journal é limpo após confirmação
  assert.equal(inspectPendingSession(sessionId).exists, false);
});

test('FS-01A (Test D): Journal legado sem metadado lifecycleState adota tratamento conservador SENT_UNCONFIRMED', () => {
  const sessionId = 'study-legacy-journal-04';
  const prefix = 'fiscalstudy:study_session:v1:';
  const legacyData = {
    version: 1,
    sessionId,
    serializedBody: JSON.stringify({ sessionId, disciplina: 'Auditoria' }),
    // Sem campo lifecycleState propositalmente
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 3600000
  };

  globalThis.sessionStorage.setItem(prefix + sessionId, JSON.stringify(legacyData));

  // readPendingSession aplica fallback seguro
  const pending = readPendingSession(sessionId);
  assert.ok(pending);
  assert.equal(pending.lifecycleState, 'SENT_UNCONFIRMED');

  // fromJournal restaura como SENT_UNCONFIRMED
  const recovered = StudySessionSubmission.fromJournal(sessionId);
  assert.ok(recovered);
  assert.equal(recovered.lifecycleState, 'SENT_UNCONFIRMED');
  assert.equal(recovered.hasAttemptedSend, true);

  // evaluateContinuationDecision exige confirmação explícita
  const decision = evaluateContinuationDecision(recovered, sessionId);
  assert.equal(decision.canProceedSilently, false);
  assert.equal(decision.requiresExplicitConfirmation, true);

  discardPendingSession(sessionId);
});

test('FS-01A (Test E): Falha de storage (MEMORY_ONLY) emite warning claro e nao promete recuperacao apos reload', async () => {
  const sessionId = 'study-storage-failure-05';
  const origSetItem = globalThis.sessionStorage.setItem;
  try {
    globalThis.sessionStorage.setItem = () => { throw new Error('QuotaExceeded'); };

    const payload = { sessionId, disciplina: 'Direito Constitucional' };
    const sub = new StudySessionSubmission(payload, sessionId);
    assert.equal(sub.storageState, 'MEMORY_ONLY');
    assert.equal(sub.isDurable, false);
    assert.match(sub.storageWarning, /cota excedida ou restrição.*não será recuperada após recarregar a página/i);

    // Falha de rede emite aviso enfático de que a operação está mantida apenas em memória
    globalThis.fetch = async () => { throw new Error('Network error'); };
    await assert.rejects(
      sub.send(),
      (err) => err instanceof StudySessionError && /ATENÇÃO: o armazenamento local.*NÃO recarregue a página/i.test(err.message)
    );

    // Simulando reload: como não houve persistência durável, fromJournal retorna null
    const recovered = StudySessionSubmission.fromJournal(sessionId);
    assert.equal(recovered, null);
  } finally {
    globalThis.sessionStorage.setItem = origSetItem;
  }
});

test('FS-01A (Gate Final 1): Transição monotônica impede regressão de SENT_UNCONFIRMED para PREPARED em nova instância', async () => {
  const sessionId = 'study-monotonic-gate-01';
  const payload = { sessionId, disciplina: 'Direito Tributário', tempoSegundos: 1500 };

  // 1. Criação da operação A
  const subA = new StudySessionSubmission(payload, sessionId);
  assert.equal(subA.lifecycleState, 'PREPARED');

  // 2. Envio com resultado incerto (falha de rede)
  globalThis.fetch = async () => { throw new Error('Network timeout'); };
  await assert.rejects(subA.send());
  assert.equal(subA.lifecycleState, 'SENT_UNCONFIRMED');

  const journalAfterSend = readPendingJournalEntry(sessionId);
  assert.ok(journalAfterSend);
  assert.equal(journalAfterSend.lifecycleState, 'SENT_UNCONFIRMED');

  // 3. Nova instância criada com mesmo ID e mesmo payload
  const subDuplicate = new StudySessionSubmission(payload, sessionId);

  // 4. Verificação de que o journal permanece SENT_UNCONFIRMED (não foi rebaixado para PREPARED)
  const journalAfterDuplicate = readPendingJournalEntry(sessionId);
  assert.ok(journalAfterDuplicate);
  assert.equal(journalAfterDuplicate.lifecycleState, 'SENT_UNCONFIRMED', 'Journal NÃO pode ser rebaixado para PREPARED');
  assert.equal(subDuplicate.lifecycleState, 'SENT_UNCONFIRMED');
  assert.equal(subDuplicate.hasAttemptedSend, true);

  // 5. Recuperação após reload com bloqueio de descarte silencioso
  const recovered = StudySessionSubmission.fromJournal(sessionId);
  assert.ok(recovered);
  assert.equal(recovered.lifecycleState, 'SENT_UNCONFIRMED');

  const decision = evaluateContinuationDecision(recovered, sessionId);
  assert.equal(decision.canProceedSilently, false);
  assert.equal(decision.requiresExplicitConfirmation, true);
  assert.equal(decision.reason, 'SENT_UNCONFIRMED');

  discardPendingSession(sessionId);
});

test('FS-01A (Gate Final 2): Impedir descarte silencioso de journal corrompido e diferenciar os 4 estados de journal', () => {
  const prefix = 'fiscalstudy:study_session:v1:';

  // 1. Journal comprovadamente inexistente
  const decisionInexistent = evaluateContinuationDecision(null, 'session-totally-inexistent');
  assert.equal(decisionInexistent.canProceedSilently, true);
  assert.equal(decisionInexistent.requiresExplicitConfirmation, false);
  assert.equal(decisionInexistent.reason, 'NOT_SENT');

  // 2. Journal válido PREPARED
  const sessionPrepared = 'session-gate-prepared';
  savePendingSessionDetailed(sessionPrepared, JSON.stringify({ sessionId: sessionPrepared, tempo: 100 }), 'PREPARED');
  const decisionPrepared = evaluateContinuationDecision(null, sessionPrepared);
  assert.equal(decisionPrepared.canProceedSilently, true);
  assert.equal(decisionPrepared.requiresExplicitConfirmation, false);
  assert.equal(decisionPrepared.reason, 'NOT_SENT');
  discardPendingSession(sessionPrepared);

  // 3. Journal válido SENT_UNCONFIRMED
  const sessionSent = 'session-gate-sent';
  savePendingSessionDetailed(sessionSent, JSON.stringify({ sessionId: sessionSent, tempo: 100 }), 'SENT_UNCONFIRMED');
  const decisionSent = evaluateContinuationDecision(null, sessionSent);
  assert.equal(decisionSent.canProceedSilently, false);
  assert.equal(decisionSent.requiresExplicitConfirmation, true);
  assert.equal(decisionSent.reason, 'SENT_UNCONFIRMED');
  discardPendingSession(sessionSent);

  // 4. Journal existente, mas corrompido ou de estado desconhecido
  const sessionCorrupted = 'session-gate-corrupted';
  globalThis.sessionStorage.setItem(prefix + sessionCorrupted, '{"version":1,"sessionId":"corrupted",INVALID_JSON');
  
  const decisionCorrupted = evaluateContinuationDecision(null, sessionCorrupted);
  assert.equal(decisionCorrupted.canProceedSilently, false, 'Journal corrompido NÃO pode autorizar continuação silenciosa');
  assert.equal(decisionCorrupted.requiresExplicitConfirmation, true, 'Journal corrompido DEVE exigir confirmação explícita');
  assert.equal(decisionCorrupted.reason, 'CORRUPTED_OR_UNKNOWN');
  assert.match(decisionCorrupted.warningMessage, /Registro local existente está corrompido ou em formato inválido/i);

  // Comprova que o registro corrompido permanece preservado no storage
  assert.equal(globalThis.sessionStorage.getItem(prefix + sessionCorrupted), '{"version":1,"sessionId":"corrupted",INVALID_JSON');

  // Descarte explícito consciente expurga
  executeConsciousDiscard(sessionCorrupted);
  assert.equal(globalThis.sessionStorage.getItem(prefix + sessionCorrupted), null);
});
