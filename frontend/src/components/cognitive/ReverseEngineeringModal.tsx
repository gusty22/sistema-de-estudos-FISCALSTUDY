import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ReverseEngineeringModal.css';

interface ReverseQuestion {
  id: string;
  enunciado: string;
  options: string[];
  correctOption?: string;
  disciplina: string;
  assunto: string;
  banca: string;
  ano?: number;
  orgao?: string;
}

interface ReverseEngineeringModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplina: string;
  assunto: string;
  concursoId?: string;
  banca?: string;
  onPrescriptionReady?: (prescription: any) => void;
  onNavigateToPdf?: (doc: string, pageStart: number, pageEnd: number) => void;
}

export const ReverseEngineeringModal: React.FC<ReverseEngineeringModalProps> = ({
  isOpen,
  onClose,
  disciplina,
  assunto,
  concursoId,
  banca = 'FGV',
  onPrescriptionReady,
  onNavigateToPdf,
}) => {
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctOption: string } | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);

  // Inicializa sessão ao abrir o modal
  useEffect(() => {
    if (!isOpen) {
      setSessionData(null);
      setCurrentIndex(0);
      setSelectedOption(null);
      setEliminatedOptions([]);
      setFeedback(null);
      return;
    }

    setLoading(true);
    fetch('/api/v1/cognitive/reverse-engineering/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concursoId,
        disciplina,
        assunto,
        banca: banca || 'FGV',
        nivelTopico: 'INTERMEDIARIO',
        quantidadeQuestoes: 5,
        sessionId: 'sess-' + Date.now(),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSessionData(data);
          setStartTime(Date.now());
        }
      })
      .catch((err) => console.error('Erro ao iniciar estudo reverso:', err))
      .finally(() => setLoading(false));
  }, [isOpen, disciplina, assunto, concursoId, banca]);

  if (!isOpen) return null;

  const questoes: ReverseQuestion[] = sessionData?.questoes || [];
  const currentQ = questoes[currentIndex];
  const isFinished = sessionData?.status === 'CONCLUIDA' || currentIndex >= questoes.length;

  const handleToggleEliminate = (letter: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (eliminatedOptions.includes(letter)) {
      setEliminatedOptions(eliminatedOptions.filter((l) => l !== letter));
    } else {
      setEliminatedOptions([...eliminatedOptions, letter]);
      if (selectedOption === letter) setSelectedOption(null);
    }
  };

  const handleSelectOption = (letter: string) => {
    if (feedback) return; // Já respondida
    if (eliminatedOptions.includes(letter)) {
      setEliminatedOptions(eliminatedOptions.filter((l) => l !== letter));
    }
    setSelectedOption(letter);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedOption || !currentQ || submitting) return;

    setSubmitting(true);
    const elapsedSecs = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const letter = selectedOption.toUpperCase();
    const correctLet = (currentQ.correctOption || 'A').toUpperCase();
    const isCorrect = letter === correctLet;

    try {
      const res = await fetch('/api/v1/cognitive/reverse-engineering/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reverseSessionId: sessionData.id,
          questionId: currentQ.id,
          numeroQuestao: currentIndex + 1,
          selectedOption: letter,
          isCorrect,
          eliminatedOptions,
          tempoGastoSegundos: elapsedSecs,
          pegadinhaCausa: isCorrect ? null : 'EXCECAO_JURISPRUDENCIAL',
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSessionData(updated);
        setFeedback({ isCorrect, correctOption: correctLet });
        if (updated.status === 'CONCLUIDA' && onPrescriptionReady) {
          onPrescriptionReady(updated);
        }
      }
    } catch (err) {
      console.error('Erro ao submeter resposta reversa:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    setFeedback(null);
    setSelectedOption(null);
    setEliminatedOptions([]);
    setStartTime(Date.now());
    setCurrentIndex((prev) => prev + 1);
  };

  const modalContent = (
    <div className="rev-modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="rev-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="rev-header">
          <div className="rev-header-left">
            <div className="rev-badge-row">
              <span className="rev-tag-method">🎯 Estudo Reverso Orientado</span>
              <span className="rev-tag-board">Banca Foco: {sessionData?.banca || banca}</span>
              <span className="rev-tag-level">Assunto Intermediário/Avançado</span>
            </div>
            <h2 className="rev-title">{disciplina} — {assunto}</h2>
          </div>
          <button type="button" className="rev-close-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        {/* Barra de Progresso / Stepper */}
        {!isFinished && questoes.length > 0 && (
          <div className="rev-stepper-bar">
            <div className="rev-pills">
              {questoes.map((_, idx) => {
                let statusClass = '';
                if (idx === currentIndex) statusClass = 'active';
                return (
                  <div key={idx} className={`rev-step-pill ${statusClass}`}>
                    {idx + 1}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Questão {currentIndex + 1} de {questoes.length} • Sondagem de Fronteira
            </span>
          </div>
        )}

        {/* Corpo do Conteúdo */}
        <div className="rev-content-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              O sistema está selecionando 5 questões de provas anteriores da banca {banca}...
            </div>
          )}

          {!loading && !isFinished && currentQ && (
            <div>
              <div className="rev-statement">
                {currentQ.enunciado}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Marque sua resposta ou <strong>elimine alternativas com facilidade</strong>:
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
                  {eliminatedOptions.length > 0 && `✓ ${eliminatedOptions.length} alternativa(s) eliminada(s)`}
                </span>
              </div>

              <div className="rev-options-list">
                {currentQ.options && currentQ.options.map((opt, idx) => {
                  const isCE = currentQ.options.length === 2 && (
                    currentQ.options.some(o => o.toUpperCase().includes('CERT') || o.toUpperCase().includes('ERR')) ||
                    (currentQ.banca && (currentQ.banca.toUpperCase().includes('CEBRASPE') || currentQ.banca.toUpperCase().includes('CESPE')))
                  );
                  const letterMatch = opt.match(/^([A-E])\)?/i);
                  const letter = isCE
                    ? (idx === 0 ? 'C' : 'E')
                    : (letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + idx));
                  const isEliminated = eliminatedOptions.includes(letter);
                  const isSelected = selectedOption === letter;

                  let cardClass = 'rev-option-card';
                  if (isSelected) cardClass += ' selected';
                  if (isEliminated) cardClass += ' eliminated';
                  if (feedback) {
                    if (letter === feedback.correctOption) cardClass += ' correct-answer';
                    else if (isSelected && !feedback.isCorrect) cardClass += ' wrong-answer';
                  }

                  return (
                    <div
                      key={idx}
                      className={cardClass}
                      onClick={() => handleSelectOption(letter)}
                    >
                      <span className="rev-opt-text">{opt}</span>
                      {!feedback && (
                        <button
                          type="button"
                          className="rev-eliminate-btn"
                          onClick={(e) => handleToggleEliminate(letter, e)}
                          title="Eliminar esta alternativa com facilidade"
                        >
                          {isEliminated ? 'Restaurar' : '✕ Riscar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Feedback pós-resposta imediato */}
              {feedback && (
                <div className={`rev-feedback-banner ${feedback.isCorrect ? 'correct' : 'incorrect'} animate-fade-in`}>
                  {feedback.isCorrect ? (
                    <div>
                      <strong>✅ Resposta Correta!</strong> Você demonstrou domínio sobre a mecânica desta alternativa. O sistema registrou as alternativas eliminadas para comprovação da regra geral.
                    </div>
                  ) : (
                    <div>
                      <strong>⚠️ Pegadinha Mapeada!</strong> Você caiu no distrator da banca ({feedback.correctOption} era a correta). Esta exceção jurisprudencial será isolada no recorte do material teórico.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prescrição Cirúrgica Final após responder as 5 questões */}
          {!loading && isFinished && sessionData && (
            <div className="animate-fade-in">
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '2.5rem' }}>💡</span>
                <h3 style={{ margin: '0.35rem 0', color: '#f8fafc', fontSize: '1.3rem' }}>
                  Estudo Reverso Concluído — Recorte Teórico Gerado
                </h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.86rem' }}>
                  Mapeamos onde você domina a regra geral e onde caiu nas pegadinhas da {sessionData.banca || banca}.
                </p>
              </div>

              <div className="rev-prescription-card">
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📜 Prescrição do Terceiro Observador:
                </span>
                <div className="rev-prescription-quote">
                  "{sessionData.prescricaoRecorteTexto}"
                </div>

                <div className="rev-metrics-grid">
                  <div className="rev-metric-item">
                    <span className="rev-metric-label">⏱️ Economia de Tempo</span>
                    <span className="rev-metric-val">{sessionData.paginasPuladas} páginas puladas (~45 min)</span>
                  </div>
                  <div className="rev-metric-item">
                    <span className="rev-metric-label">🎯 Leitura Cirúrgica</span>
                    <span className="rev-metric-val">Páginas {sessionData.paginaInicioRecorte} a {sessionData.paginaFimRecorte}</span>
                  </div>
                  <div className="rev-metric-item">
                    <span className="rev-metric-label">📊 Acertos na Bateria</span>
                    <span className="rev-metric-val">{sessionData.questoesCorretas} de {sessionData.totalQuestoes} questões</span>
                  </div>
                  <div className="rev-metric-item">
                    <span className="rev-metric-label">⚠️ Pegadinhas Mapeadas</span>
                    <span className="rev-metric-val">{sessionData.errosQuestoesNumeros ? `Questões ${sessionData.errosQuestoesNumeros}` : 'Nenhuma'}</span>
                  </div>
                </div>

                {sessionData.alternativasEliminadasFacilidade && sessionData.alternativasEliminadasFacilidade.length > 0 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.95rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, fontSize: '0.8rem', color: '#94a3b8' }}>
                    <strong>🔍 Eliminações de Facilidade Mapeadas:</strong> {sessionData.alternativasEliminadasFacilidade.slice(0, 6).join(' • ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Ações */}
        <footer className="rev-actions-footer">
          {!isFinished ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Suspender Estudo Reverso
              </button>

              {!feedback ? (
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff',
                    padding: '8px 20px',
                    fontWeight: 600,
                  }}
                  disabled={!selectedOption || submitting}
                  onClick={handleSubmitAnswer}
                >
                  {submitting ? 'Analisando...' : 'Confirmar Resposta ➔'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    padding: '8px 20px',
                    fontWeight: 600,
                  }}
                  onClick={handleNextQuestion}
                >
                  {currentIndex + 1 < questoes.length ? 'Próxima Questão ➔' : 'Ver Recorte Teórico ➔'}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Fechar
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000',
                  padding: '9px 24px',
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                }}
                onClick={() => {
                  if (onNavigateToPdf && sessionData) {
                    onNavigateToPdf(
                      sessionData.pdfDocNome || 'PDF Aula',
                      sessionData.paginaInicioRecorte || 16,
                      sessionData.paginaFimRecorte || 22
                    );
                  } else {
                    alert(`📖 Abrindo ${sessionData?.pdfDocNome || 'PDF da matéria'} na página ${sessionData?.paginaInicioRecorte || 16} a ${sessionData?.paginaFimRecorte || 22}. As primeiras 15 páginas foram puladas com sucesso!`);
                  }
                  onClose();
                }}
              >
                📖 Abrir PDF nas Páginas {sessionData?.paginaInicioRecorte || 16} a {sessionData?.paginaFimRecorte || 22} ➔
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
