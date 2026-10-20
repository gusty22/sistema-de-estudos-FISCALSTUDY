import { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Play,
  RotateCcw,
  CalendarX2,
  CalendarClock,
  Info,
  ShieldCheck,
  Car,
  ListOrdered
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import type { AdaptiveTask } from './PlanejamentoAdaptativo';
import './VisaoSemanal.css';

// ============================================================================
// TIPOS E DADOS DA VISÃO SEMANAL
// ============================================================================
export type ActivityState =
  | 'CONCLUIDO'
  | 'EM_EXECUCAO'
  | 'ADIADO'
  | 'SUBSTITUIDO'
  | 'PLANEJADO'
  | 'CANCELADO';

export interface WeeklyActivity {
  id: string;
  title: string;
  type: 'NOVO_CONTEUDO' | 'REVISAO' | 'PRATICA';
  duration: number;
  state: ActivityState;
  discipline?: string;
  topic?: string;
  reason?: string;
  note?: string;
}

export interface DaySchedule {
  id: string;
  date: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  availableMinutes: number;
  usedMinutes: number;
  status: 'completed' | 'mixed' | 'active' | 'planned' | 'exception';
  exceptionReason?: string;
  activities: WeeklyActivity[];
}

interface VisaoSemanalProps {
  activeConcurso?: ConcursoItem | null;
  queueTasks?: AdaptiveTask[];
  onNavigateToStudy?: (disciplina: string, assunto?: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onSwitchToQueue?: () => void;
}

export default function VisaoSemanal({
  activeConcurso,
  queueTasks = [],
  onNavigateToStudy,
  onNavigateToTab,
  onSwitchToQueue
}: VisaoSemanalProps) {
  const [selectedDayId, setSelectedDayId] = useState<string>(() => {
    const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    return days[new Date().getDay()];
  });

  const [routineSchedule, setRoutineSchedule] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fiscalstudy_routine_schedule') || '[]');
    } catch {
      return [];
    }
  });

  const [hoursPerShift, setHoursPerShift] = useState<number>(() => {
    try {
      return parseFloat(localStorage.getItem('fiscalstudy_routine_hours_shift') || '2');
    } catch {
      return 2;
    }
  });

  const [restDays, setRestDays] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fiscalstudy_routine_rest_days') || '["DOM"]');
    } catch {
      return ['DOM'];
    }
  });

  const [studiedMinutesToday, setStudiedMinutesToday] = useState<number>(0);
  const [fetchedTasks, setFetchedTasks] = useState<AdaptiveTask[]>([]);

  useEffect(() => {
    if (!activeConcurso?.id) return;

    fetch(`/api/v1/routine?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.cicloDisciplinasJson) {
          try {
            const parsed = JSON.parse(data.cicloDisciplinasJson);
            if (Array.isArray(parsed.schedule)) setRoutineSchedule(parsed.schedule);
            if (parsed.hoursPerShift) setHoursPerShift(parsed.hoursPerShift);
            if (Array.isArray(parsed.restDays)) setRestDays(parsed.restDays);
          } catch {}
        }
      })
      .catch(() => {});

    fetch(`/api/v1/study-sessions/summary?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.totalHours !== undefined) {
          setStudiedMinutesToday(Math.round(data.totalHours * 60));
        }
      })
      .catch(() => {});

    // Fallback: se queueTasks não foi injetado pelo pai, busca diretamente do plano do Maestro
    if (queueTasks.length === 0) {
      fetch(`/api/v1/maestro/plan?concursoId=${encodeURIComponent(activeConcurso.id)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data.passos) && data.passos.length > 0) {
            const mapped: AdaptiveTask[] = data.passos.map((p: any, idx: number) => {
              const rawType = (p.tipo || '').toUpperCase();
              let mappedType: any = 'PRATICA';
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
            setFetchedTasks(mapped);
          }
        })
        .catch(() => {});
    }
  }, [activeConcurso?.id, queueTasks.length]);

  // Lista unificada de tarefas ativas para hoje
  const effectiveQueueTasks = queueTasks.length > 0 ? queueTasks : fetchedTasks;

  // Construir dias da semana corrente dinamicamente e vincular com as tarefas da fila
  const weekDaysData = useMemo<DaySchedule[]>(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Domingo
    // Calcular segunda-feira desta semana
    const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() + mondayOffset);

    const dayMeta = [
      { id: 'SEG', label: 'Segunda', offset: 0 },
      { id: 'TER', label: 'Terça', offset: 1 },
      { id: 'QUA', label: 'Quarta', offset: 2 },
      { id: 'QUI', label: 'Quinta', offset: 3 },
      { id: 'SEX', label: 'Sexta', offset: 4 },
      { id: 'SAB', label: 'Sábado', offset: 5 },
      { id: 'DOM', label: 'Domingo', offset: 6 }
    ];

    // Converter as tarefas da fila em WeeklyActivity para HOJE
    const todayActivities: WeeklyActivity[] = effectiveQueueTasks.map((t, idx) => ({
      id: t.id || `act-${idx}`,
      title: `${t.discipline}: ${t.topic}`,
      type: t.type,
      duration: t.duration,
      state: idx === 0 ? 'EM_EXECUCAO' : 'PLANEJADO',
      discipline: t.discipline,
      topic: t.topic,
      reason: t.reason,
      note: t.reason
    }));

    return dayMeta.map(dm => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + dm.offset);
      const isToday = d.toDateString() === now.toDateString();
      const isPast = d < now && !isToday;
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;

      const isRest = restDays.includes(dm.id);
      const shiftsForDay = routineSchedule.filter(s => s.startsWith(dm.id)).length;
      const availableMinutes = isRest ? 0 : Math.round(shiftsForDay * hoursPerShift * 60);
      const usedMinutes = isToday ? studiedMinutesToday : 0;

      let status: 'completed' | 'mixed' | 'active' | 'planned' | 'exception' = 'planned';
      if (isRest) {
        status = 'exception';
      } else if (isToday) {
        status = 'active';
      } else if (isPast) {
        status = usedMinutes > 0 ? 'completed' : 'mixed';
      }

      // Se for hoje, vincula as tarefas da fila do Planejamento Adaptativo
      // Se for dia futuro com disponibilidade, gera projeção indicativa dos turnos
      let dayActivities: WeeklyActivity[] = [];
      if (isToday) {
        dayActivities = todayActivities;
      } else if (!isPast && !isRest && availableMinutes > 0) {
        // Projeção estimada para turnos configurados na rotina
        const turnsCount = Math.max(1, shiftsForDay);
        const estMinutesPerBlock = Math.round(availableMinutes / turnsCount);
        dayActivities = Array.from({ length: turnsCount }).map((_, i) => ({
          id: `proj-${dm.id}-${i}`,
          title: `Bloco ${i + 1}: Conteúdo Programático Adaptativo`,
          type: i === 0 ? 'REVISAO' : 'PRATICA',
          duration: estMinutesPerBlock,
          state: 'PLANEJADO',
          note: 'Projeção anti-frágil calibrada pela disponibilidade da rotina.'
        }));
      }

      return {
        id: dm.id,
        date: dateStr,
        label: dm.label,
        isToday,
        isPast,
        availableMinutes,
        usedMinutes,
        status,
        exceptionReason: isRest ? 'Dia de Descanso Definido na Rotina' : undefined,
        activities: dayActivities
      };
    });
  }, [routineSchedule, hoursPerShift, restDays, studiedMinutesToday, effectiveQueueTasks]);

  const selectedDay = weekDaysData.find((d) => d.id === selectedDayId) || weekDaysData[0];

  // Helper de Ícone de Estado
  const getStatusIcon = (state: ActivityState) => {
    switch (state) {
      case 'CONCLUIDO':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'EM_EXECUCAO':
        return <Play className="w-4 h-4 text-indigo-500 fill-current" />;
      case 'ADIADO':
        return <CalendarX2 className="w-4 h-4 text-amber-500" />;
      case 'SUBSTITUIDO':
        return <RotateCcw className="w-4 h-4 text-stone-400" />;
      case 'CANCELADO':
        return <CalendarX2 className="w-4 h-4 text-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-stone-400" />;
    }
  };

  return (
    <div className="weekly-calm-wrapper">
      <div className="weekly-calm-container space-y-6">
        {/* CABEÇALHO */}
        <header className="weekly-header">
          <div>
            <div className="weekly-tag">
              <CalendarDays className="w-4 h-4" />
              <span>Planejamento Adaptativo</span>
              {activeConcurso?.nome && (
                <span className="opacity-80 font-normal">
                  • {activeConcurso.nome}
                </span>
              )}
            </div>
            <h1 className="weekly-title">Visão Semanal</h1>
            <p className="weekly-subtitle">
              Acompanhe o fluxo da sua carga de estudo. O futuro é uma projeção
              ajustável, não uma promessa rígida.
            </p>
          </div>

          <div className="weekly-header-actions">
            {onSwitchToQueue && (
              <button
                type="button"
                onClick={onSwitchToQueue}
                className="weekly-action-btn"
                title="Voltar para a Fila do Dia"
              >
                <ListOrdered className="w-4 h-4 text-indigo-500" />
                Fila de Execução
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onNavigateToTab) onNavigateToTab('rotina');
              }}
              className="weekly-action-btn"
              title="Ajustar disponibilidade semanal e turnos"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Editar Disponibilidade
            </button>
          </div>
        </header>

        {/* ALERTA: PRINCÍPIO DA ANTI-FRAGILIDADE */}
        <div className="weekly-antifragile-banner">
          <div className="weekly-antifragile-icon">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="weekly-antifragile-title">
              Princípio da Anti-Fragilidade
            </h4>
            <p className="weekly-antifragile-text">
              Se você não realizar uma atividade hoje, ela{' '}
              <strong>não será copiada cegamente para amanhã</strong> gerando um
              acúmulo impossível. Ela retorna ao Gêmeo Digital, que avaliará todas as suas
              prioridades e recalculará a rota mais eficiente para os dias seguintes.
            </p>
          </div>
        </div>

        {/* SELETOR DE DIAS HORIZONTAL (SEG A DOM) */}
        <div className="weekly-days-row">
          {weekDaysData.map((day) => {
            const isSelected = selectedDayId === day.id;

            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDayId(day.id)}
                className={`weekly-day-card ${
                  day.isToday ? 'is-today' : ''
                } ${isSelected ? 'is-selected' : ''} ${
                  day.isPast ? 'is-past' : ''
                }`}
              >
                <div className="weekly-day-header">
                  <span className="weekly-day-label">{day.label}</span>
                  {day.isToday && <div className="weekly-today-dot" />}
                </div>

                <div className="weekly-day-date">{day.date}</div>

                <div className="weekly-day-progress-box">
                  {day.status === 'exception' ? (
                    <span className="weekly-day-exception-badge">
                      <Car className="w-3 h-3" /> Exceção
                    </span>
                  ) : (
                    <div>
                      <div className="weekly-day-progress-text">
                        <span>
                          {day.usedMinutes}m / {day.availableMinutes}m
                        </span>
                      </div>
                      <div className="weekly-progress-bar-bg">
                        <div
                          className={`weekly-progress-bar-fill ${
                            day.isPast ? 'past' : ''
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (day.usedMinutes / (day.availableMinutes || 1)) * 100
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* PAINEL CENTRAL DO DIA SELECIONADO & LINHA DO TEMPO */}
        <div className="weekly-detail-container">
          <header className="weekly-detail-header">
            <div>
              <h2 className="weekly-detail-day-title">
                {selectedDay.label}, {selectedDay.date}
                {selectedDay.isToday && (
                  <span className="weekly-today-pill">Hoje</span>
                )}
              </h2>
              <div className="weekly-detail-window">
                <Clock className="w-4 h-4 text-stone-400" />
                <span>
                  Janela disponível:{' '}
                  {selectedDay.availableMinutes > 0
                    ? `${selectedDay.availableMinutes} minutos`
                    : 'Sem disponibilidade informada'}
                </span>
              </div>
            </div>
          </header>

          {/* DIA DE EXCEÇÃO / BLOQUEADO */}
          {selectedDay.status === 'exception' ? (
            <div className="weekly-exception-box">
              <div className="weekly-exception-circle">
                <CalendarX2 className="w-6 h-6" />
              </div>
              <h3 className="weekly-exception-heading">Dia Bloqueado</h3>
              <div className="weekly-exception-reason">
                {selectedDay.exceptionReason}
              </div>
              <p className="weekly-exception-desc">
                O sistema já redistribuiu suas revisões prioritárias para os blocos
                ativos da semana. Descanse sem culpa.
              </p>
            </div>
          ) : (
            <div className="weekly-timeline">
              {selectedDay.activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--calm-text-muted)' }}>
                  <CalendarClock className="w-8 h-8 mx-auto mb-3 opacity-40 text-stone-400" />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--calm-text)', margin: '0 0 0.4rem 0' }}>
                    Nenhuma atividade alocada para este dia
                  </h4>
                  <p style={{ fontSize: '0.8rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
                    {selectedDay.availableMinutes > 0
                      ? 'Você possui disponibilidade configurada. Conforme seu ciclo Robin Hood e revisões forem disparados, as atividades serão organizadas aqui.'
                      : 'Nenhum turno de estudo configurado para este dia da semana. Ajuste sua rotina para liberar janelas.'}
                  </p>
                </div>
              ) : (
                selectedDay.activities.map((act) => (
                  <div key={act.id} className="weekly-timeline-item">
                    {/* Marcador Central */}
                    <div className="weekly-timeline-marker">
                      {getStatusIcon(act.state)}
                    </div>

                    {/* Cartão de Atividade */}
                    <div
                      className={`weekly-activity-card ${
                        act.state === 'CONCLUIDO'
                          ? 'is-concluido'
                          : act.state === 'EM_EXECUCAO'
                          ? 'is-em-execucao'
                          : act.state === 'ADIADO'
                          ? 'is-adiado'
                          : act.state === 'SUBSTITUIDO'
                          ? 'is-substituido'
                          : ''
                      }`}
                    >
                      <div className="weekly-activity-top">
                        <span
                          className={`weekly-activity-badge ${
                            act.type === 'REVISAO'
                              ? 'type-revisao'
                              : act.type === 'PRATICA'
                              ? 'type-pratica'
                              : 'type-conteudo'
                          }`}
                        >
                          {act.type.replace('_', ' ')}
                        </span>

                        <span className="weekly-activity-duration">
                          <Clock className="w-3 h-3 text-stone-400" /> {act.duration}m
                        </span>
                      </div>

                      <h4
                        className={`weekly-activity-title ${
                          act.state === 'ADIADO' || act.state === 'SUBSTITUIDO'
                            ? 'strike'
                            : ''
                        }`}
                      >
                        {act.title}
                      </h4>

                      <div className="weekly-activity-footer">
                        <span
                          className={`weekly-state-text ${
                            act.state === 'CONCLUIDO'
                              ? 'concluido'
                              : act.state === 'EM_EXECUCAO'
                              ? 'em-execucao'
                              : act.state === 'PLANEJADO'
                              ? 'planejado'
                              : 'adiado'
                          }`}
                        >
                          {act.state.replace('_', ' ')}
                        </span>

                        {act.note && (
                          <span className="weekly-activity-note">
                            <Info className="w-3 h-3" /> {act.note}
                          </span>
                        )}

                        {selectedDay.isToday && act.discipline && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sessionStorage.setItem('fiscalstudy_session_discipline', act.discipline || '');
                              sessionStorage.setItem('fiscalstudy_session_topic', act.topic || '');
                              sessionStorage.setItem('fiscalstudy_session_objective', act.reason || act.title);
                              if (act.type === 'REVISAO') {
                                sessionStorage.setItem('fiscalstudy_session_type', 'REVISAO');
                              } else if (act.type === 'PRATICA') {
                                sessionStorage.setItem('fiscalstudy_session_type', 'QUESTOES');
                              } else {
                                sessionStorage.setItem('fiscalstudy_session_type', 'ESTUDO_ORIENTADO');
                              }
                              if (onNavigateToTab) {
                                onNavigateToTab('session');
                              } else if (onNavigateToStudy && act.discipline) {
                                onNavigateToStudy(act.discipline, act.topic || '');
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:opacity-85 cursor-pointer ml-auto"
                            title="Iniciar esta atividade no player focado"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Iniciar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
