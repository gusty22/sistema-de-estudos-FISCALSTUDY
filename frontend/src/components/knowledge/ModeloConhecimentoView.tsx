import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  HelpCircle,
  Info,
  X,
  Sparkles
} from 'lucide-react';
import './ModeloConhecimentoView.css';

export interface TopicKnowledge {
  topicId: string;
  disciplineId: string;
  topicName: string;
  totalAttempts: number;
  correctAttempts: number;
  errorAttempts: number;
  accuracyRate: number;
  accuracyDenominatorText: string;
  totalActiveTimeMs: number;
  averageActiveTimeMs: number;
  lastAttemptAt?: string;
  uniqueQuestionsCount: number;
  newQuestionsAttempts: number;
  repeatedQuestionsAttempts: number;
  variantQuestionsAttempts: number;
  avgConfidenceOrdinal?: number;
  lowConfidenceSuccesses: number;
  highConfidenceErrors: number;
  confidenceDistributionJson?: string;
  contextDistributionJson?: string;
  errorCausesDistributionJson?: string;
  fsrsStabilityDays?: number;
  fsrsRetrievalRate?: number;
  evidenceStatus: 'SEM_EVIDENCIAS' | 'PRELIMINAR' | 'EM_CONSTRUCAO' | 'CONSOLIDADA' | string;
  epistemicLimitationsJson?: string;
  pedagogicalHypothesesJson?: string;
  updatedAt: string;
}

export const ModeloConhecimentoView: React.FC = () => {
  const [topics, setTopics] = useState<TopicKnowledge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildFeedback, setRebuildFeedback] = useState<string | null>(null);
  const [filterDiscipline, setFilterDiscipline] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<TopicKnowledge | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/knowledge/topics');
      if (res.ok) {
        const data: TopicKnowledge[] = await res.json();
        setTopics(data);
      }
    } catch (err) {
      console.warn('Erro ao carregar modelo individual de conhecimento:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setRebuildFeedback('Reconstruindo projeções do Modelo de Conhecimento a partir do log imutável...');
    try {
      const res = await fetch('/api/v1/knowledge/rebuild', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setRebuildFeedback(`Reconstrução concluída: ${result.topicsProcessed} tópicos processados, ${result.totalAttempts} tentativas legítimas agregadas.`);
        await loadData();
      } else {
        setRebuildFeedback('Falha na requisição de reconstrução.');
      }
    } catch (err) {
      setRebuildFeedback('Erro ao conectar ao endpoint de reconstrução.');
    } finally {
      setIsRebuilding(false);
      setTimeout(() => setRebuildFeedback(null), 6000);
    }
  };

  const disciplines = ['TODAS', ...Array.from(new Set(topics.map(t => t.disciplineId || 'GERAL')))];

  const filteredTopics = topics.filter(t => {
    if (filterDiscipline !== 'TODAS' && t.disciplineId !== filterDiscipline) return false;
    if (filterStatus !== 'TODOS' && t.evidenceStatus !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (t.topicName || t.topicId).toLowerCase();
      const disc = (t.disciplineId || '').toLowerCase();
      if (!name.includes(q) && !disc.includes(q)) return false;
    }
    return true;
  });

  const totalTopics = topics.length;
  const topicsWithEvidence = topics.filter(t => t.totalAttempts > 0).length;
  const topicsSemEvidencias = topics.filter(t => t.totalAttempts === 0).length;
  const totalAttempts = topics.reduce((acc, t) => acc + t.totalAttempts, 0);
  const totalCorrect = topics.reduce((acc, t) => acc + t.correctAttempts, 0);

  const parseJsonSafe = (jsonStr?: string, defaultVal: any = {}): any => {
    if (!jsonStr) return defaultVal;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return defaultVal;
    }
  };

  const renderStatusBadge = (status: string, totalAttempts: number) => {
    switch (status) {
      case 'SEM_EVIDENCIAS':
        return <span className="status-badge sem-evidencias">SEM EVIDÊNCIAS (0/0)</span>;
      case 'PRELIMINAR':
        return <span className="status-badge preliminar">⚠️ PRELIMINAR (N={totalAttempts})</span>;
      case 'EM_CONSTRUCAO':
        return <span className="status-badge em-construcao">EM CONSTRUÇÃO (N={totalAttempts})</span>;
      case 'CONSOLIDADA':
        return <span className="status-badge consolidada">CONSOLIDADA (N={totalAttempts})</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="modelo-conhecimento-container animate-fade-in" data-testid="modelo-conhecimento-view">
      {/* 1. Header com Governança Científica */}
      <header className="modelo-header">
        <div className="modelo-header-titles">
          <div className="header-badge-row">
            <span className="badge-epic">EPIC 02</span>
            <span className="badge-governance">Refinamento Científico & Integridade Epistêmica</span>
          </div>
          <h1>Modelo Individual de Conhecimento</h1>
          <p className="header-subtitle">
            Mapeamento estritamente determinístico, auditável e reconstruível a partir dos eventos originais do log de estudo.
            Segregação completa entre fatos observados, métricas ordinais e hipóteses pedagógicas.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn-rebuild"
            onClick={handleRebuild}
            disabled={isRebuilding}
            title="Reconstroi todas as projeções determinísticas lendo cada evento do event_store"
          >
            <RotateCw className={`w-4 h-4 mr-2 ${isRebuilding ? 'spin-icon' : ''}`} />
            {isRebuilding ? 'Reconstruindo...' : 'Reconstruir do Log'}
          </button>
        </div>
      </header>

      {/* Banner de Feedback de Reconstrução */}
      {rebuildFeedback && (
        <div className="rebuild-banner animate-fade-in">
          <Info className="w-4 h-4 mr-2 text-indigo-400 shrink-0" />
          <span>{rebuildFeedback}</span>
        </div>
      )}

      {/* 2. Princípios Epistêmicos Resumidos (Transparência Científica) */}
      <section className="epistemic-principles-card">
        <div className="principles-header">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mr-2 shrink-0" />
          <h3>Contrato Epistêmico de Governança dos Dados</h3>
        </div>
        <div className="principles-grid">
          <div className="principle-item">
            <span className="principle-num">1</span>
            <div>
              <strong>Observação vs Inferência</strong>
              <p>Desempenho observado e confiança não são fundidos em notas de domínio inventadas.</p>
            </div>
          </div>
          <div className="principle-item">
            <span className="principle-num">2</span>
            <div>
              <strong>Sem Pesos Arbitrários</strong>
              <p>Simulados e retestes registrados como metadados contextuais, sem fatores arbitrários (1.5x / 1.2x).</p>
            </div>
          </div>
          <div className="principle-item">
            <span className="principle-num">3</span>
            <div>
              <strong>Confiança Ordinal Pura (1–5)</strong>
              <p>Valores 1 a 5 não são convertidos em porcentagens artificiais; Brier Score desativado.</p>
            </div>
          </div>
          <div className="principle-item">
            <span className="principle-num">4</span>
            <div>
              <strong>Memória Desacoplada (FSRS)</strong>
              <p>Recuperabilidade temporal não é confundida com prova biológica de perda de conhecimento.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Cards Métricos de Visão Geral */}
      <section className="metrics-summary-grid">
        <div className="summary-card">
          <span className="card-label">Tópicos Cadastrados</span>
          <div className="card-value-box">
            <span className="card-value">{totalTopics}</span>
            <span className="card-sub">{disciplines.length - 1} disciplinas</span>
          </div>
          <span className="card-footer-info">Base canônica do edital verticalizado</span>
        </div>

        <div className="summary-card highlight-success">
          <span className="card-label">Tópicos com Evidências</span>
          <div className="card-value-box">
            <span className="card-value text-emerald-400">{topicsWithEvidence}</span>
            <span className="card-sub">de {totalTopics} ({totalTopics > 0 ? Math.round((topicsWithEvidence / totalTopics) * 100) : 0}%)</span>
          </div>
          <span className="card-footer-info">Com ao menos 1 tentativa legítima</span>
        </div>

        <div className="summary-card highlight-neutral">
          <span className="card-label">Sem Evidências</span>
          <div className="card-value-box">
            <span className="card-value text-slate-400">{topicsSemEvidencias}</span>
            <span className="card-sub">aguardando estudo</span>
          </div>
          <span className="card-footer-info">Exibição explícita de `SEM_EVIDENCIAS`</span>
        </div>

        <div className="summary-card highlight-indigo">
          <span className="card-label">Denominador Global Auditado</span>
          <div className="card-value-box">
            <span className="card-value text-indigo-400">
              {totalAttempts > 0 ? `${totalCorrect}/${totalAttempts}` : '0/0'}
            </span>
            <span className="card-sub">
              {totalAttempts > 0 ? `${Math.round((totalCorrect / totalAttempts) * 1000) / 10}%` : 'SEM_DADOS'}
            </span>
          </div>
          <span className="card-footer-info">Eventos `origin = REAL_STUDY`</span>
        </div>
      </section>

      {/* 4. Barra de Filtros e Busca */}
      <section className="filters-bar">
        <div className="search-input-box">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Buscar tópico curricular ou disciplina..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="filter-select-group">
          <div className="select-wrapper">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
            <select value={filterDiscipline} onChange={e => setFilterDiscipline(e.target.value)}>
              {disciplines.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="select-wrapper">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="TODOS">Todos os Status</option>
              <option value="SEM_EVIDENCIAS">Sem Evidências</option>
              <option value="PRELIMINAR">Preliminar (N &lt; 10)</option>
              <option value="EM_CONSTRUCAO">Em Construção (10-24)</option>
              <option value="CONSOLIDADA">Consolidada (N &ge; 25)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 5. Tabela de Indicadores Observáveis por Tópico */}
      <section className="topics-table-section">
        {isLoading ? (
          <div className="loading-state">Carregando evidências de conhecimento dos tópicos...</div>
        ) : filteredTopics.length === 0 ? (
          <div className="empty-state">
            <HelpCircle className="w-8 h-8 text-slate-400 mb-2" />
            <p>Nenhum tópico encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="knowledge-table">
              <thead>
                <tr>
                  <th>Tópico Curricular</th>
                  <th>Disciplina</th>
                  <th>Status Amostral</th>
                  <th>Desempenho Observado</th>
                  <th>Confiança Declarada</th>
                  <th>Metacognição</th>
                  <th>Cobertura</th>
                  <th>Tempo Ativo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopics.map((topic) => {
                  const isZero = topic.totalAttempts === 0;

                  return (
                    <tr key={topic.topicId} className={isZero ? 'row-sem-evidencias' : ''}>
                      <td className="topic-name-cell">
                        <strong>{topic.topicName || topic.topicId}</strong>
                        {topic.uniqueQuestionsCount > 0 && (
                          <span className="topic-meta-sub">
                            {topic.uniqueQuestionsCount} questão(ões) distinta(s)
                          </span>
                        )}
                      </td>
                      <td className="discipline-cell">
                        <span className="discipline-badge">{topic.disciplineId}</span>
                      </td>
                      <td>
                        {renderStatusBadge(topic.evidenceStatus, topic.totalAttempts)}
                      </td>
                      <td className="accuracy-cell">
                        {isZero ? (
                          <span className="text-muted">SEM_EVIDÊNCIAS</span>
                        ) : (
                          <div>
                            <span className="denominator-bold">{topic.accuracyDenominatorText}</span>
                            <span className="rate-percent">({Math.round(topic.accuracyRate * 1000) / 10}%)</span>
                          </div>
                        )}
                      </td>
                      <td className="confidence-cell">
                        {topic.avgConfidenceOrdinal != null ? (
                          <div className="conf-ordinal-box">
                            <span className="conf-num">{topic.avgConfidenceOrdinal.toFixed(2)}</span>
                            <span className="conf-scale">/ 5.0 (ordinal)</span>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="metacog-cell">
                        {isZero ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="metacog-chips">
                            {topic.highConfidenceErrors > 0 && (
                              <span className="chip-ponto-cego" title="Erros cometidos com nível 4 ou 5 de certeza">
                                ⚠️ {topic.highConfidenceErrors} erro(s) c/ certeza
                              </span>
                            )}
                            {topic.lowConfidenceSuccesses > 0 && (
                              <span className="chip-inseguro" title="Acertos com nível 1 ou 2 de confiança (dúvida ou chute)">
                                ❓ {topic.lowConfidenceSuccesses} acerto(s) inseguro(s)
                              </span>
                            )}
                            {topic.highConfidenceErrors === 0 && topic.lowConfidenceSuccesses === 0 && (
                              <span className="chip-equilibrado">Alinhado</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="coverage-cell">
                        {isZero ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="coverage-sub">
                            <span>{topic.newQuestionsAttempts} inéditas</span>
                            {topic.repeatedQuestionsAttempts > 0 && (
                              <span className="text-amber-400"> • {topic.repeatedQuestionsAttempts} repetidas</span>
                            )}
                            {topic.variantQuestionsAttempts > 0 && (
                              <span className="text-indigo-400"> • {topic.variantQuestionsAttempts} variantes</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="time-cell">
                        {topic.averageActiveTimeMs > 0 ? (
                          <span>{Math.round(topic.averageActiveTimeMs / 1000)}s / item</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-inspect-evidence"
                          onClick={() => setSelectedTopic(topic)}
                        >
                          Evidências & Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. Modal / Drawer de Detalhamento Epistêmico */}
      {selectedTopic && (
        <div className="modal-backdrop" onClick={() => setSelectedTopic(null)}>
          <div className="modal-evidence-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="drawer-pre-title">{selectedTopic.disciplineId}</span>
                <h2>{selectedTopic.topicName || selectedTopic.topicId}</h2>
              </div>
              <button className="btn-close-drawer" onClick={() => setSelectedTopic(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="drawer-content">
              {/* Dimensão 1: Desempenho Observado */}
              <div className="drawer-section">
                <h4>1. Desempenho Observado (Fatos Brutos)</h4>
                <div className="drawer-grid-3">
                  <div className="drawer-metric-card">
                    <span className="lbl">Tentativas Legítimas</span>
                    <span className="val">{selectedTopic.totalAttempts}</span>
                    <span className="sub">origin = REAL_STUDY</span>
                  </div>
                  <div className="drawer-metric-card">
                    <span className="lbl">Denominador Auditado</span>
                    <span className="val text-emerald-400">{selectedTopic.accuracyDenominatorText}</span>
                    <span className="sub">Acertos / Total</span>
                  </div>
                  <div className="drawer-metric-card">
                    <span className="lbl">Tempo Ativo Total</span>
                    <span className="val">{Math.round(selectedTopic.totalActiveTimeMs / 1000)}s</span>
                    <span className="sub">Média: {Math.round(selectedTopic.averageActiveTimeMs / 1000)}s/item</span>
                  </div>
                </div>
              </div>

              {/* Dimensão 2: Confiança Declarada & Metacognição Ordinal */}
              <div className="drawer-section">
                <h4>2. Confiança Declarada (Escala Ordinal 1 a 5)</h4>
                <div className="conf-distribution-card">
                  <div className="conf-header-info">
                    <span>Média Ordinal: <strong>{selectedTopic.avgConfidenceOrdinal?.toFixed(2) || '—'}</strong> / 5.0</span>
                    <span className="badge-warning-text">⚠️ Não convertida em probabilidades arbitrárias</span>
                  </div>
                  <div className="ordinal-bars-grid">
                    {(() => {
                      const dist = parseJsonSafe(selectedTopic.confidenceDistributionJson);
                      const labels = [
                        { lvl: '1', name: '1. Chute cego' },
                        { lvl: '2', name: '2. Inseguro / dúvida' },
                        { lvl: '3', name: '3. Razoável' },
                        { lvl: '4', name: '4. Confiante' },
                        { lvl: '5', name: '5. Certeza absoluta' }
                      ];
                      return labels.map(l => (
                        <div key={l.lvl} className="ordinal-bar-row">
                          <span className="bar-lvl-lbl">{l.name}</span>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${selectedTopic.totalAttempts > 0 ? ((dist[l.lvl] || 0) / selectedTopic.totalAttempts) * 100 : 0}%`
                              }}
                            />
                          </div>
                          <span className="bar-count-lbl">{dist[l.lvl] || 0}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Dimensão 3: Familiaridade com Questões & Variantes */}
              <div className="drawer-section">
                <h4>3. Familiaridade e Identificação de Variantes</h4>
                <div className="drawer-grid-3">
                  <div className="drawer-metric-card">
                    <span className="lbl">Questões Inéditas</span>
                    <span className="val">{selectedTopic.newQuestionsAttempts}</span>
                    <span className="sub">Primeiro contato</span>
                  </div>
                  <div className="drawer-metric-card">
                    <span className="lbl">Questões Repetidas</span>
                    <span className="val text-amber-400">{selectedTopic.repeatedQuestionsAttempts}</span>
                    <span className="sub">Risco de fixação de gabarito</span>
                  </div>
                  <div className="drawer-metric-card">
                    <span className="lbl">Variantes Identificadas</span>
                    <span className="val text-indigo-400">{selectedTopic.variantQuestionsAttempts}</span>
                    <span className="sub">Família de questões confirmada</span>
                  </div>
                </div>
              </div>

              {/* Dimensão 4: Contextos Registrados e Causas de Erro */}
              <div className="drawer-section">
                <h4>4. Metadados Contextuais e Taxonomia de Erros</h4>
                <div className="drawer-grid-2">
                  <div className="context-box">
                    <span className="box-title">Contexto das Tentativas (Sem pesos fixos)</span>
                    <div className="chips-list">
                      {Object.entries(parseJsonSafe(selectedTopic.contextDistributionJson)).map(([ctx, count]) => (
                        <span key={ctx} className="chip-context">
                          {ctx}: <strong>{count as number}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="context-box">
                    <span className="box-title">Causas de Erro Efetivamente Registradas</span>
                    <div className="chips-list">
                      {Object.entries(parseJsonSafe(selectedTopic.errorCausesDistributionJson)).length === 0 ? (
                        <span className="text-muted">Nenhum erro registrado ou classificado</span>
                      ) : (
                        Object.entries(parseJsonSafe(selectedTopic.errorCausesDistributionJson)).map(([causa, count]) => (
                          <span key={causa} className="chip-cause">
                            {causa}: <strong>{count as number}</strong>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dimensão 5: Mnemônica / Memória FSRS (Desacoplada) */}
              <div className="drawer-section">
                <h4>5. Estimativas Temporais de Memória (FSRS Desacoplado)</h4>
                <div className="drawer-grid-2">
                  <div className="drawer-metric-card">
                    <span className="lbl">Estabilidade Sináptica Média (S)</span>
                    <span className="val">{selectedTopic.fsrsStabilityDays ? `${selectedTopic.fsrsStabilityDays} dias` : '—'}</span>
                    <span className="sub">Parâmetro puro de agendamento FSRS</span>
                  </div>
                  <div className="drawer-metric-card">
                    <span className="lbl">Recuperabilidade Teórica Atual (R)</span>
                    <span className="val">{selectedTopic.fsrsRetrievalRate ? `${Math.round(selectedTopic.fsrsRetrievalRate * 100)}%` : '—'}</span>
                    <span className="sub">Não constitui decaimento de domínio conceitual</span>
                  </div>
                </div>
              </div>

              {/* Dimensão 6: Limitações Epistemológicas & Hipóteses Pedagógicas */}
              <div className="drawer-section highlight-epistemic">
                <h4>6. Governança Científica & Limitações da Amostra</h4>
                <div className="limitations-list">
                  {parseJsonSafe(selectedTopic.epistemicLimitationsJson, []).map((lim: string, idx: number) => (
                    <div key={idx} className="limitation-row">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mr-2 shrink-0 mt-0.5" />
                      <span>{lim}</span>
                    </div>
                  ))}
                </div>

                <h5 className="mt-4 mb-2 text-sm font-semibold text-slate-300">Hipóteses Pedagógicas Preliminares:</h5>
                <div className="hypotheses-list">
                  {parseJsonSafe(selectedTopic.pedagogicalHypothesesJson, []).map((hyp: string, idx: number) => (
                    <div key={idx} className="hypothesis-row">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 mr-2 shrink-0 mt-0.5" />
                      <span>{hyp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
