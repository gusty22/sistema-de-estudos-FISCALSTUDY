import { useState, useEffect, useRef } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { LeitorMaterialModal } from '../materiais/LeitorMaterialModal';
import { ResolucaoQuestaoModal } from '../questoes/ResolucaoQuestaoModal';
import type { QuestionItem } from '../questoes/BancoQuestoes';
import type { StudyMaterialItem } from '../materiais/BibliotecaMateriais';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import { StudySessionSubmission, StudySessionError } from '../../utils/studySessionSubmission';
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
  const [activityType, setActivityType] = useState<ActivityType>(() => {
    if (initialActivityType && initialActivityType !== 'ESTUDO_ORIENTADO') return initialActivityType;
    const storedType = sessionStorage.getItem('fiscalstudy_session_type') as ActivityType;
    return storedType && STEPS_BY_TYPE[storedType] ? storedType : initialActivityType;
  });
  // Identidade de sessão estável para idempotência e recuperação local
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem('fiscalstudy_active_session_id');
      if (stored) return stored;
      const generated = `sess_${crypto.randomUUID()}`;
      sessionStorage.setItem('fiscalstudy_active_session_id', generated);
      return generated;
    } catch {
      return `sess_${crypto.randomUUID()}`;
    }
  });

  const isSavingSessionRef = useRef<boolean>(false);
  const pendingSubmissionRef = useRef<StudySessionSubmission | null>(null);
  const [saveError, setSaveError] = useState<{ message: string; isConflict: boolean; retryable: boolean } | null>(null);

  const effectiveDiscipline = initialDiscipline || sessionStorage.getItem('fiscalstudy_session_discipline') || activeConcurso?.nome || DEFAULT_SESSION.discipline;
  const effectiveTopic = initialTopic || sessionStorage.getItem('fiscalstudy_session_topic') || DEFAULT_SESSION.topic;
  const effectiveObjective = initialObjective || sessionStorage.getItem('fiscalstudy_session_objective') || DEFAULT_SESSION.objective;

  const session: SessionData = {
    ...DEFAULT_SESSION,
    discipline: effectiveDiscipline,
    topic: effectiveTopic,
    objective: effectiveObjective,
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

  // Modais de suporte e Conteúdo Embutido (Tecnologia Calma)
  const [showInterruption, setShowInterruption] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [difficultyText, setDifficultyText] = useState('');
  const [fatigueDismissed, setFatigueDismissed] = useState(false);

  // Estados para leitor de PDF e questões embutidos na sessão
  const [embeddedMaterial, setEmbeddedMaterial] = useState<StudyMaterialItem | null>(null);
  const [isLoadingMaterial, setIsLoadingMaterial] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionItem[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isEmbeddedQuestionsOpen, setIsEmbeddedQuestionsOpen] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Abre material embutido diretamente na tela do timer
  const handleOpenEmbeddedMaterial = async () => {
    setIsLoadingMaterial(true);
    try {
      // 1. Tenta carregar materiais vinculados ao concurso ou disciplina
      const res = await fetch(`/api/v1/materials?concursoId=${encodeURIComponent(activeConcurso?.id || '')}`);
      if (res.ok) {
        const list: StudyMaterialItem[] = await res.json();
        // Procura material que coincida com a disciplina ou id
        const match = list.find(m => 
          (session.material.materialId && m.id === session.material.materialId) ||
          m.disciplina?.toLowerCase() === session.discipline.toLowerCase() ||
          m.titulo?.toLowerCase().includes(session.topic.toLowerCase())
        ) || list[0];

        if (match) {
          setEmbeddedMaterial(match);
          return;
        }
      }
      
      // Fallback: cria objeto temporário com os dados da sessão
      setEmbeddedMaterial({
        id: session.material.materialId || 'temp_mat',
        titulo: session.material.title,
        disciplina: session.discipline,
        formato: 'PDF',
        totalPaginas: 150,
        paginaAtual: 142
      });
    } catch (e) {
      console.warn('Fallback para visualização de material:', e);
      setEmbeddedMaterial({
        id: 'temp_mat',
        titulo: session.material.title,
        disciplina: session.discipline,
        formato: 'PDF',
        totalPaginas: 150,
        paginaAtual: 142
      });
    } finally {
      setIsLoadingMaterial(false);
    }
  };

  // Carrega e abre questões do tópico embutidas na sessão
  const handleOpenEmbeddedQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const url = `/api/v1/bank/questions?disciplina=${encodeURIComponent(session.discipline)}&page=0&size=5`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.questions || data.items || [];
        if (items.length > 0) {
          setSessionQuestions(items);
          setCurrentQuestionIdx(0);
          setIsEmbeddedQuestionsOpen(true);
          return;
        }
      }
      // Se não encontrou por disciplina específica, busca as gerais
      const fallbackRes = await fetch('/api/v1/bank/questions?page=0&size=5');
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const fallbackItems = fallbackData.questions || fallbackData.items || [];
        if (fallbackItems.length > 0) {
          setSessionQuestions(fallbackItems);
          setCurrentQuestionIdx(0);
          setIsEmbeddedQuestionsOpen(true);
          return;
        }
      }
      alert('Nenhuma questão cadastrada para este tópico no momento.');
    } catch (e) {
      console.error('Erro ao carregar questões para a sessão:', e);
      alert('Não foi possível carregar as questões no momento.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

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
      // Ao concluir a ultima etapa, transiciona para a tela de revisao e encerramento (T14).
      // O callback onFinishSession dispara estritamente apos confirmacao HTTP em handleFinalizeAndRecord.
      setTimerStatus('finished');
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

    if (embeddedMaterial) {
      return (
        <LeitorMaterialModal
          material={embeddedMaterial}
          onClose={() => setEmbeddedMaterial(null)}
          onUpdateProgress={(_matId, newPage) => {
            setEmbeddedMaterial(prev => prev ? { ...prev, paginaAtual: newPage } : null);
          }}
        />
      );
    }

    if (isEmbeddedQuestionsOpen && sessionQuestions.length > 0) {
      const activeQ = sessionQuestions[currentQuestionIdx];
      return (
        <ResolucaoQuestaoModal
          captureScope={'active:' + effectiveDiscipline + '|' + effectiveTopic}
          question={activeQ}
          currentIndex={currentQuestionIdx}
          totalInBatch={sessionQuestions.length}
          onClose={() => setIsEmbeddedQuestionsOpen(false)}
          onNext={() => {
            if (currentQuestionIdx < sessionQuestions.length - 1) {
              setCurrentQuestionIdx(prev => prev + 1);
            }
          }}
          onPrev={() => {
            if (currentQuestionIdx > 0) {
              setCurrentQuestionIdx(prev => prev - 1);
            }
          }}
          onQuestionAnswered={(_qId: string, _isCorrect: boolean) => {
            if (currentQuestionIdx < sessionQuestions.length - 1) {
              setCurrentQuestionIdx(prev => prev + 1);
            } else {
              setIsEmbeddedQuestionsOpen(false);
            }
          }}
          onToggleFavorite={() => {}}
          onReportQuestion={() => {}}
        />
      );
    }

    return null;
  };

  // Envio idempotente para a API com barreira sincrona e recuperacao
  const handleFinalizeAndRecord = async () => {
    // Barreira sincrona contra clique duplo ou submissao apos confirmacao
    if (isSavingSessionRef.current || isSaved) return;

    if (!pendingSubmissionRef.current) {
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
      pendingSubmissionRef.current = new StudySessionSubmission(payload, sessionId);
    }

    isSavingSessionRef.current = true;
    setIsSavingSession(true);
    setSaveError(null);

    try {
      await pendingSubmissionRef.current.send();

      // Confirmacao valida recebida do backend (200 / 201)
      setIsSaved(true);
      pendingSubmissionRef.current = null;
      try {
        sessionStorage.removeItem('fiscalstudy_active_session_id');
      } catch {
        // Silencioso em caso de storage restrito
      }

      if (onFinishSession) {
        onFinishSession({
          durationSeconds: secondsElapsed,
          discipline: session.discipline,
          topic: session.topic
        });
      }
    } catch (err: unknown) {
      const isConflict = err instanceof StudySessionError ? err.isConflict : false;
      const message = err instanceof Error ? err.message : 'Falha ao gravar sessao no servidor.';
      setSaveError({
        message,
        isConflict,
        retryable: !isConflict
      });
    } finally {
      isSavingSessionRef.current = false;
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

          {/* Feedback de Erro com Ação de Retry */}
          {saveError && (
            <div className="mb-4 p-3 rounded-xl text-left bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex flex-col gap-2">
              <span>{saveError.message}</span>
              {saveError.retryable && (
                <button
                  type="button"
                  onClick={handleFinalizeAndRecord}
                  disabled={isSavingSession}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition w-fit"
                >
                  {isSavingSession ? 'Reenviando...' : '🔄 Tentar Novamente'}
                </button>
              )}
            </div>
          )}

          {/* Ações de Encerramento */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={handleFinalizeAndRecord}
              disabled={isSavingSession || isSaved}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
            >
              {isSavingSession ? 'Salvando...' : isSaved ? '✓ Registrado com Sucesso' : saveError?.retryable ? '🔄 Tentar Novamente' : 'Finalizar e Registrar'}
            </button>

            <button
              type="button"
              onClick={() => {
                setTimerStatus('running');
                setSaveError(null);
                if (isSaved) {
                  setIsSaved(false);
                  pendingSubmissionRef.current = null;
                  const newId = `sess_${crypto.randomUUID()}`;
                  setSessionId(newId);
                  try {
                    sessionStorage.setItem('fiscalstudy_active_session_id', newId);
                  } catch {
                    // Silencioso em caso de storage restrito
                  }
                }
              }}
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
        {/* Seletor Elegante do Tipo de Atividade (Tecnologia Calma) */}
        <div className="session-activity-bar">
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
              className={`session-activity-pill ${activityType === t.id ? 'active' : ''}`}
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
              } else {
                handleOpenEmbeddedMaterial();
              }
            }}
            className="session-material-open-btn flex items-center gap-1.5"
            disabled={isLoadingMaterial}
          >
            {isLoadingMaterial ? (
              <span>Carregando...</span>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" /> Ler PDF Embutido
              </>
            )}
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

                        {/* Atalho especial no passo 3 (Prática de Fixação) ou atividade QUESTOES */}
                        {(step.id === 'step_3' || activityType === 'QUESTOES') && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenQuestions) {
                                  onOpenQuestions(session.discipline, session.topic);
                                } else {
                                  handleOpenEmbeddedQuestions();
                                }
                              }}
                              disabled={isLoadingQuestions}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:opacity-85 cursor-pointer transition shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              {isLoadingQuestions ? 'Buscando questões...' : 'Resolver Questões de Fixação Embutidas'}
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
