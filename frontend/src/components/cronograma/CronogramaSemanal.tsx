import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';

import './CronogramaSemanal.css';

interface CronogramaProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy: (disciplina: string, assunto?: string) => void;
  onNavigateToTab?: (tab: string) => void;
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

export const GEMINI_ROUTINE_PROMPT = `Você é um planejador de rotina e especialista em cronogramas de estudo para concursos fiscais.
Eu vou descrever minhas atividades semanais, horários de trabalho, compromissos pessoais, sono e janelas livres.
Sua missão é calcular exatamente quantas horas líquidas de estudo realista eu tenho por dia e formatar em um JSON rigoroso para o FiscalStudy Core.

Siga estritamente esta estrutura JSON (retorne APENAS o JSON válido, sem texto antes ou depois):

{
  "concursoId": "<ID_DO_CONCURSO_ATIVO>",
  "modoPlanejamento": "MAESTRO",
  "horasSemana": {
    "segunda": 3.5,
    "terca": 3.5,
    "quarta": 3.0,
    "quinta": 4.0,
    "sexta": 3.0,
    "sabado": 6.0,
    "domingo": 4.0
  },
  "compromissos": [
    {
      "titulo": "Trabalho Presencial",
      "diaSemana": "SEGUNDA",
      "horaInicio": "08:00",
      "horaFim": "17:00",
      "tipo": "TRABALHO"
    },
    {
      "titulo": "Academia / Treino",
      "diaSemana": "TERCA",
      "horaInicio": "18:00",
      "horaFim": "19:00",
      "tipo": "SAUDE"
    }
  ],
  "observacoes": "Rotina equilibrada preservando sono reparador."
}

Regras das Variáveis:
1. 'horasSemana': Números decimais representando horas líquidas disponíveis para estudo em cada dia (ex: 3.5 = 3 horas e 30 minutos). Mínimo 0, máximo 16.
2. 'diaSemana': Deve ser um dos valores: "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO".
3. 'tipo': Deve ser um dos valores: "TRABALHO", "FACULDADE", "FAMILIA", "SAUDE", "OUTRO".
4. 'horaInicio' e 'horaFim': Formato 24h "HH:mm" (ex: "08:00", "17:30").
5. 'modoPlanejamento': "MAESTRO" (Interface de Batalha com micro-passos), "SEMANAL" (Grade de blocos) ou "CICLO" (Ciclo proporcional).

Minhas Atividades da Semana:
[Substitua com suas atividades reais:
- Trabalho de segunda a sexta das 08h às 17h
- Almoço das 12h às 13h
- Academia seg, qua e sex das 18h às 19h
- Fins de semana livres para estudar mais
- Durmo cerca de 7h30 por noite]`;

export const CronogramaSemanal: React.FC<CronogramaProps> = ({ activeConcurso, onNavigateToStudy, onNavigateToTab: _onNavigateToTab }) => {
  const [mode, setMode] = useState<'SEMANAL' | 'CICLO'>(() => {
    const saved = sessionStorage.getItem('fiscalstudy_crono_mode');
    return (saved === 'CICLO' || saved === 'SEMANAL') ? saved : 'SEMANAL';
  });
  const [selectedDia, setSelectedDia] = useState<string>('Segunda');
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [routineDrawerTab, setRoutineDrawerTab] = useState<'MANUAL' | 'JSON_GEMINI'>('MANUAL');
  const [routineJsonInput, setRoutineJsonInput] = useState('');
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [importJsonFeedback, setImportJsonFeedback] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

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

  // Study blocks - initialized to empty array without mocks
  const [blocks, setBlocks] = useState<StudyBlock[]>([]);

  const handleGenerateBlocksFromCycle = () => {
    if (cycleItems.length === 0) return;
    const generated: StudyBlock[] = [];
    const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const hoursPerDay: Record<string, number> = {
      'Segunda': routineHours.horasSegunda,
      'Terça': routineHours.horasTerca,
      'Quarta': routineHours.horasQuarta,
      'Quinta': routineHours.horasQuinta,
      'Sexta': routineHours.horasSexta,
      'Sábado': routineHours.horasSabado,
      'Domingo': routineHours.horasDomingo,
    };

    let cycleIndex = 0;
    let blockIdCounter = 1;

    diasSemana.forEach((dia) => {
      const dailyHours = hoursPerDay[dia] || 0;
      let remainingMinutes = Math.round(dailyHours * 60);

      while (remainingMinutes >= 45 && cycleItems.length > 0) {
        const item = cycleItems[cycleIndex % cycleItems.length];
        const blockDuration = Math.min(remainingMinutes, item.blocoMinutos || 60);
        const tipo: 'TEORIA' | 'QUESTOES' | 'REVISAO' =
          (blockIdCounter % 3 === 1) ? 'TEORIA' : (blockIdCounter % 3 === 2) ? 'QUESTOES' : 'REVISAO';

        generated.push({
          id: `gen-${blockIdCounter++}`,
          dia,
          disciplina: item.disciplina,
          assunto: `Estudo guiado do edital (${item.totalTopicos || 1} tópicos)`,
          tipo,
          duracaoMinutos: blockDuration,
          concluido: false,
        });

        remainingMinutes -= blockDuration;
        cycleIndex++;
      }
    });

    setBlocks(generated);
  };

  const loadRoutineData = () => {
    const url = activeConcurso?.id
      ? `/api/v1/routine?concursoId=${encodeURIComponent(activeConcurso.id)}`
      : '/api/v1/routine';

    fetch(url)
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

  const handleCopyPrompt = () => {
    let p = GEMINI_ROUTINE_PROMPT;
    if (activeConcurso?.id) {
      p = p.replace('<ID_DO_CONCURSO_ATIVO>', activeConcurso.id);
    }
    navigator.clipboard.writeText(p);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const handleImportRoutineJson = async () => {
    if (!routineJsonInput.trim()) return;
    setIsImportingJson(true);
    setImportJsonFeedback(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(routineJsonInput.trim());
      } catch {
        const match = routineJsonInput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          parsed = JSON.parse(match[1]);
        } else {
          throw new Error('Formato JSON inválido. Verifique chaves e aspas.');
        }
      }

      const cid = activeConcurso?.id || parsed.concursoId || '';
      const res = await fetch(`/api/v1/routine/import-json?concursoId=${encodeURIComponent(cid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });

      if (res.ok) {
        const data = await res.json();
        setImportJsonFeedback(`✓ Sucesso! ${data.commitmentsCount || 0} compromissos cadastrados e rotina ajustada para ${data.totalHorasSemanais || 0}h semanais.`);
        loadRoutineData();
        setTimeout(() => {
          setIsRoutineOpen(false);
          setImportJsonFeedback(null);
        }, 2200);
      } else {
        setImportJsonFeedback('⚠️ Falha ao salvar rotina no servidor.');
      }
    } catch (e: any) {
      setImportJsonFeedback(`⚠️ Erro: ${e.message || 'JSON inválido'}`);
    } finally {
      setIsImportingJson(false);
    }
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
            onClick={() => {
              setMode('SEMANAL');
              sessionStorage.setItem('fiscalstudy_crono_mode', 'SEMANAL');
            }}
          >
            🗓️ Grade Semanal
          </button>
          <button
            className={`crono-mode-pill ${mode === 'CICLO' ? 'active' : ''}`}
            onClick={() => {
              setMode('CICLO');
              sessionStorage.setItem('fiscalstudy_crono_mode', 'CICLO');
            }}
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
              {blocksDoDia.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <p style={{ fontSize: '15px', marginBottom: '8px', color: '#f1f5f9' }}>
                    📭 Nenhum bloco de estudo agendado para {selectedDia}-feira.
                  </p>
                  <p style={{ fontSize: '13px', maxWidth: '460px', margin: '0 auto 16px auto', color: '#94a3b8' }}>
                    {cycleItems.length > 0
                      ? 'Você pode gerar automaticamente a distribuição dos blocos semanais a partir do seu ciclo de estudos proporcional.'
                      : 'Cadastre matérias no edital do concurso para gerar automaticamente seu ciclo e cronograma semanal.'}
                  </p>
                  {cycleItems.length > 0 && (
                    <button
                      className="btn-add-material"
                      style={{ padding: '8px 16px', fontSize: '13px', margin: '0 auto' }}
                      onClick={handleGenerateBlocksFromCycle}
                    >
                      ⚡ Gerar Blocos Automáticos do Ciclo
                    </button>
                  )}
                </div>
              ) : (
                blocksDoDia.map((block) => (
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
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* MODE 2: CICLO DE ESTUDOS ADAPTATIVO */}
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

            {/* Abas: Manual vs Importar JSON (Gemini) */}
            <div style={{ display: 'flex', gap: '4px', padding: '0 20px', borderBottom: '1px solid #2e3347', background: '#12151e' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: routineDrawerTab === 'MANUAL' ? '2px solid #6366f1' : '2px solid transparent',
                  color: routineDrawerTab === 'MANUAL' ? '#fff' : '#a1a6c2',
                  padding: '12px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onClick={() => setRoutineDrawerTab('MANUAL')}
              >
                ✍️ Horários Manuais
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: routineDrawerTab === 'JSON_GEMINI' ? '2px solid #10b981' : '2px solid transparent',
                  color: routineDrawerTab === 'JSON_GEMINI' ? '#10b981' : '#a1a6c2',
                  padding: '12px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => setRoutineDrawerTab('JSON_GEMINI')}
              >
                🤖 Importar JSON (Gemini)
                <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>IA</span>
              </button>
            </div>

            <div className="routine-drawer-body">
              {routineDrawerTab === 'MANUAL' ? (
                <>
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
                </>
              ) : (
                /* Gemini JSON Import Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#d1fae5'
                  }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#10b981', marginBottom: '4px' }}>
                      ✨ Como usar a conversão de rotina com o Gemini:
                    </strong>
                    1. Clique no botão abaixo para copiar o <strong>Prompt Mestre</strong> formatado.<br />
                    2. Abra o Gemini e cole o prompt, substituindo a lista de atividades com sua rotina real.<br />
                    3. Copie o JSON gerado pelo Gemini e cole no campo abaixo para injetar na sua agenda.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: copiedPrompt ? '#059669' : '#1e293b',
                        border: '1px solid #334155',
                        color: '#fff',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {copiedPrompt ? '✓ Prompt Copiado para Área de Transferência!' : '📋 Copiar Prompt Mestre para o Gemini'}
                    </button>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Compatível com Gemini Pro, Flash e Advanced</span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
                        Cole aqui o JSON gerado pelo Gemini:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setRoutineJsonInput(`{
  "concursoId": "${activeConcurso?.id || ''}",
  "modoPlanejamento": "MAESTRO",
  "horasSemana": {
    "segunda": 3.0,
    "terca": 3.0,
    "quarta": 3.0,
    "quinta": 3.0,
    "sexta": 3.0,
    "sabado": 6.0,
    "domingo": 4.0
  },
  "compromissos": [
    {
      "titulo": "Trabalho Integral",
      "diaSemana": "SEGUNDA",
      "horaInicio": "08:00",
      "horaFim": "17:00",
      "tipo": "TRABALHO"
    },
    {
      "titulo": "Academia",
      "diaSemana": "QUARTA",
      "horaInicio": "18:00",
      "horaFim": "19:00",
      "tipo": "SAUDE"
    }
  ]
}`);
                        }}
                        style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Carregar exemplo
                      </button>
                    </div>

                    <textarea
                      value={routineJsonInput}
                      onChange={(e) => setRoutineJsonInput(e.target.value)}
                      placeholder='{\n  "horasSemana": { "segunda": 3.5, ... },\n  "compromissos": [ ... ]\n}'
                      style={{
                        width: '100%',
                        height: '220px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        background: '#0d1117',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                        padding: '12px',
                        color: '#58a6ff',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {importJsonFeedback && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: importJsonFeedback.startsWith('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: importJsonFeedback.startsWith('✓') ? '#34d399' : '#f87171',
                      border: importJsonFeedback.startsWith('✓') ? '1px solid #10b981' : '1px solid #ef4444'
                    }}>
                      {importJsonFeedback}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
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
                      Fechar
                    </button>
                    <button
                      type="button"
                      disabled={isImportingJson || !routineJsonInput.trim()}
                      className="btn-add-material"
                      style={{
                        background: isImportingJson || !routineJsonInput.trim() ? '#475569' : '#10b981',
                        cursor: isImportingJson || !routineJsonInput.trim() ? 'not-allowed' : 'pointer'
                      }}
                      onClick={handleImportRoutineJson}
                    >
                      {isImportingJson ? 'Injetando Rotina...' : '🚀 Processar e Aplicar Rotina'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronogramaSemanal;
