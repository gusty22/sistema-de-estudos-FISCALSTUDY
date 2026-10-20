import React, { useState, useMemo, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import {
  CalendarDays,
  Clock,
  Sun,
  Moon,
  Sunrise,
  ShieldAlert,
  CalendarX,
  Plus,
  Info,
  CheckCircle2,
  SlidersHorizontal,
  BatteryCharging,
  Trash2,
  X
} from 'lucide-react';
import './RotinaDisponibilidade.css';

interface RotinaDisponibilidadeProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToTab?: (tab: any) => void;
}

interface RoutineExceptionItem {
  id: string;
  date: string;
  reason: string;
  type: 'indisponivel' | 'tempo_extra';
  hours?: number;
}

const DAYS = [
  { id: 'SEG', label: 'Segunda', fullKey: 'segunda' },
  { id: 'TER', label: 'Terça', fullKey: 'terca' },
  { id: 'QUA', label: 'Quarta', fullKey: 'quarta' },
  { id: 'QUI', label: 'Quinta', fullKey: 'quinta' },
  { id: 'SEX', label: 'Sexta', fullKey: 'sexta' },
  { id: 'SAB', label: 'Sábado', fullKey: 'sabado' },
  { id: 'DOM', label: 'Domingo', fullKey: 'domingo' }
];

const SHIFTS = [
  {
    id: 'MANHA',
    label: 'Manhã',
    icon: Sunrise,
    colorClass: '#f59e0b',
    activeClass: 'is-selected-manha'
  },
  {
    id: 'TARDE',
    label: 'Tarde',
    icon: Sun,
    colorClass: '#f97316',
    activeClass: 'is-selected-tarde'
  },
  {
    id: 'NOITE',
    label: 'Noite',
    icon: Moon,
    colorClass: '#6366f1',
    activeClass: 'is-selected-noite'
  }
];

export const RotinaDisponibilidade: React.FC<RotinaDisponibilidadeProps> = ({
  activeConcurso
}) => {
  // Grade de Horários (Set com chaves "DIA-TURNO", ex: "SEG-NOITE")
  const [schedule, setSchedule] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('fiscalstudy_routine_schedule');
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // Ignora erro de parsing
    }
    return new Set(['SEG-NOITE', 'TER-NOITE', 'QUA-NOITE', 'QUI-NOITE', 'SAB-MANHA', 'SAB-TARDE']);
  });

  // Configurações Macro
  const [hoursPerShift, setHoursPerShift] = useState<number>(() => {
    const saved = localStorage.getItem('fiscalstudy_routine_hours_shift');
    return saved ? parseFloat(saved) : 2.0;
  });

  const [maxSessionDuration, setMaxSessionDuration] = useState<number>(() => {
    const saved = localStorage.getItem('fiscalstudy_routine_max_session');
    return saved ? parseInt(saved, 10) : 50;
  });

  // Dias de descanso sagrado (Folga)
  const [restDays, setRestDays] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('fiscalstudy_routine_rest_days');
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // Ignora erro de parsing
    }
    return new Set(['DOM']);
  });

  // Exceções Temporárias
  const [exceptions, setExceptions] = useState<RoutineExceptionItem[]>([]);

  // Modal para nova exceção
  const [isAddExceptionOpen, setIsAddExceptionOpen] = useState(false);
  const [newExcDate, setNewExcDate] = useState('');
  const [newExcReason, setNewExcReason] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Carregar dados salvos no backend se houver concurso ativo
  useEffect(() => {
    if (!activeConcurso) return;

    fetch(`/api/v1/routine?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.cicloDisciplinasJson) {
          try {
            const parsed = JSON.parse(data.cicloDisciplinasJson);
            if (parsed.schedule && Array.isArray(parsed.schedule)) {
              setSchedule(new Set(parsed.schedule));
            }
            if (parsed.hoursPerShift) {
              setHoursPerShift(parsed.hoursPerShift);
            }
            if (parsed.maxSessionDuration) {
              setMaxSessionDuration(parsed.maxSessionDuration);
            }
            if (parsed.restDays && Array.isArray(parsed.restDays)) {
              setRestDays(new Set(parsed.restDays));
            }
          } catch {
            // Ignora erro de parsing de JSON legado
          }
        }
      })
      .catch(() => {});

    // Carregar exceções do backend
    fetch('/api/v1/routine/exceptions')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted: RoutineExceptionItem[] = data.map((e: any) => ({
            id: e.id,
            date: e.data,
            reason: e.motivo,
            type: e.tipo === 'TEMPO_EXTRA' ? 'tempo_extra' : 'indisponivel',
            hours: e.horas
          }));
          setExceptions(formatted);
        }
      })
      .catch(() => {});
  }, [activeConcurso]);

  // Alternar Bloco da Semana
  const toggleBlock = (dayId: string, shiftId: string) => {
    if (restDays.has(dayId)) return;

    const key = `${dayId}-${shiftId}`;
    const nextSchedule = new Set(schedule);
    if (nextSchedule.has(key)) {
      nextSchedule.delete(key);
    } else {
      nextSchedule.add(key);
    }
    setSchedule(nextSchedule);
  };

  // Alternar Dia de Descanso Sagrado
  const toggleRestDay = (dayId: string) => {
    const nextRestDays = new Set(restDays);
    if (nextRestDays.has(dayId)) {
      nextRestDays.delete(dayId);
    } else {
      nextRestDays.add(dayId);
      // Remove automaticamente todos os turnos desse dia
      const nextSchedule = new Set(schedule);
      SHIFTS.forEach(shift => nextSchedule.delete(`${dayId}-${shift.id}`));
      setSchedule(nextSchedule);
    }
    setRestDays(nextRestDays);
  };

  // Cálculos Dinâmicos
  const totalWeeklyHours = useMemo(() => {
    return Math.round(schedule.size * hoursPerShift * 10) / 10;
  }, [schedule, hoursPerShift]);

  // Feedback do Gêmeo Digital (Regra T05: Não acumular tarefas impossíveis)
  const systemFeedback = useMemo(() => {
    if (totalWeeklyHours === 0) {
      return {
        title: 'Nenhum horário definido',
        desc: 'Selecione ao menos um bloco para o sistema gerar suas metas de estudo realistas.',
        type: 'neutral'
      };
    }
    if (totalWeeklyHours < 12) {
      return {
        title: 'Ritmo Leve (Carga Reduzida)',
        desc: 'O Gêmeo Digital identificou sua restrição de tempo. As metas do edital serão diluídas automaticamente para você estudar sem ansiedade e sem acúmulos irreais.',
        type: 'warning'
      };
    }
    if (totalWeeklyHours > 40) {
      return {
        title: 'Ritmo Intenso (Risco de Fadiga)',
        desc: 'Sua disponibilidade declarada é bastante elevada. O sistema inserirá pausas forçadas de consolidação de memória para evitar esgotamento e manter alto rendimento.',
        type: 'alert'
      };
    }
    return {
      title: 'Ritmo Balanceado',
      desc: 'Disponibilidade saudável e sustentável. O planejamento adaptará suas revisões confortavelmente dentro desta janela semanal.',
      type: 'success'
    };
  }, [totalWeeklyHours]);

  // Adicionar Exceção
  const handleAddException = () => {
    if (!newExcDate.trim() || !newExcReason.trim()) return;

    const newId = `exc-${Date.now()}`;
    const newExc: RoutineExceptionItem = {
      id: newId,
      date: newExcDate.trim(),
      reason: newExcReason.trim(),
      type: 'indisponivel',
      hours: hoursPerShift * 2
    };

    setExceptions(prev => [newExc, ...prev]);

    // Persistir no backend
    fetch('/api/v1/routine/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId,
        data: newExc.date,
        tipo: 'INDISPONIBILIDADE',
        horas: newExc.hours || 4,
        motivo: newExc.reason
      })
    }).catch(() => {});

    setNewExcDate('');
    setNewExcReason('');
    setIsAddExceptionOpen(false);
  };

  // Remover Exceção
  const handleRemoveException = (id: string) => {
    setExceptions(prev => prev.filter(e => e.id !== id));
    fetch(`/api/v1/routine/exceptions/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  // Salvar Padrão de Rotina
  const handleSaveRoutine = async () => {
    // 1. Salvar no localStorage
    localStorage.setItem('fiscalstudy_routine_schedule', JSON.stringify(Array.from(schedule)));
    localStorage.setItem('fiscalstudy_routine_hours_shift', hoursPerShift.toString());
    localStorage.setItem('fiscalstudy_routine_max_session', maxSessionDuration.toString());
    localStorage.setItem('fiscalstudy_routine_rest_days', JSON.stringify(Array.from(restDays)));

    // 2. Calcular horas por dia para o backend
    const dayHours: Record<string, number> = {
      segunda: 0,
      terca: 0,
      quarta: 0,
      quinta: 0,
      sexta: 0,
      sabado: 0,
      domingo: 0
    };

    DAYS.forEach(d => {
      if (!restDays.has(d.id)) {
        let count = 0;
        SHIFTS.forEach(s => {
          if (schedule.has(`${d.id}-${s.id}`)) count++;
        });
        dayHours[d.fullKey] = Math.round(count * hoursPerShift * 10) / 10;
      }
    });

    // 3. Persistir no backend
    if (activeConcurso) {
      const routinePayload = {
        concursoId: activeConcurso.id,
        modoPlanejamento: 'SEMANAL',
        horasSegunda: dayHours.segunda,
        horasTerca: dayHours.terca,
        horasQuarta: dayHours.quarta,
        horasQuinta: dayHours.quinta,
        horasSexta: dayHours.sexta,
        horasSabado: dayHours.sabado,
        horasDomingo: dayHours.domingo,
        cicloDisciplinasJson: JSON.stringify({
          schedule: Array.from(schedule),
          hoursPerShift,
          maxSessionDuration,
          restDays: Array.from(restDays),
          totalWeeklyHours
        })
      };

      try {
        await fetch('/api/v1/routine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(routinePayload)
        });
      } catch (e) {
        console.warn('Erro ao salvar no backend, salvo localmente:', e);
      }
    }

    setSaveSuccessMsg('✓ Padrão de rotina salvo! O Gêmeo Digital adaptou suas metas à sua disponibilidade real.');
    setTimeout(() => setSaveSuccessMsg(null), 5000);
  };

  return (
    <div className="rotina-calm-wrapper">
      <div className="rotina-calm-container">

        {/* ==================================================================
            1. HEADER: FOCO SILENCIOSO E PARÂMETROS PESSOAIS
            ================================================================== */}
        <header className="rotina-header">
          <div>
            <div className="rotina-category-tag">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              <span>Parâmetros Pessoais</span>
            </div>
            <h1 className="rotina-title">
              Rotina & Disponibilidade
            </h1>
            <p className="rotina-subtitle">
              Defina sua capacidade real de estudo. O Gêmeo Digital usará essa janela para planejar suas sessões sem gerar acúmulos irreais.
            </p>
          </div>
        </header>

        {/* Mensagem de sucesso */}
        {saveSuccessMsg && (
          <div style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '1rem',
            backgroundColor: 'var(--calm-emerald-bg)',
            color: 'var(--calm-emerald-text)',
            border: '1px solid var(--calm-emerald-border)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* ==================================================================
            2. FEEDBACK DO SISTEMA (GÊMEO DIGITAL)
            ================================================================== */}
        <div className={`rotina-feedback-banner type-${systemFeedback.type}`}>
          <div className="rotina-feedback-icon">
            {systemFeedback.type === 'warning' && <Clock className="w-5 h-5 text-amber-500" />}
            {systemFeedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            {systemFeedback.type === 'alert' && <BatteryCharging className="w-5 h-5 text-rose-500" />}
            {systemFeedback.type === 'neutral' && <Info className="w-5 h-5 text-stone-400" />}
          </div>
          <div>
            <h3 className={`rotina-feedback-title type-${systemFeedback.type}`}>
              {systemFeedback.title} ({totalWeeklyHours}h / semana)
            </h3>
            <p className={`rotina-feedback-desc type-${systemFeedback.type}`}>
              {systemFeedback.desc}
            </p>
          </div>
        </div>

        {/* ==================================================================
            3. CORPO PRINCIPAL (GRADE TÁTIL + AJUSTES LATERAIS)
            ================================================================== */}
        <div className="rotina-main-grid">

          {/* COLUNA ESQUERDA: A Grade Tátil da Semana */}
          <div className="rotina-card">
            <div className="rotina-card-header">
              <div>
                <h2 className="rotina-card-title">Mapa da Semana</h2>
                <p className="rotina-card-caption">Clique nos blocos onde você costuma ter janelas livres.</p>
              </div>
              <div className="rotina-badge-pill">
                {schedule.size} blocos ativos
              </div>
            </div>

            {/* Matriz Scrollável */}
            <div className="rotina-table-scroll">
              <div className="rotina-table-container">

                {/* Cabeçalho com os 7 Dias */}
                <div className="rotina-grid-row">
                  <div /> {/* Espaço vazio para a coluna de turnos */}
                  {DAYS.map(day => {
                    const isRest = restDays.has(day.id);
                    return (
                      <div
                        key={day.id}
                        className={`rotina-day-header ${isRest ? 'is-rest' : ''}`}
                      >
                        {day.id}
                      </div>
                    );
                  })}
                </div>

                {/* Linhas de Turnos (Manhã, Tarde, Noite) */}
                {SHIFTS.map(shift => {
                  const Icon = shift.icon;
                  return (
                    <div key={shift.id} className="rotina-grid-row">
                      {/* Label do Turno */}
                      <div className="rotina-shift-label">
                        <Icon className="w-4 h-4 opacity-80" style={{ color: shift.colorClass }} />
                        <span className="rotina-shift-text">{shift.label}</span>
                      </div>

                      {/* 7 Células Clicáveis para cada dia */}
                      {DAYS.map(day => {
                        const isRest = restDays.has(day.id);
                        const key = `${day.id}-${shift.id}`;
                        const isSelected = schedule.has(key);

                        return (
                          <button
                            key={key}
                            onClick={() => toggleBlock(day.id, shift.id)}
                            disabled={isRest}
                            className={`rotina-block-btn ${isRest ? 'is-rest-day' : ''} ${!isRest && isSelected ? shift.activeClass : ''}`}
                            title={isRest ? `${day.label} é dia de descanso` : `${shift.label} de ${day.label}`}
                          >
                            {isSelected && !isRest && (
                              <>
                                <div
                                  className="rotina-block-dot"
                                  style={{ backgroundColor: shift.colorClass }}
                                />
                                <span
                                  className="rotina-block-time"
                                  style={{ color: shift.colorClass }}
                                >
                                  ~{hoursPerShift}h
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

              </div>
            </div>

            {/* Botões Rápidos de Descanso no Rodapé da Grade */}
            <div className="rotina-rest-days-row">
              <span className="rotina-rest-label">
                Dias de Descanso:
              </span>
              {DAYS.map(day => {
                const isRest = restDays.has(day.id);
                return (
                  <button
                    key={`rest-${day.id}`}
                    onClick={() => toggleRestDay(day.id)}
                    className={`rotina-rest-btn ${isRest ? 'is-active' : ''}`}
                  >
                    {day.label} {isRest && '(Folga)'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUNA DIREITA: Ajustes de Capacidade & Exceções */}
          <div className="rotina-side-column">

            {/* Ajuste de Capacidade Macro */}
            <div className="rotina-card">
              <div className="rotina-card-header" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <SlidersHorizontal className="w-4 h-4 text-stone-400" />
                  <h2 className="rotina-card-title">Ajustes de Capacidade</h2>
                </div>
              </div>

              <div className="rotina-adjust-section">
                <div>
                  <div className="rotina-field-header">
                    <span className="rotina-field-label">Volume por Bloco</span>
                    <span className="rotina-field-value">~{hoursPerShift} horas</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="0.5"
                    value={hoursPerShift}
                    onChange={(e) => setHoursPerShift(parseFloat(e.target.value))}
                    className="rotina-slider"
                  />
                  <p className="rotina-field-tip">
                    Estimativa maleável. Não se preocupe em preencher horários rígidos como 19h15.
                  </p>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--calm-border)' }} />

                <div>
                  <div className="rotina-field-header">
                    <span className="rotina-field-label">Duração Máxima de Sessão</span>
                    <span className="rotina-field-value">{maxSessionDuration} min</span>
                  </div>
                  <div className="rotina-pills-row">
                    {[30, 50, 90].map(mins => (
                      <button
                        key={mins}
                        onClick={() => setMaxSessionDuration(mins)}
                        className={`rotina-pill-btn ${maxSessionDuration === mins ? 'is-active' : ''}`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <p className="rotina-field-tip">
                    Tempo máximo de foco contínuo antes de uma pausa recomendada.
                  </p>
                </div>
              </div>
            </div>

            {/* Exceções Temporárias */}
            <div className="rotina-card">
              <div className="rotina-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CalendarX className="w-4 h-4 text-stone-400" />
                  <h2 className="rotina-card-title">Exceções Temporárias</h2>
                </div>
                <button
                  onClick={() => setIsAddExceptionOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--calm-text-muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Adicionar Exceção"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="rotina-exceptions-list">
                {exceptions.map(exc => (
                  <div key={exc.id} className="rotina-exception-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="rotina-exception-date">{exc.date}</span>
                      <span className="rotina-exception-reason">{exc.reason}</span>
                    </div>
                    <span className="rotina-badge-unavail">
                      Indisponível
                    </span>
                    <button
                      onClick={() => handleRemoveException(exc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--calm-text-muted)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setIsAddExceptionOpen(true)}
                  className="rotina-add-exc-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar exceção futura
                </button>

                <p className="rotina-field-tip" style={{ textAlign: 'center' }}>
                  Compromissos lançados aqui subtraem a carga do dia automaticamente.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ==================================================================
            4. RODAPÉ FIXO DE CONFIRMAÇÃO E SALVAMENTO
            ================================================================== */}
        <footer className="rotina-footer">
          <div className="rotina-footer-note">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Seus horários não são engessados. Você pode alterá-los a qualquer momento sem culpa.</span>
          </div>

          <button
            onClick={handleSaveRoutine}
            className="rotina-btn-save"
          >
            Salvar Padrão de Rotina
          </button>
        </footer>

      </div>

      {/* Modal: Adicionar Exceção Futura */}
      {isAddExceptionOpen && (
        <div className="rotina-modal-overlay">
          <div className="rotina-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="rotina-modal-title">Nova Exceção Temporária</h3>
              <button
                onClick={() => setIsAddExceptionOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rotina-form-group">
              <label className="rotina-field-label">Data ou Período</label>
              <input
                type="text"
                placeholder="Ex: 20/Nov ou Próxima Sexta"
                value={newExcDate}
                onChange={(e) => setNewExcDate(e.target.value)}
                className="rotina-input-text"
              />
            </div>

            <div className="rotina-form-group">
              <label className="rotina-field-label">Motivo</label>
              <input
                type="text"
                placeholder="Ex: Consulta médica, Viagem a trabalho"
                value={newExcReason}
                onChange={(e) => setNewExcReason(e.target.value)}
                className="rotina-input-text"
              />
            </div>

            <div className="rotina-modal-actions">
              <button
                onClick={() => setIsAddExceptionOpen(false)}
                className="rotina-rest-btn"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddException}
                className="rotina-btn-save"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.82rem' }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotinaDisponibilidade;
