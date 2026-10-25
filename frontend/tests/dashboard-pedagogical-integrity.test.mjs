import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQueueActivities,
  getDashboardUIState,
  getCurrentActivity,
  getNextQueueIndex,
  prepareSessionPayload
} from '../src/components/dashboard/dashboardLogic.ts';

test('1. Fila vazia: não injeta disciplinas ou tópicos fictícios', () => {
  const queue = computeQueueActivities(null, null);
  assert.equal(queue.length, 0, 'A fila deve permanecer estritamente vazia quando não há dados');

  // Assegura que nenhum valor artificial existe
  const serialized = JSON.stringify(queue);
  assert.ok(!serialized.includes('default-activity-initial'), 'Não deve conter ID artificial');
  assert.ok(!serialized.includes('Direito Tributário'), 'Não deve injetar Direito Tributário arbitrariamente');
  assert.ok(!serialized.includes('Crédito Tributário'), 'Não deve injetar Crédito Tributário arbitrariamente');
});

test('2. Fila com dados reais de revisão e Robin Hood: mapeia sem inventar dados', () => {
  const realAgenda = {
    hoje: [
      {
        id: 'rev-101',
        disciplina: 'Contabilidade Geral',
        topico: 'Balanço Patrimonial',
        justificativa_pedagogica: 'Erros recentes em simulado',
        estagio_intervencao: 'Intervenção Crítica',
        intervalo_dias: 7
      }
    ]
  };

  const realCycle = {
    blocos: [
      {
        sequenceOrder: 1,
        type: 'EMERGENCIA_ROBIN_HOOD',
        disciplina: 'Legislação Tributária Estadual',
        duracaoMinutos: 40,
        horasTransferidasRobinHood: 2,
        mensagemEuDoPassado: 'Matéria de alto peso no edital'
      }
    ]
  };

  const queue = computeQueueActivities(realAgenda, realCycle);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].discipline, 'Contabilidade Geral');
  assert.equal(queue[0].topic, 'Balanço Patrimonial');
  assert.equal(queue[1].discipline, 'Legislação Tributária Estadual');
  assert.equal(queue[1].type, 'Revisão');
});

test('3. Proteção matemática: getCurrentActivity e getNextQueueIndex nunca geram NaN', () => {
  // Com fila vazia
  const currentEmpty = getCurrentActivity([], 0);
  assert.equal(currentEmpty, undefined);

  const nextIndexEmpty = getNextQueueIndex(0, 0);
  assert.equal(nextIndexEmpty, 0);
  assert.ok(!Number.isNaN(nextIndexEmpty), 'Índice nunca pode ser NaN');

  // Com índice inválido/NaN passado
  const currentNaN = getCurrentActivity([], NaN);
  assert.equal(currentNaN, undefined);

  const nextWithNaN = getNextQueueIndex(NaN, 0);
  assert.equal(nextWithNaN, 0);
  assert.ok(!Number.isNaN(nextWithNaN));

  // Com fila contendo 2 itens reais
  const mockQueue = [
    { id: '1', discipline: 'D1', topic: 'T1', type: 'Questões', reason: 'R1', duration: 30, material: 'M1', strategy: 'S1', pedagogyNote: 'P1' },
    { id: '2', discipline: 'D2', topic: 'T2', type: 'Revisão', reason: 'R2', duration: 20, material: 'M2', strategy: 'S2', pedagogyNote: 'P2' }
  ];

  assert.equal(getCurrentActivity(mockQueue, 0)?.id, '1');
  assert.equal(getCurrentActivity(mockQueue, 1)?.id, '2');
  assert.equal(getCurrentActivity(mockQueue, 2)?.id, '1'); // Ciclo seguro
  assert.equal(getNextQueueIndex(0, mockQueue.length), 1);
  assert.equal(getNextQueueIndex(1, mockQueue.length), 0);
});

test('4. Proteção de sessão: prepareSessionPayload rejeita atividade inexistente', () => {
  const resultUndefined = prepareSessionPayload(undefined, false);
  assert.equal(resultUndefined, null, 'Atividade indefinida não pode gerar payload de sessão');

  const resultIncomplete = prepareSessionPayload({ discipline: '', topic: '' }, false);
  assert.equal(resultIncomplete, null, 'Atividade sem disciplina/tópico não pode gerar sessão');

  const validActivity = {
    id: 'act-1',
    type: 'Revisão',
    discipline: 'Direito Constitucional',
    topic: 'Controle de Constitucionalidade',
    reason: 'Revisão periódica',
    duration: 30,
    material: 'PDF',
    strategy: 'Ativa',
    pedagogyNote: 'Evitar curva de esquecimento'
  };

  const validResult = prepareSessionPayload(validActivity, false);
  assert.ok(validResult !== null);
  assert.equal(validResult.sessionStorageItems.fiscalstudy_session_discipline, 'Direito Constitucional');
  assert.equal(validResult.sessionStorageItems.fiscalstudy_session_topic, 'Controle de Constitucionalidade');
  assert.equal(validResult.sessionStorageItems.fiscalstudy_session_type, 'REVISAO');
  assert.equal(validResult.navigationParams.mode, 'STANDARD');
});

test('5. Estados explícitos de interface do Dashboard', () => {
  // 1. Nenhum concurso selecionado
  assert.equal(
    getDashboardUIState({
      hasActiveConcurso: false,
      isLoading: false,
      loadError: null,
      topicsCount: 0,
      queueActivitiesCount: 0
    }),
    'NO_CONCURSO'
  );

  // 2. Carregando dados
  assert.equal(
    getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: true,
      loadError: null,
      topicsCount: 0,
      queueActivitiesCount: 0
    }),
    'LOADING'
  );

  // 3. Erro de comunicação
  assert.equal(
    getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: '500 Internal Server Error',
      topicsCount: 0,
      queueActivitiesCount: 0
    }),
    'ERROR'
  );

  // 4. Concurso sem edital ou tópicos
  assert.equal(
    getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      topicsCount: 0,
      queueActivitiesCount: 0
    }),
    'NO_EDITAL_TOPICS'
  );

  // 5. Edital disponível, mas sem atividades elegíveis (fila vazia)
  assert.equal(
    getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      topicsCount: 42,
      queueActivitiesCount: 0
    }),
    'NO_ACTIVITIES'
  );

  // 6. Fila com atividades reais
  assert.equal(
    getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      topicsCount: 42,
      queueActivitiesCount: 3
    }),
    'HAS_ACTIVITIES'
  );
});

test('7. Recuperação após carregamento bem-sucedido', () => {
  // Inicialmente em carregamento
  let state = getDashboardUIState({
    hasActiveConcurso: true,
    isLoading: true,
    loadError: null,
    topicsCount: 0,
    queueActivitiesCount: 0
  });
  assert.equal(state, 'LOADING');

  // Transiciona para dados carregados com sucesso
  state = getDashboardUIState({
    hasActiveConcurso: true,
    isLoading: false,
    loadError: null,
    topicsCount: 15,
    queueActivitiesCount: 2
  });
  assert.equal(state, 'HAS_ACTIVITIES');
});
