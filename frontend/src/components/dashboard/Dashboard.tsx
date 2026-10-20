import React, { useState, useEffect, useMemo } from 'react';
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

  // Carregar dados reais da API
  useEffect(() => {
    if (!activeConcurso) return;

    // Tópicos do Edital
    fetch(`/api/v1/concursos/${activeConcurso.id}/edital`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.topicos) setTopics(data.topicos);
      })
      .catch(() => { });

    // Agenda de Revisões Adaptativas
    fetch(`/api/v1/revisoes/agenda?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRevisionAgenda(data);
      })
      .catch(() => { });

    // Ciclo Robin Hood
    fetch(`/api/v1/cycle/robin-hood?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRobinHoodCycle(data);
      })
      .catch(() => { });

    // Auditoria Automática de Anomalias de Estudo
    fetch(`/api/v1/analytics/study-anomalies?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.anomalies) setAnomalyReport(data);
      })
      .catch(() => { });

    // Sumário de Horas Rastreadas
    fetch(`/api/v1/study-sessions/summary?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.totalHours !== undefined) {
          const minutes = Math.round(data.totalHours * 60);
          if (minutes > 0) {
            setStudiedTime(minutes);
          }
        }
      })
      .catch(() => { });

    // Capacidade do Dia calculada a partir da Rotina
    fetch(`/api/v1/routine/effective-hours?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.effectiveMinutes && data.effectiveMinutes > 0) {
          setAvailableTime(data.effectiveMinutes);
        } else {
          // Checar se há configuração local salva no mapa tátil
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
            // Usa fallback
          }
        }
      })
      .catch(() => { });

    // Status do Anki e Flashcards Pendentes
    fetch('/api/v1/anki/status')
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
      })
      .catch(() => { });
  }, [activeConcurso]);

  // Construção da Fila de Atividades Unificada
  const queueActivities = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'Revisão' | 'Questões' | 'Novo Conteúdo';
      discipline: string;
      topic: string;
      reason: string;
      duration: number;
      material: string;
      strategy: string;
      pedagogyNote: string;
    }> = [];

    // 1. Prioridade Máxima: Revisões Adaptativas do dia
    if (revisionAgenda && revisionAgenda.hoje && revisionAgenda.hoje.length > 0) {
      revisionAgenda.hoje.forEach((rev, idx) => {
        const stage = rev.estagio_intervencao || 'Intervenção Corretiva';
        list.push({
          id: `rev-${rev.id || idx}`,
          type: 'Revisão',
          discipline: rev.disciplina || 'Direito Tributário',
          topic: rev.topico || 'Crédito Tributário',
          reason: rev.justificativa_pedagogica || 'Dificuldade recorrente + Alta prioridade',
          duration: Math.min(30, (rev.intervalo_dias ? 20 : 15)),
          material: 'Resumo Teórico & Caderno de Erros',
          strategy: `${stage} (Robin Hood)`,
          pedagogyNote: rev.justificativa_pedagogica || 'Revisão priorizada pelo histórico recente de retenção para evitar a curva do esquecimento.'
        });
      });
    }

    // 2. Blocos do Ciclo de Estudo (Robin Hood & Feedback Loop SWOT)
    if (robinHoodCycle && robinHoodCycle.blocos && robinHoodCycle.blocos.length > 0) {
      robinHoodCycle.blocos.forEach((b, idx) => {
        const isEmergency = b.type === 'EMERGENCIA_ROBIN_HOOD';
        list.push({
          id: `cycle-${idx}`,
          type: (b.type === 'REVISAO' || isEmergency) ? 'Revisão' : 'Questões',
          discipline: b.disciplina,
          topic: isEmergency ? 'Intervenção Emergencial de Erros' : `Bloco Estratégico #${b.sequenceOrder}`,
          reason: isEmergency
            ? '🚨 Pós-Simulado SWOT (Tempo Injetado)'
            : (b.horasTransferidasRobinHood > 0
              ? `Robin Hood (+${b.horasTransferidasRobinHood}h alocadas)`
              : 'Consolidação de Dificuldades'),
          duration: b.duracaoMinutos || 35,
          material: 'Material Vinculado da Biblioteca',
          strategy: isEmergency ? 'Intervenção Crítica Pós-Simulado' : 'Prática de Questões e Fixação',
          pedagogyNote: b.mensagemEuDoPassado || 'Tópico prioritário de acordo com a distribuição ponderada do seu edital.'
        });
      });
    }

    // 3. Fallback dinâmico estritamente baseado no edital real cadastrado (se houver)
    if (list.length === 0 && topics.length > 0) {
      const firstTopic = topics[0];
      list.push({
        id: `topic-${firstTopic.id || 0}`,
        type: 'Questões',
        discipline: firstTopic.disciplina || 'Conhecimentos do Edital',
        topic: firstTopic.assunto || 'Tópico Prioritário',
        reason: 'Conteúdo do edital com questões pendentes',
        duration: 30,
        material: 'Banco de Questões e Biblioteca',
        strategy: 'Prática de Questões e Diagnóstico',
        pedagogyNote: 'Atividade gerada diretamente a partir do edital cadastrado para este concurso.'
      });
    }

    return list;
  }, [revisionAgenda, robinHoodCycle, topics]);

  // Atividade atual em destaque (Hero)
  const currentActivity = queueActivities[activeQueueIndex % queueActivities.length] || queueActivities[0];

  // Disparar atividade ao clicar em Começar Agora
  const handleStartActivity = (activity = currentActivity) => {
    onNavigateToTab('study', {
      disciplina: activity.discipline,
      assunto: activity.topic,
      mode: modeOnlyQuestions ? 'ONLY_QUESTIONS' : 'STANDARD'
    });
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
        setActiveQueueIndex(prev => (prev + 1) % queueActivities.length);
        setShowWhy(false);
        break;
      case 'NO_MATERIAL':
        setModeOnlyQuestions(true);
        handleStartActivity();
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
        <header className="calm-home-header">
          <div>
            <h1 className="calm-home-greeting">
              Bons Estudos!
            </h1>
            <div className="calm-home-target">
              <Target className="w-4 h-4 text-indigo-500" />
              <span>Objetivo: {activeConcurso?.nome || 'Auditor Fiscal (RFB)'}</span>
            </div>
          </div>
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
                  Auditoria de Logs: {anomalyReport.anomalies.length} Anomalia(s) Detectada(s)
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
                Abrir Diagnóstico Automático <ChevronRight className="w-3.5 h-3.5" />
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
                    {ankiStatus.connected ? 'Anki Desktop Aberto (Porta 8765)' : 'Aguardando Anki Desktop'}
                  </span>
                </div>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--calm-text-muted, #64748b)' }}>
                  {ankiStatus.connected
                    ? 'Flashcards sintetizados a partir das suas sessões. Clique para injetar nos baralhos por disciplina.'
                    : 'Fila segura no SQLite. Abra o Anki Desktop para sincronização automática em segundo plano.'}
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
            2. HERO CARD: SUA PRÓXIMA ATIVIDADE
            ================================================================== */}
        {currentActivity ? (
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
        ) : (
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
                Pronto para Começar
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--calm-text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                Nenhuma revisão atrasada pendente. Escolha um conteúdo do seu edital ou inicie uma sessão no banco de questões.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => onNavigateToTab('edital')}
                  className="calm-btn-start"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <BookOpen className="w-4 h-4" />
                  Abrir Edital Verticalizado
                </button>
                <button
                  onClick={() => onNavigateToTab('banco')}
                  className="calm-btn-why"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Play className="w-4 h-4" />
                  Praticar Questões
                </button>
              </div>
            </div>
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
