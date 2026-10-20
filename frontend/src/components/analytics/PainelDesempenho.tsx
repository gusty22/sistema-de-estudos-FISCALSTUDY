import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import {
  TrendingUp,
  Brain,
  Layers,
  Download,
  ChevronRight,
  ShieldAlert,
  BarChart3
} from 'lucide-react';
import { AnaliseConteudoModal } from './AnaliseConteudoModal';
import { CalibracaoRetencaoAbas } from './CalibracaoRetencaoAbas';
import { AuditoriaAnomaliasEstudo } from './AuditoriaAnomaliasEstudo';
import './PainelDesempenho.css';

export interface PainelDesempenhoProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy?: (disciplina?: string, assunto?: string) => void;
  onNavigateToRevision?: () => void;
  onNavigateToCycle?: () => void;
  onNavigateToQuestions?: () => void;
}

export const PainelDesempenho: React.FC<PainelDesempenhoProps> = ({
  activeConcurso,
  onNavigateToStudy,
  onNavigateToRevision,
  onNavigateToCycle,
  onNavigateToQuestions
}) => {
  // Aba principal: Painel T26 vs Calibração/Retenção T28 vs Auditoria Anomalias T29
  const [activeMainTab, setActiveMainTab] = useState<'T26_PAINEL' | 'T28_CALIBRACAO' | 'T29_ANOMALIAS'>('T26_PAINEL');

  // Filtro de período para o gráfico temporal
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'MONTH' | 'WEEK' | 'TODAY'>('ALL');

  // Dados da API
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Estado T27: Conteúdo selecionado para Análise Detalhada
  const [selectedContent, setSelectedContent] = useState<{ disciplina: string; topico: string } | null>(null);

  const loadDashboard = () => {
    setIsLoading(true);
    fetch(`/api/v1/analytics/dashboard?concursoId=${encodeURIComponent(activeConcurso?.id || '')}&period=${periodFilter}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setDashboardData(data);
      })
      .catch(err => console.warn('Erro ao carregar dashboard de desempenho:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [activeConcurso, periodFilter]);

  // Exportação para R
  const handleExportR = async () => {
    setExportStatus('Exportando dataset para o motor em R...');
    try {
      const res = await fetch('/api/v1/analytics/export');
      if (!res.ok) throw new Error('Falha no download');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiscalstudy_attempts_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setExportStatus('✓ CSV exportado para análise psicométrica!');
      setTimeout(() => setExportStatus(null), 3500);
    } catch {
      setExportStatus('Erro na exportação');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const summary = dashboardData?.resumo || {
    questoesRespondidas: 0,
    questoesAvaliadas: 0,
    acertos: 0,
    erros: 0,
    precisaoPercentual: 0.0,
    precisaoDenominador: '0% — 0 acertos em 0 questões',
    tempoEfetivoFormatado: '0 min',
    conteudosTrabalhados: 0,
    revisoesExecutadas: 0,
    isPreliminar: true
  };

  const evolucao: any[] = dashboardData?.evolucao || [];
  const distribuicao: any[] = dashboardData?.distribuicao || [];
  const alertas: any[] = dashboardData?.alertas || [];

  return (
    <div className="painel-desempenho-view">
      {/* Top Header */}
      <header className="desempenho-header">
        <div className="desempenho-header-left">
          <div className="header-pill">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            MÓDULO G — DESEMPENHO E INTELIGÊNCIA
          </div>
          <h1 className="desempenho-title">Painel de Desempenho & Inteligência</h1>
          <p className="desempenho-subtitle">
            Visão longitudinal confiável da preparação para{' '}
            <strong>{activeConcurso?.nome || 'o Concurso Ativo'}</strong>
          </p>
        </div>

        <div className="desempenho-header-right">
          <button className="btn-export-r" onClick={handleExportR}>
            <Download className="w-4 h-4 inline mr-1.5" />
            Dataset para R
          </button>
        </div>
      </header>

      {exportStatus && (
        <div className="export-status-banner animate-fade-in">{exportStatus}</div>
      )}

      {isLoading && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', margin: '-0.5rem 0 0.5rem 0' }}>
          Atualizando métricas longitudinais de desempenho...
        </div>
      )}

      {/* Tabs Switcher: T26 vs T28 */}
      <div className="desempenho-main-nav">
        <button
          className={`nav-tab-btn ${activeMainTab === 'T26_PAINEL' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('T26_PAINEL')}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Painel de Desempenho & Conteúdos
        </button>

        <button
          className={`nav-tab-btn ${activeMainTab === 'T28_CALIBRACAO' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('T28_CALIBRACAO')}
        >
          <Brain className="w-4 h-4 inline mr-2" />
          Calibração, Retenção & Modelo do Estudante
        </button>

        <button
          className={`nav-tab-btn ${activeMainTab === 'T29_ANOMALIAS' ? 'active' : ''}`}
          onClick={() => setActiveMainTab('T29_ANOMALIAS')}
        >
          <ShieldAlert className="w-4 h-4 inline mr-2 text-rose-500" />
          Auditoria de Anomalias (Diagnóstico Automático)
        </button>
      </div>

      {/* =========================================================================
          ABA PRINCIPAL: T26 — PAINEL DE DESEMPENHO
          ========================================================================= */}
      {activeMainTab === 'T26_PAINEL' && (
        <div className="t26-content animate-fade-in">
          {/* 1. RESUMO: 5 Métricas Centrais */}
          <section className="resumo-grid">
            <div className="resumo-card">
              <span className="resumo-label">Questões Respondidas</span>
              <div className="resumo-num-box">
                <span className="resumo-num">{summary.questoesRespondidas}</span>
                <span className="resumo-subnum">({summary.questoesAvaliadas} avaliadas)</span>
              </div>
              <span className="resumo-hint">Exclui itens anulados da banca</span>
            </div>

            <div className="resumo-card highlight-precisao">
              <span className="resumo-label">Precisão Observada</span>
              <div className="resumo-num-box">
                <span className="resumo-num text-emerald-400">
                  {summary.precisaoDenominador}
                </span>
              </div>
              {summary.isPreliminar ? (
                <span className="resumo-preliminar-warning">
                  ⚠️ Amostra preliminar (&lt; 15 itens). Conclusão estatística não definitiva.
                </span>
              ) : (
                <span className="resumo-hint">Denominador auditado em todas as métricas</span>
              )}
            </div>

            <div className="resumo-card">
              <span className="resumo-label">Tempo Efetivo de Estudo</span>
              <div className="resumo-num-box">
                <span className="resumo-num">{summary.tempoEfetivoFormatado}</span>
              </div>
              <span className="resumo-hint">Tempo líquido ativo de resolução</span>
            </div>

            <div className="resumo-card">
              <span className="resumo-label">Conteúdos Trabalhados</span>
              <div className="resumo-num-box">
                <span className="resumo-num">{summary.conteudosTrabalhados}</span>
                <span className="resumo-subnum">tópicos do edital</span>
              </div>
              <span className="resumo-hint">Cobertura ativa demonstrada</span>
            </div>

            <div className="resumo-card">
              <span className="resumo-label">Revisões Executadas</span>
              <div className="resumo-num-box">
                <span className="resumo-num text-indigo-400">{summary.revisoesExecutadas}</span>
                <span className="resumo-subnum">ciclos concluídos</span>
              </div>
              <span className="resumo-hint">Recuperação ativa com evidência</span>
            </div>
          </section>

          {/* 2. EVOLUÇÃO TEMPORAL */}
          <section className="evolucao-section">
            <div className="evolucao-header-row">
              <div className="section-title-box">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="section-heading">Evolução Temporal de Desempenho</h2>
                <span className="section-subtext">Taxa de acertos diária com denominador explícito</span>
              </div>

              {/* Filtros de Período */}
              <div className="period-filter-group">
                <button
                  className={`filter-btn ${periodFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setPeriodFilter('ALL')}
                >
                  Tudo
                </button>
                <button
                  className={`filter-btn ${periodFilter === 'MONTH' ? 'active' : ''}`}
                  onClick={() => setPeriodFilter('MONTH')}
                >
                  30 Dias
                </button>
                <button
                  className={`filter-btn ${periodFilter === 'WEEK' ? 'active' : ''}`}
                  onClick={() => setPeriodFilter('WEEK')}
                >
                  7 Dias
                </button>
                <button
                  className={`filter-btn ${periodFilter === 'TODAY' ? 'active' : ''}`}
                  onClick={() => setPeriodFilter('TODAY')}
                >
                  Hoje
                </button>
              </div>
            </div>

            {/* Gráfico / Barras de Evolução */}
            {evolucao.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                Nenhum dado temporal registrado neste período. Resolva questões para visualizar sua curva de progresso.
              </div>
            ) : (
              <div className="evolucao-bars-grid">
                {evolucao.map((pt: any, idx: number) => (
                  <div key={idx} className="evolucao-col">
                    <div className="evolucao-bar-container">
                      <div
                        className="evolucao-bar-fill"
                        style={{ height: `${Math.max(15, pt.precisaoPercentual)}%` }}
                      />
                      <span className="evolucao-percent-label">{pt.precisaoPercentual}%</span>
                    </div>
                    <span className="evolucao-date-label">{pt.data}</span>
                    <span className="evolucao-denominador-label">{pt.denominador}</span>
                    {pt.isPreliminar && (
                      <span className="preliminar-mini-badge" title="Amostra pequena (< 15 questões)">
                        *preliminar
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. ALERTAS CANÔNICOS */}
          <section className="alertas-section">
            <div className="section-title-box">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h2 className="section-heading">Alertas Pedagógicos & Metaconscienciosos</h2>
              <span className="section-subtext">Detecção de riscos e pontos de atenção pelo Gêmeo Digital</span>
            </div>

            {alertas.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed rgba(255,255,255,0.08)' }}>
                Nenhum ponto cego crítico ou alerta de retenção pendente diagnosticado no momento.
              </div>
            ) : (
              <div className="alertas-grid">
                {alertas.map((al: any, idx: number) => (
                  <div
                    key={idx}
                    className={`alerta-card ${al.tipo.toLowerCase()}`}
                    onClick={() => setSelectedContent({ disciplina: al.disciplina, topico: al.topico })}
                    title="Clique para abrir a Análise Detalhada deste Conteúdo"
                  >
                    <div className="alerta-card-header">
                      <span className="alerta-badge">{al.badge}</span>
                      <span className="alerta-disc">{al.disciplina}</span>
                    </div>
                    <h3 className="alerta-titulo">{al.titulo}</h3>
                    <p className="alerta-desc">{al.descricao}</p>
                    <div className="alerta-footer">
                      <span>{al.topico}</span>
                      <span className="alerta-cta">
                        Analisar conteúdo <ChevronRight className="w-3.5 h-3.5 inline" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. DISTRIBUIÇÃO POR CONTEÚDO */}
          <section className="distribuicao-section">
            <div className="section-title-box">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h2 className="section-heading">Distribuição por Conteúdo</h2>
              <span className="section-subtext">Disciplinas e assuntos auditados com denominadores estritos</span>
            </div>

            <div className="tabela-conteudos-container">
              {distribuicao.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Nenhum conteúdo com resoluções registradas ainda. Inicie sua primeira sessão de estudo no edital.
                </div>
              ) : (
                <table className="tabela-conteudos">
                  <thead>
                    <tr>
                      <th>Disciplina</th>
                      <th>Tópico Curricular</th>
                      <th>Respondidas</th>
                      <th>Precisão Observada</th>
                      <th>Domínio Real (P<sub>atual</sub>)</th>
                      <th>Tempo Médio</th>
                      <th>Amostra</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribuicao.map((item: any, idx: number) => {
                      const pReal = item.proficienciaAtualPct !== undefined ? item.proficienciaAtualPct : item.precisaoPercentual;
                      const realColor = pReal >= 80 ? '#34d399' : (pReal >= 65 ? '#60a5fa' : (pReal >= 45 ? '#fbbf24' : '#f87171'));
                      return (
                        <tr key={idx}>
                          <td className="font-semibold">{item.disciplina}</td>
                          <td>{item.topico}</td>
                          <td>
                            <span className="font-bold">{item.total}</span> itens ({item.acertos}A / {item.erros}E)
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="font-semibold" style={{ textDecoration: item.mediaSimplesEnganosa ? 'line-through' : 'none', color: item.mediaSimplesEnganosa ? '#94a3b8' : '#34d399' }}>
                                {item.precisaoDenominador}
                              </span>
                              {item.mediaSimplesEnganosa && (
                                <span style={{ fontSize: '0.66rem', color: '#f87171', fontWeight: 700, marginTop: '0.1rem' }}>
                                  ⚠️ Falsa Fluência ({item.deltaTDias}d sem contato)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="font-bold" style={{ color: realColor }}>
                                {pReal}%
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                {item.ultimoContato ? `${item.ultimoContato}` : 'Recente'} {item.forcaMemoriaDias !== undefined ? `(S: ${item.forcaMemoriaDias}d)` : ''}
                              </span>
                            </div>
                          </td>
                          <td>{item.tempoMedioSegundos}s / questão</td>
                          <td>
                            {item.isPreliminar ? (
                              <span className="sample-badge preliminar">Amostra Preliminar (&lt;15)</span>
                            ) : (
                              <span className="sample-badge confiavel">Amostra Robusta</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn-analisar-conteudo"
                              onClick={() => setSelectedContent({ disciplina: item.disciplina, topico: item.topico })}
                              title="Abrir Análise Longitudinal do Conteúdo"
                            >
                              Analisar <ChevronRight className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          ABA PRINCIPAL: T28 — CALIBRAÇÃO, RETENÇÃO E MODELO DO ESTUDANTE
          ========================================================================= */}
      {activeMainTab === 'T28_CALIBRACAO' && (
        <CalibracaoRetencaoAbas
          concursoId={activeConcurso?.id}
          onNavigateToContentAnalysis={(disc, top) => setSelectedContent({ disciplina: disc, topico: top })}
        />
      )}

      {/* =========================================================================
          ABA PRINCIPAL: T29 — AUDITORIA DE ANOMALIAS DE ESTUDO (LOGS)
          ========================================================================= */}
      {activeMainTab === 'T29_ANOMALIAS' && (
        <AuditoriaAnomaliasEstudo
          concursoId={activeConcurso?.id}
          onNavigateToStudy={onNavigateToStudy}
          onNavigateToCycle={onNavigateToCycle}
          onNavigateToQuestions={onNavigateToQuestions}
        />
      )}

      {/* =========================================================================
          MODAL T27: ANÁLISE POR CONTEÚDO
          ========================================================================= */}
      {selectedContent && (
        <AnaliseConteudoModal
          disciplina={selectedContent.disciplina}
          topico={selectedContent.topico}
          concursoId={activeConcurso?.id}
          isOpen={Boolean(selectedContent)}
          onClose={() => setSelectedContent(null)}
          onNavigateToStudy={onNavigateToStudy}
          onNavigateToRevision={onNavigateToRevision}
        />
      )}
    </div>
  );
};
