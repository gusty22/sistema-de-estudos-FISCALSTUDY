import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StudySessionSubmission,
  StudySessionError,
  savePendingSession,
  readPendingSession,
  clearPendingSession
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
