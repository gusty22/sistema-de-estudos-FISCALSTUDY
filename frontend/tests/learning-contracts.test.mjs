import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AttemptSubmission, annotateAttempt, requestJson } from '../src/utils/attemptSubmission.ts';
import { normalizeStudyPreferences, saveStudyPreferences } from '../src/utils/studyPreferences.ts';

const ok = data => new Response(JSON.stringify(data), { status: 200 });

test('a transport retry preserves attempt identity and the original payload', async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: init.body });
    if (sent.length === 1) throw new Error('connection lost after server write');
    return ok({ attemptId: 'stable-id', isCorrect: false });
  };
  const attempt = new AttemptSubmission({ sessionId: 's', selectedOption: 'B', activeTimeMs: 12000 }, 'stable-id');
  await assert.rejects(attempt.send('question/1'));
  assert.equal((await attempt.send('question/1')).attemptId, 'stable-id');
  assert.equal(sent[0].body, sent[1].body);
  assert.match(sent[1].url, /question%2F1/);
  assert.equal(JSON.parse(sent[1].body).activeTimeMs, 12000);
  assert.equal(new AttemptSubmission({}, 'new-attempt').attemptId, 'new-attempt');
});

test('concurrent submissions share a single in-flight request', async () => {
  let calls = 0;
  let finish;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const attempt = new AttemptSubmission({}, 'id');
  const first = attempt.send('q');
  const second = attempt.send('q');
  assert.equal(first, second);
  finish(ok({ attemptId: 'id' }));
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('HTTP failure never becomes a success result', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'PROJECTION_PENDING' }), { status: 503 });
  await assert.rejects(requestJson('/test'), /PROJECTION_PENDING/);
  globalThis.fetch = async () => new Response('<html>proxy error</html>', { status: 502 });
  await assert.rejects(requestJson('/test'), /inválida/);
});

test('post-answer annotations target the confirmed attempt, not a new answer', async () => {
  let sent;
  globalThis.fetch = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return ok({ status: 'RECORDED' }); };
  await annotateAttempt('q', 'attempt-id', 'session-id', 'SABIA_MAS_CONFUNDI', 'annotation-id');
  assert.equal(sent.url, '/api/v1/questions/q/attempts/attempt-id/annotations');
  assert.deepEqual(sent.body, { annotationId: 'annotation-id', sessionId: 'session-id', causaErro: 'SABIA_MAS_CONFUNDI' });
  assert.equal(sent.body.selectedOption, undefined);
});

test('preferences normalize supported choices without inventing a learning profile', () => {
  const prefs = normalizeStudyPreferences({ perfilEstudos: { tema: 'CALMA_NOTURNA', tamanhoFonte: 'GRANDE', duracaoSessaoMinutos: 75 }, objetivos: { metaQuestoesDiarias: 40 } });
  assert.deepEqual(prefs, { theme: 'night', questionFont: '1.18rem', sessionMinutes: 75, dailyQuestions: 40 });
  assert.equal(normalizeStudyPreferences({ perfilEstudos: { duracaoSessaoMinutos: -3 } }).sessionMinutes, 50);
  assert.equal(normalizeStudyPreferences({ objetivos: { metaQuestoesDiarias: 900 } }).dailyQuestions, 150);
});

test('only confirmed persisted preferences update the running UI', async () => {
  const changes = [];
  globalThis.document = { documentElement: { style: { setProperty: (...v) => changes.push(v) } } };
  globalThis.localStorage = { setItem: () => {} };
  globalThis.window = new EventTarget();
  let event;
  window.addEventListener('fiscalstudy:preferences-updated', e => { event = e.detail; });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'write failed' }), { status: 500 });
  await assert.rejects(saveStudyPreferences({}), /write failed/);
  assert.equal(event, undefined);
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? ok({ status: 'saved' }) : ok({ perfilEstudos: { tema: 'PAPEL_CLARO', tamanhoFonte: 'PADRAO', duracaoSessaoMinutos: 25 } });
  await saveStudyPreferences({});
  assert.equal(calls, 2);
  assert.equal(event.theme, 'paper');
  assert.equal(event.sessionMinutes, 25);
  assert.deepEqual(changes, [['--question-reading-size', '1rem']]);
});

import { setIngestionToken, ingestionFetch } from '../src/utils/ingestionAccess.ts';
test('ingestion authorization stays in memory and is restricted to its API', async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({url, headers: new Headers(init.headers)}); return ok({}); };
  setIngestionToken('local-secret');
  await ingestionFetch('/api/v1/ingestion/sessions', {method:'POST'});
  await ingestionFetch('https://example.invalid/ingestion');
  await ingestionFetch('/api/v1/questions');
  assert.equal(sent[0].headers.get('X-FiscalStudy-Admin-Token'), 'local-secret');
  assert.equal(sent[1].headers.has('X-FiscalStudy-Admin-Token'), false);
  assert.equal(sent[2].headers.has('X-FiscalStudy-Admin-Token'), false);
  setIngestionToken('');
  await ingestionFetch('/api/v1/ingestion/sessions');
  assert.equal(sent[3].headers.has('X-FiscalStudy-Admin-Token'), false);
});

test('annotateAttempt handles HTTP 409 conflict and propagates descriptive error without mutating original attempt', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Conflito de anotação concorrente' }), { status: 409 });
  await assert.rejects(
    annotateAttempt('q-test', 'attempt-123', 'sess-123', 'CONCEITO_CONFUNDIDO'),
    /Conflito de anotação concorrente/
  );

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Tentativa não encontrada' }), { status: 404 });
  await assert.rejects(
    annotateAttempt('q-test', 'attempt-inexistente', 'sess-123', 'PEGADINHA'),
    /Tentativa não encontrada/
  );
});
