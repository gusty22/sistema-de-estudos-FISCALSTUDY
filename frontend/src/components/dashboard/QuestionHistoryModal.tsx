import React, { useState, useEffect } from 'react';
import './QuestionHistoryModal.css';

interface QuestionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConcursoId?: string | null;
  activeConcursoNome?: string | null;
  initialTab?: 'history' | 'xray';
  onNavigateToStudy?: (disciplina?: string) => void;
}

interface QuestionHistoryItem {
  eventId: string;
  questionId: string;
  statement: string;
  options: string[];
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean | null;
  gabaritoStatus: string;
  concursoPoint: number;
  confidenceLevel: number;
  activeTimeMs: number;
  causaErro?: string;
  discipline: string;
  topic: string;
  board?: string;
  year?: number;
  orgao?: string;
  cargo?: string;
  occurredAt: string;
  attemptNumber: number;
  totalAttemptsForQuestion: number;
}

interface QuestionHistoryResponse {
  items: QuestionHistoryItem[];
  totalAttempts: number;
  uniqueQuestionsCount: number;
  correctCount: number;
  incorrectCount: number;
  anuladasCount: number;
  accuracyRate: number;
}

interface PerformanceXRayData {
  totalAttempts: number;
  uniqueQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalAnuladas: number;
  accuracyRate: number;
  totalActiveTimeMs: number;
  averageTimePerQuestionMs: number;
  disciplineBreakdown: Array<{
    disciplina: string;
    totalAttempts: number;
    uniqueQuestions: number;
    correctCount: number;
    accuracyRate: number;
    status: string;
    averageTimeMs: number;
  }>;
  topicBreakdown: Array<{
    disciplina: string;
    topic: string;
    totalAttempts: number;
    correctCount: number;
    incorrectCount: number;
    accuracyRate: number;
  }>;
  topErrorAreas: Array<{
    disciplina: string;
    topic: string;
    totalAttempts: number;
    correctCount: number;
    incorrectCount: number;
    accuracyRate: number;
  }>;
  masteredAreas: Array<{
    disciplina: string;
    topic: string;
    totalAttempts: number;
    correctCount: number;
    incorrectCount: number;
    accuracyRate: number;
  }>;
  unansweredQuestionsCount: number;
  totalQuestionsInBank: number;
  recentEvolution: Array<{
    date: string;
    attempts: number;
    correct: number;
    accuracyRate: number;
  }>;
}

export const QuestionHistoryModal: React.FC<QuestionHistoryModalProps> = ({
  isOpen,
  onClose,
  activeConcursoId,
  activeConcursoNome,
  initialTab = 'history',
  onNavigateToStudy,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'xray'>(initialTab);
  const [loading, setLoading] = useState(false);

  // Filters
  const [disciplinaFilter, setDisciplinaFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');

  // History State
  const [historyData, setHistoryData] = useState<QuestionHistoryResponse | null>(null);

  // X-Ray State
  const [xrayData, setXrayData] = useState<PerformanceXRayData | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadHistory = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeConcursoId) params.append('concursoId', activeConcursoId);
    if (disciplinaFilter !== 'ALL') params.append('disciplina', disciplinaFilter);
    if (resultFilter !== 'ALL') params.append('result', resultFilter);
    if (periodFilter !== 'ALL') params.append('period', periodFilter);

    fetch(`/api/v1/analytics/question-history?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: QuestionHistoryResponse | null) => {
        if (data) setHistoryData(data);
      })
      .catch((err) => console.error('Erro ao carregar histórico:', err))
      .finally(() => setLoading(false));
  };

  const loadXRay = () => {
    setLoading(true);
    const url = activeConcursoId
      ? `/api/v1/analytics/performance-xray?concursoId=${encodeURIComponent(activeConcursoId)}`
      : '/api/v1/analytics/performance-xray';

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PerformanceXRayData | null) => {
        if (data) setXrayData(data);
      })
      .catch((err) => console.error('Erro ao carregar raio-x:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'history') {
      loadHistory();
    } else {
      loadXRay();
    }
  }, [isOpen, activeTab, disciplinaFilter, resultFilter, periodFilter, activeConcursoId]);

  if (!isOpen) return null;

  // Extract unique disciplines for the filter dropdown from items or breakdown
  const availableDisciplines = Array.from(
    new Set([
      ...(historyData?.items.map((i) => i.discipline).filter(Boolean) || []),
      ...(xrayData?.disciplineBreakdown.map((d) => d.disciplina).filter(Boolean) || []),
    ])
  );

  return (
    <div className="history-modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="history-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-modal-title">
            <h3>
              <span>🎯</span>
              {activeTab === 'history' ? 'Rastreabilidade Completa de Questões' : 'Raio-X de Desempenho Real'}
            </h3>
            <p className="history-modal-subtitle">
              Concurso: <strong style={{ color: '#60a5fa' }}>{activeConcursoNome || 'Geral'}</strong> • Dados 100% calculados a partir dos eventos do banco
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="history-modal-tabs">
          <button
            className={`history-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 Histórico Detalhado ({historyData?.totalAttempts ?? 0} resoluções)
          </button>
          <button
            className={`history-tab-btn ${activeTab === 'xray' ? 'active' : ''}`}
            onClick={() => setActiveTab('xray')}
          >
            🔬 Raio-X & Diagnóstico Pedagógico
          </button>
        </div>

        {/* Modal Content */}
        <div className="history-modal-content">
          {activeTab === 'history' && (
            <>
              {/* Summary Badges distinguishing unique questions vs attempts */}
              {historyData && (
                <div className="history-kpi-bar">
                  <div className="history-kpi-item">
                    <span className="history-kpi-label">Tentativas Totais</span>
                    <span className="history-kpi-value">{historyData.totalAttempts}</span>
                    <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Total de cliques "Responder"</small>
                  </div>
                  <div className="history-kpi-item">
                    <span className="history-kpi-label">Questões Únicas</span>
                    <span className="history-kpi-value" style={{ color: '#38bdf8' }}>
                      {historyData.uniqueQuestionsCount}
                    </span>
                    <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Itens distintos do banco</small>
                  </div>
                  <div className="history-kpi-item">
                    <span className="history-kpi-label">Acertos</span>
                    <span className="history-kpi-value" style={{ color: '#34d399' }}>
                      {historyData.correctCount}
                    </span>
                  </div>
                  <div className="history-kpi-item">
                    <span className="history-kpi-label">Erros</span>
                    <span className="history-kpi-value" style={{ color: '#f87171' }}>
                      {historyData.incorrectCount}
                    </span>
                  </div>
                  <div className="history-kpi-item">
                    <span className="history-kpi-label">Acurácia Real</span>
                    <span className="history-kpi-value" style={{ color: historyData.accuracyRate >= 70 ? '#34d399' : '#fbbf24' }}>
                      {historyData.accuracyRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Filters Bar */}
              <div className="history-filters-bar">
                <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Filtrar por:</span>

                <select
                  className="history-filter-select"
                  value={disciplinaFilter}
                  onChange={(e) => setDisciplinaFilter(e.target.value)}
                >
                  <option value="ALL">Todas as Disciplinas</option>
                  {availableDisciplines.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  className="history-filter-select"
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                >
                  <option value="ALL">Todos os Resultados</option>
                  <option value="CORRECT">Apenas Acertos</option>
                  <option value="INCORRECT">Apenas Erros</option>
                  <option value="ANULADA">Apenas Anuladas</option>
                </select>

                <select
                  className="history-filter-select"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                >
                  <option value="ALL">Todo o Período</option>
                  <option value="TODAY">Resolvidas Hoje</option>
                  <option value="WEEK">Últimos 7 Dias</option>
                  <option value="MONTH">Últimos 30 Dias</option>
                </select>

                <button
                  className="btn btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.8rem', marginLeft: 'auto' }}
                  onClick={loadHistory}
                >
                  🔄 Atualizar
                </button>
              </div>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  Carregando resoluções auditadas do banco de dados...
                </div>
              )}

              {/* Empty state */}
              {!loading && (!historyData || historyData.items.length === 0) && (
                <div style={{ textAlign: 'center', padding: '3.5rem', background: '#131722', borderRadius: '12px' }}>
                  <h4 style={{ color: '#f1f5f9', margin: '0 0 0.5rem 0' }}>Nenhuma questão respondida ainda</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 1.25rem 0' }}>
                    Resolva questões no banco de questões ou inicie uma sessão de estudos para acompanhar o histórico detalhado.
                  </p>
                  {onNavigateToStudy && (
                    <button
                      className="btn"
                      onClick={() => {
                        onClose();
                        onNavigateToStudy();
                      }}
                    >
                      🚀 Resolver Questões Agora
                    </button>
                  )}
                </div>
              )}

              {/* Itemized Questions List */}
              {!loading && historyData && historyData.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {historyData.items.map((item) => {
                    const isAnulada = item.gabaritoStatus === 'ANULADA';
                    const isCorrect = item.isCorrect === true;
                    const isIncorrect = item.isCorrect === false;

                    return (
                      <div key={item.eventId} className="history-item-card">
                        <div className="history-item-top">
                          <div className="history-tags">
                            <span className="htag htag-disc">{item.discipline}</span>
                            {item.topic && <span className="htag htag-topic">{item.topic}</span>}
                            {item.board && <span className="htag htag-board">{item.board} {item.year ? `(${item.year})` : ''}</span>}
                            {item.totalAttemptsForQuestion > 1 && (
                              <span className="htag" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
                                Tentativa {item.attemptNumber} de {item.totalAttemptsForQuestion}
                              </span>
                            )}
                          </div>

                          <div>
                            {isAnulada ? (
                              <span className="badge-result result-anulada">⚖️ Anulada (+1 pt)</span>
                            ) : isCorrect ? (
                              <span className="badge-result result-correct">✓ Acerto</span>
                            ) : isIncorrect ? (
                              <span className="badge-result result-incorrect">✗ Erro</span>
                            ) : (
                              <span className="badge-result result-anulada">ℹ️ Sem Gabarito</span>
                            )}
                          </div>
                        </div>

                        {/* Statement */}
                        <div className="history-statement">
                          {item.statement}
                        </div>

                        {/* Options */}
                        {item.options && item.options.length > 0 && (
                          <div className="history-options-box">
                            {item.options.map((opt, idx) => {
                              const letter = opt.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
                              const isUserPick = item.selectedOption && item.selectedOption.toUpperCase() === letter;
                              const isOfficialCorrect = item.correctOption && item.correctOption.toUpperCase() === letter;

                              let className = 'history-option-row';
                              if (isOfficialCorrect) className += ' opt-correct';
                              else if (isUserPick && !isCorrect) className += ' opt-selected';

                              return (
                                <div key={idx} className={className}>
                                  <strong>{letter ? `${letter})` : '•'}</strong>
                                  <span>{opt.replace(/^([A-E])\)?\s*/i, '')}</span>
                                  {isUserPick && (
                                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700 }}>
                                      (Sua escolha)
                                    </span>
                                  )}
                                  {isOfficialCorrect && !isUserPick && (
                                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700 }}>
                                      (Gabarito Oficial)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Footer Details */}
                        <div className="history-item-footer">
                          <span>
                            📅 {item.occurredAt ? new Date(item.occurredAt).toLocaleString('pt-BR') : 'Data não informada'}
                          </span>
                          <span>
                            ⏱️ Tempo: {(item.activeTimeMs / 1000).toFixed(1)}s • Confiança: {item.confidenceLevel}/5
                          </span>
                          {item.causaErro && (
                            <span style={{ color: '#f87171', fontWeight: 600 }}>
                              Diagnóstico de Erro: {item.causaErro}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'xray' && (
            <>
              {loading && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  Calculando Raio-X analítico em tempo real...
                </div>
              )}

              {!loading && (!xrayData || xrayData.totalAttempts === 0) && (
                <div style={{ textAlign: 'center', padding: '3.5rem', background: '#131722', borderRadius: '12px' }}>
                  <h4 style={{ color: '#f1f5f9', margin: '0 0 0.5rem 0' }}>Não há dados suficientes para gerar o Raio-X</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 1.25rem 0' }}>
                    O Raio-X é alimentado estritamente pelas questões respondidas no banco de dados. Resolva suas primeiras questões para visualizar a análise por matéria e os pontos de atenção.
                  </p>
                  {onNavigateToStudy && (
                    <button
                      className="btn"
                      onClick={() => {
                        onClose();
                        onNavigateToStudy();
                      }}
                    >
                      🚀 Começar a Praticar
                    </button>
                  )}
                </div>
              )}

              {!loading && xrayData && xrayData.totalAttempts > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* KPI Summary */}
                  <div className="history-kpi-bar">
                    <div className="history-kpi-item">
                      <span className="history-kpi-label">Total de Resoluções</span>
                      <span className="history-kpi-value">{xrayData.totalAttempts}</span>
                    </div>
                    <div className="history-kpi-item">
                      <span className="history-kpi-label">Questões Únicas</span>
                      <span className="history-kpi-value" style={{ color: '#38bdf8' }}>{xrayData.uniqueQuestions}</span>
                    </div>
                    <div className="history-kpi-item">
                      <span className="history-kpi-label">Acurácia Global</span>
                      <span className="history-kpi-value" style={{ color: xrayData.accuracyRate >= 70 ? '#34d399' : '#fbbf24' }}>
                        {xrayData.accuracyRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="history-kpi-item">
                      <span className="history-kpi-label">Tempo Médio / Item</span>
                      <span className="history-kpi-value" style={{ color: '#cbd5e1' }}>
                        {(xrayData.averageTimePerQuestionMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="history-kpi-item">
                      <span className="history-kpi-label">Itens Restantes no Banco</span>
                      <span className="history-kpi-value" style={{ color: '#a78bfa' }}>
                        {xrayData.unansweredQuestionsCount}
                      </span>
                    </div>
                  </div>

                  {/* Two Columns Grid: Error Areas vs Mastered Areas */}
                  <div className="xray-grid">
                    {/* Top Error Areas */}
                    <div className="xray-card" style={{ borderLeft: '4px solid #ef4444' }}>
                      <h4 style={{ color: '#f87171' }}>
                        ⚠️ Assuntos Críticos (Maior Concentração de Erros)
                      </h4>
                      {xrayData.topErrorAreas.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nenhum erro registrado até o momento.</p>
                      ) : (
                        <table className="xray-table">
                          <thead>
                            <tr>
                              <th>Tópico</th>
                              <th>Disciplina</th>
                              <th>Erros</th>
                              <th>Acurácia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {xrayData.topErrorAreas.map((t, idx) => (
                              <tr key={idx}>
                                <td><strong>{t.topic}</strong></td>
                                <td style={{ color: '#94a3b8' }}>{t.disciplina}</td>
                                <td style={{ color: '#f87171', fontWeight: 700 }}>{t.incorrectCount}</td>
                                <td>{t.accuracyRate.toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Mastered Areas */}
                    <div className="xray-card" style={{ borderLeft: '4px solid #10b981' }}>
                      <h4 style={{ color: '#34d399' }}>
                        🏆 Assuntos com Bom Domínio Demonstrado (&gt; 75%)
                      </h4>
                      {xrayData.masteredAreas.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          Ainda não há tópicos com mais de 2 resoluções e acurácia acima de 75%.
                        </p>
                      ) : (
                        <table className="xray-table">
                          <thead>
                            <tr>
                              <th>Tópico</th>
                              <th>Disciplina</th>
                              <th>Itens</th>
                              <th>Acurácia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {xrayData.masteredAreas.map((t, idx) => (
                              <tr key={idx}>
                                <td><strong>{t.topic}</strong></td>
                                <td style={{ color: '#94a3b8' }}>{t.disciplina}</td>
                                <td>{t.totalAttempts}</td>
                                <td style={{ color: '#34d399', fontWeight: 700 }}>{t.accuracyRate.toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Discipline Breakdown Table */}
                  <div className="xray-card">
                    <h4>📚 Desempenho Auditado por Disciplina</h4>
                    <table className="xray-table">
                      <thead>
                        <tr>
                          <th>Disciplina</th>
                          <th>Resoluções</th>
                          <th>Itens Únicos</th>
                          <th>Acertos</th>
                          <th>Acurácia</th>
                          <th>Tempo Médio</th>
                          <th>Status</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xrayData.disciplineBreakdown.map((d, idx) => (
                          <tr key={idx}>
                            <td><strong>{d.disciplina}</strong></td>
                            <td>{d.totalAttempts}</td>
                            <td>{d.uniqueQuestions}</td>
                            <td>{d.correctCount}</td>
                            <td>
                              <strong style={{ color: d.accuracyRate >= 70 ? '#34d399' : '#fbbf24' }}>
                                {d.accuracyRate.toFixed(1)}%
                              </strong>
                            </td>
                            <td>{(d.averageTimeMs / 1000).toFixed(1)}s</td>
                            <td>
                              <span className={`status-badge status-${d.status.toLowerCase()}`}>
                                {d.status === 'DOMINADO' ? 'DOMINADO' : d.status === 'EM_EVOLUCAO' ? 'EM EVOLUÇÃO' : 'ATENÇÃO'}
                              </span>
                            </td>
                            <td>
                              {onNavigateToStudy && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() => {
                                    onClose();
                                    onNavigateToStudy(d.disciplina);
                                  }}
                                >
                                  Praticar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
