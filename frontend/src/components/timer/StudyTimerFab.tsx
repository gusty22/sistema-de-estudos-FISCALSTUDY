import React, { useState, useEffect, useRef } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './StudyTimerFab.css';
import { cachedStudyPreferences } from '../../utils/studyPreferences';
import { StudySessionSubmission, StudySessionError, discardPendingSession } from '../../utils/studySessionSubmission';

interface StudyTimerFabProps {
  activeConcurso: ConcursoItem | null;
  onSessionSaved?: () => void;
}

export const StudyTimerFab: React.FC<StudyTimerFabProps> = ({ activeConcurso, onSessionSaved }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'CRONOMETRO' | 'POMODORO'>('CRONOMETRO');
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Identidade de sessão estável para idempotência e recuperação (sessionStorage)
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem('fiscalstudy_timer_session_id');
      if (stored) return stored;
      const generated = 'study-' + crypto.randomUUID();
      sessionStorage.setItem('fiscalstudy_timer_session_id', generated);
      return generated;
    } catch {
      return 'study-' + crypto.randomUUID();
    }
  });
  const pendingSubmissionRef = useRef<StudySessionSubmission | null>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<{ message: string; isConflict: boolean; retryable: boolean } | null>(null);
  const [pendingRecoveryNotice, setPendingRecoveryNotice] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [storageWarningNotice, setStorageWarningNotice] = useState<string | null>(null);

  // Recuperação real após reload (Achado C): restaura o payload exato sem reconstruir dados a partir de formulário modificado
  useEffect(() => {
    try {
      const recovered = StudySessionSubmission.fromJournal(sessionId);
      if (recovered) {
        pendingSubmissionRef.current = recovered;
        if (!recovered.isDurable && recovered.storageWarning) {
          setStorageWarningNotice(recovered.storageWarning);
        }
        const p = recovered.payload as any;
        if (p.disciplina) setSelectedDisciplina(p.disciplina);
        if (typeof p.durationSeconds === 'number' && seconds === 0) setSeconds(p.durationSeconds);
        if (p.nextSessionHandoff) setNextSessionHandoff(p.nextSessionHandoff);
        if (p.notas) setNotas(p.notas);
        if (p.activityType) setActivityType(p.activityType);
        if (p.topicoId) setSelectedTopicoId(p.topicoId);
        if (p.materialId) setSelectedMaterialId(p.materialId);
        if (p.paginaInicio !== undefined) setPaginaInicio(p.paginaInicio);
        if (p.paginaFim !== undefined) setPaginaFim(p.paginaFim);
        if (p.paginasLidas !== undefined) setPaginasLidas(p.paginasLidas);
        if (p.questoesFeitas !== undefined) setQuestoesFeitas(p.questoesFeitas);
        if (p.questoesAcertadas !== undefined && p.questoesAcertadas !== null) setQuestoesAcertadas(p.questoesAcertadas);
        setPendingRecoveryNotice(
          'Operação anterior recuperada do armazenamento local da aba. Reconcilie o envio para garantir idempotência ou descarte explicitamente antes de iniciar nova sessão.'
        );
        setIsSaving(true);
      }
    } catch {
      // Degradação segura
    }
  }, [sessionId]);

  // Pomodoro settings
  const [pomoPreset, setPomoPreset] = useState<number>(() => cachedStudyPreferences().sessionMinutes);
  const [isBreak, setIsBreak] = useState(false);

  useEffect(() => {
    const update = (event: Event) => {
      // Never change an in-progress countdown when a preference is saved.
      if (!isRunning) setPomoPreset((event as CustomEvent).detail.sessionMinutes);
    };
    window.addEventListener('fiscalstudy:preferences-updated', update);
    return () => window.removeEventListener('fiscalstudy:preferences-updated', update);
  }, [isRunning]);

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

  const handleInitiateDiscard = () => {
    if (isSubmitting) return;
    setShowDiscardConfirm(true);
  };

  const handleConfirmDiscard = () => {
    if (isSubmitting) return;
    discardPendingSession(sessionId);
    pendingSubmissionRef.current = null;
    setSaveError(null);
    setPendingRecoveryNotice(null);
    setShowDiscardConfirm(false);
    setStorageWarningNotice(null);
    const newId = 'study-' + crypto.randomUUID();
    setSessionId(newId);
    try {
      sessionStorage.setItem('fiscalstudy_timer_session_id', newId);
    } catch {}
  };

  const handleCancelDiscard = () => {
    setShowDiscardConfirm(false);
  };

  const handleReset = () => {
    if (isSubmitting) return;
    // Impede reset durante operação incerta (Achado B): exige reconciliação ou descarte explícito
    if (pendingSubmissionRef.current && !pendingSubmissionRef.current.confirmed && (saveError?.retryable || pendingRecoveryNotice)) {
      return;
    }
    setIsRunning(false);
    if (mode === 'POMODORO') {
      setSeconds(pomoPreset * 60);
      setIsBreak(false);
    } else {
      setSeconds(0);
    }
    setIsSaving(false);
    pendingSubmissionRef.current = null;
    setSaveError(null);
    setSaveSuccess(null);
    setPendingRecoveryNotice(null);
    const newId = 'study-' + crypto.randomUUID();
    setSessionId(newId);
    try {
      sessionStorage.setItem('fiscalstudy_timer_session_id', newId);
    } catch {}
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

  const handlePomoPresetChange = (preset: number) => {
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
    // Barreira síncrona contra clique duplo / requisições concorrentes
    if (isSubmittingRef.current) return;

    const duration = mode === 'POMODORO'
      ? (isBreak ? 0 : pomoPreset * 60 - seconds)
      : seconds;

    if (duration <= 0 && paginasLidas <= 0 && questoesFeitas <= 0) {
      setSaveSuccess('Registre ao menos alguns minutos ou páginas lidas.');
      setTimeout(() => setSaveSuccess(null), 3000);
      return;
    }

    // Se ainda não há submissão congelada criada para esta sessão, prepara a submissão imutável
    if (!pendingSubmissionRef.current) {
      const payload = {
        sessionId,
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
      pendingSubmissionRef.current = new StudySessionSubmission(payload, sessionId);
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSaveError(null);

    try {
      await pendingSubmissionRef.current.send();

      // Confirmação válida recebida do backend (200 / 201)
      setSaveSuccess('✓ Sessão de estudo e micro-telemetria gravadas com sucesso!');
      pendingSubmissionRef.current = null;
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
      setPendingRecoveryNotice(null);
      const newId = 'study-' + crypto.randomUUID();
      setSessionId(newId);
      try {
        sessionStorage.setItem('fiscalstudy_timer_session_id', newId);
      } catch {}
      if (onSessionSaved) onSessionSaved();
      setTimeout(() => {
        setSaveSuccess(null);
        setIsOpen(false);
      }, 1500);
    } catch (err: unknown) {
      const isConflict = err instanceof StudySessionError ? err.isConflict : false;
      const message = err instanceof Error ? err.message : 'Erro ao registrar sessão no servidor.';
      setSaveError({
        message,
        isConflict,
        retryable: !isConflict
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
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
                    50m Estudo + 10m Pausa
                  </button>
                  {[75, 90].map(minutes => <button key={minutes} className={`timer-pomo-pill ${pomoPreset === minutes ? 'active' : ''}`} onClick={() => handlePomoPresetChange(minutes)}>{minutes}m Estudo + 10m Pausa</button>)}
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
                <button
                  className="timer-btn timer-btn-secondary"
                  onClick={handleReset}
                  disabled={isSubmitting || !!(pendingSubmissionRef.current && !pendingSubmissionRef.current.confirmed && (saveError?.retryable || pendingRecoveryNotice))}
                >
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

                  <button
                    className="timer-btn timer-btn-save"
                    onClick={handleSaveSession}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Gravando...' : 'Gravar na Linha do Tempo (Event Log)'}
                  </button>

                  {pendingRecoveryNotice && !saveError && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <span>ℹ️ {pendingRecoveryNotice}</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="timer-btn timer-btn-save"
                          onClick={handleSaveSession}
                          disabled={isSubmitting}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          {isSubmitting ? 'Reenviando...' : '🔄 Reconciliar Envio'}
                        </button>
                        <button
                          type="button"
                          className="timer-btn timer-btn-secondary"
                          onClick={handleInitiateDiscard}
                          disabled={isSubmitting}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          Descartar Operação Incerta
                        </button>
                      </div>
                    </div>
                  )}

                  {saveError && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      background: 'rgba(245, 90, 90, 0.15)',
                      color: '#f55a5a',
                      border: '1px solid rgba(245, 90, 90, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <span>{saveError.message}</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {saveError.retryable && (
                          <button
                            type="button"
                            className="timer-btn timer-btn-save"
                            onClick={handleSaveSession}
                            disabled={isSubmitting}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            {isSubmitting ? 'Reenviando...' : '🔄 Tentar Novamente (Reconciliar)'}
                          </button>
                        )}
                        {(saveError.retryable || saveError.isConflict) && (
                          <button
                            type="button"
                            className="timer-btn timer-btn-secondary"
                            onClick={handleInitiateDiscard}
                            disabled={isSubmitting}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            {saveError.isConflict ? 'Descartar Conflito e Iniciar Nova' : '⚠️ Descartar Operação Incerta'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              
                  {showDiscardConfirm && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <span>⚠️ <strong>Atenção Crítica:</strong> O servidor pode já ter registrado esta operação caso a resposta tenha sido perdida após a gravação. Descartar a pendência localmente NÃO desfaz gravações no banco de dados e iniciar uma nova sessão não impede duplicidade caso o envio anterior tenha sido concluído no servidor. Deseja realmente descartar a pendência local?</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="timer-btn"
                          onClick={handleConfirmDiscard}
                          disabled={isSubmitting}
                          style={{ background: '#dc2626', color: '#fff', fontSize: '11px', padding: '3px 8px' }}
                        >
                          Confirmar Descarte
                        </button>
                        <button
                          type="button"
                          className="timer-btn timer-btn-secondary"
                          onClick={handleCancelDiscard}
                          disabled={isSubmitting}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          Cancelar e Reconciliar
                        </button>
                      </div>
                    </div>
                  )}

                  {storageWarningNotice && !showDiscardConfirm && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      color: '#eab308'
                    }}>
                      ⚠️ {storageWarningNotice}
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
