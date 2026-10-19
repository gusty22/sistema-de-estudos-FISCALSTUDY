import { useState } from 'react';
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

const WEEK_DATA: DaySchedule[] = [
  {
    id: 'SEG',
    date: '14/Out',
    label: 'Segunda',
    isToday: false,
    isPast: true,
    availableMinutes: 120,
    usedMinutes: 110,
    status: 'completed',
    activities: [
      { id: 'a1', title: 'Morfologia — Verbos', type: 'NOVO_CONTEUDO', duration: 60, state: 'CONCLUIDO' },
      { id: 'a2', title: 'Revisões Espaçadas (4 tópicos)', type: 'REVISAO', duration: 25, state: 'CONCLUIDO' },
      { id: 'a3', title: 'Direito Administrativo — Princípios', type: 'PRATICA', duration: 25, state: 'CONCLUIDO' }
    ]
  },
  {
    id: 'TER',
    date: '15/Out',
    label: 'Terça',
    isToday: false,
    isPast: true,
    availableMinutes: 120,
    usedMinutes: 50,
    status: 'mixed',
    activities: [
      { id: 'a4', title: 'Atos Administrativos', type: 'NOVO_CONTEUDO', duration: 50, state: 'CONCLUIDO' },
      { id: 'a5', title: 'Revisões Espaçadas (2 tópicos)', type: 'REVISAO', duration: 15, state: 'ADIADO', note: 'Voltou para a fila de prioridades' },
      { id: 'a6', title: 'Contabilidade — Pronunciamentos', type: 'NOVO_CONTEUDO', duration: 40, state: 'SUBSTITUIDO', note: 'Substituído por reforço de base' }
    ]
  },
  {
    id: 'QUA',
    date: '16/Out',
    label: 'Quarta',
    isToday: true,
    isPast: false,
    availableMinutes: 120,
    usedMinutes: 35,
    status: 'active',
    activities: [
      { id: 'a7', title: 'Auditoria — NBC TA 330', type: 'REVISAO', duration: 35, state: 'CONCLUIDO' },
      { id: 'a8', title: 'Direito Tributário — Lançamento', type: 'PRATICA', duration: 45, state: 'EM_EXECUCAO' },
      { id: 'a9', title: 'Legislação — ICMS', type: 'NOVO_CONTEUDO', duration: 40, state: 'PLANEJADO' }
    ]
  },
  {
    id: 'QUI',
    date: '17/Out',
    label: 'Quinta',
    isToday: false,
    isPast: false,
    availableMinutes: 90,
    usedMinutes: 0,
    status: 'planned',
    activities: [
      { id: 'a10', title: 'Revisões Espaçadas (Projeção)', type: 'REVISAO', duration: 20, state: 'PLANEJADO' },
      { id: 'a11', title: 'Matemática Financeira', type: 'NOVO_CONTEUDO', duration: 70, state: 'PLANEJADO' }
    ]
  },
  {
    id: 'SEX',
    date: '18/Out',
    label: 'Sexta',
    isToday: false,
    isPast: false,
    availableMinutes: 0,
    usedMinutes: 0,
    status: 'exception',
    exceptionReason: 'Viagem a trabalho (Exceção Temporária)',
    activities: []
  },
  {
    id: 'SAB',
    date: '19/Out',
    label: 'Sábado',
    isToday: false,
    isPast: false,
    availableMinutes: 180,
    usedMinutes: 0,
    status: 'planned',
    activities: [
      { id: 'a12', title: 'Simulado Parcial', type: 'PRATICA', duration: 120, state: 'PLANEJADO' },
      { id: 'a13', title: 'Correção Ativa', type: 'REVISAO', duration: 60, state: 'PLANEJADO' }
    ]
  },
  {
    id: 'DOM',
    date: '20/Out',
    label: 'Domingo',
    isToday: false,
    isPast: false,
    availableMinutes: 0,
    usedMinutes: 0,
    status: 'exception',
    exceptionReason: 'Dia de Descanso (Configuração Padrão)',
    activities: []
  }
];

interface VisaoSemanalProps {
  activeConcurso?: ConcursoItem | null;
  onNavigateToStudy?: (disciplina: string, assunto?: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onSwitchToQueue?: () => void;
}

export default function VisaoSemanal({
  activeConcurso,
  onNavigateToTab,
  onSwitchToQueue
}: VisaoSemanalProps) {
  // 2. Dia Selecionado na Semana (padrão: Quarta / Hoje)
  const [selectedDayId, setSelectedDayId] = useState<string>('QUA');

  const selectedDay = WEEK_DATA.find((d) => d.id === selectedDayId) || WEEK_DATA[2];

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
          {WEEK_DATA.map((day) => {
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
            /* LINHA DO TEMPO VERTICAL ALTERNADA */
            <div className="weekly-timeline">
              {selectedDay.activities.map((act) => (
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
