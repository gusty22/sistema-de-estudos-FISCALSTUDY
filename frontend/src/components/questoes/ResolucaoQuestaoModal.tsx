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
import { useSimplifiedMode } from '../../context/SimplifiedModeContext';
import './ResolucaoQuestaoModal.css';
import { ProspectivePreparation } from '../../utils/prospectivePreparation';
import { readAttemptJournal } from '../../utils/attemptJournal';
import { prospectiveCaptureEnabled, modalCaptureSession } from '../../utils/prospectiveCapture';
import { AttemptSubmission, annotateAttempt } from '../../utils/attemptSubmission';
import { useModalA11y, handleKeyActivate } from '../../utils/accessibility';

interface AttemptFeedback {
  attemptId: string;
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
  captureScope?: string;
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
  captureScope = 'bank',
  currentIndex,
  totalInBatch,
  onClose,
  onNext,
  onPrev,
  onQuestionAnswered,
  onToggleFavorite,
  onReportQuestion
}) => {
  const { isSimplifiedMode } = useSimplifiedMode();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [pensouContrario, setPensouContrario] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null);
  const [selectedCausaErro, setSelectedCausaErro] = useState<string>('');
  const [annotatingState, setAnnotatingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [annotationMessage, setAnnotationMessage] = useState<string | null>(null);
  const [activeTimeMs, setActiveTimeMs] = useState<number>(0);
  const [ankiState, setAnkiState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [ankiMessage, setAnkiMessage] = useState<string | null>(null);

  // Each modal opening is a new session; a transport retry retains its attempt UUID.
  const sessionIdRef = useRef<string>('bank-session-' + crypto.randomUUID());
  const pendingAttemptRef = useRef<AttemptSubmission | null>(null);
  const submittingRef = useRef(false);
  const prospectiveRef = useRef<ProspectivePreparation | null>(null);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [preparation, setPreparation] = useState<'PREPARING' | 'READY' | 'ERROR'>('PREPARING');
  const [revision, setRevision] = useState(0);
  const [readyScope, setReadyScope] = useState('');
  const [helpDeclaration, setHelpDeclaration] = useState('UNKNOWN');
  const scope = captureScope + '|' + question.questionId + '|' + revision;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const canAnswer = preparation === 'READY' && readyScope === scope;


  // Resetar estado local ao mudar de questão
  useEffect(() => {
    scopeRef.current = scope;
    pendingAttemptRef.current = null;
    prospectiveRef.current = null;
    submittingRef.current = false;
    setHelpDeclaration('UNKNOWN');
    setPreparation('PREPARING');
    setReadyScope('');
    setSelectedOption(null);
    setConfidence(3);
    setPensouContrario(false);
    setIsSubmitting(false);
    setFeedback(null);
    setSelectedCausaErro('');
    setAnnotatingState('idle');
    setAnnotationMessage(null);
    setActiveTimeMs(0);
    setAnkiState('idle');
    setAnkiMessage(null);
    let active = true;
    prospectiveCaptureEnabled().then(async enabled => {
      if (!active) return;
      setCaptureEnabled(enabled);
      if (enabled) {
        const sid = modalCaptureSession(captureScope);
        sessionIdRef.current = sid;
        const intent = new ProspectivePreparation(question.questionId, sid);
        prospectiveRef.current = intent;
        await intent.prepare();
        if (!active) return;
        const saved = readAttemptJournal(question.questionId, sid);
        if (saved?.payload) {
          pendingAttemptRef.current = new AttemptSubmission(saved.payload, saved.attemptId);
          const letter = String(saved.payload.selectedOption);
          setSelectedOption(question.options.find((o,i) => extractLetter(o,i) === letter) || letter);
          setConfidence(Number(saved.payload.confidenceLevel));
          setActiveTimeMs(Number(saved.payload.activeTimeMs));
          setHelpDeclaration(saved.payload.usedHelp === true ? 'YES' : saved.payload.usedHelp === false ? 'NO' : 'UNKNOWN');
        }
        if (intent.recoveredResult) setFeedback(intent.recoveredResult);
        fetch('/api/v1/questions/' + encodeURIComponent(question.questionId) + '/presented', {
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid})
        }).catch(() => {});
      }
      if (active) { setReadyScope(scope); setPreparation('READY'); }
    }).catch(() => { if (active) setPreparation('ERROR'); });
    return () => { active = false; if (scopeRef.current === scope) scopeRef.current = ''; };
  }, [question.questionId, captureScope, revision]);

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

  // Acumulador de métricas da sessão de resolução de questões
  const sessionMetricsRef = useRef({
    questionsCount: 0,
    correctCount: 0,
    totalActiveTimeMs: 0,
    confidenceSum: 0,
    disciplina: question.discipline,
    topic: question.topic,
    concursoId: question.concursoId
  });

  const recordSessionSummary = async () => {
    const m = sessionMetricsRef.current;
    if (m.questionsCount === 0) return;
    try {
      const durSec = Math.max(1, Math.round(m.totalActiveTimeMs / 1000));
      const rendPct = Math.round((m.correctCount / m.questionsCount) * 100);
      const confMedia = Math.round((m.confidenceSum / m.questionsCount) * 10) / 10;
      const response = await fetch('/api/v1/study-sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          concursoId: m.concursoId,
          disciplina: m.disciplina || question.discipline || 'Geral',
          topicoId: m.topic || question.topic || 'Resolução de Questões',
          durationSeconds: durSec,
          questoesFeitas: m.questionsCount,
          questoesAcertadas: m.correctCount,
          rendimentoPercentual: rendPct,
          confiancaMedia: confMedia,
          activityType: 'QUESTOES',
          modo: 'BANCO_QUESTOES'
        })
      });
      if (!response.ok) throw new Error('O resumo da sessão não foi gravado: HTTP ' + response.status);
      // Zerar contadores para não duplicar se o modal permanecer aberto
      m.questionsCount = 0;
      m.correctCount = 0;
      m.totalActiveTimeMs = 0;
      m.confidenceSum = 0;
    } catch (err) {
      console.warn('Falha ao registrar resumo da sessão de questões:', err);
    }
  };

  const handleClose = () => {
    recordSessionSummary();
    onClose();
  };

  useModalA11y({
    isOpen: true,
    onClose: handleClose,
    closeOnEscape: true,
    restoreFocus: true
  });

  useEffect(() => {
    return () => {
      recordSessionSummary();
    };
  }, []);

  // Atalhos de teclado (1-5 confiança, setas para navegar se feedback exibido)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (!feedback && !pendingAttemptRef.current && ['1', '2', '3', '4', '5'].includes(e.key)) {
        setConfidence(parseInt(e.key, 10));
      } else if (feedback && e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (feedback && e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, feedback]);

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

  const cleanOptionText = (optText: string): string => {
    return optText
      .replace(/\s*(?:TRIBUNAL DE CONTAS|FGV CONHECIMENTO|AUDITOR FISCAL|TIPO\s+\d+|PÁGINA\s+\d+|Raciocínio Lógico).*$/i, '')
      .replace(/^[(\[]?[A-Ea-e][)\].\s\-:]+\s*(?:\([A-Ea-e]\)\s*)?/, '')
      .trim() || optText;
  };

  // Submissão da resposta
  const handleSubmit = async () => {
    if (!selectedOption || isSubmitting || submittingRef.current || feedback || !canAnswer) return;
    const submittedScope = scope;
    submittingRef.current = true;

    setIsSubmitting(true);
    try {
      const selectedIndex = rawOptions.indexOf(selectedOption);
      const letterToSend = extractLetter(selectedOption, selectedIndex >= 0 ? selectedIndex : 0);
      const timeSpent = Number(pendingAttemptRef.current?.payload.activeTimeMs ?? Math.max(1000, activeTimeMs));

      const payload = {
        selectedOption: letterToSend,
        confidenceLevel: Math.max(1, Math.min(5, confidence)),
        activeTimeMs: timeSpent,
        sessionId: sessionIdRef.current,
        origin: 'REAL_STUDY',
        studyMode: 'BANCO_QUESTOES',
        pensouContrario,
        ...(captureEnabled && helpDeclaration !== 'UNKNOWN' ? {usedHelp:helpDeclaration === 'YES',helpType:helpDeclaration === 'YES' ? 'MATERIAL_APOIO' : 'NENHUM'} : {})
      };

      pendingAttemptRef.current ??= new AttemptSubmission(payload, captureEnabled ? prospectiveRef.current!.attemptId : undefined, captureEnabled);
      const data: AttemptFeedback = await pendingAttemptRef.current.send(question.questionId);
      if (scopeRef.current !== submittedScope) return;
      {
        setFeedback(data);
        const acerto = data.isCorrect === true || data.gabaritoStatus === 'ANULADA';
        
        // Acumula métricas reais da sessão em memória
        sessionMetricsRef.current.questionsCount += 1;
        if (acerto) sessionMetricsRef.current.correctCount += 1;
        sessionMetricsRef.current.totalActiveTimeMs += timeSpent;
        sessionMetricsRef.current.confidenceSum += confidence;
        sessionMetricsRef.current.disciplina = question.discipline || sessionMetricsRef.current.disciplina;
        sessionMetricsRef.current.topic = question.topic || sessionMetricsRef.current.topic;
        sessionMetricsRef.current.concursoId = question.concursoId || sessionMetricsRef.current.concursoId;

        onQuestionAnswered(question.questionId, acerto);
      }
    } catch (e) {
      if (scopeRef.current !== submittedScope) return;
      console.error('Erro ao submeter resposta:', e);
      alert('Não foi possível confirmar a gravação. Tente novamente para reenviar a mesma tentativa. ' + (e instanceof Error ? e.message : ''));
    } finally {
      if (scopeRef.current === submittedScope) { submittingRef.current = false; setIsSubmitting(false); }
    }
  };

  // Atualizar metacognição pós-submissão
  const handleSelectCausaErro = async (causaCode: string) => {
    if (!feedback?.attemptId || annotatingState === 'saving') return;
    setAnnotatingState('saving');
    setAnnotationMessage(null);
    try {
      await annotateAttempt(question.questionId, feedback.attemptId, sessionIdRef.current, causaCode);
      setSelectedCausaErro(causaCode);
      setAnnotatingState('saved');
      setAnnotationMessage('Diagnóstico metacognitivo salvo com sucesso.');
    } catch (error) {
      setAnnotatingState('error');
      setAnnotationMessage(error instanceof Error ? error.message : 'Falha na conexão ao registrar diagnóstico.');
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
    <div className="resolucao-modal-backdrop" onClick={handleClose}>
      <div
        className="resolucao-modal-container"
        data-question-id={question.questionId}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolucao-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <header className="resolucao-modal-header">
          <div className="header-left-col">
            <div className="header-badge-row" id="resolucao-modal-title">
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
            {!isSimplifiedMode && (
              <div className="header-id-row">
                <span>ID: {question.questionId}</span>
                {question.arquivoOrigem && (
                  <span className="header-source-text">• Fonte: {question.arquivoOrigem}</span>
                )}
              </div>
            )}
          </div>

          <div className="header-right-col">
            {/* Navegador entre questões do lote */}
            <div className="batch-navigator">
              <button
                type="button"
                className="btn-batch-nav"
                onClick={onPrev}
                disabled={!onPrev || currentIndex <= 0}
                aria-label="Questão anterior"
                title="Questão anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="batch-indicator" aria-live="polite">
                {currentIndex + 1} de {totalInBatch}
              </span>
              <button
                type="button"
                className="btn-batch-nav"
                onClick={onNext}
                disabled={!onNext || currentIndex >= totalInBatch - 1}
                aria-label="Próxima questão"
                title="Próxima questão"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              className="btn-close-modal"
              onClick={handleClose}
              aria-label="Fechar resolução e voltar ao Banco"
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

          {!canAnswer && !feedback && <p role={preparation === 'ERROR' ? 'alert' : 'status'}>
            {preparation === 'ERROR' ? 'Não foi possível preparar a questão. Sua resposta ainda não foi enviada.' : 'Preparando questão...'}
            {preparation === 'ERROR' && <button onClick={() => setRevision(n => n+1)}>Tentar novamente</button>}
          </p>}
          {captureEnabled && !feedback && <label>Ajuda nesta tentativa
            <select aria-label="Ajuda nesta tentativa" value={helpDeclaration} disabled={!!pendingAttemptRef.current}
              onChange={e => setHelpDeclaration(e.target.value)}>
              <option value="UNKNOWN">Não informada</option><option value="NO">Não usei ajuda</option><option value="YES">Usei ajuda</option>
            </select>
          </label>}
          {/* Alternativas */}
          <div className="resolucao-options-list" role="radiogroup" aria-label="Alternativas da questão">
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
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={feedback || !canAnswer ? -1 : 0}
                  aria-disabled={Boolean(feedback) || !canAnswer}
                  aria-label={`Alternativa ${letter}: ${cleanText}`}
                  className={`resolucao-option-card ${optionStatusClass} ${feedback ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!feedback && !pendingAttemptRef.current && canAnswer) {
                      setSelectedOption(opt);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!feedback && !pendingAttemptRef.current && canAnswer) {
                      handleKeyActivate(e, () => setSelectedOption(opt));
                    }
                  }}
                >
                  <div className="option-marker-pill" aria-hidden="true">
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
              <div className="metacognitive-box" role="group" aria-label="Diagnóstico Metacognitivo pós-tentativa">
                <div className="metacognitive-header">
                  <span className="metacognitive-title">
                    Diagnóstico Metacognitivo: Qual foi o fator determinante nesta questão?
                  </span>
                  {annotatingState === 'saving' && (
                    <span className="annotation-status-inline saving" aria-live="polite">Salvando...</span>
                  )}
                  {annotatingState === 'saved' && (
                    <span className="annotation-status-inline saved" aria-live="polite">✓ Registrado</span>
                  )}
                  {annotatingState === 'error' && (
                    <span className="annotation-status-inline error" aria-live="assertive">⚠️ {annotationMessage}</span>
                  )}
                </div>
                <div className="metacognitive-pills">
                  {ERROR_TAXONOMIES.map((tax) => (
                    <button
                      key={tax.code}
                      type="button"
                      className={`tax-btn ${selectedCausaErro === tax.code ? 'active' : ''}`}
                      onClick={() => handleSelectCausaErro(tax.code)}
                      onKeyDown={(e) => handleKeyActivate(e, () => handleSelectCausaErro(tax.code))}
                      disabled={annotatingState === 'saving'}
                      aria-pressed={selectedCausaErro === tax.code}
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
                  <span className="confidence-label" id="resolucao-confidence-label">Certeza:</span>
                  <div className="confidence-pills" role="group" aria-labelledby="resolucao-confidence-label">
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
                        aria-pressed={confidence === lvl}
                        aria-label={`Nível de certeza ${lvl}: ${label}`}
                        className={`conf-pill ${confidence === lvl ? 'active' : ''}`}
                        onClick={() => !pendingAttemptRef.current && setConfidence(lvl)}
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
                  disabled={!selectedOption || isSubmitting || !canAnswer}
                  aria-busy={isSubmitting}
                  onClick={handleSubmit}
                >
                  <Play className="w-4 h-4" />
                  {isSubmitting ? 'Validando...' : pendingAttemptRef.current ? 'Reenviar mesma tentativa' : 'Confirmar Resposta'}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {captureEnabled && <button onClick={() => {
                  void recordSessionSummary();
                  sessionMetricsRef.current = {...sessionMetricsRef.current, questionsCount:0, correctCount:0, totalActiveTimeMs:0, confidenceSum:0};
                  modalCaptureSession(captureScope, true); setRevision(n => n+1);
                }}>Nova tentativa</button>}
                <button
                  type="button"
                  className="btn-footer-close"
                  onClick={handleClose}
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
