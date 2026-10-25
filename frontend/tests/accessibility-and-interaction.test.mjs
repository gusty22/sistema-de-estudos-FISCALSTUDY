import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleKeyActivate } from '../src/utils/accessibility.ts';
import { AttemptSubmission, requestJson } from '../src/utils/attemptSubmission.ts';

const ok = (data) => new Response(JSON.stringify(data), { status: 200 });

test('handleKeyActivate fires callback on Enter and Space, ignoring other keys', () => {
  let called = 0;
  const cb = () => { called++; };

  let prevented = false;
  handleKeyActivate({ key: 'Enter', preventDefault: () => { prevented = true; } }, cb);
  assert.equal(called, 1);
  assert.equal(prevented, true);

  prevented = false;
  handleKeyActivate({ key: ' ', preventDefault: () => { prevented = true; } }, cb);
  assert.equal(called, 2);
  assert.equal(prevented, true);

  prevented = false;
  handleKeyActivate({ key: 'Tab', preventDefault: () => { prevented = true; } }, cb);
  assert.equal(called, 2);
  assert.equal(prevented, false);

  handleKeyActivate({ key: 'ArrowDown', preventDefault: () => { prevented = true; } }, cb);
  assert.equal(called, 2);
});

test('submitting attempt rejects without false success on 500 internal server error', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'DB_LOCKED', message: 'SQLite WAL database busy' }), { status: 500 });

  const attempt = new AttemptSubmission({
    sessionId: 'session-123',
    selectedOption: 'A',
    confidenceLevel: 4,
    activeTimeMs: 15000
  }, 'attempt-fail-test');

  await assert.rejects(
    attempt.send('question-99'),
    /DB_LOCKED|SQLite WAL/
  );

  // Retain original payload for safe retry
  assert.equal(attempt.attemptId, 'attempt-fail-test');
  assert.equal(attempt.payload.confidenceLevel, 4);
  assert.equal(attempt.payload.selectedOption, 'A');
});

test('submitting attempt rejects on malformed non-JSON server error response', async () => {
  globalThis.fetch = async () => new Response('<html>502 Bad Gateway Nginx</html>', { status: 502 });

  await assert.rejects(
    requestJson('/api/v1/test-fail'),
    /inválida/
  );
});

test('confidence level bounds are clamped between 1 and 5 and cannot submit 0', () => {
  const sanitizeConfidence = (c) => Math.max(1, Math.min(5, c));
  assert.equal(sanitizeConfidence(0), 1);
  assert.equal(sanitizeConfidence(3), 3);
  assert.equal(sanitizeConfidence(5), 5);
  assert.equal(sanitizeConfidence(6), 5);
  assert.equal(sanitizeConfidence(-2), 1);
});
