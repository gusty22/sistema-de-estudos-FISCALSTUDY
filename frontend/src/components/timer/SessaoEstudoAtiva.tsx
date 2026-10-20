import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  Flag,
  AlertTriangle,
  Coffee,
  Target,
  ChevronRight,
  BrainCircuit,
  ListTodo,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './SessaoEstudoAtiva.css';

// ============================================================================
// ESTRUTURA DA SESSÃO ATIVA
// ============================================================================
export interface SessionStep {
  id: string;
  title: string;
  description: string;
}

export interface SessionData {
  id: string;
  discipline: string;
  topic: string;
  objective: string;
  material: {
    title: string;
    pages: string;
    type: string;
    materialId?: string;
  };
  steps: SessionStep[];
}

export type ActivityType =
  | 'ESTUDO_ORIENTADO'
  | 'QUESTOES'
  | 'CORRECAO_ERROS'
  | 'RECUPERACAO_ATIVA'
  | 'REVISAO'
  | 'SIMULADO';

export const STEPS_BY_TYPE: Record<ActivityType, SessionStep[]> = {
  ESTUDO_ORIENTADO: [
    { id: 'step_1', title: 'Recuperar conhecimento anterior', description: 'Antes de abrir o material, tente listar mentalmente 3 pontos que você já recorda sobre o tema.' },
    { id: 'step_2', title: 'Estudar trecho selecionado', description: 'Leia o material focado nos conceitos fundamentais e distinções práticas.' },
    { id: 'step_3', title: 'Resolver questões', description: 'Resolva questões imediatas para validar a compreensão ativa do texto.' },
    { id: 'step_4', title: 'Verificar compreensão', description: 'Resuma o conceito central em uma frase e registre seu nível de confiança.' }
  ],
  QUESTOES: [
    { id: 'step_1', title: 'Alinhamento de Foco & Conceito', description: 'Revise rapidamente as regras basilares do assunto antes dos testes.' },
    { id: 'step_2', title: 'Resolução de Bateria de Questões', description: 'Resolva a sequência de itens sem consultar gabarito antecipadamente.' },
    { id: 'step_3', title: 'Análise de Gabarito e Justificativas', description: 'Confronte suas respostas com as justificativas oficiais e fundamentadas.' }
  ],
  CORRECAO_ERROS: [
    { id: 'step_1', title: 'Releitura do Enunciado & Pegadinha', description: 'Identifique onde estava a armadilha do examinador ou a palavra-chave.' },
    { id: 'step_2', title: 'Diagnóstico da Causa Raiz do Erro', description: 'Classifique a falha: Falsa Fluência, Falta de Base, Exceção ou Desatenção.' },
    { id: 'step_3', title: 'Teste de Transferência em Questão Inédita', description: 'Aplique a regra corrigida em um item novo da mesma banca.' }
  ],
  RECUPERACAO_ATIVA: [
    { id: 'step_1', title: 'Recordação Livre (Brain Dump)', description: 'Escreva ou verbalize tudo o que se lembra sobre o tópico sem consulta.' },
    { id: 'step_2', title: 'Confronto com a Norma ou Doutrina', description: 'Compare sua recordação com o texto legal ou mapa mental para achar lacunas.' },
    { id: 'step_3', title: 'Síntese e Ajuste de Retenção', description: 'Registre o que havia esquecido para reforço prioritário pelo Gêmeo Digital.' }
  ],
  REVISAO: [
    { id: 'step_1', title: 'Verificação Rápida de Retenção', description: 'Resolva 3 flashcards ou questões de sondagem no ponto de decaimento.' },
    { id: 'step_2', title: 'Reforço nos Pontos de Hesitação', description: 'Releia apenas as notas e mnemônicos do tópico específico.' },
    { id: 'step_3', title: 'Fechamento de Ciclo', description: 'Confirme o espaçamento da próxima revisão no calendário adaptativo.' }
  ],
  SIMULADO: [
    { id: 'step_1', title: 'Preparação em Ambiente Real de Prova', description: 'Zere distrações, prepare água e cronometre o tempo total sem interrupções.' },
    { id: 'step_2', title: 'Resolução Cronometrada sem Consultas', description: 'Execute o bloco inteiro com ritmo constante de prova.' },
    { id: 'step_3', title: 'Auditoria de Desempenho e Erros', description: 'Analise o aproveitamento líquido e alimente as evidências do Gêmeo Digital.' }
  ]
};

const DEFAULT_SESSION: SessionData = {
  id: 'sess_001',
  discipline: 'Direito Tributário',
  topic: 'Crédito Tributário',
  objective:
    'Diferenciar suspensão e extinção do crédito tributário com base nas hipóteses do CTN.',
  material: {
    title: 'Manual de Direito Tributário — Cap. 5',
    pages: 'Págs. 142 a 148',
    type: 'PDF Vinculado'
  },
  steps: STEPS_BY_TYPE.ESTUDO_ORIENTADO
};

interface SessaoEstudoAtivaProps {
  activeConcurso?: ConcursoItem | null;
  initialDiscipline?: string;
  initialTopic?: string;
  initialObjective?: string;
  initialActivityType?: ActivityType;
  onBack?: () => void;
  onFinishSession?: (stats: {
    durationSeconds: number;
    discipline: string;
    topic: string;
  }) => void;
  onOpenQuestions?: (discipline: string, topic: string) => void;
  onOpenMaterial?: (materialId?: string, title?: string) => void;
}

export default function SessaoEstudoAtiva({
  activeConcurso,
  initialDiscipline,
  initialTopic,
  initialObjective,
  initialActivityType = 'ESTUDO_ORIENTADO',
  onBack,
  onFinishSession,
  onOpenQuestions,
  onOpenMaterial
}: SessaoEstudoAtivaProps) {
  // 2. Tipo de Atividade e Sessão
  const [activityType, setActivityType] = useState<ActivityType>(initialActivityType);
  const [sessionId] = useState<string>(() => `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  const session: SessionData = {
    ...DEFAULT_SESSION,
    discipline: initialDiscipline || activeConcurso?.nome || DEFAULT_SESSION.discipline,
    topic: initialTopic || DEFAULT_SESSION.topic,
    objective: initialObjective || DEFAULT_SESSION.objective,
    steps: STEPS_BY_TYPE[activityType] || DEFAULT_SESSION.steps
  };

  // 3. Cronômetro e Etapas
  const [timerStatus, setTimerStatus] = useState<'running' | 'paused' | 'finished'>('running');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [interruptionCount, setInterruptionCount] = useState(0);

  // Estados de Encerramento (T14)
  const [completionStatus, setCompletionStatus] = useState<'SIM' | 'PARCIAL' | 'NAO'>('SIM');
  const [difficultyReason, setDifficultyReason] = useState<string | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Modais de suporte
  const [showInterruption, setShowInterruption] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [difficultyText, setDifficultyText] = useState('');
  const [fatigueDismissed, setFatigueDismissed] = useState(false);

  useEffect(() => {
    let interval: any;
    if (timerStatus === 'running') {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerStatus]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleNextStep = () => {
    if (currentStepIndex < session.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setTimerStatus('finished');
      if (onFinishSession) {
        onFinishSession({
          durationSeconds: secondsElapsed,
          discipline: session.discipline,
          topic: session.topic
        });
      }
    }
  };

  const handlePauseResume = () => {
    setTimerStatus((prev) => (prev === 'running' ? 'paused' : 'running'));
  };

  // Modais de Suporte
  const renderModals = () => {
    if (showInterruption) {
      return (
        <div className="session-modal-backdrop animate-fadeIn">
          <div className="session-modal-card">
            <div className="session-modal-icon-circle interruption">
              <Coffee className="w-5 h-5 text-stone-500" />
            </div>
            <h3 className="session-modal-title">Registrar Interrupção</h3>
            <p className="session-modal-desc">
              O cronômetro está pausado. Informe o motivo para calibrarmos seu tempo
              líquido real de foco no futuro.
            </p>
            <div className="space-y-2 mb-4">
              {[
                'Pausa para água / descanso',
                'Interrupção externa / ligação',
                'Cansaço mental momentâneo',
                'Outro compromisso'
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setInterruptionCount((prev) => prev + 1);
                    setShowInterruption(false);
                    handlePauseResume();
                  }}
                  className="session-reason-btn"
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="session-modal-actions">
              <button
                type="button"
                onClick={() => setShowInterruption(false)}
                className="session-modal-cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setInterruptionCount((prev) => prev + 1);
                  setShowInterruption(false);
                  handlePauseResume();
                }}
                className="session-modal-submit-btn"
              >
                Retomar Estudo
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (showDifficulty) {
      return (
        <div className="session-modal-backdrop animate-fadeIn">
          <div className="session-modal-card">
            <div className="session-modal-icon-circle difficulty">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="session-modal-title">Sinalizar Dificuldade</h3>
            <p className="session-modal-desc">
              Sua sinalização informará ao Gêmeo Digital que este tópico requer cuidado
              especial (revisão de base ou método alternativo) nas próximas sessões.
            </p>
            <textarea
              placeholder="Opcional: O que está mais confuso? (Ex: A diferença prática entre os conceitos, a terminologia do material...)"
              value={difficultyText}
              onChange={(e) => setDifficultyText(e.target.value)}
              className="session-modal-textarea"
            />
            <div className="session-modal-actions">
              <button
                type="button"
                onClick={() => setShowDifficulty(false)}
                className="session-modal-cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDifficulty(false);
                  setDifficultyText('');
                }}
                className="session-modal-submit-btn warning"
              >
                Sinalizar Gêmeo Digital
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Envio idempotente para a API
  const handleFinalizeAndRecord = async () => {
    setIsSavingSession(true);
    try {
      const payload = {
        sessionId,
        concursoId: activeConcurso?.id || null,
        disciplina: session.discipline,
        topicoId: session.topic,
        materialId: session.material.materialId || null,
        durationSeconds: secondsElapsed,
        modo: 'CRONOMETRO',
        activityType,
        interrupcoesCount: interruptionCount,
        etapasConcluidas: currentStepIndex + 1,
        totalEtapas: session.steps.length,
        statusConclusao: completionStatus,
        dificuldadeRelatada: difficultyReason || difficultyText || null,
        notas: difficultyText || undefined
      };

      await fetch('/api/v1/study-sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setIsSaved(true);
      if (onFinishSession) {
        onFinishSession({
          durationSeconds: secondsElapsed,
          discipline: session.discipline,
          topic: session.topic
        });
      }
    } catch (err) {
      console.error('Falha ao gravar sessão:', err);
    } finally {
      setIsSavingSession(false);
    }
  };

  // T14: ENCERRAMENTO DA SESSÃO
  if (timerStatus === 'finished') {
    return (
      <div className="session-finished-container">
        <div className="session-finished-card animate-fadeIn max-w-xl w-full">
          <div className="session-finished-circle">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="session-finished-title">Encerramento da Sessão</h2>
          <p className="session-finished-subtitle">
            {session.discipline} — {session.topic}
          </p>

          {/* Resumo Automático */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 p-3 rounded-xl bg-stone-100 dark:bg-[#111214] border border-stone-200 dark:border-[#26282b] text-left">
            <div>
              <span className="block text-[10px] uppercase font-bold text-stone-400">Tempo Ativo</span>
              <span className="text-sm font-bold">{formatTime(secondsElapsed)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-stone-400">Etapas</span>
              <span className="text-sm font-bold">{currentStepIndex + 1}/{session.steps.length}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-stone-400">Interrupções</span>
              <span className="text-sm font-bold">{interruptionCount}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-stone-400">Atividade</span>
              <span className="text-sm font-bold truncate">{activityType.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Perguntas Opcionais */}
          <div className="text-left space-y-3 mb-4 p-3 rounded-xl border border-stone-200 dark:border-[#26282b]">
            <div>
              <span className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                Você conseguiu concluir a atividade?
              </span>
              <div className="flex gap-2">
                {(['SIM', 'PARCIAL', 'NAO'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCompletionStatus(opt)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                      completionStatus === opt
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {opt === 'SIM' ? 'Sim' : opt === 'PARCIAL' ? 'Parcialmente' : 'Não'}
                  </button>
                ))}
              </div>
            </div>

            {completionStatus !== 'SIM' && (
              <div>
                <span className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                  O que dificultou?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'CONTEUDO_COMPLEXO', label: 'Conteúdo complexo' },
                    { id: 'MATERIAL_INADEQUADO', label: 'Material inadequado' },
                    { id: 'FALTA_TEMPO', label: 'Falta de tempo' },
                    { id: 'INTERRUPCAO', label: 'Interrupção externa' },
                    { id: 'OUTRO', label: 'Outro' }
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficultyReason(d.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition border ${
                        difficultyReason === d.id
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Princípio do Gêmeo Digital (Regra Canônica) */}
          <div className="session-finished-twin-box text-left mb-5">
            <BrainCircuit className="w-5 h-5 session-finished-twin-icon shrink-0" />
            <div>
              <div className="session-finished-twin-label">
                Princípio do Gêmeo Digital
              </div>
              <p className="session-finished-twin-desc">
                Concluir uma leitura não significa dominar o assunto. Esta conclusão registra a{' '}
                <strong>execução consciente</strong> da atividade. Seu domínio real sobre "{session.topic}"{' '}
                será validado e calibrado através das próximas evidências de resolução de questões.
              </p>
            </div>
          </div>

          {/* Ações de Encerramento */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={handleFinalizeAndRecord}
              disabled={isSavingSession || isSaved}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
            >
              {isSavingSession ? 'Salvando...' : isSaved ? '✓ Registrado com Sucesso' : 'Finalizar e Registrar'}
            </button>

            <button
              type="button"
              onClick={() => setTimerStatus('running')}
              className="px-4 py-2.5 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              Continuar Estudando
            </button>

            <button
              type="button"
              onClick={() => {
                if (onBack) onBack();
              }}
              className="px-4 py-2.5 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              Ver Próxima Atividade
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`session-calm-wrapper ${
        timerStatus === 'paused' ? 'is-paused' : ''
      }`}
    >
      {renderModals()}

      {/* HEADER: Minimalista e Focado */}
      <header className="session-header">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
          }}
          className="session-back-btn"
          title="Suspender sessão e voltar"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Suspender e Voltar</span>
        </button>

        <div className="session-header-title-box">
          <span className="session-discipline-tag">{session.discipline}</span>
          <span className="session-topic-title" title={session.topic}>
            {session.topic}
          </span>
        </div>

        <div className="session-header-right">
          <div
            className={`session-timer-display ${
              timerStatus === 'paused' ? 'paused' : ''
            }`}
          >
            <Clock className="w-4 h-4 opacity-70" />
            <span>{formatTime(secondsElapsed)}</span>
          </div>
        </div>
      </header>

      {/* CORPO DA SESSÃO */}
      <main className="session-main-body">
        {/* Seletor Sutil do Tipo de Atividade (T13) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-2 no-scrollbar">
          {[
            { id: 'ESTUDO_ORIENTADO', label: 'Estudo Orientado' },
            { id: 'QUESTOES', label: 'Resolução de Questões' },
            { id: 'CORRECAO_ERROS', label: 'Correção de Erros' },
            { id: 'RECUPERACAO_ATIVA', label: 'Recuperação Ativa' },
            { id: 'REVISAO', label: 'Revisão' },
            { id: 'SIMULADO', label: 'Simulado' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActivityType(t.id as ActivityType);
                setCurrentStepIndex(0);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                activityType === t.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-[#16181a] border-stone-200 dark:border-[#26282b] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Alerta de Fadiga Cognitiva em Tempo Real (> 90 min) */}
        {secondsElapsed >= 5400 && !fatigueDismissed && (
          <div
            className="animate-fadeIn"
            style={{
              padding: '0.9rem 1.15rem',
              borderRadius: '0.85rem',
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Coffee className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <strong style={{ fontSize: '0.8rem', color: '#f43f5e', display: 'block' }}>
                  Alerta de Fadiga: 90 minutos contínuos sem pausa
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--calm-text-muted, #64748b)' }}>
                  A velocidade de leitura e a taxa de acerto caem vertiginosamente após 90min. Faça uma pausa de 10-15 min.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setTimerStatus('paused');
                  setShowInterruption(true);
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: '#f43f5e',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Pausar Agora
              </button>
              <button
                type="button"
                onClick={() => setFatigueDismissed(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--calm-text-muted, #94a3b8)',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                Dispensar
              </button>
            </div>
          </div>
        )}

        {/* Cartão de Objetivo (Norte Pedagógico) */}
        <div className="session-objective-card">
          <Target className="w-5 h-5 session-objective-icon" />
          <div>
            <div className="session-objective-label">Objetivo Pedagógico</div>
            <p className="session-objective-text">{session.objective}</p>
          </div>
        </div>

        {/* Cartão de Material Vinculado */}
        <div className="session-material-card">
          <div className="session-material-left">
            <div className="session-material-icon-box">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="session-material-tag">Material Vinculado</span>
              <span className="session-material-title">
                {session.material.title}
              </span>
              <span className="session-material-pages">
                {session.material.pages}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onOpenMaterial) {
                onOpenMaterial(session.material.materialId, session.material.title);
              }
            }}
            className="session-material-open-btn flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir Material
          </button>
        </div>

        {/* Roteiro da Sessão (Etapas Progressivas) */}
        <div className="session-steps-container">
          <div className="session-steps-header">
            <ListTodo className="w-4 h-4 text-stone-400" />
            <span>Roteiro da Sessão</span>
          </div>

          <div className="space-y-3">
            {session.steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isFuture = index > currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={`session-step-card ${
                    isCurrent
                      ? 'is-current'
                      : isCompleted
                      ? 'is-completed'
                      : isFuture
                      ? 'is-future'
                      : ''
                  }`}
                >
                  <div className="session-step-indicator">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isCurrent ? (
                      <Circle className="w-5 h-5 fill-current text-indigo-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h4
                      className={`session-step-title ${
                        isCompleted ? 'completed' : ''
                      }`}
                    >
                      {step.title}
                    </h4>

                    {isCurrent && (
                      <div>
                        <p className="session-step-desc animate-fadeIn">
                          {step.description}
                        </p>

                        {/* Atalho especial no passo 3 (Prática de Fixação) */}
                        {step.id === 'step_3' && onOpenQuestions && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenQuestions(session.discipline, session.topic)
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:opacity-85 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              Resolver Questões de Fixação Agora
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* BARRA DE CONTROLE FLUTUANTE INFERIOR */}
      <div className="session-footer-bar">
        <div className="session-footer-pill">
          <div className="session-footer-actions-left">
            <button
              type="button"
              onClick={() => {
                setShowInterruption(true);
                setTimerStatus('paused');
              }}
              className={`session-icon-btn ${
                timerStatus === 'paused' ? 'is-paused' : ''
              }`}
              title="Pausar ou Registrar Interrupção"
            >
              {timerStatus === 'paused' ? (
                <Play className="w-5 h-5" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowDifficulty(true)}
              className="session-icon-btn"
              title="Sinalizar Dificuldade ao Gêmeo Digital"
            >
              <Flag className="w-5 h-5" />
            </button>

            {onOpenQuestions && (
              <button
                type="button"
                onClick={() => onOpenQuestions(session.discipline, session.topic)}
                className="session-icon-btn"
                title="Abrir Questão Associada ao Tópico"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={
              timerStatus === 'running' ? handleNextStep : handlePauseResume
            }
            className={`session-primary-advance-btn ${
              timerStatus === 'paused' ? 'paused' : 'running'
            }`}
          >
            {timerStatus === 'paused' ? (
              <>
                Retomar Foco <Play className="w-4 h-4 fill-current" />
              </>
            ) : currentStepIndex === session.steps.length - 1 ? (
              <>
                Concluir Sessão <CheckCircle2 className="w-4 h-4" />
              </>
            ) : (
              <>
                Concluir Etapa <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
