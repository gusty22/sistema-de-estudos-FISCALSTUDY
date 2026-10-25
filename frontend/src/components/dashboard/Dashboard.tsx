import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import { QuestionHistoryModal } from './QuestionHistoryModal';
import {
  Play,
  HelpCircle,
  Clock,
  RotateCcw,
  BookOpen,
  Coffee,
  ChevronRight,
  Target,
  AlertTriangle,
  History,
  Layers,
  CalendarDays,
  Zap
} from 'lucide-react';
import { useSimplifiedMode } from '../../context/SimplifiedModeContext';
import {
  computeQueueActivities,
  getDashboardUIState,
  getCurrentActivity,
  getNextQueueIndex,
  prepareSessionPayload,
  type QueueActivity,
  type DashboardUIState
} from './dashboardLogic';
import './Dashboard.css';

interface DashboardProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToTab: (tab: any, params?: any) => void;
  theme?: 'paper' | 'night';
  onToggleTheme?: () => void;
}

interface EditalTopic {
  id: string;
  disciplina: string;
  assunto: string;
  peso: number;
  questoesPrevistas: number;
}

interface RevisionAgendaItem {
  id: string;
  session_id: string;
  concurso_id?: string;
  disciplina: string;
  topico: string;
  tipo_revisao: string;
  intervalo_dias: number;
  data_agendada: string;
  origem_evento: string;
  status: string;
  justificativa_pedagogica?: string;
  estagio_intervencao?: string;
  prioridade_score?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeConcurso,
  onNavigateToTab,
}) => {
  const { isSimplifiedMode, toggleSimplifiedMode } = useSimplifiedMode();

  // Estados de Interface e Transparência
  const [showWhy, setShowWhy] = useState(false);
  const [availableTime, setAvailableTime] = useState<number>(0);
  const [studiedTime, setStudiedTime] = useState<number>(0);
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(0);
  const [modeOnlyQuestions, setModeOnlyQuestions] = useState(false);
  const [restMessage, setRestMessage] = useState<string | null>(null);

  // Estados de Dados da API
  const [topics, setTopics] = useState<EditalTopic[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [revisionAgenda, setRevisionAgenda] = useState<{
    todayDate: string;
    totalPendentesHoje: number;
    hoje: RevisionAgendaItem[];
    proximos7Dias: RevisionAgendaItem[];
    concluidas: Array<{ id: string; disciplina: string; topico: string; concluida_em?: string }>;
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
  } | null>(null);

  const [anomalyReport, setAnomalyReport] = useState<{
    totalAnomalies: number;
    anomalies: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
      metricEvidence: string;
      recommendedAction: string;
    }>;
  } | null>(null);

  const [ankiStatus, setAnkiStatus] = useState<{
    connected: boolean;
    pendingQueueCount: number;
    totalCardsSynced: number;
    autoSyncActive: boolean;
  } | null>(null);
  const [isSyncingAnkiFromHome, setIsSyncingAnkiFromHome] = useState(false);

  const handleQuickSyncAnki = async () => {
    setIsSyncingAnkiFromHome(true);
    try {
      const res = await fetch('/api/v1/anki/sync-queue', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAnkiStatus(prev => prev ? {
          ...prev,
          pendingQueueCount: data.pendingRemaining || 0,
          totalCardsSynced: data.totalCardsSynced || (prev.totalCardsSynced + (data.syncedNow || 0))
        } : null);
      }
    } catch (e) {
      console.warn('Erro ao sincronizar Anki:', e);
    } finally {
      setIsSyncingAnkiFromHome(false);
    }
  };

  // Estados de Carregamento e Comunicação
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Carregar dados reais da API com tratamento explícito de erros
  const loadDashboardData = useCallback(() => {
    if (!activeConcurso) {
      setTopics([]);
      setRevisionAgenda(null);
      setRobinHoodCycle(null);
      setAnomalyReport(null);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    // 1. Tópicos do Edital Verticalizado (Endpoint Canônico)
    const editalPromise = fetch(`/api/v1/concursos/${encodeURIComponent(activeConcurso.id)}/edital`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Falha HTTP ${res.status} ao carregar o edital do concurso.`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.topicos)) {
          setTopics(data.topicos);
        } else {
          setTopics([]);
        }
      });

    // 2. Agenda de Revisões Adaptativas
    const agendaPromise = fetch(`/api/v1/revisoes/agenda?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRevisionAgenda(data);
      });

    // 3. Ciclo Robin Hood
    const cyclePromise = fetch(`/api/v1/cycle/robin-hood?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRobinHoodCycle(data);
      });

    // 4. Auditoria Automática de Anomalias de Estudo
    const anomaliesPromise = fetch(`/api/v1/analytics/study-anomalies?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.anomalies) setAnomalyReport(data);
      });

    // 5. Sumário de Horas Rastreadas
    const summaryPromise = fetch(`/api/v1/study-sessions/summary?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.totalHours !== undefined) {
          const minutes = Math.round(data.totalHours * 60);
          if (minutes > 0) {
            setStudiedTime(minutes);
          }
        }
      });

    // 6. Capacidade do Dia calculada a partir da Rotina
    const routinePromise = fetch(`/api/v1/routine/effective-hours?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.effectiveMinutes && data.effectiveMinutes > 0) {
          setAvailableTime(data.effectiveMinutes);
        } else {
          try {
            const savedSchedule: string[] = JSON.parse(localStorage.getItem('fiscalstudy_routine_schedule') || '[]');
            const savedHours = parseFloat(localStorage.getItem('fiscalstudy_routine_hours_shift') || '2');
            const dayIds = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
            const todayId = dayIds[new Date().getDay()];
            const count = savedSchedule.filter(k => k.startsWith(todayId)).length;
            if (count > 0) {
              setAvailableTime(Math.round(count * savedHours * 60));
            }
          } catch {
            // usa valor padrao
          }
        }
      });

    // 7. Status do Anki
    const ankiPromise = fetch('/api/v1/anki/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAnkiStatus({
            connected: data.connected,
            pendingQueueCount: data.pendingQueueCount || 0,
            totalCardsSynced: data.totalCardsSynced || 0,
            autoSyncActive: data.autoSyncActive ?? true
          });
        }
      });

    Promise.allSettled([editalPromise, agendaPromise, cyclePromise, anomaliesPromise, summaryPromise, routinePromise, ankiPromise])
      .then((results) => {
        const editalResult = results[0];
        if (editalResult.status === 'rejected') {
          const err = editalResult.reason;
          setLoadError(err instanceof Error ? err.message : 'Falha na comunicação com o servidor.');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeConcurso]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Construção da Fila de Atividades Unificada (100% Determinística, ZERO Conteúdo Fictício)
  const queueActivities: QueueActivity[] = useMemo(() => {
    return computeQueueActivities(revisionAgenda, robinHoodCycle);
  }, [revisionAgenda, robinHoodCycle]);

  // Estado Explícito da Interface do Dashboard
  const dashboardState: DashboardUIState = useMemo(() => {
    return getDashboardUIState({
      hasActiveConcurso: Boolean(activeConcurso),
      isLoading,
      loadError,
      topicsCount: topics.length,
      queueActivitiesCount: queueActivities.length
    });
  }, [activeConcurso, isLoading, loadError, topics.length, queueActivities.length]);

  // Atividade atual em destaque (Hero) — com guarda segura contra NaN e array vazio
  const currentActivity: QueueActivity | undefined = useMemo(() => {
    return getCurrentActivity(queueActivities, activeQueueIndex);
  }, [queueActivities, activeQueueIndex]);

  // Disparar atividade ao clicar em Começar Agora
  const handleStartActivity = (activity = currentActivity) => {
    const payload = prepareSessionPayload(activity, modeOnlyQuestions);
    if (!payload) {
      // Nenhuma atividade válida: não cria sessão, não grava storage, não inventa dados
      return;
    }

    for (const [key, value] of Object.entries(payload.sessionStorageItems)) {
      sessionStorage.setItem(key, value);
    }

    onNavigateToTab('session', payload.navigationParams);
  };

  // Ajustes Rápidos
  const handleQuickAdjust = (type: 'LESS_TIME' | 'ONLY_20_MIN' | 'MORE_TIME' | 'NEXT_ACTIVITY' | 'NO_MATERIAL' | 'REST') => {
    setRestMessage(null);

    switch (type) {
      case 'LESS_TIME':
        setAvailableTime(prev => Math.max(20, prev - 20));
        setShowWhy(false);
        setRestMessage('Meta diária recalculada. Próxima atividade dimensionada para uma janela mais curta.');
        setTimeout(() => setRestMessage(null), 5000);
        break;
      case 'ONLY_20_MIN':
        setAvailableTime(20);
        setShowWhy(false);
        setRestMessage('Janela adaptada para 20 minutos. Selecionamos 5 questões de recuperação ativa rápida para aproveitar o tempo sem sobrecarga.');
        setTimeout(() => setRestMessage(null), 7000);
        break;
      case 'MORE_TIME':
        setAvailableTime(prev => prev + 30);
        setRestMessage('Excelente! Mais 30 minutos alocados para aprofundar seu conteúdo prioritário.');
        setTimeout(() => setRestMessage(null), 5000);
        break;
      case 'NEXT_ACTIVITY':
        setActiveQueueIndex(prev => getNextQueueIndex(prev, queueActivities.length));
        setShowWhy(false);
        break;
      case 'NO_MATERIAL':
        if (currentActivity) {
          setModeOnlyQuestions(true);
          handleStartActivity(currentActivity);
        } else {
          setRestMessage('Nenhuma atividade na fila ativa para alternar modo. Escolha uma ação do edital ou banco.');
          setTimeout(() => setRestMessage(null), 5000);
        }
        break;
      case 'REST':
        setRestMessage('Excelente decisão! Pausas ativas restauram a memória de trabalho. Relaxe 15 minutos sem telas.');
        setTimeout(() => setRestMessage(null), 6000);
        break;
    }
  };

  const totalPendingRevisions = revisionAgenda?.totalPendentesHoje ?? 0;
  const estimatedRevisionMinutes = totalPendingRevisions * 8;
  const remainingMinutes = Math.max(0, availableTime - studiedTime);
  const progressPercent = Math.min(100, Math.round((studiedTime / Math.max(1, availableTime)) * 100));

  return (
    <div className="dashboard-calm-wrapper">
      <div className="dashboard-calm-container">

        {/* ==================================================================
            1. HEADER DE TECNOLOGIA CALMA (HUMANIZADO)
            ================================================================== */}
        <header className="calm-home-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="calm-home-greeting">
              Bons Estudos!
            </h1>
            <div className="calm-home-target">
              <Target className="w-4 h-4 text-indigo-500" />
              <span>Objetivo: {activeConcurso?.nome || 'Auditor Fiscal (RFB)'}</span>
            </div>
          </div>

          <button
            onClick={toggleSimplifiedMode}
            title={isSimplifiedMode ? 'Modo Aluno ativo: interface simplificada, foco em prática e mentoria. Clique para ver métricas e fórmulas de engenharia.' : 'Modo Avançado ativo: exibindo metadados técnicos e fórmulas. Clique para simplificar a interface.'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '9999px',
              border: isSimplifiedMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--calm-card-border, #e2e8f0)',
              background: isSimplifiedMode ? 'rgba(16, 185, 129, 0.08)' : 'var(--calm-card-bg, #ffffff)',
              color: isSimplifiedMode ? '#059669' : 'var(--calm-text-muted, #64748b)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{isSimplifiedMode ? '🎓 Modo Aluno' : '⚙️ Modo Avançado'}</span>
          </button>
        </header>

        {/* Feedback de Pausa Consciente */}
        {restMessage && (
          <div style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '1rem',
            background: 'var(--calm-subtle-bg)',
            border: '1px solid var(--calm-border)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}>
            <Coffee className="w-4 h-4 text-emerald-500" />
            <span>{restMessage}</span>
          </div>
        )}

        {/* Banner de Alerta de Auditoria Automática de Execução */}
        {anomalyReport && anomalyReport.anomalies && anomalyReport.anomalies.length > 0 && (
          <div className="calm-anomaly-alert animate-fade-in" style={{
            padding: '1rem 1.25rem',
            borderRadius: '1rem',
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', color: '#f43f5e', textTransform: 'uppercase' }}>
                  {isSimplifiedMode
                    ? `Diagnóstico de Estudos: ${anomalyReport.anomalies.length} Ponto(s) de Atenção`
                    : `Auditoria de Logs: ${anomalyReport.anomalies.length} Anomalia(s) Detectada(s)`}
                </span>
              </div>
              <button
                onClick={() => onNavigateToTab('analytics')}
                style={{
                  background: '#f43f5e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                {isSimplifiedMode ? 'Ver Diagnóstico' : 'Abrir Diagnóstico Automático'} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {anomalyReport.anomalies.slice(0, 2).map((a, idx) => (
                <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--calm-text-main, #0f172a)', display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
                  <span style={{ color: '#f43f5e', fontWeight: 700 }}>• {a.title}:</span>
                  <span style={{ color: 'var(--calm-text-muted, #64748b)' }}>{a.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================================
            BANNER DE FLASHCARDS AUTOMÁTICOS PENDENTES DO ANKI DESKTOP
            ================================================================== */}
        {ankiStatus && ankiStatus.pendingQueueCount > 0 && (
          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderRadius: '0.85rem',
              border: '1px solid var(--calm-card-border, #e2e8f0)',
              backgroundColor: 'var(--calm-card-bg, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1rem',
              boxShadow: 'var(--calm-card-shadow, 0 2px 8px rgba(0,0,0,0.03))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: '0.65rem',
                  backgroundColor: 'rgba(0, 150, 230, 0.12)',
                  color: '#0096e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--calm-text-main, #0f172a)' }}>
                    {ankiStatus.pendingQueueCount} Flashcard(s) Automático(s) Gerado(s)
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '9999px',
                      fontWeight: 600,
                      backgroundColor: ankiStatus.connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.15)',
                      color: ankiStatus.connected ? '#059669' : '#d97706'
                    }}
                  >
                    {isSimplifiedMode
                      ? (ankiStatus.connected ? 'Anki Conectado' : 'Aguardando Anki')
                      : (ankiStatus.connected ? 'Anki Desktop Aberto (Porta 8765)' : 'Aguardando Anki Desktop')}
                  </span>
                </div>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--calm-text-muted, #64748b)' }}>
                  {ankiStatus.connected
                    ? 'Flashcards sintetizados a partir das suas sessões. Clique para injetar nos baralhos por disciplina.'
                    : (isSimplifiedMode
                        ? 'Seus flashcards estão salvos. Abra o Anki Desktop para sincronizar com seus baralhos.'
                        : 'Fila segura no SQLite. Abra o Anki Desktop para sincronização automática em segundo plano.')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={handleQuickSyncAnki}
                disabled={isSyncingAnkiFromHome}
                style={{
                  background: '#0096e6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                {isSyncingAnkiFromHome ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Sincronizar com Anki ({ankiStatus.pendingQueueCount})
                  </>
                )}
              </button>
              <button
                onClick={() => onNavigateToTab('anki')}
                style={{
                  background: 'transparent',
                  color: 'var(--calm-text-muted, #64748b)',
                  border: '1px solid var(--calm-card-border, #e2e8f0)',
                  borderRadius: '0.5rem',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Ver Curadoria
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================
            2. HERO CARD: ESTADOS EXPLÍCITOS DA APLICAÇÃO (SEM FICTÍCIOS)
            ================================================================== */}
        {dashboardState === 'LOADING' && (
          <section className="calm-hero-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--calm-subtle-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <RotateCcw className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--calm-text)', margin: '0 0 0.5rem 0' }}>
                Carregando Dados...
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--calm-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Sincronizando tópicos do concurso, agenda de revisões e ciclo de estudos.
              </p>
            </div>
          </section>
        )}

        {dashboardState === 'ERROR' && (
          <section className="calm-hero-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', border: '1px solid rgba(244, 63, 94, 0.3)', background: 'rgba(244, 63, 94, 0.04)' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(244, 63, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--calm-text)', margin: '0 0 0.5rem 0' }}>
                Erro de Comunicação
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--calm-text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                {loadError || 'Não foi possível carregar as informações do concurso.'}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={loadDashboardData}
                  className="calm-btn-start"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
            </div>
          </section>
        )}

        {dashboardState === 'NO_CONCURSO' && (
          <section className="calm-hero-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--calm-subtle-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <Target className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--calm-text)', margin: '0 0 0.5rem 0' }}>
                Nenhum Concurso Selecionado
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--calm-text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                Selecione um concurso existente ou cadastre seu objetivo para estruturar o edital e a rotina de estudos.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => onNavigateToTab('concursos')}
                  className="calm-btn-start"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Target className="w-4 h-4" />
                  Selecionar ou Cadastrar Concurso
                </button>
              </div>
            </div>
          </section>
        )}

        {dashboardState === 'NO_EDITAL_TOPICS' && (
          <section className="calm-hero-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--calm-subtle-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <BookOpen className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--calm-text)', margin: '0 0 0.5rem 0' }}>
                Edital Ainda Não Cadastrado
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--calm-text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                O concurso '{activeConcurso?.nome}' não possui tópicos cadastrados no momento. Importe o edital verticalizado para que as recomendações pedagógicas sejam geradas.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onNavigateToTab('edital')}
                  className="calm-btn-start"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <BookOpen className="w-4 h-4" />
                  Cadastrar / Importar Edital
                </button>
                <button
                  onClick={() => onNavigateToTab('banco')}
                  className="calm-btn-why"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Play className="w-4 h-4" />
                  Abrir Banco de Questões
                </button>
              </div>
            </div>
          </section>
        )}

        {dashboardState === 'NO_ACTIVITIES' && (
          <section className="calm-hero-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '9999px',
                backgroundColor: 'var(--calm-subtle-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <Target className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--calm-text)', margin: '0 0 0.5rem 0' }}>
                Nenhuma Atividade Elegível para Hoje
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--calm-text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                O edital possui {topics.length} tópico(s) cadastrado(s), mas você não tem revisões atrasadas pendentes nem blocos de estudo no ciclo para este momento.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onNavigateToTab('edital')}
                  className="calm-btn-start"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <BookOpen className="w-4 h-4" />
                  Ver Edital Verticalizado
                </button>
                <button
                  onClick={() => onNavigateToTab('cronograma')}
                  className="calm-btn-why"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <CalendarDays className="w-4 h-4" />
                  Configurar Planejamento
                </button>
                <button
                  onClick={() => onNavigateToTab('banco')}
                  className="calm-btn-why"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Play className="w-4 h-4" />
                  Praticar Questões do Banco
                </button>
              </div>
            </div>
          </section>
        )}

        {dashboardState === 'HAS_ACTIVITIES' && currentActivity && (
          <section className="calm-hero-card">
            <div className="calm-hero-inner">
              <div className="calm-hero-tag">
                <div className="calm-pulse-dot" />
                Sua Próxima Atividade
              </div>

              <div className="calm-hero-titles">
                <span className="calm-hero-discipline">
                  {currentActivity.discipline}
                </span>
                <h2 className="calm-hero-topic">
                  {currentActivity.topic}
                </h2>
              </div>

              <div className="calm-hero-chips">
                <div className="calm-chip-reason">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Motivo: {currentActivity.reason}</span>
                </div>
                <div className="calm-chip-duration">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Duração estimada: {currentActivity.duration} minutos</span>
                </div>
              </div>

              <div className="calm-hero-actions">
                <button
                  onClick={() => handleStartActivity()}
                  className="calm-btn-start"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Começar Agora
                </button>

                <button
                  onClick={() => setShowWhy(!showWhy)}
                  className="calm-btn-why"
                >
                  <HelpCircle className="w-4 h-4 text-stone-400" />
                  Por que esta atividade?
                </button>
              </div>
            </div>

            {/* Gaveta de Transparência Pedagógica (Sanfona) */}
            {showWhy && (
              <div className="calm-why-drawer">
                <h4 className="calm-why-title">Transparência Pedagógica</h4>
                <p className="calm-why-text">
                  {currentActivity.pedagogyNote}
                </p>
                <div className="calm-why-meta">
                  <span>Estratégia: {currentActivity.strategy}</span>
                  <span>•</span>
                  <span>Material: {currentActivity.material}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ==================================================================
            3. AJUSTES RÁPIDOS (ADAPTAÇÃO AO SEU DIA)
            ================================================================== */}
        <section>
          <div className="calm-section-label">
            Ajustes Rápidos (Adaptação ao seu dia)
          </div>
          <div className="calm-adjusts-bar">
            <button
              onClick={() => handleQuickAdjust('LESS_TIME')}
              className="calm-adjust-chip"
              title="Reduz o tempo da meta diária em 20 minutos sem culpa"
            >
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Tenho menos tempo hoje
            </button>

            <button
              onClick={() => handleQuickAdjust('ONLY_20_MIN')}
              className="calm-adjust-chip"
              title="Calibra a próxima atividade para uma micro-sessão de 20 minutos"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Tenho apenas 20 min
            </button>

            <button
              onClick={() => handleQuickAdjust('MORE_TIME')}
              className="calm-adjust-chip"
              title="Aumenta o tempo da meta diária em 30 minutos"
            >
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Tenho mais tempo hoje
            </button>

            <button
              onClick={() => handleQuickAdjust('NEXT_ACTIVITY')}
              className="calm-adjust-chip"
              title="Avança para a próxima atividade disponível na fila"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
              Quero trocar de atividade
            </button>

            <button
              onClick={() => handleQuickAdjust('NO_MATERIAL')}
              className="calm-adjust-chip"
              title="Focar diretamente na resolução de questões práticas"
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              Não tenho acesso ao material
            </button>

            <button
              onClick={() => handleQuickAdjust('REST')}
              className="calm-adjust-chip"
              title="Pausa para descompressão neural"
            >
              <Coffee className="w-3.5 h-3.5 text-stone-400" />
              Preciso descansar
            </button>
          </div>
        </section>

        {/* ==================================================================
            4. GRID DE CARTÕES SECUNDÁRIOS: REVISÕES & CAPACIDADE
            ================================================================== */}
        <div className="calm-cards-grid">

          {/* Card 1: Revisões Prioritárias */}
          <div className="calm-secondary-card">
            <div>
              <div className="calm-card-header-row">
                <RotateCcw className="w-4 h-4 text-indigo-500" />
                <h3 className="calm-card-header-title">Revisões Prioritárias</h3>
              </div>
              <p className="calm-card-subtitle">Foco: Prevenir esquecimento iminente</p>

              <div>
                <div className="calm-card-big-stat">
                  {totalPendingRevisions} {totalPendingRevisions === 1 ? 'atividade' : 'atividades'}
                </div>
                <div className="calm-card-secondary-stat">
                  Estimativa: ~{estimatedRevisionMinutes} min totais
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('revisoes')}
              className="calm-card-btn-action"
            >
              Abrir fila de revisão <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Capacidade do Dia */}
          <div className="calm-secondary-card">
            <div>
              <div className="calm-card-header-row">
                <Clock className="w-4 h-4 text-stone-400" />
                <h3 className="calm-card-header-title">Capacidade do Dia</h3>
              </div>
              <p className="calm-card-subtitle">Baseado na sua rotina informada</p>

              <div style={{ marginTop: '1.25rem' }}>
                <div className="calm-capacity-row">
                  <span>{studiedTime}m estudados</span>
                  <span>{availableTime}m meta</span>
                </div>

                <div className="calm-capacity-track">
                  <div
                    className="calm-capacity-bar"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="calm-capacity-footer">
                  {remainingMinutes} min restantes
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ==================================================================
            5. PRÓXIMAS ATIVIDADES SUGERIDAS NA FILA
            ================================================================== */}
        <section>
          <div className="calm-section-label">
            Próximas atividades sugeridas na fila
          </div>

          <div className="calm-queue-card">
            {queueActivities.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--calm-text-muted)', fontSize: '0.85rem' }}>
                Nenhuma outra atividade na fila no momento. As revisões programadas e novas matérias aparecerão aqui automaticamente.
              </div>
            ) : (
              <div className="calm-queue-list">
                {queueActivities.slice(0, 4).map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => handleStartActivity(item)}
                    className="calm-queue-item"
                    title="Clique para iniciar esta atividade"
                  >
                    <div className="calm-queue-num">
                      {index + 1}
                    </div>

                    <div className="calm-queue-content">
                      <div className="calm-queue-type">
                        {item.type}
                      </div>
                      <h4 className="calm-queue-name">
                        {item.discipline} — {item.topic}
                      </h4>
                    </div>

                    <div className="calm-queue-duration">
                      ~{item.duration} min
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ==================================================================
            6. RODAPÉ DISCRETO: ACESSO A HISTÓRICO & RAIO-X
            ================================================================== */}
        <footer className="calm-home-footer-actions">
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="calm-btn-ghost"
          >
            <History className="w-3.5 h-3.5 text-stone-400" />
            Consultar Histórico & Raio-X de Questões
          </button>
          <button
            onClick={() => onNavigateToTab('rotina')}
            className="calm-btn-ghost"
          >
            <CalendarDays className="w-3.5 h-3.5 text-stone-400" />
            Rotina & Disponibilidade
          </button>
          <button
            onClick={() => onNavigateToTab('materiais')}
            className="calm-btn-ghost"
          >
            <Layers className="w-3.5 h-3.5 text-stone-400" />
            Biblioteca de Materiais
          </button>
        </footer>

      </div>

      {/* Modal de Rastreabilidade e Raio-X de Erros */}
      <QuestionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        activeConcursoId={activeConcurso?.id}
        activeConcursoNome={activeConcurso?.nome}
        initialTab="history"
        onNavigateToStudy={(disc) => onNavigateToTab('study', { disciplina: disc })}
      />
    </div>
  );
};

export default Dashboard;
