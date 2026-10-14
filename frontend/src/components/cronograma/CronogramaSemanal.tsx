import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './CronogramaSemanal.css';

interface CronogramaProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy: (disciplina: string) => void;
}

interface StudyBlock {
  id: string;
  dia: string;
  disciplina: string;
  assunto: string;
  tipo: 'TEORIA' | 'QUESTOES' | 'REVISAO';
  duracaoMinutos: number;
  concluido: boolean;
}

interface CycleItem {
  ordem: number;
  disciplina: string;
  peso: number;
  totalTopicos: number;
  horasSugeridas: number;
  blocoMinutos: number;
}

const AUTO_COLOR_PALETTE = [
  '#f55a5a', '#4f8ef7', '#7c5cfc', '#3ecf8e', '#f5c842',
  '#f5874a', '#00bcd4', '#e91e8c', '#8bc34a', '#ff9800',
  '#9c27b0', '#ff5722', '#009688', '#795548', '#3f51b5'
];

export const CronogramaSemanal: React.FC<CronogramaProps> = ({ activeConcurso, onNavigateToStudy }) => {
  const [mode, setMode] = useState<'SEMANAL' | 'CICLO'>('SEMANAL');
  const [selectedDia, setSelectedDia] = useState<string>('Segunda');
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);

  // Routine state
  const [routineHours, setRoutineHours] = useState({
    horasSegunda: 3,
    horasTerca: 3,
    horasQuarta: 3,
    horasQuinta: 3,
    horasSexta: 3,
    horasSabado: 5,
    horasDomingo: 4
  });

  const [cycleItems, setCycleItems] = useState<CycleItem[]>([]);
  const [commitments, setCommitments] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);

  // New commitment input
  const [newCommitTitulo, setNewCommitTitulo] = useState('');
  const [newCommitDia, setNewCommitDia] = useState('SEGUNDA');
  const [newCommitHoraIni, setNewCommitHoraIni] = useState('08:00');
  const [newCommitHoraFim, setNewCommitHoraFim] = useState('17:00');

  // Study blocks
  const [blocks, setBlocks] = useState<StudyBlock[]>([
    { id: '1', dia: 'Segunda', disciplina: 'Direito Tributário', assunto: 'Princípios e Limitações Constitucionais', tipo: 'TEORIA', duracaoMinutos: 60, concluido: true },
    { id: '2', dia: 'Segunda', disciplina: 'Legislação Tributária', assunto: 'ISSQN — Fato Gerador e Alíquotas', tipo: 'QUESTOES', duracaoMinutos: 90, concluido: true },
    { id: '3', dia: 'Segunda', disciplina: 'Língua Portuguesa', assunto: 'Interpretação e Concordância Verbal', tipo: 'REVISAO', duracaoMinutos: 30, concluido: false },

    { id: '4', dia: 'Terça', disciplina: 'Contabilidade Geral', assunto: 'Balanço Patrimonial e DRE', tipo: 'TEORIA', duracaoMinutos: 90, concluido: false },
    { id: '5', dia: 'Terça', disciplina: 'Direito Constitucional', assunto: 'Direitos e Garantias Fundamentais', tipo: 'QUESTOES', duracaoMinutos: 60, concluido: false },

    { id: '6', dia: 'Quarta', disciplina: 'Direito Administrativo', assunto: 'Atos Administrativos e Poderes', tipo: 'TEORIA', duracaoMinutos: 60, concluido: false },
    { id: '7', dia: 'Quarta', disciplina: 'Legislação Tributária', assunto: 'IPTU e ITBI — Regras Municipais', tipo: 'QUESTOES', duracaoMinutos: 90, concluido: false },

    { id: '8', dia: 'Quinta', disciplina: 'Auditoria Fiscal', assunto: 'Técnicas e Procedimentos de Auditoria', tipo: 'TEORIA', duracaoMinutos: 60, concluido: false },
    { id: '9', dia: 'Quinta', disciplina: 'Direito Tributário', assunto: 'Crédito Tributário e Lançamento', tipo: 'QUESTOES', duracaoMinutos: 90, concluido: false },

    { id: '10', dia: 'Sexta', disciplina: 'Contabilidade Avançada', assunto: 'Demonstração dos Fluxos de Caixa (DFC)', tipo: 'TEORIA', duracaoMinutos: 60, concluido: false },
    { id: '11', dia: 'Sexta', disciplina: 'Raciocínio Lógico & Matemática', assunto: 'Probabilidade e Equivalências', tipo: 'QUESTOES', duracaoMinutos: 60, concluido: false },

    { id: '12', dia: 'Sábado', disciplina: 'Simulado Semanal de Questões', assunto: 'Prova Completa de Conhecimentos Específicos', tipo: 'QUESTOES', duracaoMinutos: 180, concluido: false },
    { id: '13', dia: 'Sábado', disciplina: 'Caderno de Erros', assunto: 'Refazer questões erradas na semana', tipo: 'REVISAO', duracaoMinutos: 60, concluido: false },

    { id: '14', dia: 'Domingo', disciplina: 'Ciclo de Revisão Espaçada', assunto: 'Revisão dos resumos e flashcards da semana', tipo: 'REVISAO', duracaoMinutos: 120, concluido: false },
  ]);

  const loadRoutineData = () => {
    if (!activeConcurso?.id) return;

    fetch(`/api/v1/routine?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.modoPlanejamento) setMode(data.modoPlanejamento as any);
          setRoutineHours({
            horasSegunda: data.horasSegunda ?? 3,
            horasTerca: data.horasTerca ?? 3,
            horasQuarta: data.horasQuarta ?? 3,
            horasQuinta: data.horasQuinta ?? 3,
            horasSexta: data.horasSexta ?? 3,
            horasSabado: data.horasSabado ?? 5,
            horasDomingo: data.horasDomingo ?? 4,
          });

          if (data.cicloDisciplinasJson) {
            try {
              const parsed = JSON.parse(data.cicloDisciplinasJson);
              if (Array.isArray(parsed)) setCycleItems(parsed);
            } catch {}
          }
        }
      })
      .catch(() => {});

    fetch('/api/v1/routine/commitments')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCommitments(data); })
      .catch(() => {});

    fetch('/api/v1/routine/exceptions')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setExceptions(data); })
      .catch(() => {});
  };

  useEffect(() => {
    loadRoutineData();
  }, [activeConcurso?.id]);

  const toggleConcluido = (id: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, concluido: !b.concluido } : b));
  };

  const handleSaveRoutineHours = async () => {
    if (!activeConcurso?.id) return;
    const payload = {
      concursoId: activeConcurso.id,
      modoPlanejamento: mode,
      ...routineHours
    };

    try {
      await fetch('/api/v1/routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      loadRoutineData();
      setIsRoutineOpen(false);
    } catch {}
  };

  const handleAddCommitment = async () => {
    if (!newCommitTitulo.trim()) return;
    const payload = {
      titulo: newCommitTitulo.trim(),
      diaSemana: newCommitDia,
      horaInicio: newCommitHoraIni,
      horaFim: newCommitHoraFim,
      tipo: 'TRABALHO'
    };

    try {
      const res = await fetch('/api/v1/routine/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewCommitTitulo('');
        loadRoutineData();
      }
    } catch {}
  };

  const handleDeleteCommitment = async (id: string) => {
    try {
      await fetch(`/api/v1/routine/commitments/${id}`, { method: 'DELETE' });
      loadRoutineData();
    } catch {}
  };

  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const blocksDoDia = blocks.filter(b => b.dia === selectedDia);

  const totalMinutosSemana = blocks.reduce((acc, b) => acc + b.duracaoMinutos, 0);
  const totalMinutosConcluidos = blocks.filter(b => b.concluido).reduce((acc, b) => acc + b.duracaoMinutos, 0);

  const totalHorasPlanejadas = Object.values(routineHours).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="cronograma-container animate-fade-in">
      {/* Header */}
      <div className="cronograma-header glass">
        <div>
          <h2>📅 Cronograma Inteligente & Ciclos de Estudo</h2>
          <p className="cronograma-subtitle">
            Planejamento adaptativo equilibrado para {activeConcurso?.nome || 'o Concurso Ativo'}
          </p>
        </div>

        <div className="cronograma-progress-card">
          <div className="prog-metric">
            <span className="prog-val">{(totalMinutosConcluidos / 60).toFixed(1)}h</span>
            <span className="prog-label">concluídas de {(totalMinutosSemana / 60).toFixed(1)}h</span>
          </div>
          <div className="cronograma-bar">
            <div 
              className="cronograma-fill" 
              style={{ width: `${(totalMinutosConcluidos / totalMinutosSemana) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mode Switcher & Routine Settings Bar */}
      <div className="crono-mode-bar">
        <div className="crono-mode-pills">
          <button
            className={`crono-mode-pill ${mode === 'SEMANAL' ? 'active' : ''}`}
            onClick={() => setMode('SEMANAL')}
          >
            🗓️ Grade Semanal
          </button>
          <button
            className={`crono-mode-pill ${mode === 'CICLO' ? 'active' : ''}`}
            onClick={() => setMode('CICLO')}
          >
            🔄 Ciclo de Estudos Contínuo
          </button>
        </div>

        <button className="btn-routine-config" onClick={() => setIsRoutineOpen(true)}>
          ⚙️ Configurar Rotina ({totalHorasPlanejadas}h/sem)
        </button>
      </div>

      {/* MODE 1: CRONOGRAMA SEMANAL */}
      {mode === 'SEMANAL' && (
        <>
          {/* Days Tabs */}
          <div className="dias-tabs-bar">
            {dias.map((dia) => {
              const diaBlocks = blocks.filter(b => b.dia === dia);
              const allDone = diaBlocks.length > 0 && diaBlocks.every(b => b.concluido);
              const diaMinutos = diaBlocks.reduce((acc, b) => acc + b.duracaoMinutos, 0);

              return (
                <button
                  key={dia}
                  className={`dia-tab ${selectedDia === dia ? 'active' : ''}`}
                  onClick={() => setSelectedDia(dia)}
                >
                  <span className="dia-tab-nome">{dia}</span>
                  <span className="dia-tab-horas">{(diaMinutos / 60).toFixed(1)}h</span>
                  {allDone && <span className="dia-tab-done">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Blocks for Selected Day */}
          <div className="dia-content-card glass">
            <div className="dia-header-row">
              <h3>Blocos Planejados para {selectedDia}-feira</h3>
              <span className="dia-total-badge">
                {blocksDoDia.length} blocos • {blocksDoDia.reduce((acc, b) => acc + b.duracaoMinutos, 0)} minutos
              </span>
            </div>

            <div className="blocks-list">
              {blocksDoDia.map((block) => (
                <div
                  key={block.id}
                  className={`study-block-card ${block.concluido ? 'is-completed' : ''}`}
                >
                  <div className="block-status-col">
                    <input
                      type="checkbox"
                      checked={block.concluido}
                      onChange={() => toggleConcluido(block.id)}
                      title="Marcar como concluído"
                    />
                  </div>

                  <div className="block-info-col">
                    <div className="block-top-meta">
                      <span className={`block-badge type-${block.tipo.toLowerCase()}`}>
                        {block.tipo}
                      </span>
                      <span className="block-duration">⏱️ {block.duracaoMinutos} min</span>
                    </div>
                    <h4 className="block-discipline">{block.disciplina}</h4>
                    <p className="block-subject">{block.assunto}</p>
                  </div>

                  <div className="block-actions-col">
                    <button
                      className="btn-block-study"
                      onClick={() => onNavigateToStudy(block.disciplina)}
                    >
                      ▶ Praticar Questões
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* MODE 2: CICLO DE ESTUDOS (TRACK CONCURSOS) */}
      {mode === 'CICLO' && (
        <div className="ciclo-container animate-fade-in">
          <div className="ciclo-hero-card">
            <div className="ciclo-hero-info">
              <h3>🔄 Ciclo Proporcional de Aprendizagem</h3>
              <p>
                O ciclo de estudos roda continuamente sem se prender a dias fixos da semana.
                As horas de cada disciplina são proporcionais aos pesos e tópicos do edital de {activeConcurso?.nome}.
              </p>
            </div>
            <div className="ciclo-status-pill">
              <div className="label">Matéria da Vez</div>
              <div className="val">{cycleItems[0]?.disciplina || 'Direito Tributário'}</div>
            </div>
          </div>

          <div className="ciclo-grid">
            {cycleItems.map((item, idx) => {
              const color = AUTO_COLOR_PALETTE[idx % AUTO_COLOR_PALETTE.length];
              return (
                <div
                  key={item.disciplina}
                  className="ciclo-card"
                  style={{ '--ciclo-color': color } as React.CSSProperties}
                >
                  <div className="ciclo-card-top">
                    <span className="ciclo-ordem-badge">Passo {item.ordem}</span>
                    <span className="ciclo-peso-badge">Peso: {item.peso}</span>
                  </div>

                  <div>
                    <h4 className="ciclo-materia-nome">{item.disciplina}</h4>
                    <p className="ciclo-materia-meta">{item.totalTopicos} tópicos no edital</p>
                  </div>

                  <div className="ciclo-hours-box">
                    <span className="ciclo-hours-label">Meta do Bloco:</span>
                    <span className="ciclo-hours-val">{item.horasSugeridas}h ({item.blocoMinutos}m)</span>
                  </div>

                  <button
                    className="ciclo-btn-study"
                    onClick={() => onNavigateToStudy(item.disciplina)}
                  >
                    ▶ Praticar {item.disciplina}
                  </button>
                </div>
              );
            })}

            {cycleItems.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#a1a6c2' }}>
                Nenhum edital com tópicos cadastrado para gerar o ciclo. Importe o edital no assistente de concurso.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Routine & Commitments Drawer Modal */}
      {isRoutineOpen && (
        <div className="routine-drawer-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget) setIsRoutineOpen(false);
        }}>
          <div className="routine-drawer-card">
            <div className="routine-drawer-header">
              <h3>⚙️ Configuração da Rotina & Disponibilidade</h3>
              <button
                style={{ background: 'none', border: 'none', color: '#a1a6c2', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setIsRoutineOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="routine-drawer-body">
              {/* Daily Hours */}
              <div>
                <h4 className="routine-section-title">Horas Disponíveis por Dia da Semana</h4>
                <div className="routine-days-grid">
                  {Object.entries({
                    Seg: 'horasSegunda',
                    Ter: 'horasTerca',
                    Qua: 'horasQuarta',
                    Qui: 'horasQuinta',
                    Sex: 'horasSexta',
                    Sáb: 'horasSabado',
                    Dom: 'horasDomingo'
                  }).map(([label, key]) => (
                    <div key={label} className="routine-day-input-box">
                      <span>{label}</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="16"
                        value={(routineHours as any)[key]}
                        onChange={(e) => setRoutineHours({
                          ...routineHours,
                          [key]: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Commitments */}
              <div>
                <h4 className="routine-section-title">Compromissos Fixos (Bloqueios de Agenda)</h4>
                <div className="commitments-list">
                  {commitments.map(c => (
                    <div key={c.id} className="commitment-item">
                      <div className="commitment-info">
                        <strong>{c.titulo}</strong>
                        <small>{c.diaSemana} • {c.horaInicio} às {c.horaFim} ({c.tipo})</small>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', color: '#f55a5a', cursor: 'pointer' }}
                        onClick={() => handleDeleteCommitment(c.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="Novo compromisso (ex: Trabalho)"
                      value={newCommitTitulo}
                      onChange={(e) => setNewCommitTitulo(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#1a1e2a',
                        border: '1px solid #2e3347',
                        borderRadius: '6px',
                        padding: '8px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                    <select
                      value={newCommitDia}
                      onChange={(e) => setNewCommitDia(e.target.value)}
                      style={{
                        background: '#1a1e2a',
                        border: '1px solid #2e3347',
                        borderRadius: '6px',
                        padding: '8px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    >
                      <option value="SEGUNDA">Segunda</option>
                      <option value="TERCA">Terça</option>
                      <option value="QUARTA">Quarta</option>
                      <option value="QUINTA">Quinta</option>
                      <option value="SEXTA">Sexta</option>
                      <option value="SABADO">Sábado</option>
                      <option value="DOMINGO">Domingo</option>
                      <option value="TODOS_DIAS_UTEIS">Seg a Sex</option>
                    </select>
                    <input
                      type="time"
                      value={newCommitHoraIni}
                      onChange={(e) => setNewCommitHoraIni(e.target.value)}
                      style={{
                        background: '#1a1e2a',
                        border: '1px solid #2e3347',
                        borderRadius: '6px',
                        padding: '6px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                    <input
                      type="time"
                      value={newCommitHoraFim}
                      onChange={(e) => setNewCommitHoraFim(e.target.value)}
                      style={{
                        background: '#1a1e2a',
                        border: '1px solid #2e3347',
                        borderRadius: '6px',
                        padding: '6px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                    <button
                      className="btn-add-material"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={handleAddCommitment}
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {/* Exceptions */}
              <div>
                <h4 className="routine-section-title">Exceções & Imprevistos Registrados</h4>
                <div className="commitments-list">
                  {exceptions.map(ex => (
                    <div key={ex.id} className="commitment-item">
                      <div className="commitment-info">
                        <strong>📅 {ex.data}: {ex.motivo || 'Sem motivo'}</strong>
                        <small>{ex.tipo} • {ex.horas}h de impacto</small>
                      </div>
                    </div>
                  ))}
                  {exceptions.length === 0 && (
                    <small style={{ color: '#a1a6c2' }}>Nenhuma exceção registrada. A rotina segue o padrão planejado.</small>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  style={{
                    background: '#1a1e2a',
                    border: '1px solid #2e3347',
                    color: '#a1a6c2',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setIsRoutineOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-add-material"
                  onClick={handleSaveRoutineHours}
                >
                  Salvar Configuração de Rotina
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronogramaSemanal;
