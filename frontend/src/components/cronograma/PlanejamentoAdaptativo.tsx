import { useState, useEffect } from 'react';
import {
  ListOrdered,
  CalendarDays,
  Play,
  Clock,
  ArrowUp,
  ArrowDown,
  CalendarX2,
  Info,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Settings2,
  ShieldAlert,
  Zap
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import VisaoSemanal from './VisaoSemanal';
import './PlanejamentoAdaptativo.css';

// ============================================================================
// TIPOS E MODELO DE DADOS DA FILA ADAPTATIVA
// ============================================================================
export type TaskType = 'REVISAO' | 'PRATICA' | 'NOVO_CONTEUDO';

export interface AdaptiveTask {
  id: string;
  type: TaskType;
  discipline: string;
  topic: string;
  reason: string;
  duration: number;
  isCritical: boolean;
  status: 'pending' | 'done' | 'postponed';
}

export interface PlanejamentoAdaptativoProps {
  activeConcurso?: ConcursoItem | null;
  onNavigateToStudy?: (disciplina: string, assunto?: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onSwitchToBattle?: () => void;
}

export default function PlanejamentoAdaptativo({
  activeConcurso,
  onNavigateToStudy,
  onNavigateToTab,
  onSwitchToBattle
}: PlanejamentoAdaptativoProps) {
  // 2. Fila Dinâmica e Estado do Planejador
  const [queue, setQueue] = useState<AdaptiveTask[]>([]);
  const [planData, setPlanData] = useState<any>(null);
  const [disponibilidadeMinutos, setDisponibilidadeMinutos] = useState<number>(120);
  const [showStrategy, setShowStrategy] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [postponeWarning, setPostponeWarning] = useState<AdaptiveTask | null>(null);
  const [viewMode, setViewMode] = useState<'QUEUE' | 'WEEKLY'>('QUEUE');

  // 3. Integração com API do Maestro / Robin Hood
  const fetchPlan = () => {
    const url = activeConcurso?.id
      ? `/api/v1/maestro/plan?concursoId=${encodeURIComponent(activeConcurso.id)}`
      : '/api/v1/maestro/plan';

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setPlanData(data);
          const disp =
            data.tempoDisponivelMinutos ||
            (data.telemetriaCognitiva && data.telemetriaCognitiva.tempoDisponivelMinutos) ||
            data.tempoTotalMinutos ||
            120;
          setDisponibilidadeMinutos(disp);

          if (Array.isArray(data.passos) && data.passos.length > 0) {
            const mapped: AdaptiveTask[] = data.passos.map((p: any, idx: number) => {
              const rawType = (p.tipo || '').toUpperCase();
              let mappedType: TaskType = 'PRATICA';
              if (rawType.includes('REVISAO') || rawType.includes('SRS') || rawType.includes('ANKI')) {
                mappedType = 'REVISAO';
              } else if (rawType.includes('TEORIA') || rawType.includes('NOVO') || rawType.includes('VIDEO')) {
                mappedType = 'NOVO_CONTEUDO';
              }

              return {
                id: `dyn_task_${idx}`,
                type: mappedType,
                discipline: p.disciplina || 'Conhecimentos Fiscais',
                topic: p.assunto || p.titulo || 'Tópico Estratégico',
                reason: p.objetivoPedagogico || p.instrucaoMastigada || 'Prioridade algorítmica',
                duration: p.duracaoMinutos || 25,
                isCritical: idx < 2 || mappedType === 'REVISAO',
                status: 'pending'
              };
            });
            setQueue(mapped);
          } else {
            setQueue([]);
          }
        } else {
          setQueue([]);
        }
      })
      .catch(() => {
        setQueue([]);
      });
  };

  useEffect(() => {
    fetchPlan();
  }, [activeConcurso?.id]);

  // Reordenação na fila (Up / Down)
  const moveTask = (index: number, direction: 'UP' | 'DOWN') => {
    const newQueue = [...queue];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
    setQueue(newQueue);
  };

  // Adiamento com proteção pedagógica
  const handlePostponeClick = (task: AdaptiveTask) => {
    if (task.isCritical) {
      setPostponeWarning(task);
    } else {
      executePostpone(task.id);
    }
  };

  const executePostpone = (taskId: string) => {
    setQueue(queue.filter((t) => t.id !== taskId));
    setPostponeWarning(null);
    triggerRecalculation();
  };

  // Recálculo suave
  const triggerRecalculation = () => {
    setIsRecalculating(true);
    fetchPlan();
    setTimeout(() => {
      setIsRecalculating(false);
    }, 700);
  };

  // Iniciar estudo diretamente no player calmo unificado
  const handleStartTask = (task: AdaptiveTask) => {
    sessionStorage.setItem('fiscalstudy_session_discipline', task.discipline);
    sessionStorage.setItem('fiscalstudy_session_topic', task.topic);
    sessionStorage.setItem('fiscalstudy_session_objective', task.reason || `Estudar e dominar ${task.topic}`);
    if (task.type === 'REVISAO') {
      sessionStorage.setItem('fiscalstudy_session_type', 'REVISAO');
    } else if (task.type === 'PRATICA') {
      sessionStorage.setItem('fiscalstudy_session_type', 'QUESTOES');
    } else {
      sessionStorage.setItem('fiscalstudy_session_type', 'ESTUDO_ORIENTADO');
    }

    if (onNavigateToTab) {
      onNavigateToTab('session');
    } else if (onNavigateToStudy) {
      onNavigateToStudy(task.discipline, task.topic);
    }
  };

  // Métricas derivadas
  const totalTime = queue.reduce((acc, task) => acc + task.duration, 0);
  const criticalCount = queue.filter((q) => q.isCritical).length;
  const reviewCount = queue.filter((q) => q.type === 'REVISAO').length;
  const distinctDisciplines = Array.from(
    new Set(
      queue
        .map((t) => t.discipline)
        .filter((d) => d && !d.toLowerCase().includes('descanso') && !d.toLowerCase().includes('pausa'))
    )
  );

  const isOverloaded = totalTime > disponibilidadeMinutos;
  const isComplete = queue.length === 0;

  // Render do Modal de Consequência Cognitiva
  const renderPostponeModal = () => {
    if (!postponeWarning) return null;

    return (
      <div className="planning-modal-backdrop animate-fadeIn">
        <div className="planning-modal-card">
          <div className="planning-modal-icon-circle">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="planning-modal-title">Consequência Cognitiva</h3>
          <p className="planning-modal-desc">
            Você está prestes a adiar <strong>"{postponeWarning.topic}"</strong>. Como o
            motivo desta atividade é{' '}
            <em>"{postponeWarning.reason.toLowerCase()}"</em>, adiá-la aumenta o
            intervalo desde a última recuperação, reduzindo a estabilidade dessa memória.
            <br />
            <br />
            O Gêmeo Digital reorganizará os pesos e tentará reagendar para a próxima janela
            livre. Deseja manter o adiamento?
          </p>

          <div className="planning-modal-actions">
            <button
              type="button"
              onClick={() => setPostponeWarning(null)}
              className="planning-modal-cancel-btn"
            >
              Cancelar (Manter na fila)
            </button>
            <button
              type="button"
              onClick={() => executePostpone(postponeWarning.id)}
              className="planning-modal-confirm-btn"
            >
              Sim, adiar atividade
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (viewMode === 'WEEKLY') {
    return (
      <VisaoSemanal
        activeConcurso={activeConcurso}
        queueTasks={queue}
        onNavigateToStudy={onNavigateToStudy}
        onNavigateToTab={onNavigateToTab}
        onSwitchToQueue={() => setViewMode('QUEUE')}
      />
    );
  }

  return (
    <div className="planning-calm-wrapper">
      {renderPostponeModal()}

      <div className="planning-calm-container space-y-6">
        {/* CABEÇALHO */}
        <header className="planning-header">
          <div>
            <div className="planning-tag">
              <ListOrdered className="w-4 h-4" />
              <span>Motor de Decisão Pedagógica</span>
              {activeConcurso?.nome && (
                <span className="opacity-80 font-normal">
                  • {activeConcurso.nome}
                </span>
              )}
            </div>
            <h1 className="planning-title">Planejamento Adaptativo</h1>
            <p className="planning-subtitle">
              Uma fila dinâmica de atividades, não um cronograma rígido. Reorganize
              conforme sua necessidade e o sistema ajustará a rota em tempo real.
            </p>
          </div>

          <div className="planning-header-actions">
            <button
              type="button"
              onClick={() => setViewMode('WEEKLY')}
              className="planning-action-btn"
              title="Acessar visão semanal da carga e projeção"
            >
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              Visão Semanal
            </button>

            {onSwitchToBattle && (
              <button
                type="button"
                onClick={onSwitchToBattle}
                className="planning-action-btn"
                title="Iniciar Sessão Focada com o player calmo"
              >
                <Zap className="w-4 h-4 text-indigo-500" />
                Iniciar Sessão Focada
              </button>
            )}

            <button
              type="button"
              onClick={triggerRecalculation}
              className="planning-action-btn"
              title="Recalcular prioridades com o Gêmeo Digital"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 ${
                  isRecalculating ? 'animate-spin text-indigo-500' : ''
                }`}
              />
              Recalcular Fila
            </button>
          </div>
        </header>

        {/* REGIÃO 1: CARDS DE SITUAÇÃO ATUAL */}
        <div className="planning-metrics-grid">
          <div className="planning-metric-card">
            <div className="planning-metric-top">
              <span className="planning-metric-label">Tempo Estimado</span>
              <Clock className="w-4 h-4 text-stone-400" />
            </div>
            <div>
              <div className="planning-metric-value">{totalTime} min</div>
              <div className="planning-metric-subtext">
                Disponibilidade: {disponibilidadeMinutos} min
              </div>
            </div>
          </div>

          <div className="planning-metric-card">
            <div className="planning-metric-top">
              <span className="planning-metric-label">Itens Críticos</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="planning-metric-value">{criticalCount}</div>
              <div className="planning-metric-subtext">Prioridade alta na fila</div>
            </div>
          </div>

          <div className="planning-metric-card">
            <div className="planning-metric-top">
              <span className="planning-metric-label">Revisões Injetadas</span>
              <RotateCcw className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="planning-metric-value">{reviewCount}</div>
              <div className="planning-metric-subtext">
                {reviewCount === 0 ? 'Retenção dentro da margem' : 'Para estabilizar memória'}
              </div>
            </div>
          </div>

          <div className={`planning-metric-card ${isOverloaded ? 'is-warning' : 'is-highlight'}`}>
            <div className="planning-metric-top">
              <span
                className="planning-metric-label"
                style={{ color: isOverloaded ? '#d97706' : 'var(--calm-primary)' }}
              >
                Status do Planejador
              </span>
              {isOverloaded ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--calm-primary)' }} />
              )}
            </div>
            <div>
              <div className="planning-metric-value" style={{ fontSize: '1.15rem' }}>
                {isRecalculating
                  ? 'Otimizando rota...'
                  : isOverloaded
                  ? 'Sobrecarga de tempo'
                  : isComplete
                  ? 'Fila do dia concluída'
                  : 'Adequado e balanceado'}
              </div>
              <div className="planning-metric-subtext">
                {isRecalculating
                  ? 'Recalculando prioridades...'
                  : isOverloaded
                  ? `Excede em ${totalTime - disponibilidadeMinutos} min o limite de hoje (${disponibilidadeMinutos} min)`
                  : isComplete
                  ? 'Todas as atividades concluídas'
                  : `${totalTime} min alocados de ${disponibilidadeMinutos} min de hoje`}
              </div>
            </div>
          </div>
        </div>

        {/* LAYOUT PRINCIPAL: FILA + ESTRATÉGIA (12 COLUNAS) */}
        <div className="planning-main-grid">
          {/* REGIÃO 2: A FILA DE ATIVIDADES (8 COLUNAS) */}
          <div
            className={`space-y-3 ${
              isRecalculating ? 'planning-queue-container recalculating' : 'planning-queue-container'
            }`}
          >
            <div className="planning-queue-header">
              Ordem de Execução Recomendada
            </div>

            {queue.map((task, index) => (
              <div
                key={task.id}
                className={`planning-task-card ${
                  task.isCritical ? 'is-critical' : ''
                }`}
              >
                {/* Número Ordinal */}
                <div className="planning-task-number">{index + 1}</div>

                {/* Conteúdo da Tarefa */}
                <div className="planning-task-content">
                  <div className="planning-task-tags">
                    <span
                      className={`planning-type-badge ${
                        task.type === 'REVISAO'
                          ? 'type-revisao'
                          : task.type === 'PRATICA'
                          ? 'type-pratica'
                          : 'type-conteudo'
                      }`}
                    >
                      {task.type === 'NOVO_CONTEUDO'
                        ? 'NOVO CONTEÚDO'
                        : task.type}
                    </span>
                    <span className="planning-task-discipline">
                      {task.discipline}
                    </span>
                  </div>

                  <h3 className="planning-task-topic">{task.topic}</h3>

                  <div className="flex items-center gap-2">
                    <span
                      className={`planning-task-reason ${
                        task.isCritical ? 'is-critical-text' : ''
                      }`}
                    >
                      {task.isCritical && <AlertTriangle className="w-3.5 h-3.5" />}
                      {task.reason}
                    </span>
                  </div>
                </div>

                {/* Ações e Controles */}
                <div className="planning-task-actions">
                  <div className="planning-task-duration">
                    <Clock className="w-3.5 h-3.5" /> {task.duration}m
                  </div>

                  <div className="planning-task-buttons">
                    {/* Controles de Reordenação */}
                    <div className="planning-order-controls">
                      <button
                        type="button"
                        onClick={() => moveTask(index, 'UP')}
                        disabled={index === 0}
                        className="planning-order-btn"
                        title="Subir prioridade na fila"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTask(index, 'DOWN')}
                        disabled={index === queue.length - 1}
                        className="planning-order-btn"
                        title="Descer prioridade na fila"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Botão de Adiar */}
                    <button
                      type="button"
                      onClick={() => handlePostponeClick(task)}
                      title="Adiar atividade"
                      className="planning-postpone-btn"
                    >
                      <CalendarX2 className="w-4 h-4" />
                    </button>

                    {/* Botão de Iniciar (destacado no topo da fila) */}
                    {index === 0 && (
                      <button
                        type="button"
                        onClick={() => handleStartTask(task)}
                        className="planning-start-btn"
                        title="Iniciar atividade agora"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {queue.length === 0 && (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  borderRadius: '1.5rem',
                  border: '1px dashed var(--calm-border)',
                  backgroundColor: 'var(--calm-card-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--calm-subtle-bg)',
                    marginBottom: '1rem',
                    color: 'var(--calm-text-muted)'
                  }}
                >
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                  Fila do Dia Concluída
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--calm-text-muted)', margin: 0 }}>
                  Não há mais atividades pendentes para este bloco de estudo.
                </p>
              </div>
            )}
          </div>

          {/* REGIÃO 3: EXPLICAÇÃO DA ESTRATÉGIA (4 COLUNAS) */}
          <div className="space-y-4">
            {showStrategy ? (
              <div className="planning-strategy-card animate-fadeIn">
                <div className="planning-strategy-header">
                  <h2 className="planning-strategy-title">
                    <Settings2 className="w-4 h-4 text-stone-400" />
                    Lógica do Gêmeo Digital
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowStrategy(false)}
                    className="planning-strategy-toggle-btn"
                  >
                    Ocultar
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="planning-strategy-section-title">
                      Critérios Utilizados Agora
                    </div>
                    <ul className="planning-criteria-list">
                      <li className="planning-criterion-item">
                        <div
                          className="planning-criterion-dot"
                          style={{ backgroundColor: '#6366f1' }}
                        />
                        <span>
                          <strong>Priorização por Decaimento:</strong>{' '}
                          {reviewCount > 0
                            ? `${reviewCount} ${
                                reviewCount === 1 ? 'revisão foi injetada' : 'revisões foram injetadas'
                              } no topo porque o algoritmo detectou pendência real de repetição espaçada ou risco de esquecimento.`
                            : 'Nenhuma revisão emergencial injetada hoje. A retenção estimada das disciplinas está dentro da margem de segurança (≥ 75%) e a repetição espaçada está em dia.'}
                        </span>
                      </li>
                      <li className="planning-criterion-item">
                        <div
                          className="planning-criterion-dot"
                          style={{ backgroundColor: '#f59e0b' }}
                        />
                        <span>
                          <strong>Alternância Cognitiva (Interleaving):</strong>{' '}
                          {distinctDisciplines.length > 1
                            ? `Sessões intercaladas entre ${distinctDisciplines.length} matérias (${distinctDisciplines.join(
                                ' ➔ '
                              )}). Cada bloco é calibrado para até 50–60 min para manter alta performance cognitiva e evitar a fadiga mental.`
                            : `Foco direcionado em ${
                                distinctDisciplines[0] || 'disciplina prioritária'
                              }, equilibrando teoria, questões práticas e consolidação.`}
                        </span>
                      </li>
                      <li className="planning-criterion-item">
                        <div
                          className="planning-criterion-dot"
                          style={{ backgroundColor: isOverloaded ? '#d97706' : '#10b981' }}
                        />
                        <span>
                          <strong>Restrição de Tempo:</strong>{' '}
                          {!isOverloaded
                            ? `A fila foi calibrada para ${totalTime} min, perfeitamente adequada à sua disponibilidade de hoje (${disponibilidadeMinutos} min), preservando intervalos de descanso mental entre blocos.`
                            : `Alerta de Restrição: a fila soma ${totalTime} min, excedendo sua disponibilidade de hoje (${disponibilidadeMinutos} min) em ${
                                totalTime - disponibilidadeMinutos
                              } min. Considere adiar tarefas secundárias.`}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="planning-divider" />

                  <div>
                    <div className="planning-strategy-section-title">
                      Ocorrências Recentes
                    </div>
                    <div className="planning-event-box">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-stone-400" />
                      <p className="margin-0 leading-relaxed text-[11px]">
                        {planData?.telemetriaCognitiva?.ocorrenciaRecente ||
                          (distinctDisciplines.length > 1
                            ? `Alternância ativa aplicada com sucesso entre ${distinctDisciplines.join(
                                ' e '
                              )} para garantir alta absorção cognitiva sem monotonia.`
                            : 'Roteiro de estudo equilibrado entre absorção de novos conceitos e fixação prática por questões.')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowStrategy(true)}
                className="planning-strategy-collapsed-btn"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-stone-400" />
                  Entender estratégia do sistema
                </span>
                <Info className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
