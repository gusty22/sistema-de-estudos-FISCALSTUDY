import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './Dashboard.css';

interface DashboardProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToTab: (tab: any, params?: any) => void;
}

interface EditalTopic {
  id: string;
  disciplina: string;
  assunto: string;
  peso: number;
  questoesPrevistas: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeConcurso, onNavigateToTab }) => {
  const [stats, setStats] = useState({
    totalQuestionsSolved: 0,
    totalCorrect: 0,
    accuracyRate: 0,
    accuracyCalibrated: false, // true only if >= 30 questions
    studyHoursWeek: 12.5, // simulated from sessions or default
  });
  const [topics, setTopics] = useState<EditalTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real statistics & topics
  useEffect(() => {
    if (!activeConcurso) return;
    setIsLoading(true);

    // Fetch topics for this concurso via EditalController
    fetch(`/api/v1/concursos/${activeConcurso.id}/edital`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.topicos) setTopics(data.topicos);
      })
      .catch((err) => console.warn('Erro ao buscar tópicos do edital:', err));

    // Fetch study session summary for real tracked hours
    fetch(`/api/v1/study-sessions/summary?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.totalHours !== undefined) {
          setStats((prev) => ({
            ...prev,
            studyHoursWeek: data.totalHours,
          }));
        }
      })
      .catch(() => {});

    // Fetch analytics / overview
    fetch('/api/v1/analytics/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const total = data.totalAnswered || 0;
          const correct = data.correctCount || 0;
          const acc = data.globalAccuracy !== undefined ? data.globalAccuracy : (total > 0 ? (correct / total) * 100 : 0);
          setStats((prev) => ({
            ...prev,
            totalQuestionsSolved: total,
            totalCorrect: correct,
            accuracyRate: acc,
            accuracyCalibrated: total >= 30,
          }));
        }
      })
      .catch((err) => console.warn('Erro ao carregar estatísticas:', err))
      .finally(() => setIsLoading(false));
  }, [activeConcurso]);

  // Calculate days remaining to exam
  const getDaysRemaining = (): number | null => {
    if (!activeConcurso?.dataProva) return null;
    const examDate = new Date(activeConcurso.dataProva);
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysLeft = getDaysRemaining();

  // Weekly hours target from disponibilidadeJson if present
  let weeklyHoursTarget = 28;
  try {
    if (activeConcurso?.disponibilidadeJson) {
      const parsed = JSON.parse(activeConcurso.disponibilidadeJson);
      if (parsed.totalSemana) weeklyHoursTarget = parsed.totalSemana;
    }
  } catch (e) {}

  // "O Que Estudar Agora?" Recommendation Engine (Deterministic MVT)
  // Recommends top priority based on edital topics and lowest recent accuracy or unstudied topic
  const getRecommendation = () => {
    if (topics.length > 0) {
      // Pick highest weight topic
      const sorted = [...topics].sort((a, b) => (b.peso || 1) - (a.peso || 1));
      const topTopic = sorted[0];
      return {
        disciplina: topTopic.disciplina,
        assunto: topTopic.assunto,
        atividade: 'Resolução de Questões da Banca ' + (activeConcurso?.banca || 'Oficial'),
        tempoMinutos: 45,
        motivo: `Maior peso programático (${topTopic.peso || '1.0'}) no edital oficial com questões no banco.`,
      };
    }
    return {
      disciplina: 'Legislação Tributária Municipal & Direito Tributário',
      assunto: 'Impostos Municipais (ISSQN, IPTU, ITBI)',
      atividade: 'Resolução de Questões com Justificativa e Classificação de Erros',
      tempoMinutos: 45,
      motivo: 'Disciplina central de maior recorrência em concursos de Auditoria e Fiscalização.',
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="dashboard-container animate-fade-in">
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '0.4rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          Atualizando dados do concurso...
        </div>
      )}
      {/* Top Banner / Contest Info */}
      <div className="dashboard-header glass">
        <div className="header-info">
          <div className="contest-title-row">
            <h2>{activeConcurso ? activeConcurso.nome : 'Nenhum Concurso Selecionado'}</h2>
            <span className="badge-situacao">
              {activeConcurso?.situacao || 'EM_PREPARACAO'}
            </span>
          </div>
          <p className="contest-desc">
            {activeConcurso?.cargo || 'Cargo Fiscal'} • {activeConcurso?.orgao || 'Órgão Oficial'} • Banca {activeConcurso?.banca || 'N/D'}
          </p>
        </div>

        {daysLeft !== null ? (
          <div className={`countdown-card ${daysLeft < 30 ? 'urgent' : ''}`}>
            <span className="countdown-number">{daysLeft > 0 ? daysLeft : '0'}</span>
            <span className="countdown-label">{daysLeft > 0 ? 'dias até a prova' : 'prova transcorrida'}</span>
            <span className="countdown-date">
              {new Date(activeConcurso!.dataProva!).toLocaleDateString('pt-BR')} ({activeConcurso?.dataProvaTipo || 'OFICIAL'})
            </span>
          </div>
        ) : (
          <div className="countdown-card">
            <span className="countdown-number">—</span>
            <span className="countdown-label">Data da prova</span>
            <button 
              className="btn-set-date" 
              onClick={() => onNavigateToTab('concursos')}
            >
              Definir data
            </button>
          </div>
        )}
      </div>

      {/* 5 Top KPIs Row */}
      <div className="kpi-grid">
        {/* KPI 1: Horas de Estudo */}
        <div className="kpi-card glass">
          <div className="kpi-header">
            <span className="kpi-icon">⏱️</span>
            <span className="kpi-title">Horas Esta Semana</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{stats.studyHoursWeek}h</span>
            <span className="kpi-target">/ {weeklyHoursTarget}h meta</span>
          </div>
          <div className="kpi-progress-bar">
            <div
              className="kpi-progress-fill"
              style={{ width: `${Math.min((stats.studyHoursWeek / weeklyHoursTarget) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Questões Resolvidas */}
        <div className="kpi-card glass">
          <div className="kpi-header">
            <span className="kpi-icon">📝</span>
            <span className="kpi-title">Questões Feitas</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{stats.totalQuestionsSolved}</span>
            <span className="kpi-subtitle">respostas registradas</span>
          </div>
          <span className="kpi-tag-sub">Event Store Append-Only</span>
        </div>

        {/* KPI 3: Taxa de Acerto Geral */}
        <div className="kpi-card glass">
          <div className="kpi-header">
            <span className="kpi-icon">🎯</span>
            <span className="kpi-title">Taxa de Acerto</span>
          </div>
          <div className="kpi-body">
            {stats.accuracyCalibrated ? (
              <span className="kpi-value text-green">{stats.accuracyRate.toFixed(1)}%</span>
            ) : (
              <div>
                <span className="kpi-value" style={{ fontSize: '1.25rem', color: '#f59e0b' }}>
                  {stats.totalQuestionsSolved > 0 ? `${stats.accuracyRate.toFixed(1)}%*` : '0%'}
                </span>
                <span className="kpi-tag-calibration">
                  {stats.totalQuestionsSolved < 30 ? 'Em Calibração (<30 questões)' : 'Calibrado'}
                </span>
              </div>
            )}
          </div>
          <span className="kpi-subtitle">
            {stats.totalCorrect} acertos de {stats.totalQuestionsSolved} tentativas
          </span>
        </div>

        {/* KPI 4: Simulado Recente */}
        <div className="kpi-card glass">
          <div className="kpi-header">
            <span className="kpi-icon">🏆</span>
            <span className="kpi-title">Último Simulado</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value" style={{ fontSize: '1.2rem', color: '#94a3b8' }}>
              Nenhum ainda
            </span>
          </div>
          <button 
            className="kpi-link-btn"
            onClick={() => onNavigateToTab('simulados')}
          >
            + Iniciar Simulado Rápido
          </button>
        </div>

        {/* KPI 5: Cobertura do Edital */}
        <div className="kpi-card glass">
          <div className="kpi-header">
            <span className="kpi-icon">📋</span>
            <span className="kpi-title">Tópicos do Edital</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{topics.length}</span>
            <span className="kpi-subtitle">tópicos cadastrados</span>
          </div>
          <button 
            className="kpi-link-btn"
            onClick={() => onNavigateToTab('edital')}
          >
            Ver Árvore Completa →
          </button>
        </div>
      </div>

      {/* CENTRAL CARD: "O Que Estudar Agora?" */}
      <div className="recommendation-card glass">
        <div className="rec-glow-accent" />
        <div className="rec-header">
          <div className="rec-badge">
            <span className="pulse-dot" />
            <span>PRESCRIÇÃO ADAPTATIVA MVT</span>
          </div>
          <span className="rec-timer">⏱️ Duração Sugerida: {recommendation.tempoMinutos} min</span>
        </div>

        <div className="rec-content">
          <div className="rec-main">
            <span className="rec-discipline">{recommendation.disciplina}</span>
            <h3 className="rec-subject">{recommendation.assunto}</h3>
            <p className="rec-activity">
              🎯 <strong>Atividade:</strong> {recommendation.atividade}
            </p>
            <div className="rec-reason">
              💡 <strong>Por que este tópico?</strong> {recommendation.motivo}
            </div>
          </div>

          <div className="rec-actions">
            <button
              className="btn btn-rec-action"
              onClick={() => onNavigateToTab('study', { disciplina: recommendation.disciplina })}
            >
              ▶ Praticar Questões
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateToTab('materiais')}
            >
              📚 Ver Teoria / Material
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateToTab('cronograma')}
            >
              📅 Ver Cronograma
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Quick Actions & Priority Disciplines */}
      <div className="dashboard-bottom-grid">
        {/* Disciplinas Estratégicas */}
        <div className="strategic-disciplines-card glass">
          <div className="card-section-title">
            <h4>Disciplinas Estratégicas do Concurso</h4>
            <span className="card-sub-info">Classificação por peso no edital</span>
          </div>

          <div className="disciplines-list">
            {[
              { nome: 'Legislação Tributária Municipal/Estadual', peso: 2.0, questoes: 25, status: 'Crítica' },
              { nome: 'Direito Tributário', peso: 2.0, questoes: 20, status: 'Crítica' },
              { nome: 'Contabilidade Geral e Avançada', peso: 1.5, questoes: 15, status: 'Alta' },
              { nome: 'Direito Constitucional e Administrativo', peso: 1.0, questoes: 10, status: 'Média' },
              { nome: 'Auditoria Fiscal', peso: 1.5, questoes: 15, status: 'Alta' },
            ].map((d, i) => (
              <div key={i} className="discipline-item">
                <div className="disc-info">
                  <span className="disc-name">{d.nome}</span>
                  <span className="disc-meta">Peso: {d.peso} • {d.questoes} questões previstas</span>
                </div>
                <div className="disc-badge-container">
                  <span className={`disc-badge ${d.status === 'Crítica' ? 'badge-critical' : 'badge-high'}`}>
                    {d.status}
                  </span>
                  <button
                    className="btn-disc-study"
                    onClick={() => onNavigateToTab('study', { disciplina: d.nome })}
                  >
                    Praticar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tools & Workflow Shortcuts */}
        <div className="quick-actions-card glass">
          <div className="card-section-title">
            <h4>Ações Rápidas de Preparação</h4>
            <span className="card-sub-info">Acesso direto aos módulos de alta produtividade</span>
          </div>

          <div className="quick-buttons-grid">
            <button className="quick-action-btn" onClick={() => onNavigateToTab('study')}>
              <span className="quick-action-icon">📝</span>
              <div className="quick-action-text">
                <strong>Nova Sessão de Questões</strong>
                <span>Filtro por banca, cargo e disciplinas</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('simulados')}>
              <span className="quick-action-icon">🎯</span>
              <div className="quick-action-text">
                <strong>Simulado Cronometrado</strong>
                <span>Modo prova com gabarito no final</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('revisoes')}>
              <span className="quick-action-icon">🔄</span>
              <div className="quick-action-text">
                <strong>Caderno de Erros (E1 a E6)</strong>
                <span>Refazer questões com causa mapeada</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('import')}>
              <span className="quick-action-icon">📥</span>
              <div className="quick-action-text">
                <strong>Importar Nova Prova / PDF</strong>
                <span>Extração com Docling & PyMuPDF</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
