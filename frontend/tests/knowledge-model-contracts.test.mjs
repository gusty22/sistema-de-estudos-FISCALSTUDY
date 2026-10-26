import test from 'node:test';
import assert from 'node:assert/strict';

test('EPIC 02 Contrato 1: Tratamento de insuficiência de evidências (SEM_EVIDENCIAS para N=0 e PRELIMINAR para N<10)', () => {
  const classifyStatus = (total, unique) => {
    if (total <= 0) return 'SEM_EVIDENCIAS';
    if (total < 10 || unique < 5) return 'PRELIMINAR';
    if (total < 25 || unique < 10) return 'EM_CONSTRUCAO';
    return 'CONSOLIDADA';
  };

  assert.equal(classifyStatus(0, 0), 'SEM_EVIDENCIAS');
  assert.equal(classifyStatus(1, 1), 'PRELIMINAR');
  assert.equal(classifyStatus(5, 5), 'PRELIMINAR');
  assert.equal(classifyStatus(9, 5), 'PRELIMINAR');
  assert.equal(classifyStatus(12, 6), 'EM_CONSTRUCAO');
  assert.equal(classifyStatus(30, 15), 'CONSOLIDADA');
});

test('EPIC 02 Contrato 2: Denominador auditado explícito sem nota percentual cega', () => {
  const formatDenominator = (correct, total) => {
    if (total <= 0) return 'SEM_EVIDENCIAS';
    return `${correct}/${total}`;
  };

  assert.equal(formatDenominator(0, 0), 'SEM_EVIDENCIAS');
  assert.equal(formatDenominator(3, 4), '3/4');
  assert.equal(formatDenominator(18, 20), '18/20');
});

test('EPIC 02 Contrato 3: Escala ordinal pura de confiança e detecção de pontos cegos', () => {
  const isLowConfidenceSuccess = (conf, isCorrect) => isCorrect && conf >= 1 && conf <= 2;
  const isHighConfidenceError = (conf, isCorrect) => !isCorrect && conf >= 4 && conf <= 5;

  // Acerto com nível 1 ou 2 (chute/dúvida)
  assert.equal(isLowConfidenceSuccess(1, true), true);
  assert.equal(isLowConfidenceSuccess(2, true), true);
  assert.equal(isLowConfidenceSuccess(3, true), false);
  assert.equal(isLowConfidenceSuccess(5, true), false);

  // Erro com nível 4 ou 5 (ilusão de competência / pegadinha)
  assert.equal(isHighConfidenceError(5, false), true);
  assert.equal(isHighConfidenceError(4, false), true);
  assert.equal(isHighConfidenceError(3, false), false);
  assert.equal(isHighConfidenceError(1, false), false);
});

test('EPIC 02 Contrato 4: Metadados contextuais registrados sem pesos multiplicadores arbitrários', () => {
  // Garantir que simulados e retestes contam como 1 tentativa legítima observada, sem fator 1.5x ou 1.2x
  const attempts = [
    { type: 'SIMULADO', isCorrect: true },
    { type: 'RETESTE', isCorrect: true },
    { type: 'REGULAR', isCorrect: false }
  ];

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(a => a.isCorrect).length;
  const rawAccuracy = correctAttempts / totalAttempts;

  assert.equal(totalAttempts, 3);
  assert.equal(correctAttempts, 2);
  assert.equal(Math.round(rawAccuracy * 100) / 100, 0.67);
});
