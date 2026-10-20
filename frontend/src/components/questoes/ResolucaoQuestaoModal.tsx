import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Flag,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import type { QuestionItem } from './BancoQuestoes';
import './ResolucaoQuestaoModal.css';

interface AttemptFeedback {
  isCorrect: boolean | null;
  gabaritoStatus?: string;
  concursoPoint?: number;
  bloqueioCognitivo?: boolean;
  errosConsecutivos?: number;
  prescricaoTexto?: string;
  veiculo?: string;
  correctOption?: string;
}

export interface ResolucaoQuestaoModalProps {
  question: QuestionItem;
  currentIndex: number;
  totalInBatch: number;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onQuestionAnswered: (questionId: string, isCorrect: boolean) => void;
  onToggleFavorite: (questionId: string) => void;
  onReportQuestion: (questionId: string) => void;
}

const ERROR_TAXONOMIES = [
  { code: 'SABIA_COM_CONVICCAO', label: '🟢 Sabia e acertei com convicção', type: 'acerto' },
  { code: 'CHUTE_EDUCADO', label: '🟡 Acertei no chute educado / eliminação', type: 'acerto' },
  { code: 'SABIA_MAS_CONFUNDI', label: '🟠 Sabia, mas confundi detalhe / exceção', type: 'erro' },
  { code: 'NAO_SABIA_MATERIA', label: '🔴 Não sabia a matéria (Lacuna teórica pura)', type: 'erro' },
  { code: 'PEGADINHA_BANCA', label: '⚠️ Caí em pegadinha / distração na leitura', type: 'erro' }
];

export const ResolucaoQuestaoModal: React.FC<ResolucaoQuestaoModalProps> = ({
  question,
  currentIndex,
  totalInBatch,
  onClose,
  onNext,
  onPrev,
  onQuestionAnswered,
  onToggleFavorite,
  onReportQuestion
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [pensouContrario, setPensouContrario] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null);
  const [selectedCausaErro, setSelectedCausaErro] = useState<string>('');
  const [activeTimeMs, setActiveTimeMs] = useState<number>(0);
  const [ankiState, setAnkiState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [ankiMessage, setAnkiMessage] = useState<string | null>(null);

  // ID persistente para a sessão de resolução no Banco de Questões
  const sessionIdRef = useRef<string>(
    sessionStorage.getItem('fiscalstudy_bank_session_id') ||
    `bank-session-${Date.now()}`
  );

  useEffect(() => {
    sessionStorage.setItem('fiscalstudy_bank_session_id', sessionIdRef.current);
  }, []);

  // Resetar estado local ao mudar de questão
  useEffect(() => {
    setSelectedOption(null);
    setConfidence(3);
    setPensouContrario(false);
    setIsSubmitting(false);
    setFeedback(null);
    setSelectedCausaErro('');
    setActiveTimeMs(0);
    setAnkiState('idle');
    setAnkiMessage(null);
  }, [question.questionId]);

  // Cronômetro de tempo ativo gasto na questão
  useEffect(() => {
    if (feedback || isSubmitting) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveTimeMs((prev) => prev + 1000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [feedback, isSubmitting, question.questionId]);

  // Atalhos de teclado (Esc para fechar, 1-5 confiança, setas para navegar se feedback exibido)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (!feedback && ['1', '2', '3', '4', '5'].includes(e.key)) {
        setConfidence(parseInt(e.key, 10));
      } else if (feedback && e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (feedback && e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, feedback]);

  const isAnulada = question.gabaritoStatus === 'ANULADA';
  const isCertoErrado = question.tipoQuestao === 'CERTO_ERRADO' ||
    (Array.isArray(question.options) && question.options.length === 2 &&
      question.options.some((o: string) => o.toUpperCase().includes('CERTO') || o.toUpperCase().includes('ERRADO')));

  const rawOptions: string[] = Array.isArray(question.options) ? question.options : [];

  // Extrair letra padronizada da opção selecionada (A, B, C, D, E ou C, E)
  const extractLetter = (optText: string, index: number): string => {
    if (isCertoErrado) {
      if (optText.toUpperCase().includes('CERTO') || optText.toUpperCase().startsWith('C')) return 'C';
      if (optText.toUpperCase().includes('ERRADO') || optText.toUpperCase().startsWith('E')) return 'E';
      return index === 0 ? 'C' : 'E';
    }
    const match = optText.match(/^[(\[]?([A-Ea-e])[)\].\s]/);
    if (match) return match[1].toUpperCase();
    return String.fromCharCode(65 + index);
  };

  // Limpar texto da opção para não repetir a letra
  const cleanOptionText = (optText: string): string => {
    return optText.replace(/^[(\[]?[A-Ea-e][)\].\s\-:]+\s*(?:\([A-Ea-e]\)\s*)?/, '').trim() || optText;
  };

  // Submissão da resposta
  const handleSubmit = async () => {
    if (!selectedOption || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const selectedIndex = rawOptions.indexOf(selectedOption);
      const letterToSend = extractLetter(selectedOption, selectedIndex >= 0 ? selectedIndex : 0);

      const payload = {
        selectedOption: letterToSend,
        confidenceLevel: Math.max(1, Math.min(5, confidence)),
        activeTimeMs: Math.max(1000, activeTimeMs),
        sessionId: sessionIdRef.current,
        origin: 'BANCO_QUESTOES',
        pensouContrario
      };

      const res = await fetch(`/api/v1/questions/${question.questionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: AttemptFeedback = await res.json();
        setFeedback(data);
        const acerto = data.isCorrect === true || data.gabaritoStatus === 'ANULADA';
        onQuestionAnswered(question.questionId, acerto);
      } else {
        alert('Não foi possível submeter a resposta. Tente novamente.');
      }
    } catch (e) {
      console.error('Erro ao submeter resposta:', e);
      alert('Erro de conexão ao salvar sua resposta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Atualizar metacognição pós-submissão
  const handleSelectCausaErro = async (causaCode: string) => {
    setSelectedCausaErro(causaCode);
    try {
      const selectedIndex = selectedOption ? rawOptions.indexOf(selectedOption) : 0;
      const letterToSend = selectedOption ? extractLetter(selectedOption, selectedIndex >= 0 ? selectedIndex : 0) : 'A';
      await fetch(`/api/v1/questions/${question.questionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption: letterToSend,
          confidenceLevel: Math.max(1, Math.min(5, confidence)),
          activeTimeMs: Math.max(1000, activeTimeMs),
          sessionId: sessionIdRef.current,
          origin: 'BANCO_QUESTOES',
          causaErro: causaCode,
          pensouContrario
        })
      });
    } catch {
      // Metacognição silenciosa
    }
  };

  // Criar Flashcard Anki
  const handleCreateAnkiFlashcard = async () => {
    if (ankiState === 'saving' || ankiState === 'saved') return;
    setAnkiState('saving');
    setAnkiMessage(null);

    try {
      const selectedIndex = selectedOption ? rawOptions.indexOf(selectedOption) : 0;
      const letterToSend = selectedOption ? extractLetter(selectedOption, selectedIndex >= 0 ? selectedIndex : 0) : 'A';

      const res = await fetch('/api/v1/anki/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.questionId,
          selectedOption: letterToSend,
          causaErro: selectedCausaErro || 'PRATICA_BANCO_QUESTOES',
          sessionId: sessionIdRef.current
        })
      });

      if (res.ok) {
        setAnkiState('saved');
        setAnkiMessage('Flashcard injetado com sucesso na fila do Anki!');
      } else {
        setAnkiState('error');
        setAnkiMessage('Não foi possível conectar ao Anki. Verifique se o daemon está ativo.');
      }
    } catch {
      setAnkiState('error');
      setAnkiMessage('Falha ao comunicar com o servidor de sincronização Anki.');
    }
  };

  // Formatação amigável do enunciado
  const renderStatement = (text: string) => {
    if (!text) return null;
    const paragraphs = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);

    return paragraphs.map((par, i) => {
      const isCommand = /^(?:assinale|qual|a respeito|julgue|com base|considerando|em relação)/i.test(par);
      return (
        <p key={i} className={`statement-par ${isCommand ? 'statement-command' : ''}`}>
          {par}
        </p>
      );
    });
  };

  // Formatar tempo em mm:ss
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="resolucao-modal-backdrop" onClick={onClose}>
      <div className="resolucao-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho do Modal */}
        <header className="resolucao-modal-header">
          <div className="header-left-col">
            <div className="header-badge-row">
              <span className="badge-tag-modal discipline">{question.discipline}</span>
              <span className="badge-tag-modal topic">{question.topic || 'Geral'}</span>
              <span className="badge-tag-modal">{question.board} • {question.year}</span>
              {question.orgao && <span className="badge-tag-modal">{question.orgao}</span>}
              <span className="badge-tag-modal">{isCertoErrado ? 'Certo ou Errado' : 'Múltipla Escolha'}</span>
              {isAnulada ? (
                <span className="badge-tag-modal anulada">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> Anulada
                </span>
              ) : (
                <span className="badge-tag-modal validada">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Validada
                </span>
              )}
            </div>
            <div className="header-id-row">
              <span>ID: {question.questionId}</span>
              {question.arquivoOrigem && (
                <span className="header-source-text">• Fonte: {question.arquivoOrigem}</span>
              )}
            </div>
          </div>

          <div className="header-right-col">
            {/* Navegador entre questões do lote */}
            <div className="batch-navigator">
              <button
                type="button"
                className="btn-batch-nav"
                onClick={onPrev}
                disabled={!onPrev || currentIndex <= 0}
                title="Questão anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="batch-indicator">
                {currentIndex + 1} de {totalInBatch}
              </span>
              <button
                type="button"
                className="btn-batch-nav"
                onClick={onNext}
                disabled={!onNext || currentIndex >= totalInBatch - 1}
                title="Próxima questão"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
              title="Fechar resolução e voltar ao Banco (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Corpo com rolagem */}
        <div className="resolucao-modal-body">
          {/* Enunciado */}
          <div className="resolucao-statement-box">
            {renderStatement(question.statement)}
          </div>

          {/* Imagem de apoio se existir */}
          {question.supportMaterial?.mediaPath && (
            <div className="resolucao-support-media">
              <img
                src={
                  question.supportMaterial.mediaPath.startsWith('http')
                    ? question.supportMaterial.mediaPath
                    : `http://localhost:8080/${question.supportMaterial.mediaPath.replace(/^\/+/, '')}`
                }
                alt={question.supportMaterial.titulo || 'Imagem de apoio da questão'}
                loading="lazy"
              />
            </div>
          )}

          {/* Alternativas */}
          <div className="resolucao-options-list">
            {rawOptions.map((opt, idx) => {
              const letter = extractLetter(opt, idx);
              const isSelected = selectedOption === opt;
              const cleanText = cleanOptionText(opt);

              let optionStatusClass = '';
              let badgeLabel = null;

              if (feedback) {
                const normalizedCorrect = feedback.correctOption ? feedback.correctOption.toUpperCase().trim() : null;
                const isCorrectOption = normalizedCorrect === letter;

                if (isCorrectOption) {
                  optionStatusClass = 'is-correct-target';
                  badgeLabel = '✅ Gabarito Oficial';
                } else if (isSelected && !feedback.isCorrect && !isAnulada) {
                  optionStatusClass = 'is-incorrect-selected';
                  badgeLabel = '❌ Sua Escolha';
                } else if (isSelected && feedback.isCorrect) {
                  optionStatusClass = 'is-correct-selected';
                  badgeLabel = '✅ Sua Escolha (Correta)';
                } else {
                  optionStatusClass = 'is-dimmed';
                }
              } else if (isSelected) {
                optionStatusClass = 'is-selected';
              }

              return (
                <div
                  key={idx}
                  className={`resolucao-option-card ${optionStatusClass} ${feedback ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!feedback) {
                      setSelectedOption(opt);
                    }
                  }}
                >
                  <div className="option-marker-pill">
                    {letter}
                  </div>
                  <div className="option-body-text">
                    {cleanText}
                  </div>
                  {badgeLabel && (
                    <span className="option-feedback-badge">
                      {badgeLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bloco Antipegadinha (antes de responder) */}
          {!feedback && (
            <div className="antipegadinha-banner">
              <label className="antipegadinha-label">
                <input
                  type="checkbox"
                  checked={pensouContrario}
                  onChange={(e) => setPensouContrario(e.target.checked)}
                />
                <span>
                  <strong>Reflexão Crítica:</strong> Analisei exceções, prazos específicos e termos restritivos (<em>"salvo", "apenas", "vedado"</em>) antes de confirmar.
                </span>
              </label>
            </div>
          )}

          {/* Feedback Pós-Resposta */}
          {feedback && (
            <div
              className={`resolucao-feedback-banner ${
                isAnulada
                  ? 'anulada'
                  : feedback.isCorrect
                  ? 'correct'
                  : 'error'
              }`}
            >
              <div className="feedback-banner-header">
                {isAnulada ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4>Questão Anulada pela Banca Examinadora</h4>
                      <p>O ponto desta questão é computado pelas regras do concurso e não penaliza seu histórico pedagógico.</p>
                    </div>
                  </>
                ) : feedback.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4>Parabéns, você acertou!</h4>
                      <p>Resposta correta confirmada com o gabarito oficial ({feedback.correctOption || 'Validado'}).</p>
                    </div>
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5 text-red-400" />
                    <div>
                      <h4>Resposta Incorreta</h4>
                      <p>
                        Gabarito oficial da banca: <strong>Alternativa {feedback.correctOption || 'indicada em verde'}</strong>. Revise o conceito abaixo para consolidar sua retenção.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Taxonomia do Erro / Metacognição */}
              <div className="metacognitive-box">
                <span className="metacognitive-title">
                  Diagnóstico Metacognitivo: Qual foi o fator determinante nesta questão?
                </span>
                <div className="metacognitive-pills">
                  {ERROR_TAXONOMIES.map((tax) => (
                    <button
                      key={tax.code}
                      type="button"
                      className={`tax-btn ${selectedCausaErro === tax.code ? 'active' : ''}`}
                      onClick={() => handleSelectCausaErro(tax.code)}
                    >
                      {tax.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações pós-resolução */}
              <div className="feedback-actions-bar">
                <button
                  type="button"
                  className={`btn-feedback-action ${ankiState === 'saved' ? 'success' : ''}`}
                  onClick={handleCreateAnkiFlashcard}
                  disabled={ankiState === 'saving' || ankiState === 'saved'}
                >
                  <Sparkles className="w-4 h-4" />
                  {ankiState === 'saving'
                    ? 'Injetando no Anki...'
                    : ankiState === 'saved'
                    ? '✓ Card no Anki'
                    : 'Criar Flashcard Anki'}
                </button>

                <button
                  type="button"
                  className="btn-feedback-action"
                  onClick={() => onToggleFavorite(question.questionId)}
                >
                  <Bookmark className="w-4 h-4" fill={question.isFavorite ? 'currentColor' : 'none'} />
                  {question.isFavorite ? 'Favoritada' : 'Favoritar'}
                </button>

                <button
                  type="button"
                  className="btn-feedback-action"
                  onClick={() => onReportQuestion(question.questionId)}
                >
                  <Flag className="w-4 h-4" />
                  Reportar
                </button>

                {onNext && currentIndex < totalInBatch - 1 && (
                  <button
                    type="button"
                    className="btn-feedback-action primary"
                    onClick={onNext}
                  >
                    Próxima Questão
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {ankiMessage && (
                <div className={`anki-status-msg ${ankiState === 'saved' ? 'success' : 'error'}`}>
                  {ankiMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações de Submissão */}
        <footer className="resolucao-modal-footer">
          <div className="footer-left-info">
            <span className="timer-badge">
              ⏱️ Tempo Ativo: {formatTime(activeTimeMs)}
            </span>
            {question.tentativasTotal > 0 && (
              <span className="stats-prev-badge">
                Respondida {question.tentativasTotal}x • Histórico: {question.taxaAcertoPessoal}% acerto
              </span>
            )}
          </div>

          <div className="footer-right-actions">
            {!feedback ? (
              <>
                {/* Seletor de Certeza */}
                <div className="confidence-selector-row">
                  <span className="confidence-label">Certeza:</span>
                  <div className="confidence-pills">
                    {[
                      { lvl: 1, label: 'Chute' },
                      { lvl: 2, label: 'Baixa' },
                      { lvl: 3, label: 'Média' },
                      { lvl: 4, label: 'Alta' },
                      { lvl: 5, label: 'Certeza' }
                    ].map(({ lvl, label }) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`conf-pill ${confidence === lvl ? 'active' : ''}`}
                        onClick={() => setConfidence(lvl)}
                        title={`Nível ${lvl} — ${label} (tecla ${lvl})`}
                      >
                        <span className="num">{lvl}</span>
                        <span className="lbl">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-confirm-answer"
                  disabled={!selectedOption || isSubmitting}
                  onClick={handleSubmit}
                >
                  <Play className="w-4 h-4" />
                  {isSubmitting ? 'Validando...' : 'Confirmar Resposta'}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn-footer-close"
                  onClick={onClose}
                >
                  Voltar ao Banco
                </button>
                {onNext && currentIndex < totalInBatch - 1 && (
                  <button
                    type="button"
                    className="btn-confirm-answer"
                    onClick={onNext}
                  >
                    Avançar para Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
