import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Polyfill de sessionStorage para ambiente Node
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

// Importação das funções puras do dashboardLogic
const {
  extractLatestEligibleHandoff,
  prepareHandoffResumptionPayload,
  checkResumptionSafety,
  getDashboardUIState,
  computeQueueActivities,
  createDashboardLoadCoordinator
} = await import('../src/components/dashboard/dashboardLogic.ts');

describe('FS-02A: Extração Segura e Determinística do Handoff', () => {
  test('T01: Extrai o handoff elegível da sessão mais recente do concurso ativo', () => {
    const sessions = [
      {
        sessionId: 'sess-1',
        concursoId: 'conc-sefaz',
        disciplina: 'Direito Tributário',
        topicoId: 'Imunidades',
        nextSessionHandoff: 'Revisar súmulas vinculantes sobre IPTU',
        occurredAt: '2026-10-30T10:00:00Z'
      },
      {
        sessionId: 'sess-2',
        concursoId: 'conc-sefaz',
        disciplina: 'Direito Tributário',
        topicoId: 'Princípio da Anterioridade',
        nextSessionHandoff: 'Resolver 10 questões da FGV sobre noventena',
        occurredAt: '2026-10-31T15:30:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-sefaz');
    assert.ok(handoff);
    assert.equal(handoff.sessionId, 'sess-2');
    assert.equal(handoff.disciplina, 'Direito Tributário');
    assert.equal(handoff.topicoId, 'Princípio da Anterioridade');
    assert.equal(handoff.nextSessionHandoff, 'Resolver 10 questões da FGV sobre noventena');
    assert.equal(handoff.occurredAt, '2026-10-31T15:30:00Z');
    assert.equal(handoff.isFromLatestSession, true);
  });

  test('T02: Retorna null quando nenhuma sessão possui anotação de handoff', () => {
    const sessions = [
      {
        sessionId: 'sess-1',
        concursoId: 'conc-sefaz',
        disciplina: 'Contabilidade',
        nextSessionHandoff: null,
        occurredAt: '2026-10-30T10:00:00Z'
      },
      {
        sessionId: 'sess-2',
        concursoId: 'conc-sefaz',
        disciplina: 'Contabilidade',
        nextSessionHandoff: '   ', // Somente espaços
        occurredAt: '2026-10-31T10:00:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-sefaz');
    assert.equal(handoff, null);
  });

  test('T03: Garante ordenação cronológica mesmo quando a lista chega fora de ordem', () => {
    // Array com sessão mais antiga no índice 0 e mais nova no índice 1
    const sessions = [
      {
        sessionId: 'sess-antiga',
        concursoId: 'conc-auditor',
        disciplina: 'Auditoria',
        nextSessionHandoff: 'Recado antigo',
        occurredAt: '2026-10-25T10:00:00Z'
      },
      {
        sessionId: 'sess-recente',
        concursoId: 'conc-auditor',
        disciplina: 'Auditoria',
        nextSessionHandoff: 'Recado mais recente e relevante',
        occurredAt: '2026-10-31T20:00:00Z'
      },
      {
        sessionId: 'sess-meio',
        concursoId: 'conc-auditor',
        disciplina: 'Auditoria',
        nextSessionHandoff: 'Recado intermediário',
        occurredAt: '2026-10-28T12:00:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-auditor');
    assert.ok(handoff);
    assert.equal(handoff.sessionId, 'sess-recente');
    assert.equal(handoff.nextSessionHandoff, 'Recado mais recente e relevante');
  });

  test('T04: Segregação estrita por concurso (nunca vaza recado de outro concurso)', () => {
    const sessions = [
      {
        sessionId: 'sess-outro',
        concursoId: 'conc-outro-orgao',
        disciplina: 'Direito Penal',
        nextSessionHandoff: 'Estudar crimes contra ordem tributária',
        occurredAt: '2026-11-01T08:00:00Z'
      },
      {
        sessionId: 'sess-ativo',
        concursoId: 'conc-sefaz',
        disciplina: 'Legislação Tributária',
        nextSessionHandoff: 'Revisar alíquotas internas de ICMS',
        occurredAt: '2026-10-31T10:00:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-sefaz');
    assert.ok(handoff);
    assert.equal(handoff.concursoId, 'conc-sefaz');
    assert.equal(handoff.disciplina, 'Legislação Tributária');
    assert.equal(handoff.nextSessionHandoff, 'Revisar alíquotas internas de ICMS');
  });

  test('T05: Trata IDs numéricos e strings de forma compatível e defensiva', () => {
    const sessions = [
      {
        sessionId: 'sess-num',
        concursoId: 532, // numérico
        disciplina: 'Economia',
        nextSessionHandoff: 'Revisar elasticidade-preço da demanda',
        occurredAt: '2026-10-31T10:00:00Z'
      }
    ];

    // Consulta passando string '532'
    const handoffStringQuery = extractLatestEligibleHandoff(sessions, '532');
    assert.ok(handoffStringQuery);
    assert.equal(handoffStringQuery.disciplina, 'Economia');

    // Consulta passando número 532
    const handoffNumQuery = extractLatestEligibleHandoff(sessions, 532);
    assert.ok(handoffNumQuery);
    assert.equal(handoffNumQuery.disciplina, 'Economia');
  });

  test('T06: Retorna null quando activeConcursoId é nulo, indefinido ou vazio', () => {
    const sessions = [
      {
        sessionId: 'sess-1',
        concursoId: 'conc-1',
        disciplina: 'Direito Administrativo',
        nextSessionHandoff: 'Atos administrativos',
        occurredAt: '2026-10-31T10:00:00Z'
      }
    ];

    assert.equal(extractLatestEligibleHandoff(sessions, null), null);
    assert.equal(extractLatestEligibleHandoff(sessions, undefined), null);
    assert.equal(extractLatestEligibleHandoff(sessions, ''), null);
    assert.equal(extractLatestEligibleHandoff(sessions, '   '), null);
  });

  test('T07: Trata datas inválidas, ausentes ou malformadas sem quebrar e sem inventar dados', () => {
    const sessions = [
      {
        sessionId: 'sess-invalida',
        concursoId: 'conc-1',
        disciplina: 'TI',
        nextSessionHandoff: 'Anotação sem data válida',
        occurredAt: 'data_invalida_nao_parseavel'
      },
      {
        sessionId: 'sess-sem-data',
        concursoId: 'conc-1',
        disciplina: 'TI',
        nextSessionHandoff: 'Anotação com data nula',
        occurredAt: null
      },
      {
        sessionId: 'sess-valida',
        concursoId: 'conc-1',
        disciplina: 'TI',
        nextSessionHandoff: 'Anotação com data ISO válida',
        occurredAt: '2026-10-30T10:00:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-1');
    assert.ok(handoff);
    assert.equal(handoff.sessionId, 'sess-valida');
    assert.equal(handoff.nextSessionHandoff, 'Anotação com data ISO válida');
  });

  test('T08: Identifica se o handoff provém da última sessão ou de uma sessão anterior', () => {
    const sessions = [
      {
        sessionId: 'sess-handoff',
        concursoId: 'conc-1',
        disciplina: 'Direito Tributário',
        nextSessionHandoff: 'Recado da sessão 1',
        occurredAt: '2026-10-30T10:00:00Z'
      },
      {
        // Sessão mais recente, mas o estudante encerrou sem deixar recado
        sessionId: 'sess-recente-sem-recado',
        concursoId: 'conc-1',
        disciplina: 'Português',
        nextSessionHandoff: null,
        occurredAt: '2026-10-31T18:00:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-1');
    assert.ok(handoff);
    assert.equal(handoff.sessionId, 'sess-handoff');
    // Deve indicar false porque a sessão mais recente geral foi a sess-recente-sem-recado
    assert.equal(handoff.isFromLatestSession, false);
  });
});

describe('FS-02A / FS-02B: Resiliência de Identidade e Preparação da Sessão', () => {
  test('T09: prepareHandoffResumptionPayload gera nova identidade e injeta fiscalstudy_active_session_id', () => {
    const handoff = {
      sessionId: 'sess-historica-123',
      concursoId: 'conc-sefaz',
      disciplina: 'Direito Tributário',
      topicoId: 'Imunidades Tributárias',
      nextSessionHandoff: 'Continuar resolvendo questões sobre imunidade recíproca',
      occurredAt: '2026-10-31T10:00:00Z',
      isFromLatestSession: true
    };

    const res = prepareHandoffResumptionPayload(handoff);
    assert.equal(res.safe, true);
    assert.ok(res.newSessionId.startsWith('study-') || res.newSessionId.startsWith('session-'));
    assert.notEqual(res.newSessionId, 'sess-historica-123', 'NUNCA deve reutilizar o sessionId da sessão concluída');

    // Chaves canônicas verificadas
    assert.equal(res.sessionStorageItems.fiscalstudy_active_session_id, res.newSessionId);
    assert.equal(res.sessionStorageItems.fiscalstudy_session_discipline, 'Direito Tributário');
    assert.equal(res.sessionStorageItems.fiscalstudy_session_topic, 'Imunidades Tributárias');
    assert.equal(res.sessionStorageItems.fiscalstudy_session_objective, 'Continuar resolvendo questões sobre imunidade recíproca');
    assert.equal(res.sessionStorageItems.fiscalstudy_session_type, 'ESTUDO_ORIENTADO');

    // Parâmetros de navegação
    assert.equal(res.navigationParams.disciplina, 'Direito Tributário');
    assert.equal(res.navigationParams.assunto, 'Imunidades Tributárias');
  });

  test('T10: checkResumptionSafety bloqueia quando há operação incerta (SENT_UNCONFIRMED) no storage', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'active-uncertain-999';

    // Simula journal FS-01 pendente em SENT_UNCONFIRMED
    const journalEntry = {
      version: 1,
      sessionId: activeId,
      serializedBody: JSON.stringify({ sessionId: activeId, disciplina: 'Direito' }),
      lifecycleState: 'SENT_UNCONFIRMED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    };
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + activeId, JSON.stringify(journalEntry));

    const safety = checkResumptionSafety(activeId);
    assert.equal(safety.safe, false);
    assert.equal(safety.reason, 'SENT_UNCONFIRMED_PENDING');
    assert.ok(safety.warning.includes('pendente'));

    // Verifica que prepareHandoffResumptionPayload com checkSafety respeita a trava
    const handoff = {
      sessionId: 'sess-old',
      concursoId: 'conc-1',
      disciplina: 'Direito',
      nextSessionHandoff: 'Recado',
      isFromLatestSession: true
    };
    const prep = prepareHandoffResumptionPayload(handoff, { checkSafety: true, existingActiveSessionId: activeId });
    assert.equal(prep.safe, false);
    assert.equal(prep.reason, 'SENT_UNCONFIRMED_PENDING');
  });

  test('T11: checkResumptionSafety bloqueia quando há journal corrompido no storage', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'active-corrupted-888';

    // JSON corrompido
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + activeId, '{ invalid json syntax');

    const safety = checkResumptionSafety(activeId);
    assert.equal(safety.safe, false);
    assert.equal(safety.reason, 'CORRUPTED_JOURNAL');
  });
});

describe('FS-02C: Confiabilidade da Fila e Diferenciação de Cold Start', () => {
  test('T12: Falha na agenda ou ciclo com fila vazia NÃO transiciona para NO_ACTIVITIES (evita falso estado vazio)', () => {
    // Cenário: Concurso com edital e tópicos, mas a requisição da agenda falhou (HTTP 500)
    const state = getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      editaisCount: 1,
      topicsCount: 50,
      queueActivitiesCount: 0,
      isAgendaUnavailable: true, // Agenda falhou!
      isCycleUnavailable: false
    });

    assert.notEqual(state, 'NO_ACTIVITIES', 'NUNCA deve fingir que as atividades acabaram quando a agenda falhou');
    assert.equal(state, 'PARTIAL_UNAVAILABLE');
  });

  test('T13: Fila comprovadamente vazia após carregamento bem-sucedido retorna NO_ACTIVITIES legítimo', () => {
    const state = getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      editaisCount: 1,
      topicsCount: 50,
      queueActivitiesCount: 0,
      isAgendaUnavailable: false,
      isCycleUnavailable: false
    });

    assert.equal(state, 'NO_ACTIVITIES');
  });

  test('T14: Falha na agenda mas ciclo disponível com atividades retorna HAS_ACTIVITIES', () => {
    // Agenda falhou, mas o ciclo Robin Hood tem blocos disponíveis
    const state = getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      editaisCount: 1,
      topicsCount: 50,
      queueActivitiesCount: 2, // Atividades presentes do ciclo
      isAgendaUnavailable: true,
      isCycleUnavailable: false
    });

    assert.equal(state, 'HAS_ACTIVITIES');
  });

  test('T15: Preserva estritamente estados estruturais: NO_CONCURSO, NO_EDITAL, NO_TOPICS_IN_EDITAL, LOADING, ERROR', () => {
    assert.equal(getDashboardUIState({ hasActiveConcurso: false, isLoading: false, loadError: null, topicsCount: 0, queueActivitiesCount: 0 }), 'NO_CONCURSO');
    assert.equal(getDashboardUIState({ hasActiveConcurso: true, isLoading: true, loadError: null, topicsCount: 0, queueActivitiesCount: 0 }), 'LOADING');
    assert.equal(getDashboardUIState({ hasActiveConcurso: true, isLoading: false, loadError: 'Falha de rede', topicsCount: 0, queueActivitiesCount: 0 }), 'ERROR');
    assert.equal(getDashboardUIState({ hasActiveConcurso: true, isLoading: false, loadError: null, editaisCount: 0, topicsCount: 0, queueActivitiesCount: 0 }), 'NO_EDITAL');
    assert.equal(getDashboardUIState({ hasActiveConcurso: true, isLoading: false, loadError: null, editaisCount: 1, topicsCount: 0, queueActivitiesCount: 0 }), 'NO_TOPICS_IN_EDITAL');
  });

  test('T16: Ambas as fontes (agenda e ciclo) indisponíveis com fila vazia resultam em PARTIAL_UNAVAILABLE', () => {
    const state = getDashboardUIState({
      hasActiveConcurso: true,
      isLoading: false,
      loadError: null,
      editaisCount: 1,
      topicsCount: 20,
      queueActivitiesCount: 0,
      isAgendaUnavailable: true,
      isCycleUnavailable: true
    });
    assert.equal(state, 'PARTIAL_UNAVAILABLE');
  });

  test('T17: Preservação de reflexões multilinhas e caracteres especiais no handoff', () => {
    const complexNotes = '“Parar no art. 150, VI, «c» da CF/88 — revisar jurisprudência do STF sobre IPTU vs Templos!”\nLinha 2 com matemática: α + β ≤ γ';
    const sessions = [
      {
        sessionId: 'sess-complex',
        concursoId: 'conc-rfb',
        disciplina: 'Direito Tributário',
        topicoId: 'Imunidades',
        nextSessionHandoff: complexNotes,
        occurredAt: '2026-10-31T20:00:00Z'
      }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-rfb');
    assert.ok(handoff);
    assert.equal(handoff.nextSessionHandoff, complexNotes);

    const prep = prepareHandoffResumptionPayload(handoff);
    assert.equal(prep.safe, true);
    assert.equal(prep.sessionStorageItems.fiscalstudy_session_objective, complexNotes);
  });

  test('T18: Retomada guiada define fiscalstudy_session_type como ESTUDO_ORIENTADO e mode: RESUMPTION', () => {
    const handoff = {
      sessionId: 'sess-any',
      concursoId: 'conc-1',
      disciplina: 'Contabilidade Geral',
      topicoId: 'DRE',
      nextSessionHandoff: 'Revisar estrutura da DRE segundo a Lei 6.404/76',
      occurredAt: '2026-10-31T21:00:00Z',
      isFromLatestSession: true
    };

    const result = prepareHandoffResumptionPayload(handoff);
    assert.equal(result.safe, true);
    assert.equal(result.sessionStorageItems.fiscalstudy_session_type, 'ESTUDO_ORIENTADO');
    assert.equal(result.navigationParams.mode, 'RESUMPTION');
    assert.equal(result.navigationParams.disciplina, 'Contabilidade Geral');
    assert.equal(result.navigationParams.assunto, 'DRE');
  });

  test('T19: prepareHandoffResumptionPayload com safety ativo e sessão sem pendências retorna safe: true', () => {
    const handoff = {
      sessionId: 'sess-old',
      concursoId: 'conc-1',
      disciplina: 'Economia',
      nextSessionHandoff: 'Microeconomia: curvas de indiferença',
      occurredAt: '2026-10-31T15:00:00Z',
      isFromLatestSession: true
    };

    // Caso 1: Sem sessão anterior ativa
    const resultNoSession = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: null
    });
    assert.equal(resultNoSession.safe, true);
    assert.equal(resultNoSession.status, 'NO_PREVIOUS_SESSION');
    assert.ok(resultNoSession.newSessionId);

    // Caso 2: Sessão anterior com descarte explícito de sessão em andamento (PREVIOUS_SESSION_DISCARDED)
    const resultDiscarded = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: 'sess-abandonada-1',
      forceDiscardPrevious: true
    });
    assert.equal(resultDiscarded.safe, true);
    assert.equal(resultDiscarded.status, 'PREVIOUS_SESSION_DISCARDED');
  });

  test('T20: extractLatestEligibleHandoff com dados heterogêneos e elementos nulos não lança exceção', () => {
    const sessions = [
      null,
      undefined,
      42,
      'string-invalida',
      {},
      { concursoId: null },
      { concursoId: 'conc-1', occurredAt: 'invalido' },
      { concursoId: 'conc-1', nextSessionHandoff: '', occurredAt: '2026-10-31T10:00:00Z' },
      { concursoId: 'conc-1', nextSessionHandoff: 'Handoff sobrevivente', occurredAt: '2026-10-31T12:00:00Z', disciplina: 'AFO' }
    ];

    const handoff = extractLatestEligibleHandoff(sessions, 'conc-1');
    assert.ok(handoff);
    assert.equal(handoff.disciplina, 'AFO');
    assert.equal(handoff.nextSessionHandoff, 'Handoff sobrevivente');
  });

  test('T21 (ACHADO B): Sessão ativa em andamento sem journal bloqueia sobrescrita automática de identidade', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'sess-estudo-em-andamento-777';
    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', activeId);

    // Comprova que NÃO há journal de encerramento para activeId
    assert.equal(globalThis.sessionStorage.getItem('fiscalstudy:study_session:v1:' + activeId), null);

    // Avalia segurança: ausência de journal NÃO pode ser convertida em confirmação de encerramento!
    const safety = checkResumptionSafety(activeId);
    assert.equal(safety.safe, false, 'Ausência de journal NÃO autoriza nova sessão quando há sessão ativa');
    assert.equal(safety.status, 'SESSION_IN_PROGRESS');
    assert.equal(safety.reason, 'SESSION_IN_PROGRESS');
    assert.equal(safety.activeSessionId, activeId);
    assert.ok(safety.warning.includes('em andamento'));

    // Tentar preparar a retomada sem descarte explícito é bloqueado
    const handoff = {
      sessionId: 'sess-historica-1',
      concursoId: 'conc-1',
      disciplina: 'Direito Administrativo',
      nextSessionHandoff: 'Continuar atos',
      isFromLatestSession: true
    };

    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: activeId
    });

    assert.equal(prep.safe, false);
    assert.equal(prep.status, 'SESSION_IN_PROGRESS');
    assert.equal(prep.activeSessionId, activeId);

    // Invariante crucial: o sessionStorage retém a sessão ativa original (NÃO sobrescrita!)
    assert.equal(globalThis.sessionStorage.getItem('fiscalstudy_active_session_id'), activeId);
  });

  test('T22 (ACHADO B): Distinção rigorosa entre os estados de segurança de sessão', () => {
    globalThis.sessionStorage.clear();

    // 1. Nenhuma sessão anterior
    assert.equal(checkResumptionSafety(null).status, 'NO_PREVIOUS_SESSION');
    assert.equal(checkResumptionSafety('').status, 'NO_PREVIOUS_SESSION');
    assert.equal(checkResumptionSafety('   ').status, 'NO_PREVIOUS_SESSION');

    // 2. Sessão anterior comprovadamente concluída (CONFIRMED no journal)
    const confirmedId = 'sess-confirmed-1';
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + confirmedId, JSON.stringify({
      version: 1,
      sessionId: confirmedId,
      serializedBody: '{}',
      lifecycleState: 'CONFIRMED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    }));
    assert.equal(checkResumptionSafety(confirmedId).status, 'PREVIOUS_SESSION_COMPLETED');

    // 3. Descarte consciente de sessão em andamento sem journal (PREVIOUS_SESSION_DISCARDED)
    assert.equal(checkResumptionSafety('sess-in-progress-1', { forceDiscardPrevious: true }).status, 'PREVIOUS_SESSION_DISCARDED');

    // 4. Sessão anterior em andamento sem descarte (SESSION_IN_PROGRESS)
    assert.equal(checkResumptionSafety('sess-active-no-journal').status, 'SESSION_IN_PROGRESS');

    // 5. Operação enviada sem confirmação (SENT_UNCONFIRMED)
    const uncertainId = 'sess-uncertain-123';
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + uncertainId, JSON.stringify({
      version: 1,
      sessionId: uncertainId,
      serializedBody: '{}',
      lifecycleState: 'SENT_UNCONFIRMED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    }));
    assert.equal(checkResumptionSafety(uncertainId).status, 'SENT_UNCONFIRMED_PENDING');

    // 6. Journal corrompido ou estado desconhecido
    const corruptedId = 'sess-corrupted-999';
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + corruptedId, '{ malformed json');
    assert.equal(checkResumptionSafety(corruptedId).status, 'CORRUPTED_JOURNAL');
  });

  test('T23 (ACHADO B): Resolução explícita com forceDiscardPrevious permite prosseguir com nova identidade', () => {
    const activeId = 'sess-in-progress-to-discard';
    const handoff = {
      sessionId: 'sess-old-88',
      concursoId: 'conc-1',
      disciplina: 'TI',
      nextSessionHandoff: 'Redes de computadores',
      isFromLatestSession: true
    };

    // Usuário confirma conscientemente o descarte da sessão anterior
    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: activeId,
      forceDiscardPrevious: true
    });

    assert.equal(prep.safe, true);
    assert.equal(prep.status, 'PREVIOUS_SESSION_DISCARDED');
    assert.ok(prep.newSessionId.startsWith('study-'));
    assert.notEqual(prep.newSessionId, activeId);
    assert.equal(prep.sessionStorageItems.fiscalstudy_active_session_id, prep.newSessionId);
  });

  test('T24 (ACHADO A): Coordenador de carga protege contra respostas obsoletas fora de ordem ao trocar de concurso', () => {
    const coordinator = createDashboardLoadCoordinator();

    // 1. Usuário seleciona concurso A -> requisição de carga A iniciada
    const loadA = coordinator.startLoad('conc-A');
    assert.equal(loadA.concursoId, 'conc-A');
    assert.equal(loadA.requestId, 1);
    assert.equal(loadA.isCurrent(), true);
    assert.equal(loadA.signal.aborted, false);

    // 2. Usuário troca rapidamente para concurso B -> requisição B iniciada
    const loadB = coordinator.startLoad('conc-B');
    assert.equal(loadB.concursoId, 'conc-B');
    assert.equal(loadB.requestId, 2);
    assert.equal(loadB.isCurrent(), true);

    // 3. Comprova que a carga A foi automaticamente abortada e não é mais current
    assert.equal(loadA.isCurrent(), false, 'Carga A não pode ser considerada atual após troca para B');
    assert.equal(loadA.signal.aborted, true, 'Sinal de cancelamento de A deve estar ativo');
    assert.equal(coordinator.isCurrent(loadA.requestId, 'conc-A'), false);

    // 4. Cenário de resposta fora de ordem:
    // B responde primeiro (rede rápida)
    let stateAppliedConcurso = null;
    let stateData = null;

    if (loadB.isCurrent()) {
      stateAppliedConcurso = loadB.concursoId;
      stateData = 'DADOS_DO_CONCURSO_B';
    }
    assert.equal(stateAppliedConcurso, 'conc-B');
    assert.equal(stateData, 'DADOS_DO_CONCURSO_B');

    // Resposta atrasada de A chega mais tarde (rede lenta)
    if (loadA.isCurrent()) {
      stateAppliedConcurso = loadA.concursoId;
      stateData = 'DADOS_DO_CONCURSO_A';
    }

    // Invariante crucial: os dados atrasados de A NUNCA sobrepõem a interface de B
    assert.equal(stateAppliedConcurso, 'conc-B', 'Dados de A nunca podem substituir o estado de B');
    assert.equal(stateData, 'DADOS_DO_CONCURSO_B');
  });

  test('T25 (ACHADO A): Isolamento estrito de isLoading e loadError contra falhas de requisições anteriores', () => {
    const coordinator = createDashboardLoadCoordinator();

    const loadA = coordinator.startLoad('conc-A');
    let uiIsLoading = true;
    let uiLoadError = null;

    // Usuário muda para B
    const loadB = coordinator.startLoad('conc-B');

    // A falha com erro de rede posteriormente
    const delayedErrorA = new Error('Falha HTTP 500 no concurso A');
    if (loadA.isCurrent()) {
      uiLoadError = delayedErrorA.message;
    }
    if (loadA.isCurrent()) {
      uiIsLoading = false;
    }

    // Comprova que o erro de A não afeta B e o loading de B não é encerrado prematuramente por A
    assert.equal(uiLoadError, null, 'Erro da requisição obsoleta de A não pode definir loadError em B');
    assert.equal(uiIsLoading, true, 'Finally da requisição obsoleta de A não pode desativar isLoading de B');

    // B conclui com sucesso
    if (loadB.isCurrent()) {
      uiIsLoading = false;
    }
    assert.equal(uiIsLoading, false);
    assert.equal(uiLoadError, null);
  });

  test('T26 (ACHADO A): Operação de retry gera nova sessão e invalida tentativa anterior do mesmo concurso', () => {
    const coordinator = createDashboardLoadCoordinator();

    const load1 = coordinator.startLoad('conc-B');
    assert.equal(load1.requestId, 1);
    assert.equal(load1.isCurrent(), true);

    // Usuário clica em 'Tentar Novamente (Recarregar)' para o mesmo concurso B
    const retryLoad = coordinator.startLoad('conc-B');
    assert.equal(retryLoad.requestId, 2);
    assert.equal(retryLoad.isCurrent(), true);

    // Tentativa anterior 1 foi abortada
    assert.equal(load1.isCurrent(), false);
    assert.equal(load1.signal.aborted, true);
  });

  test('T27 (Achado de Segurança - Cenário 1): Sessão em andamento sem journal permite descarte consciente com status PREVIOUS_SESSION_DISCARDED', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'sess-progress-clean-1';
    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', activeId);

    // Sem journal existente
    assert.equal(globalThis.sessionStorage.getItem('fiscalstudy:study_session:v1:' + activeId), null);

    const safety = checkResumptionSafety(activeId, { forceDiscardPrevious: true });
    assert.equal(safety.safe, true);
    assert.equal(safety.status, 'PREVIOUS_SESSION_DISCARDED');
    assert.equal(safety.reason, 'PREVIOUS_SESSION_DISCARDED');
    assert.equal(safety.activeSessionId, activeId);

    const handoff = {
      sessionId: 'sess-old-1',
      concursoId: 'conc-1',
      disciplina: 'Direito Constitucional',
      nextSessionHandoff: 'Direitos fundamentais',
      isFromLatestSession: true
    };

    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: activeId,
      forceDiscardPrevious: true
    });

    assert.equal(prep.safe, true);
    assert.equal(prep.status, 'PREVIOUS_SESSION_DISCARDED');
    assert.ok(prep.newSessionId);
    assert.notEqual(prep.newSessionId, activeId);
    assert.equal(prep.sessionStorageItems.fiscalstudy_active_session_id, prep.newSessionId);
  });

  test('T28 (Achado de Segurança - Cenário 2): Sessão que passa de SESSION_IN_PROGRESS para SENT_UNCONFIRMED antes do clique tem descarte bloqueado', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'sess-race-unconfirmed-2';
    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', activeId);

    // Inicialmente sem journal: se avaliada antes, estaria como SESSION_IN_PROGRESS
    const initialSafety = checkResumptionSafety(activeId);
    assert.equal(initialSafety.status, 'SESSION_IN_PROGRESS');

    // Mas antes do clique de confirmação de descarte, ocorre submissão que fica pendente de confirmação (SENT_UNCONFIRMED)
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + activeId, JSON.stringify({
      version: 1,
      sessionId: activeId,
      serializedBody: '{"duracao": 3600}',
      lifecycleState: 'SENT_UNCONFIRMED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    }));

    // Ao tentar descarte consciente, a revalidação obrigatória do journal detecta SENT_UNCONFIRMED e bloqueia a ação
    const revalidatedSafety = checkResumptionSafety(activeId, { forceDiscardPrevious: true });
    assert.equal(revalidatedSafety.safe, false, 'forceDiscardPrevious não pode contornar SENT_UNCONFIRMED');
    assert.equal(revalidatedSafety.status, 'SENT_UNCONFIRMED_PENDING');
    assert.equal(revalidatedSafety.activeSessionId, activeId);
    assert.ok(revalidatedSafety.warning.includes('pendente de confirmação'));

    const handoff = {
      sessionId: 'sess-old-2',
      concursoId: 'conc-1',
      disciplina: 'Auditoria Privada',
      nextSessionHandoff: 'Normas NBC TI',
      isFromLatestSession: true
    };

    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: activeId,
      forceDiscardPrevious: true
    });

    assert.equal(prep.safe, false);
    assert.equal(prep.status, 'SENT_UNCONFIRMED_PENDING');
  });

  test('T29 (Achado de Segurança - Cenário 3): Journal corrompido com forceDiscardPrevious=true tem descarte bloqueado', () => {
    globalThis.sessionStorage.clear();
    const corruptedId = 'sess-corrupted-must-block-3';
    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', corruptedId);
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + corruptedId, '{ broken-json !!!');

    // Mesmo com forceDiscardPrevious: true, journal corrompido NUNCA é contornado
    const safety = checkResumptionSafety(corruptedId, { forceDiscardPrevious: true });
    assert.equal(safety.safe, false, 'forceDiscardPrevious não pode contornar journal corrompido');
    assert.equal(safety.status, 'CORRUPTED_JOURNAL');
    assert.equal(safety.activeSessionId, corruptedId);
    assert.ok(safety.warning.includes('corrompido ou inválido'));

    const handoff = {
      sessionId: 'sess-old-3',
      concursoId: 'conc-1',
      disciplina: 'Legislação Tributária',
      nextSessionHandoff: 'Regulamento do ICMS',
      isFromLatestSession: true
    };

    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: corruptedId,
      forceDiscardPrevious: true
    });

    assert.equal(prep.safe, false);
    assert.equal(prep.status, 'CORRUPTED_JOURNAL');
  });

  test('T30 (Achado de Segurança - Cenário 4): Estado desconhecido no journal tem descarte bloqueado', () => {
    globalThis.sessionStorage.clear();
    const unknownId = 'sess-unknown-state-4';
    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', unknownId);
    globalThis.sessionStorage.setItem('fiscalstudy:study_session:v1:' + unknownId, JSON.stringify({
      version: 1,
      sessionId: unknownId,
      serializedBody: '{}',
      lifecycleState: 'NON_EXISTENT_FUTURE_STATE',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    }));

    // Revalidação detecta estado desconhecido e bloqueia
    const safety = checkResumptionSafety(unknownId, { forceDiscardPrevious: true });
    assert.equal(safety.safe, false, 'forceDiscardPrevious não pode contornar UNKNOWN_STATE');
    assert.equal(safety.status, 'UNKNOWN_STATE');
    assert.equal(safety.activeSessionId, unknownId);

    const handoff = {
      sessionId: 'sess-old-4',
      concursoId: 'conc-1',
      disciplina: 'Português',
      nextSessionHandoff: 'Crase e regência verbal',
      isFromLatestSession: true
    };

    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: unknownId,
      forceDiscardPrevious: true
    });

    assert.equal(prep.safe, false);
    assert.equal(prep.status, 'UNKNOWN_STATE');
  });

  test('T31 (Achado de Segurança - Cenário 5): Falha no descarte preserva rigorosamente activeSessionId e journal no storage', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'sess-preserved-identity-5';
    const journalKey = 'fiscalstudy:study_session:v1:' + activeId;
    const journalRaw = JSON.stringify({
      version: 1,
      sessionId: activeId,
      serializedBody: '{"tempo": 1200, "notas": "Dados intactos preservados"}',
      lifecycleState: 'SENT_UNCONFIRMED',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });

    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', activeId);
    globalThis.sessionStorage.setItem('fiscalstudy_timer_session_id', activeId);
    globalThis.sessionStorage.setItem(journalKey, journalRaw);

    const handoff = {
      sessionId: 'sess-old-5',
      concursoId: 'conc-1',
      disciplina: 'Contabilidade de Custos',
      nextSessionHandoff: 'Equivalência patrimonial',
      isFromLatestSession: true
    };

    // Tenta descarte que é bloqueado por revalidação
    const prep = prepareHandoffResumptionPayload(handoff, {
      checkSafety: true,
      existingActiveSessionId: activeId,
      forceDiscardPrevious: true
    });

    assert.equal(prep.safe, false);
    assert.equal(prep.newSessionId, undefined, 'Nenhum novo sessionId gerado em caso de bloqueio');
    assert.equal(prep.sessionStorageItems, undefined, 'Nenhum item de storage retornado em caso de bloqueio');

    // Invariante de integridade estrita: nada foi alterado ou expurgado do sessionStorage
    assert.equal(globalThis.sessionStorage.getItem('fiscalstudy_active_session_id'), activeId);
    assert.equal(globalThis.sessionStorage.getItem('fiscalstudy_timer_session_id'), activeId);
    assert.equal(globalThis.sessionStorage.getItem(journalKey), journalRaw);
  });

  test('T32 (Comportamental): Máquina de estados do fluxo de confirmação e descarte consciente', () => {
    globalThis.sessionStorage.clear();
    const activeId = 'sess-behavioral-flow-1';
    globalThis.sessionStorage.setItem('fiscalstudy_active_session_id', activeId);

    const handoff = {
      sessionId: 'sess-target-1',
      concursoId: 'conc-1',
      disciplina: 'Direito Previdenciário',
      nextSessionHandoff: 'Benefícios em espécie',
      isFromLatestSession: true
    };

    // 1. Simulação do estado inicial do componente:
    let resumptionSafetyStatus = null;
    let resumptionSafetyWarning = null;
    let showDiscardConfirm = false;
    let navigatedTab = null;
    let navigationParams = null;

    // Ação: Usuário clica no botão "Continuar este assunto"
    const handleResumptionClick = (forceDiscard = false) => {
      const existingId = globalThis.sessionStorage.getItem('fiscalstudy_active_session_id');
      const result = prepareHandoffResumptionPayload(handoff, {
        checkSafety: true,
        existingActiveSessionId: existingId,
        forceDiscardPrevious: forceDiscard
      });

      if (!result.safe) {
        resumptionSafetyWarning = result.warning || 'Ação bloqueada';
        resumptionSafetyStatus = result.status || 'SESSION_IN_PROGRESS';
        showDiscardConfirm = false;
        return;
      }

      showDiscardConfirm = false;
      resumptionSafetyWarning = null;
      resumptionSafetyStatus = null;

      if (result.sessionStorageItems) {
        for (const [key, value] of Object.entries(result.sessionStorageItems)) {
          globalThis.sessionStorage.setItem(key, value);
        }
      }

      navigatedTab = 'session';
      navigationParams = result.navigationParams;
    };

    // 2. Primeiro clique: deve bloquear e solicitar decisão consciente
    handleResumptionClick(false);
    assert.equal(resumptionSafetyStatus, 'SESSION_IN_PROGRESS');
    assert.ok(resumptionSafetyWarning);
    assert.equal(showDiscardConfirm, false);
    assert.equal(navigatedTab, null);

    // 3. Usuário clica em "Descartar anterior e iniciar este assunto" -> abre painel com advertência
    showDiscardConfirm = true;
    assert.equal(showDiscardConfirm, true);

    // 4. Usuário clica em "Cancelar" -> fecha painel sem alterar sessão
    showDiscardConfirm = false;
    assert.equal(showDiscardConfirm, false);
    assert.equal(globalThis.sessionStorage.getItem('fiscalstudy_active_session_id'), activeId);

    // 5. Usuário abre novamente e clica em "Confirmar Descarte e Iniciar"
    showDiscardConfirm = true;
    handleResumptionClick(true);

    // 6. Confirma que o descarte consciente foi aceito com PREVIOUS_SESSION_DISCARDED,
    // novo ID gerado no storage e navegação disparada
    assert.equal(resumptionSafetyStatus, null);
    assert.equal(resumptionSafetyWarning, null);
    assert.equal(showDiscardConfirm, false);
    assert.equal(navigatedTab, 'session');
    assert.equal(navigationParams.mode, 'RESUMPTION');
    const newId = globalThis.sessionStorage.getItem('fiscalstudy_active_session_id');
    assert.ok(newId.startsWith('study-'));
    assert.notEqual(newId, activeId);
  });
});
