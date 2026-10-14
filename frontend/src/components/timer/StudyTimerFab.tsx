import React, { useState, useEffect, useRef } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './StudyTimerFab.css';

interface StudyTimerFabProps {
  activeConcurso: ConcursoItem | null;
  onSessionSaved?: () => void;
}

export const StudyTimerFab: React.FC<StudyTimerFabProps> = ({ activeConcurso, onSessionSaved }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'CRONOMETRO' | 'POMODORO'>('CRONOMETRO');
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Pomodoro settings
  const [pomoPreset, setPomoPreset] = useState<25 | 50>(25);
  const [isBreak, setIsBreak] = useState(false);

  // Context selection
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('');
  const [topicos, setTopicos] = useState<{ id: string; assunto: string; disciplina: string }[]>([]);
  const [selectedTopicoId, setSelectedTopicoId] = useState<string>('');
  const [materials, setMaterials] = useState<{ id: string; titulo: string; disciplina: string }[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

  // Save session inputs
  const [isSaving, setIsSaving] = useState(false);
  const [activityType, setActivityType] = useState<'HE' | 'HRE'>('HE');
  const [nextSessionHandoff, setNextSessionHandoff] = useState<string>('');
  const [paginaInicio, setPaginaInicio] = useState<number | ''>('');
  const [paginaFim, setPaginaFim] = useState<number | ''>('');
  const [paginasLidas, setPaginasLidas] = useState<number>(0);
  const [questoesFeitas, setQuestoesFeitas] = useState<number>(0);
  const [questoesAcertadas, setQuestoesAcertadas] = useState<number | ''>('');
  const [notas, setNotas] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  // Carrega tópicos e disciplinas do concurso ativo
  useEffect(() => {
    if (!activeConcurso?.id) return;

    fetch(`/api/v1/concursos/${encodeURIComponent(activeConcurso.id)}/edital`)
      .then(res => res.json())
      .then(data => {
        const topicosList = Array.isArray(data) ? data : (data?.topicos || []);
        if (Array.isArray(topicosList) && topicosList.length > 0) {
          setTopicos(topicosList);
          const uniqueDiscs = Array.from(new Set(topicosList.map((t: any) => t.disciplina))).filter(Boolean) as string[];
          setDisciplinas(uniqueDiscs);
          if (uniqueDiscs.length > 0 && !selectedDisciplina) {
            setSelectedDisciplina(uniqueDiscs[0]);
          }
        }
      })
      .catch(() => {});

    fetch(`/api/v1/materials?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMaterials(data);
        }
      })
      .catch(() => {});
  }, [activeConcurso?.id]);

  // Timer interval loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setSeconds(prev => {
          if (mode === 'POMODORO') {
            if (prev <= 1) {
              // Fim do bloco pomodoro
              const nextBreak = !isBreak;
              setIsBreak(nextBreak);
              const nextTime = nextBreak ? (pomoPreset === 25 ? 5 * 60 : 10 * 60) : pomoPreset * 60;
              return nextTime;
            }
            return prev - 1;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, isBreak, pomoPreset]);

  const handleStart = () => {
    if (mode === 'POMODORO' && seconds === 0) {
      setSeconds(pomoPreset * 60);
      setIsBreak(false);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (mode === 'POMODORO') {
      setSeconds(pomoPreset * 60);
      setIsBreak(false);
    } else {
      setSeconds(0);
    }
    setIsSaving(false);
  };

  const handleSwitchMode = (newMode: 'CRONOMETRO' | 'POMODORO') => {
    setIsRunning(false);
    setMode(newMode);
    if (newMode === 'POMODORO') {
      setSeconds(pomoPreset * 60);
      setIsBreak(false);
    } else {
      setSeconds(0);
    }
    setIsSaving(false);
  };

  const handlePomoPresetChange = (preset: 25 | 50) => {
    setPomoPreset(preset);
    if (!isRunning && mode === 'POMODORO') {
      setSeconds(preset * 60);
      setIsBreak(false);
    }
  };

  const formatDigits = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSession = async () => {
    const duration = mode === 'POMODORO'
      ? (isBreak ? 0 : pomoPreset * 60 - seconds)
      : seconds;

    if (duration <= 0 && paginasLidas <= 0 && questoesFeitas <= 0) {
      setSaveSuccess('Registre ao menos alguns minutos ou páginas lidas.');
      setTimeout(() => setSaveSuccess(null), 3000);
      return;
    }

    const payload = {
      sessionId: `study-${Date.now()}`,
      concursoId: activeConcurso?.id || null,
      disciplina: selectedDisciplina || 'Geral',
      topicoId: selectedTopicoId || null,
      materialId: selectedMaterialId || null,
      durationSeconds: Math.max(0, duration),
      paginaInicio: paginaInicio !== '' ? Number(paginaInicio) : null,
      paginaFim: paginaFim !== '' ? Number(paginaFim) : null,
      paginasLidas: Number(paginasLidas) || 0,
      questoesFeitas: Number(questoesFeitas) || 0,
      questoesAcertadas: questoesAcertadas !== '' ? Number(questoesAcertadas) : null,
      modo: mode,
      activityType: activityType,
      nextSessionHandoff: nextSessionHandoff.trim() || null,
      notas: notas || null
    };

    try {
      const res = await fetch('/api/v1/study-sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveSuccess('✓ Sessão de estudo e micro-telemetria gravadas com sucesso!');
        setIsRunning(false);
        setIsSaving(false);
        setSeconds(0);
        setPaginaInicio('');
        setPaginaFim('');
        setPaginasLidas(0);
        setQuestoesFeitas(0);
        setQuestoesAcertadas('');
        setNotas('');
        setNextSessionHandoff('');
        if (onSessionSaved) onSessionSaved();
        setTimeout(() => {
          setSaveSuccess(null);
          setIsOpen(false);
        }, 1500);
      } else {
        setSaveSuccess('Erro ao registrar sessão.');
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch {
      setSaveSuccess('Falha de conexão com o servidor.');
      setTimeout(() => setSaveSuccess(null), 3000);
    }
  };

  const filteredTopicos = topicos.filter(t => !selectedDisciplina || t.disciplina === selectedDisciplina);
  const filteredMaterials = materials.filter(m => !selectedDisciplina || m.disciplina === selectedDisciplina);

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`study-timer-fab ${isRunning ? 'is-running' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Cronômetro e Pomodoro de Estudo"
      >
        <span>{isRunning ? '⏱️' : '⏳'}</span>
        {isRunning && (
          <span className="fab-time-badge">
            {formatDigits(seconds)}
          </span>
        )}
      </button>

      {/* Floating Popup Modal */}
      {isOpen && (
        <div className="timer-popup-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}>
          <div className="timer-popup-card">
            {/* Header */}
            <div className="timer-popup-header">
              <span className="timer-popup-title">
                ⏱️ Cronômetro de Estudo
              </span>
              <button className="timer-close-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            {/* Mode Switcher */}
            <div className="timer-mode-switcher">
              <button
                className={`timer-mode-btn ${mode === 'CRONOMETRO' ? 'active' : ''}`}
                onClick={() => handleSwitchMode('CRONOMETRO')}
              >
                Cronômetro Livre
              </button>
              <button
                className={`timer-mode-btn ${mode === 'POMODORO' ? 'active' : ''}`}
                onClick={() => handleSwitchMode('POMODORO')}
              >
                Pomodoro Adaptativo
              </button>
            </div>

            {/* Body */}
            <div className="timer-popup-body">
              {/* Pomodoro Presets */}
              {mode === 'POMODORO' && (
                <div className="timer-pomo-options">
                  <button
                    className={`timer-pomo-pill ${pomoPreset === 25 ? 'active' : ''}`}
                    onClick={() => handlePomoPresetChange(25)}
                  >
                    25m Estudo + 5m Pausa
                  </button>
                  <button
                    className={`timer-pomo-pill ${pomoPreset === 50 ? 'active' : ''}`}
                    onClick={() => handlePomoPresetChange(50)}
                  >
                    50m Ultradiano + 10m Pausa
                  </button>
                </div>
              )}

              {/* Display Box */}
              <div className="timer-display-box">
                <div className={`timer-display-digits ${mode === 'POMODORO' ? (isBreak ? 'pomodoro-break' : 'pomodoro-work') : ''}`}>
                  {formatDigits(seconds)}
                </div>
                <div className="timer-display-state">
                  {mode === 'POMODORO'
                    ? (isBreak ? '☕ Intervalo de Recuperação' : (isRunning ? '🎯 Foco Ativo no Estudo' : 'Pausado'))
                    : (isRunning ? '▶ Registrando Tempo Ativo' : (seconds > 0 ? 'Pausado' : 'Pronto para Iniciar'))}
                </div>
              </div>

              {/* Context Selector: Disciplina e Tópico */}
              <div className="timer-form-group">
                <label className="timer-label">Disciplina</label>
                <select
                  className="timer-select"
                  value={selectedDisciplina}
                  onChange={(e) => {
                    setSelectedDisciplina(e.target.value);
                    setSelectedTopicoId('');
                  }}
                >
                  <option value="">Selecione a disciplina...</option>
                  {disciplinas.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {filteredTopicos.length > 0 && (
                <div className="timer-form-group">
                  <label className="timer-label">Tópico do Edital</label>
                  <select
                    className="timer-select"
                    value={selectedTopicoId}
                    onChange={(e) => setSelectedTopicoId(e.target.value)}
                  >
                    <option value="">Geral / Sem tópico específico</option>
                    {filteredTopicos.map(t => (
                      <option key={t.id} value={t.id}>{t.assunto}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Controls */}
              <div className="timer-controls-row">
                {!isRunning ? (
                  <button className="timer-btn timer-btn-primary" onClick={handleStart}>
                    ▶ Iniciar
                  </button>
                ) : (
                  <button className="timer-btn timer-btn-pause" onClick={handlePause}>
                    ⏸ Pausar
                  </button>
                )}
                <button className="timer-btn timer-btn-secondary" onClick={handleReset}>
                  ↺ Reset
                </button>
                <button
                  className="timer-btn timer-btn-save"
                  onClick={() => setIsSaving(!isSaving)}
                >
                  💾 Salvar
                </button>
              </div>

              {/* Save Session Drawer */}
              {isSaving && (
                <div className="timer-save-sheet">
                  {/* Micro-Telemetria de Estudo (Método Lucas) */}
                  <div style={{ background: '#0a0f1d', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📊 Micro-Telemetria do Bloco (Método Lucas)
                      </span>
                    </div>

                    {/* Linha Páginas: Início, Fim e Lidas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                      <div className="timer-form-group" style={{ margin: 0 }}>
                        <label className="save-stat-label" style={{ fontSize: '10px' }}>Pág. Inicial</label>
                        <input
                          type="number"
                          min="0"
                          className="timer-input"
                          placeholder="Ex: 1"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={paginaInicio}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                            setPaginaInicio(val);
                            if (typeof val === 'number' && typeof paginaFim === 'number' && paginaFim >= val) {
                              setPaginasLidas(paginaFim - val + 1);
                            }
                          }}
                        />
                      </div>
                      <div className="timer-form-group" style={{ margin: 0 }}>
                        <label className="save-stat-label" style={{ fontSize: '10px' }}>Pág. Final</label>
                        <input
                          type="number"
                          min="0"
                          className="timer-input"
                          placeholder="Ex: 25"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={paginaFim}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                            setPaginaFim(val);
                            if (typeof paginaInicio === 'number' && typeof val === 'number' && val >= paginaInicio) {
                              setPaginasLidas(val - paginaInicio + 1);
                            }
                          }}
                        />
                      </div>
                      <div className="timer-form-group" style={{ margin: 0 }}>
                        <label className="save-stat-label" style={{ fontSize: '10px' }}>Total Págs</label>
                        <input
                          type="number"
                          min="0"
                          className="timer-input"
                          style={{ padding: '4px 6px', fontSize: '12px', background: '#1e293b' }}
                          value={paginasLidas || ''}
                          onChange={(e) => setPaginasLidas(parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    </div>

                    {/* Linha Questões: Feitas e Acertadas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                      <div className="timer-form-group" style={{ margin: 0 }}>
                        <label className="save-stat-label" style={{ fontSize: '10px' }}>Questões Feitas</label>
                        <input
                          type="number"
                          min="0"
                          className="timer-input"
                          placeholder="Ex: 20"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={questoesFeitas || ''}
                          onChange={(e) => setQuestoesFeitas(parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                      <div className="timer-form-group" style={{ margin: 0 }}>
                        <label className="save-stat-label" style={{ fontSize: '10px' }}>Acertos ("Nota")</label>
                        <input
                          type="number"
                          min="0"
                          className="timer-input"
                          placeholder="Ex: 17"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={questoesAcertadas}
                          onChange={(e) => setQuestoesAcertadas(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        />
                      </div>
                    </div>

                    {/* Indicadores em Tempo Real */}
                    {(() => {
                      const dur = mode === 'POMODORO' ? (isBreak ? 0 : pomoPreset * 60 - seconds) : seconds;
                      const hrs = Math.max(0.0008, dur / 3600.0);
                      const velPags = paginasLidas > 0 ? (paginasLidas / hrs).toFixed(1) : '0';
                      const velQsts = questoesFeitas > 0 ? (questoesFeitas / hrs).toFixed(1) : '0';
                      const nota = questoesFeitas > 0 && typeof questoesAcertadas === 'number'
                        ? ((questoesAcertadas / questoesFeitas) * 100).toFixed(0)
                        : null;

                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(56, 189, 248, 0.08)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                          <span title="Velocidade de Leitura">📖 <strong>{velPags}</strong> pág/h</span>
                          <span title="Velocidade de Resolução">⚡ <strong>{velQsts}</strong> quest/h</span>
                          {nota !== null && (
                            <span style={{ color: Number(nota) >= 80 ? '#34d399' : '#fbbf24' }}>
                              🎯 <strong>{nota}%</strong> acerto
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {filteredMaterials.length > 0 && (
                    <div className="timer-form-group">
                      <label className="save-stat-label">Material Didático Utilizado</label>
                      <select
                        className="timer-select"
                        value={selectedMaterialId}
                        onChange={(e) => setSelectedMaterialId(e.target.value)}
                      >
                        <option value="">Nenhum / Caderno avulso</option>
                        {filteredMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.titulo}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="timer-form-group">
                    <label className="save-stat-label">Tipo de Estudo (Regra de Negócio Caderno 2)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        className={`timer-btn ${activityType === 'HE' ? 'timer-btn-primary' : 'timer-btn-secondary'}`}
                        style={{ padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
                        onClick={() => setActivityType('HE')}
                        title="Hora de Estudo Raiz: Estudo ativo puro (questões, fórmulas de cabeça, resumo por abstração)"
                      >
                        🔥 HE (Estudo Raiz)
                      </button>
                      <button
                        type="button"
                        className={`timer-btn ${activityType === 'HRE' ? 'timer-btn-primary' : 'timer-btn-secondary'}`}
                        style={{ padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
                        onClick={() => setActivityType('HRE')}
                        title="Hora Relacionada ao Estudo: Tarefas operacionais (organizar pastas, cartões, resumos prontos)"
                      >
                        ⚙️ HRE (Operacional)
                      </button>
                    </div>
                  </div>

                  <div className="timer-form-group">
                    <label className="save-stat-label">📬 Mensagem para o Eu do Futuro (Próxima Sessão)</label>
                    <input
                      type="text"
                      className="timer-input"
                      placeholder="Ex: Parou na pág 42; resolver ímpares do tópico X"
                      value={nextSessionHandoff}
                      onChange={(e) => setNextSessionHandoff(e.target.value)}
                    />
                  </div>

                  <div className="timer-form-group">
                    <label className="save-stat-label">Notas e Resumo da Sessão</label>
                    <input
                      type="text"
                      className="timer-input"
                      placeholder="Ex: Domínio dos incisos I e II do Art. 150"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                    />
                  </div>

                  <button className="timer-btn timer-btn-save" onClick={handleSaveSession}>
                    Gravar na Linha do Tempo (Event Log)
                  </button>
                </div>
              )}

              {saveSuccess && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textAlign: 'center',
                  background: saveSuccess.startsWith('✓') ? 'rgba(62, 207, 142, 0.15)' : 'rgba(245, 90, 90, 0.15)',
                  color: saveSuccess.startsWith('✓') ? '#3ecf8e' : '#f55a5a',
                  border: `1px solid ${saveSuccess.startsWith('✓') ? 'rgba(62, 207, 142, 0.3)' : 'rgba(245, 90, 90, 0.3)'}`
                }}>
                  {saveSuccess}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
