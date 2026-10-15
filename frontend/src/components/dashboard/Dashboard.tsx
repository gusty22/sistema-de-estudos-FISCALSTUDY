import React, { useState, useEffect, useMemo } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import { QuestionHistoryModal } from './QuestionHistoryModal';
import './Dashboard.css';

interface DashboardProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToTab: (tab: any, params?: any) => void;
  onOpenAnkiHub?: () => void;
}

interface EditalTopic {
  id: string;
  disciplina: string;
  assunto: string;
  peso: number;
  questoesPrevistas: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeConcurso, onNavigateToTab, onOpenAnkiHub }) => {
  const [stats, setStats] = useState({
    totalQuestionsSolved: 0,
    totalCorrect: 0,
    accuracyRate: 0,
    accuracyCalibrated: false, // true only if >= 30 questions
    studyHoursWeek: 0.0,
  });
  const [topics, setTopics] = useState<EditalTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyModalInitialTab, setHistoryModalInitialTab] = useState<'history' | 'xray'>('history');

  // Estados Cognitivos Módulo 1 & 2
  const [timeMetrics, setTimeMetrics] = useState<{
    totalHours: number;
    heHours: number;
    hreHours: number;
    hrePercent: number;
    isHreThresholdExceeded: boolean;
    hreAlertMessage: string;
  } | null>(null);

  const [robinHoodCycle, setRobinHoodCycle] = useState<{
    blocos: Array<{
      sequenceOrder: number;
      type: string;
      disciplina: string;
      duracaoMinutos: number;
      nivelDominioEstrelas: number;
      horasAlocadasDisciplina: number;
      horasTransferidasRobinHood: number;
      mensagemEuDoPassado: string;
    }>;
    recalibracaoObrigatoria: boolean;
    resumoRobinHood: Record<string, string>;
  } | null>(null);

  const [marcouAcabou, setMarcouAcabou] = useState<{
    totalSwitches: number;
    correctToWrongCount: number;
    wrongToCorrectCount: number;
    netPointsScore: number;
    correctToWrongPercent: number;
    marcouAcabouAdvice: string;
  } | null>(null);

  const [latestHandoff, setLatestHandoff] = useState<string | null>(null);

  const [digitalTwinSummary, setDigitalTwinSummary] = useState<{
    horasLiquidasAcumuladas: number;
    metaHorasAprovacao: number;
    progressoMetaPct: number;
    velocidadeLeituraMedia: number;
    velocidadeQuestoesMedia: number;
    rendimentoMedioBlocos: number;
    saudeNeuralMediaPct: number;
    simulacaoRecente?: {
      notaProjetadaHojePct: number;
      notaCorteConcursoPct: number;
      gapCompetitivoPct: number;
    };
  } | null>(null);

  const [isSyncingRobinHood, setIsSyncingRobinHood] = useState(false);
  const [robinHoodSyncMsg, setRobinHoodSyncMsg] = useState<string | null>(null);

  const handleSyncRobinHoodWeights = async () => {
    setIsSyncingRobinHood(true);
    try {
      const res = await fetch('/api/v1/cycle/robin-hood/sync-weights', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setRobinHoodSyncMsg(`Pesos sincronizados! Modelo: ${data?.source_model || 'R Survival GLM'}`);
        if (activeConcurso) {
          const cycleRes = await fetch(`/api/v1/cycle/robin-hood?concursoId=${encodeURIComponent(activeConcurso.id)}`);
          if (cycleRes.ok) {
            const cycleData = await cycleRes.json();
            setRobinHoodCycle(cycleData);
          }
        }
      } else {
        setRobinHoodSyncMsg('Arquivo de pesos não encontrado. Execute retention_analysis.R primeiro.');
      }
    } catch (e) {
      setRobinHoodSyncMsg('Erro ao conectar com o serviço de pesos Robin Hood.');
    } finally {
      setIsSyncingRobinHood(false);
      setTimeout(() => setRobinHoodSyncMsg(null), 5000);
    }
  };

  const handleExportQuestionsV1 = () => {
    window.open('/api/v1/analytics/export/questions-v1', '_blank');
  };

  const handleExportEventsV1 = () => {
    window.open('/api/v1/analytics/export/events-v1', '_blank');
  };

  // Fetch real statistics, topics & cognitive metrics
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

    // Fetch study session summary for real tracked hours & latest handoff
    fetch(`/api/v1/study-sessions/summary?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.totalHours !== undefined) {
          setStats((prev) => ({
            ...prev,
            studyHoursWeek: data.totalHours,
          }));
        }
        if (data && data.latestHandoff) {
          setLatestHandoff(data.latestHandoff);
        }
      })
      .catch(() => {});

    // Fetch cognitive time metrics (HE vs HRE)
    fetch(`/api/v1/cognitive/time-metrics?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTimeMetrics(data);
      })
      .catch(() => {});

    // Fetch Robin Hood study cycle
    fetch(`/api/v1/cycle/robin-hood?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRobinHoodCycle(data);
      })
      .catch(() => {});

    // Fetch Answer Switch Tracker ("Marcou, Acabou")
    fetch('/api/v1/cognitive/marcou-acabou')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMarcouAcabou(data);
      })
      .catch(() => {});

    // Fetch Digital Twin status (Lucas telemetry + simulation)
    fetch(`/api/v1/digital-twin/status?concursoId=${encodeURIComponent(activeConcurso.id)}&concursoNome=${encodeURIComponent(activeConcurso.nome)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDigitalTwinSummary(data);
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

  // Strategic disciplines derived directly from real edital topics without mocks
  const strategicDisciplines = useMemo(() => {
    if (!topics || topics.length === 0) return [];
    const map = new Map<string, { nome: string; peso: number; questoes: number }>();
    topics.forEach((t) => {
      const existing = map.get(t.disciplina) || { nome: t.disciplina, peso: 1.0, questoes: 0 };
      existing.peso = Math.max(existing.peso, t.peso || 1.0);
      existing.questoes += (t.questoesPrevistas || 0);
      map.set(t.disciplina, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => (b.peso !== a.peso ? b.peso - a.peso : b.questoes - a.questoes))
      .map((d) => ({
        ...d,
        status: d.peso >= 2.0 ? 'Crítica' : d.peso >= 1.5 ? 'Alta' : 'Média',
      }));
  }, [topics]);

  // "O Que Estudar Agora?" Recommendation Engine (Deterministic MVT)
  // Recommends top priority based on edital topics and lowest recent accuracy or unstudied topic
  const getRecommendation = () => {
    if (topics && topics.length > 0) {
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
    return null;
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
            {activeConcurso
              ? `${activeConcurso.cargo || 'Cargo Fiscal'} • ${activeConcurso.orgao || 'Órgão Oficial'} • Banca ${activeConcurso.banca || 'N/D'}`
              : 'Cadastre seu primeiro concurso ou selecione um existente no menu lateral.'}
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

      {/* PONTO CRÍTICO DE ESQUECIMENTO: INTERVENÇÃO EMERGENCIAL ROBIN HOOD (R LAB) */}
      {robinHoodCycle?.blocos && robinHoodCycle.blocos.length > 0 && robinHoodCycle.blocos[0].type === 'EMERGENCIA_ROBIN_HOOD' && (
        <div
          className="glass animate-fade-in"
          style={{
            padding: '1.4rem 1.75rem',
            borderRadius: '16px',
            border: '2px solid #ef4444',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)',
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.35)',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
        >
          <div style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#ef4444', background: 'rgba(239, 68, 68, 0.25)', padding: '3px 10px', borderRadius: '4px' }}>
                🚨 AÇÃO IMEDIATA: PONTO CRÍTICO DE ESQUECIMENTO (ROBIN HOOD & R LAB)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Limite de Wilson &lt; 85% • Intervenção Mandatória</span>
            </div>
            <h3 style={{ color: '#f8fafc', fontSize: '1.35rem', margin: '0.2rem 0 0.4rem 0', fontWeight: 800 }}>
              {robinHoodCycle.blocos[0].disciplina} ({robinHoodCycle.blocos[0].duracaoMinutos} min de Emergência)
            </h3>
            <p style={{ color: '#e2e8f0', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>
              {robinHoodCycle.blocos[0].mensagemEuDoPassado}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                fontSize: '0.95rem',
                fontWeight: 800,
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.55)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => {
                if (onOpenAnkiHub) {
                  onOpenAnkiHub();
                } else {
                  onNavigateToTab('study', { disciplina: robinHoodCycle.blocos[0].disciplina });
                }
              }}
            >
              <span>⚡ Executar Bloco de Emergência (15 min)</span>
              <span>→</span>
            </button>
            {onOpenAnkiHub && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onOpenAnkiHub}
                style={{ borderRadius: '10px', padding: '12px 18px', fontSize: '0.88rem' }}
              >
                ⚡ Anki SRS Local
              </button>
            )}
          </div>
        </div>
      )}

      {/* BANNER HEROICO: O MAESTRO DO CICLO DIÁRIO */}
      <div 
        className="glass animate-fade-in" 
        style={{ 
          padding: '1.4rem 1.75rem', 
          borderRadius: '16px', 
          border: '1px solid rgba(245, 158, 11, 0.45)', 
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.1) 50%, rgba(15, 23, 42, 0.95) 100%)',
          boxShadow: '0 10px 35px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          margin: '0 0 1.5rem 0'
        }}
      >
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.25)', padding: '3px 10px', borderRadius: '4px' }}>
              ⚡ O Maestro do Ciclo Diário • Micro-Orquestração
            </span>
            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>Sem Calendário Estático</span>
          </div>
          <h3 style={{ color: '#f8fafc', fontSize: '1.35rem', margin: '0.2rem 0 0.4rem 0', fontWeight: 800 }}>
            "Tenho 3 horas hoje" — O Maestro assume o controle total
          </h3>
          <p style={{ color: '#cbd5e1', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>
            A Interface de Batalha mostra <strong>apenas a próxima ação imediata</strong> com roteiro mastigado: Anki SRS (15 min) ➔ Priming Cognitivo (10 min) ➔ Teoria Hiperfocada (50 min) ➔ Descanso Obrigatório (10 min).
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('fiscalstudy_maestro_hours', '180');
                onNavigateToTab('maestro');
              }}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 22px',
                fontSize: '0.95rem',
                fontWeight: 800,
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.45)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 26px rgba(245, 158, 11, 0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.45)'; }}
            >
              <span>⚡ "Tenho 3 horas hoje"</span>
              <span>→</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('fiscalstudy_maestro_hours', '120');
                onNavigateToTab('maestro');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '12px 18px',
                fontSize: '0.88rem',
                fontWeight: 700,
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              2 horas
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('fiscalstudy_maestro_hours', '60');
                onNavigateToTab('maestro');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '12px 18px',
                fontSize: '0.88rem',
                fontWeight: 700,
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              1 hora
            </button>
            {onOpenAnkiHub && (
              <button
                type="button"
                onClick={onOpenAnkiHub}
                style={{
                  background: 'rgba(59, 130, 246, 0.18)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.45)',
                  padding: '12px 18px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Automação Extrema: Integração Silenciosa com AnkiConnect"
              >
                <span>⚡</span>
                <span>Anki Hub</span>
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Clique para assumir a Interface de Batalha Imediata ou gerenciar Flashcards Anki</span>
        </div>
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

        {/* KPI 2: Questões Resolvidas (Clickable Traceability) */}
        <div
          className="kpi-card glass kpi-card-clickable"
          onClick={() => {
            setHistoryModalInitialTab('history');
            setIsHistoryModalOpen(true);
          }}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Clique para auditar cada questão respondida com enunciado, resposta e tempo gasto"
        >
          <div className="kpi-header">
            <span className="kpi-icon">📝</span>
            <span className="kpi-title">Questões Feitas</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
              🔍 Histórico
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{stats.totalQuestionsSolved}</span>
            <span className="kpi-subtitle">respostas registradas</span>
          </div>
          <span className="kpi-tag-sub">Rastreabilidade Total • Clique para auditar</span>
        </div>

        {/* KPI 3: Taxa de Acerto Geral (Clickable X-Ray) */}
        <div
          className="kpi-card glass kpi-card-clickable"
          onClick={() => {
            setHistoryModalInitialTab('xray');
            setIsHistoryModalOpen(true);
          }}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Clique para abrir o Raio-X de desempenho detalhado por disciplina e tópicos críticos"
        >
          <div className="kpi-header">
            <span className="kpi-icon">🎯</span>
            <span className="kpi-title">Taxa de Acerto</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
              🔬 Raio-X
            </span>
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

      {/* Mensagem para o Eu do Futuro (Último Handoff Gravado) */}
      {latestHandoff && (
        <div className="glass future-self-handoff-box animate-fade-in" style={{ padding: '1rem 1.25rem', border: '1px solid #38bdf8', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.08)' }}>
          <span className="handoff-tag" style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
            📬 Mensagem do Seu Eu do Passado (Onde você parou):
          </span>
          <p style={{ margin: '0.4rem 0 0', color: '#f8fafc', fontSize: '1.05rem', fontWeight: 500 }}>
            "{latestHandoff}"
          </p>
        </div>
      )}

      {/* Banner de Destaque: Gêmeo Digital & Limiar Estatístico de Aprovação (Método Lucas) */}
      {digitalTwinSummary && (
        <div className="glass animate-fade-in" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.35)', background: 'radial-gradient(circle at top left, rgba(139, 92, 246, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c084fc' }}>
                🧠 Gêmeo Digital Cognitivo (Método Lucas)
              </span>
              <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', margin: '0.2rem 0 0 0' }}>
                {digitalTwinSummary.horasLiquidasAcumuladas}h de 3.100h Líquidas ({digitalTwinSummary.progressoMetaPct}%) • {digitalTwinSummary.simulacaoRecente ? `Nota Projetada na Prova Hoje: ${digitalTwinSummary.simulacaoRecente.notaProjetadaHojePct}%` : 'Simulação de Prova Ativa'}
              </h3>
            </div>

            <button
              type="button"
              className="btn btn-sm"
              style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '0.5rem 1rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
              onClick={() => onNavigateToTab('digitaltwin')}
            >
              🚀 Abrir Gêmeo Digital & Roteiro do Dia →
            </button>
          </div>

          <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' }}>
            <div style={{ height: '100%', width: `${Math.min(100, digitalTwinSummary.progressoMetaPct)}%`, background: 'linear-gradient(90deg, #7c3aed 0%, #38bdf8 50%, #10b981 100%)', borderRadius: '4px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: '#0a0f1d', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>📖 Velocidade Leitura</span>
              <strong style={{ display: 'block', color: '#38bdf8', fontSize: '1rem' }}>{digitalTwinSummary.velocidadeLeituraMedia} pág/h</strong>
            </div>
            <div style={{ background: '#0a0f1d', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>⚡ Velocidade Resolução</span>
              <strong style={{ display: 'block', color: '#fbbf24', fontSize: '1rem' }}>{digitalTwinSummary.velocidadeQuestoesMedia} quest/h</strong>
            </div>
            <div style={{ background: '#0a0f1d', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>🎯 Rendimento Médio ("Nota")</span>
              <strong style={{ display: 'block', color: '#34d399', fontSize: '1rem' }}>{digitalTwinSummary.rendimentoMedioBlocos}%</strong>
            </div>
            <div style={{ background: '#0a0f1d', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>🔬 Saúde Neural Ebbinghaus</span>
              <strong style={{ display: 'block', color: '#c084fc', fontSize: '1rem' }}>{digitalTwinSummary.saudeNeuralMediaPct}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* CENTRAL CARD: "O Que Estudar Agora?" */}
      {recommendation ? (
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
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', fontWeight: 700 }}
                onClick={() => {
                  sessionStorage.setItem('fiscalstudy_maestro_hours', '180');
                  onNavigateToTab('maestro');
                }}
              >
                ⚡ "Tenho 3 Horas": Modo Batalha
              </button>
              <button
                className="btn btn-secondary"
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
      ) : (
        <div className="recommendation-card glass" style={{ textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#f8fafc', fontSize: '1.15rem' }}>
            📋 Nenhuma matéria/tópico cadastrado no edital ainda
          </h3>
          <p style={{ margin: '0 0 1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
            Cadastre os tópicos ou importe o edital do concurso para gerar prescrições de estudo automáticas baseadas em pesos reais e incidência de prova.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => onNavigateToTab('edital')}
            style={{ padding: '8px 20px' }}
          >
            Estruturar Edital Verticalizado
          </button>
        </div>
      )}

      {/* SEÇÃO COGNITIVA: HE vs HRE & AUDITORIA DE TEMPO */}
      {timeMetrics && (
        <div className={`cognitive-time-card glass ${timeMetrics.isHreThresholdExceeded ? 'border-amber-alert' : ''}`}>
          <div className="card-section-title">
            <div className="flex-row-center gap-2">
              <span className="icon-pulse">⏳</span>
              <h4>Balanço de Tempo Cognitivo: HE (Raiz) vs HRE (Operacional)</h4>
            </div>
            <span className="kpi-tag-sub">Princípio da Mínima Ação / Anti-Fricção</span>
          </div>

          <div className="time-metrics-grid">
            <div className="metric-box he-box">
              <span className="metric-label">HE Líquida (Ativa / Raiz)</span>
              <span className="metric-value text-emerald">{timeMetrics.heHours}h</span>
              <span className="metric-sub">Leitura investigativa, questões e simulados</span>
            </div>
            <div className="metric-box hre-box">
              <span className="metric-label">HRE (Operacional)</span>
              <span className={`metric-value ${timeMetrics.isHreThresholdExceeded ? 'text-amber' : 'text-slate'}`}>
                {timeMetrics.hreHours}h ({timeMetrics.hrePercent}%)
              </span>
              <span className="metric-sub">Organização, flashcards e configurações</span>
            </div>
          </div>

          {/* Barra de Proporção HE vs HRE */}
          <div className="he-ratio-bar-container">
            <div
              className="he-fill"
              style={{ width: `${Math.max(100 - timeMetrics.hrePercent, 0)}%` }}
              title={`HE Ativa: ${(100 - timeMetrics.hrePercent).toFixed(1)}%`}
            />
            <div
              className="hre-fill"
              style={{ width: `${timeMetrics.hrePercent}%` }}
              title={`HRE Operacional: ${timeMetrics.hrePercent}%`}
            />
          </div>

          {/* Banner de Alerta se HRE > 15% */}
          <div className={`time-alert-banner ${timeMetrics.isHreThresholdExceeded ? 'alert-warning' : 'alert-success'}`}>
            <span>{timeMetrics.hreAlertMessage}</span>
          </div>
        </div>
      )}

      {/* SEÇÃO COGNITIVA: CICLO DE ESTUDOS DINÂMICO (LEI DE ROBIN HOOD) */}
      {robinHoodCycle && robinHoodCycle.blocos.length > 0 && (
        <div className="robin-hood-card glass">
          <div className="card-section-title">
            <div className="flex-row-center gap-2">
              <span>🏹</span>
              <div>
                <h4>Ciclo de Estudos Dinâmico (Lei de Robin Hood)</h4>
                <p className="card-sub-info">
                  Fila circular contínua • Horas transferidas de matérias ricas (4-5★) para pobres (0-2★)
                </p>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateToTab('cronograma')}
              title="Ajustar disponibilidade ou recalibrar ciclo"
            >
              🔄 Replanejar Ciclo
            </button>
          </div>

          {robinHoodCycle.recalibracaoObrigatoria && (
            <div className="recalibration-warning-banner">
              ⚠️ <strong>Recalibração Obrigatória:</strong> Você completou 4 ciclos! Atualize suas estrelas de domínio por matéria para o algoritmo recalcular a distribuição justa de horas.
            </div>
          )}

          {/* Fila Circular de Blocos */}
          <div className="cycle-blocks-queue">
            {robinHoodCycle.blocos.slice(0, 6).map((bloco, idx) => {
              const isFirst = idx === 0;
              return (
                <div key={idx} className={`cycle-block-pill ${isFirst ? 'active-next-block' : ''}`}>
                  <div className="block-pill-header">
                    <span className="block-order">#{bloco.sequenceOrder}</span>
                    <span className="block-stars">
                      {bloco.type === 'EMERGENCIA_ROBIN_HOOD'
                        ? '🚨 R-URGENTE'
                        : bloco.type === 'ESTUDO_REGULAR'
                        ? '★'.repeat(bloco.nivelDominioEstrelas) + '☆'.repeat(5 - bloco.nivelDominioEstrelas)
                        : '🎯'}
                    </span>
                  </div>
                  <strong className="block-discipline">{bloco.disciplina}</strong>
                  <span className="block-duration">{bloco.duracaoMinutos} min</span>

                  {bloco.horasTransferidasRobinHood > 0.1 && (
                    <span className="badge-robin-hood-gain" title="Horas recebidas via Robin Hood">
                      +{bloco.horasTransferidasRobinHood.toFixed(1)}h
                    </span>
                  )}
                  {bloco.horasTransferidasRobinHood < -0.1 && (
                    <span className="badge-robin-hood-loss" title="Horas transferidas para matérias fracas">
                      {bloco.horasTransferidasRobinHood.toFixed(1)}h
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mensagem para o Eu do Futuro (Handoff do Passado) */}
          {robinHoodCycle.blocos[0]?.mensagemEuDoPassado && (
            <div className="future-self-handoff-box">
              <span className="handoff-tag">💬 Mensagem do seu Eu do Passado para este bloco:</span>
              <p className="handoff-text">"{robinHoodCycle.blocos[0].mensagemEuDoPassado}"</p>
              <button
                className="btn btn-rec-action btn-sm"
                onClick={() => onNavigateToTab('study', { disciplina: robinHoodCycle.blocos[0].disciplina })}
              >
                ▶ Iniciar Bloco: {robinHoodCycle.blocos[0].disciplina}
              </button>
            </div>
          )}

          {/* Barra de Integração com o Laboratório Psicométrico em R */}
          <div style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem' }}>🔬</span>
              <div>
                <strong style={{ color: '#38bdf8', fontSize: '0.9rem', display: 'block' }}>Laboratório Psicométrico em R (FiscalStudy Analytics)</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Exportação do Vetor de Esquecimento e Reinjeção Dinâmica via Lei de Robin Hood</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportQuestionsV1}
                title="Baixar dataset questions_v1.csv (com Δt, Cn-1, Yn e telemetria limpa)"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                📥 questions_v1.csv
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportEventsV1}
                title="Baixar append-only event store completo events_v1.csv"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                📜 events_v1.csv
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleSyncRobinHoodWeights}
                disabled={isSyncingRobinHood}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                title="Consumir output/metrics/robin_hood_weights.json gerado pelo R"
              >
                {isSyncingRobinHood ? 'Sincronizando...' : '🔄 Sincronizar Pesos R'}
              </button>
            </div>
          </div>
          {robinHoodSyncMsg && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.82rem',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              {robinHoodSyncMsg}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO COGNITIVA: RASTREADOR "MARCOU, ACABOU" (ANSWER SWITCH TRACKER) */}
      {marcouAcabou && marcouAcabou.totalSwitches > 0 && (
        <div className="marcou-acabou-card glass">
          <div className="card-section-title">
            <div className="flex-row-center gap-2">
              <span>🎯</span>
              <h4>Auditoria Comportamental: Regra do "Marcou, Acabou"</h4>
            </div>
            <span className={`badge-score-impact ${marcouAcabou.netPointsScore >= 0 ? 'impact-positive' : 'impact-negative'}`}>
              Saldo Líquido: {marcouAcabou.netPointsScore > 0 ? `+${marcouAcabou.netPointsScore}` : marcouAcabou.netPointsScore} pts
            </span>
          </div>

          <p className="marcou-acabou-desc">{marcouAcabou.marcouAcabouAdvice}</p>

          <div className="switches-mini-stats">
            <div className="mini-stat">
              <span className="mini-num text-red">{marcouAcabou.correctToWrongCount}</span>
              <span className="mini-lbl">Trocou Certo ➔ Errado</span>
            </div>
            <div className="mini-stat">
              <span className="mini-num text-emerald">{marcouAcabou.wrongToCorrectCount}</span>
              <span className="mini-lbl">Trocou Errado ➔ Certo</span>
            </div>
            <div className="mini-stat">
              <span className="mini-num">{marcouAcabou.totalSwitches}</span>
              <span className="mini-lbl">Total de Trocas</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Grid: Quick Actions & Priority Disciplines */}
      <div className="dashboard-bottom-grid">
        {/* Disciplinas Estratégicas */}
        <div className="strategic-disciplines-card glass">
          <div className="card-section-title">
            <h4>Disciplinas Estratégicas do Concurso</h4>
            <span className="card-sub-info">Classificação por peso no edital</span>
          </div>

          <div className="disciplines-list">
            {strategicDisciplines.length > 0 ? (
              strategicDisciplines.map((d, i) => (
                <div key={i} className="discipline-item">
                  <div className="disc-info">
                    <span className="disc-name">{d.nome}</span>
                    <span className="disc-meta">Peso: {d.peso}x • ~{d.questoes > 0 ? d.questoes : 10} questões previstas</span>
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
              ))
            ) : (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>Nenhuma matéria cadastrada no edital ainda.</p>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => onNavigateToTab('edital')}
                >
                  📋 Estruturar Edital Verticalizado
                </button>
              </div>
            )}
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
                <strong>Caderno de Erros (5 Taxonomias)</strong>
                <span>Refazer questões com causa mapeada</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('metodoera')}>
              <span className="quick-action-icon">⚡</span>
              <div className="quick-action-text">
                <strong>Método ERA</strong>
                <span>Explorar, Estudar, Revisar, Avaliar</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('feynman')}>
              <span className="quick-action-icon">🔬</span>
              <div className="quick-action-text">
                <strong>Sessão Feynman</strong>
                <span>Reconstrução ativa em Tela Limpa</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('pontoschave')}>
              <span className="quick-action-icon">🎯</span>
              <div className="quick-action-text">
                <strong>Pontos-Chave (Cloze SRS)</strong>
                <span>Omissão de palavras nos 5 critérios</span>
              </div>
            </button>

            <button className="quick-action-btn" onClick={() => onNavigateToTab('premortem')}>
              <span className="quick-action-icon">🔮</span>
              <div className="quick-action-text">
                <strong>Pré-Mortem (Gary Klein)</strong>
                <span>Simulação de fracasso e vacina mental</span>
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

      {/* Modal de Rastreabilidade Total & Raio-X */}
      <QuestionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        activeConcursoId={activeConcurso?.id}
        activeConcursoNome={activeConcurso?.nome}
        initialTab={historyModalInitialTab}
        onNavigateToStudy={(disc) => onNavigateToTab('study', { disciplina: disc })}
      />
    </div>
  );
};

export default Dashboard;
