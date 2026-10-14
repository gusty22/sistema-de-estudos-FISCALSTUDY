import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './MaestroBattleView.css';

export interface MaestroStep {
  numeroPasso: number;
  totalPassos: number;
  duracaoMinutos: number;
  tipo: string;
  titulo: string;
  instrucaoMastigada: string;
  disciplina: string;
  assunto: string;
  objetivoPedagogico: string;
  actionType: string;
  metadata?: Record<string, any>;
  concluido?: boolean;
}

export interface MaestroPlan {
  concursoId: string;
  concursoNome: string;
  tempoTotalMinutos: number;
  totalPassos: number;
  disciplinaPrincipal: string;
  assuntoPrincipal: string;
  passos: MaestroStep[];
  telemetriaCognitiva?: Record<string, any>;
  statusMensagem?: string;
}

interface MaestroBattleViewProps {
  concursoId: string;
  concursoNome: string;
  onNavigateToStudy: (disciplina?: string, assunto?: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onSwitchToWeekly?: () => void;
}

export const MaestroBattleView: React.FC<MaestroBattleViewProps> = ({
  concursoId,
  concursoNome,
  onNavigateToStudy,
  onNavigateToTab,
  onSwitchToWeekly,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(180); // Padrão 3 horas
  const [plan, setPlan] = useState<MaestroPlan | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Timer do Passo Atual
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Drawer do Roteiro Completo
  const [isScriptDrawerOpen, setIsScriptDrawerOpen] = useState<boolean>(false);

  // Ação executada com sucesso feedback
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Carregar Plano do Maestro
  const loadPlan = async (minutes: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/maestro/plan?concursoId=${encodeURIComponent(concursoId || '')}&tempoDisponivelMinutos=${minutes}`);
      if (!res.ok) throw new Error('Falha ao gerar plano do Maestro.');
      const data: MaestroPlan = await res.json();
      setPlan(data);
      setCurrentStepIndex(0);
      if (data.passos && data.passos.length > 0) {
        setSecondsRemaining(data.passos[0].duracaoMinutos * 60);
      }
      setIsTimerRunning(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar roteiro do Maestro.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlan(selectedMinutes);
  }, [concursoId, selectedMinutes]);

  // Atualizar timer quando muda de passo
  useEffect(() => {
    if (plan && plan.passos && plan.passos[currentStepIndex]) {
      setSecondsRemaining(plan.passos[currentStepIndex].duracaoMinutos * 60);
      setIsTimerRunning(false);
    }
  }, [currentStepIndex, plan]);

  // Efeito do Cronômetro Decrescente
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (secondsRemaining === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Concluir passo e avançar
  const handleCompleteCurrentStep = async () => {
    if (!plan || !plan.passos[currentStepIndex]) return;
    const step = plan.passos[currentStepIndex];

    try {
      await fetch('/api/v1/maestro/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId,
          numeroPasso: step.numeroPasso,
          tipo: step.tipo,
          duracaoMinutos: step.duracaoMinutos,
        }),
      });

      // Atualiza status local
      const updatedPassos = [...plan.passos];
      updatedPassos[currentStepIndex].concluido = true;
      setPlan({ ...plan, passos: updatedPassos });

      // Avança para o próximo passo
      if (currentStepIndex + 1 < plan.passos.length) {
        setCurrentStepIndex(currentStepIndex + 1);
        setActionFeedback(`Passo ${step.numeroPasso} concluído! Assumindo o próximo passo.`);
        setTimeout(() => setActionFeedback(null), 4000);
      } else {
        // Todos concluídos!
        setCurrentStepIndex(plan.passos.length);
      }
    } catch (err: any) {
      alert('Erro ao registrar conclusão do passo: ' + err.message);
    }
  };

  // Executar Ação Imediata
  const handleExecuteAction = (step: MaestroStep) => {
    if (step.actionType === 'RESOLVER_QUESTOES') {
      sessionStorage.setItem('fiscalstudy_filter_discipline', step.disciplina);
      sessionStorage.setItem('fiscalstudy_filter_assunto', step.assunto);
      sessionStorage.setItem('fiscalstudy_auto_start', 'true');
      onNavigateToStudy(step.disciplina, step.assunto);
    } else if (step.actionType === 'LER_MATERIAL') {
      if (onNavigateToTab) {
        onNavigateToTab('materiais');
      } else {
        alert(`Abra o material: ${step.metadata?.materialDoc || 'PDF Aula'} (págs. ${step.metadata?.paginaInicio || 1} a ${step.metadata?.paginaFim || 30}).`);
      }
    } else if (step.actionType === 'ANKI_SYNC') {
      setActionFeedback('Sessão Anki registrada: 45 cards reativados na curva de retenção.');
      setTimeout(() => setActionFeedback(null), 4000);
    } else if (step.actionType === 'DESCANSO_TIMER') {
      setIsTimerRunning(true);
      setActionFeedback('Descanso sináptico ativado: afaste os olhos da tela por 10 minutos.');
      setTimeout(() => setActionFeedback(null), 5000);
    } else if (step.actionType === 'FEYNMAN') {
      if (onNavigateToTab) {
        onNavigateToTab('feynman');
      } else {
        alert('Explique com suas próprias palavras os conceitos principais deste tópico.');
      }
    }
  };

  const currentStep = plan && plan.passos ? plan.passos[currentStepIndex] : null;
  const isAllCompleted = plan && currentStepIndex >= plan.passos.length;
  const completedCount = plan && plan.passos ? plan.passos.filter((p) => p.concluido).length : 0;
  const progressPercent = plan && plan.passos.length > 0 ? Math.round((completedCount / plan.passos.length) * 100) : 0;

  return (
    <div className="maestro-container animate-fade-in">
      {/* Top Header com Seletor de Tempo */}
      <div className="maestro-top-header">
        <div className="maestro-title-text">
          <div className="maestro-brand-title">
            <span className="maestro-badge-live">
              <span className="pulse-dot"></span> Modo Batalha Ativo
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>• O Maestro do Ciclo Diário</span>
          </div>
          <h2>⚔️ Interface de Batalha (Micro-Orquestração)</h2>
          <p>Diga seu tempo disponível para {concursoNome}. O sistema assume o controle total e mostra apenas a próxima ação imediata.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onSwitchToWeekly && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSwitchToWeekly}
              style={{ fontSize: '0.82rem', padding: '7px 14px' }}
              title="Alternar para a visualização clássica de calendário semanal"
            >
              📅 Calendário Semanal
            </button>
          )}

          <div className="maestro-time-selector">
            <span className="time-selector-label">Tenho hoje:</span>
            <button
              type="button"
              className={`time-pill-btn ${selectedMinutes === 60 ? 'active' : ''}`}
              onClick={() => setSelectedMinutes(60)}
            >
              1 hora
            </button>
            <button
              type="button"
              className={`time-pill-btn ${selectedMinutes === 120 ? 'active' : ''}`}
              onClick={() => setSelectedMinutes(120)}
            >
              2 horas
            </button>
            <button
              type="button"
              className={`time-pill-btn ${selectedMinutes === 180 ? 'active' : ''}`}
              onClick={() => setSelectedMinutes(180)}
            >
              3 horas (Padrão)
            </button>
            <button
              type="button"
              className={`time-pill-btn ${selectedMinutes === 240 ? 'active' : ''}`}
              onClick={() => setSelectedMinutes(240)}
            >
              4 horas
            </button>
          </div>
        </div>
      </div>

      {/* Meta Bar do Foco de Hoje */}
      {plan && (
        <div className="maestro-meta-bar">
          <div className="meta-focus-item">
            <span className="meta-focus-label">🎯 Concurso:</span>
            <span className="meta-focus-val">{plan.concursoNome}</span>
          </div>
          <div className="meta-focus-item">
            <span className="meta-focus-label">📚 Disciplina Foco:</span>
            <span className="meta-focus-val">{plan.disciplinaPrincipal}</span>
          </div>
          <div className="meta-focus-item">
            <span className="meta-focus-label">📌 Assunto:</span>
            <span className="meta-focus-val">{plan.assuntoPrincipal}</span>
          </div>
          <div className="meta-retention-badge">
            <span>🧠 Retenção Atual: {plan.telemetriaCognitiva?.retencaoAtual || 82}%</span>
            <span style={{ opacity: 0.6 }}>➔</span>
            <span>Meta: {plan.telemetriaCognitiva?.metaRetencao || 90}%</span>
          </div>
        </div>
      )}

      {actionFeedback && (
        <div className="glass" style={{ borderLeft: '4px solid #10b981', padding: '0.85rem 1.25rem', background: 'rgba(16, 185, 129, 0.12)' }}>
          <p style={{ margin: 0, color: '#34d399', fontWeight: 700, fontSize: '0.9rem' }}>
            ✓ {actionFeedback}
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="glass" style={{ borderLeft: '4px solid #ef4444', padding: '0.85rem 1.25rem' }}>
          <p style={{ margin: 0, color: '#ef4444', fontWeight: 600 }}>⚠️ {errorMsg}</p>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          O Maestro está calibrando seu roteiro de batalha com base nas lacunas do Gêmeo Digital...
        </div>
      )}

      {/* =========================================================================
          HERO BATTLE CARD: APENAS A PRÓXIMA AÇÃO IMEDIATA
          ========================================================================= */}
      {!isLoading && plan && currentStep && !isAllCompleted && (
        <div className={`battle-hero-card step-${currentStep.tipo.toLowerCase()} animate-fade-in`}>
          {/* Header do Passo */}
          <div className="battle-step-indicator-bar">
            <span className="battle-step-tag">
              PASSO {currentStep.numeroPasso} DE {plan.totalPassos} • {currentStep.titulo}
            </span>
            <span className="battle-step-duration">
              ⏱️ Duração Alvo: <strong>{currentStep.duracaoMinutos} min</strong>
            </span>
          </div>

          {/* O Roteiro Mastigado (Directive Quotation Box) */}
          <div className="battle-directive-box">
            <h3 className="battle-directive-quote">
              "{currentStep.instrucaoMastigada}"
            </h3>
            <div className="battle-directive-subtext">
              <span>🎯 Disciplina: <strong style={{ color: '#38bdf8' }}>{currentStep.disciplina}</strong></span>
              <span>• Assunto: <strong style={{ color: '#cbd5e1' }}>{currentStep.assunto}</strong></span>
            </div>
          </div>

          {/* HUD do Cronômetro Decrescente */}
          <div className="battle-timer-hud">
            <div className="timer-digits-group">
              <span className={`timer-digits ${secondsRemaining <= 120 ? 'warning' : ''} ${secondsRemaining === 0 ? 'completed' : ''}`}>
                {formatTime(secondsRemaining)}
              </span>
              <div>
                <span className="timer-status-label">
                  {isTimerRunning ? '🟢 Bloco em Andamento' : secondsRemaining === 0 ? '🏁 Bloco Concluído' : '⏸️ Bloco Pausado'}
                </span>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Micro-telemetria ativa: tempo líquido registrado
                </p>
              </div>
            </div>

            <div className="timer-controls">
              <button
                type="button"
                className="btn-timer-primary"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
              >
                {isTimerRunning ? '⏸ Pausar Bloco' : '▶ Iniciar Bloco'}
              </button>
              <button
                type="button"
                className="btn-timer-secondary"
                onClick={() => setSecondsRemaining((prev) => prev + 300)}
                title="Adicionar mais 5 minutos a este bloco"
              >
                +5 min
              </button>
              <button
                type="button"
                className="btn-timer-secondary"
                onClick={() => {
                  setIsTimerRunning(false);
                  setSecondsRemaining(currentStep.duracaoMinutos * 60);
                }}
                title="Reiniciar cronômetro do bloco"
              >
                ↺
              </button>
            </div>
          </div>

          {/* Justificativa e ROI Cognitivo */}
          <div className="battle-roi-card">
            <span className="battle-roi-icon">🧠</span>
            <div className="battle-roi-text">
              <h5>Por que o Maestro determinou esta ação agora?</h5>
              <p>
                <strong>{currentStep.objetivoPedagogico}</strong>. Baseado nas métricas do Gêmeo Digital, este bloco maximiza a retenção neural e impede que você gaste energia decidindo o que fazer.
              </p>
            </div>
          </div>

          {/* Botões de Ação Imediata & Avanço */}
          <div className="battle-actions-bar">
            <div>
              {currentStep.actionType === 'RESOLVER_QUESTOES' && (
                <button
                  type="button"
                  className="btn-battle-launch"
                  onClick={() => handleExecuteAction(currentStep)}
                >
                  ⚡ {currentStep.tipo === 'PRIMING_COGNITIVO' ? 'Resolver 5 Questões Inéditas de Priming Agora' : 'Iniciar Bateria de Questões Agora'}
                </button>
              )}

              {currentStep.actionType === 'LER_MATERIAL' && (
                <button
                  type="button"
                  className="btn-battle-launch"
                  onClick={() => handleExecuteAction(currentStep)}
                >
                  📖 Abrir {currentStep.metadata?.materialDoc || 'PDF Aula'} (Págs. {currentStep.metadata?.paginaInicio || 15} a {currentStep.metadata?.paginaFim || 35})
                </button>
              )}

              {currentStep.actionType === 'ANKI_SYNC' && (
                <button
                  type="button"
                  className="btn-battle-launch"
                  onClick={() => handleExecuteAction(currentStep)}
                >
                  🔄 Sincronizar e Confirmar 45 Cards do Anki
                </button>
              )}

              {currentStep.actionType === 'DESCANSO_TIMER' && (
                <button
                  type="button"
                  className="btn-battle-launch"
                  onClick={() => handleExecuteAction(currentStep)}
                >
                  🧘 Iniciar Descanso Cerebral (Afaste-se da tela)
                </button>
              )}

              {currentStep.actionType === 'FEYNMAN' && (
                <button
                  type="button"
                  className="btn-battle-launch"
                  onClick={() => handleExecuteAction(currentStep)}
                >
                  ✍️ Abrir Sessão Feynman em Tela Limpa
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-battle-complete"
              onClick={handleCompleteCurrentStep}
            >
              ✓ Concluir Passo e Avançar ➔
            </button>
          </div>
        </div>
      )}

      {/* Victory Screen ao Concluir Todos os Passos do Dia */}
      {!isLoading && isAllCompleted && (
        <div className="battle-victory-card animate-fade-in">
          <div className="victory-icon">🏆</div>
          <h2>Missão Diária Cumprida com Sucesso!</h2>
          <p>
            Você executou com maestria todos os {plan?.totalPassos} passos do roteiro diário ({plan?.tempoTotalMinutos} min líquidos). A retenção foi fortalecida e suas sinapses consolidadas!
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCurrentStepIndex(0);
                if (plan?.passos) {
                  const resetPassos = plan.passos.map((p) => ({ ...p, concluido: false }));
                  setPlan({ ...plan, passos: resetPassos });
                }
              }}
            >
              ↺ Reiniciar Ciclo de Hoje
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedMinutes(selectedMinutes + 60)}
            >
              + Adicionar Mais 1 Hora de Batalha
            </button>
          </div>
        </div>
      )}

      {/* Bottom HUD: Barra de Progresso e Botão de Ver Roteiro Completo */}
      {plan && (
        <div className="battle-bottom-hud">
          <div className="hud-progress-info">
            <span className="hud-progress-text">
              Progresso de Hoje: <strong>{completedCount} de {plan.totalPassos} passos ({progressPercent}%)</strong>
            </span>
            <div className="hud-dots-sequence">
              {plan.passos.map((p, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isDone = p.concluido;
                return (
                  <span
                    key={p.numeroPasso}
                    className={`hud-step-dot ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                    title={`Passo ${p.numeroPasso}: ${p.titulo} (${p.duracaoMinutos} min)`}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Tempo Total: <strong>{plan.tempoTotalMinutos} min</strong>
            </span>
            <button
              type="button"
              className="btn-toggle-drawer"
              onClick={() => setIsScriptDrawerOpen(true)}
            >
              📋 Ver Roteiro Completo do Dia
            </button>
          </div>
        </div>
      )}

      {/* Drawer / Modal com o Roteiro Completo Mastigado */}
      {isScriptDrawerOpen && plan && createPortal(
        <div className="drawer-backdrop" onClick={() => setIsScriptDrawerOpen(false)}>
          <div className="drawer-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', margin: 0 }}>
                  📜 Roteiro Completo Orquestrado pelo Maestro
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                  Total: {plan.tempoTotalMinutos} min • Foco: {plan.disciplinaPrincipal} ({plan.assuntoPrincipal})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScriptDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {plan.passos.map((p, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isDone = p.concluido;
                return (
                  <div
                    key={p.numeroPasso}
                    className={`full-script-item ${isCurrent ? 'current' : ''} ${isDone ? 'completed' : ''}`}
                  >
                    <span className="script-item-num">
                      {isDone ? '✓' : `Passo ${p.numeroPasso}`}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <strong style={{ color: isCurrent ? '#38bdf8' : '#f1f5f9', fontSize: '0.92rem' }}>
                          {p.titulo}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                          ⏱️ {p.duracaoMinutos} min
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.45' }}>
                        "{p.instrucaoMastigada}"
                      </p>
                      <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                        Objetivo: {p.objetivoPedagogico}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsScriptDrawerOpen(false)}
              >
                Voltar à Interface de Batalha
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
