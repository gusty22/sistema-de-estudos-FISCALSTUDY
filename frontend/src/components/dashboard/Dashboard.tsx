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
  CalendarDays
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
  const [availableTime, setAvailableTime] = useState<number>(100); // 1h40 = 100 min
  const [studiedTime, setStudiedTime] = useState<number>(45); // 45 min
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

  // Carregar dados reais da API
  useEffect(() => {
    if (!activeConcurso) return;

    // Tópicos do Edital
    fetch(`/api/v1/concursos/${activeConcurso.id}/edital`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.topicos) setTopics(data.topicos);
      })
      .catch(() => {});

    // Agenda de Revisões Adaptativas
    fetch(`/api/v1/revisoes/agenda?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRevisionAgenda(data);
      })
      .catch(() => {});

    // Ciclo Robin Hood
    fetch(`/api/v1/cycle/robin-hood?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRobinHoodCycle(data);
      })
      .catch(() => {});

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
      .catch(() => {});

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
      .catch(() => {});
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

    // 2. Blocos do Ciclo de Estudo (Robin Hood)
    if (robinHoodCycle && robinHoodCycle.blocos && robinHoodCycle.blocos.length > 0) {
      robinHoodCycle.blocos.forEach((b, idx) => {
        list.push({
          id: `cycle-${idx}`,
          type: b.type === 'REVISAO' ? 'Revisão' : 'Questões',
          discipline: b.disciplina,
          topic: `Bloco Estratégico #${b.sequenceOrder}`,
          reason: b.horasTransferidasRobinHood > 0 
            ? `Robin Hood (+${b.horasTransferidasRobinHood}h alocadas)`
            : 'Consolidação de Dificuldades',
          duration: b.duracaoMinutos || 35,
          material: 'Material Vinculado da Biblioteca',
          strategy: 'Prática de Questões e Fixação',
          pedagogyNote: b.mensagemEuDoPassado || 'Tópico prioritário de acordo com a distribuição ponderada do seu edital.'
        });
      });
    }

    // 3. Fallbacks elegantes baseados no edital ou valores padrão do wireframe
    if (list.length === 0) {
      const firstTopic = topics.length > 0 ? topics[0] : null;
      list.push({
        id: 'default-1',
        type: 'Revisão',
        discipline: firstTopic?.disciplina || 'Direito Tributário',
        topic: firstTopic?.assunto || 'Crédito Tributário — Lançamento e Decadência',
        reason: 'Dificuldade recorrente + Alta prioridade',
        duration: 35,
        material: 'PDF Sistematizado (Págs. 12 a 18)',
        strategy: 'Prática intercalada com verificação de retenção',
        pedagogyNote: 'Este tópico foi priorizado porque apresentou erros recentes, possui importância elevada para o objetivo e ainda não teve retenção confirmada.'
      });
      list.push({
        id: 'default-2',
        type: 'Revisão',
        discipline: 'Administração Pública',
        topic: 'Atos Administrativos — Requisitos e Atributos',
        reason: 'Manutenção preventiva de taxa de acerto',
        duration: 25,
        material: 'Caderno de Questões Cespe/Cebraspe',
        strategy: 'Simulado focado com justificativas completas',
        pedagogyNote: 'Prioridade baseada no currículo e no diagnóstico inicial. Ainda não há histórico suficiente para personalização avançada.'
      });
      list.push({
        id: 'default-3',
        type: 'Novo Conteúdo',
        discipline: 'Contabilidade Geral',
        topic: 'Demonstrações Contábeis — Estrutura da DRE',
        reason: 'Cobertura de lacuna teórica do edital verticalizado',
        duration: 45,
        material: 'Apostila Completa Contabilidade (Cap. 4)',
        strategy: 'Leitura esquematizada + 5 questões inéditas',
        pedagogyNote: 'Tópico de alta incidência em provas fiscais com dependência lógica para Balanço Patrimonial.'
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

  const totalPendingRevisions = revisionAgenda?.totalPendentesHoje ?? 3;
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
              Bom dia, Washington.
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

        {/* ==================================================================
            2. HERO CARD: SUA PRÓXIMA ATIVIDADE
            ================================================================== */}
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
