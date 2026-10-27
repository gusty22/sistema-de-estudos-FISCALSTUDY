import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AttemptSubmission, annotateAttempt } from '../utils/attemptSubmission';
import { ProspectivePreparation } from '../utils/prospectivePreparation';
import { readAttemptJournal, restoreQuestionSession, saveQuestionSession } from '../utils/attemptJournal';
import { cachedStudyPreferences } from '../utils/studyPreferences';
import { handleKeyActivate } from '../utils/accessibility';
import './QuestionViewer.css';
import { CrossDomainBridgeModal } from './cognitive/CrossDomainBridgeModal';
import { CognitiveLockModal } from './cognitive/CognitiveLockModal';
import { ReverseEngineeringModal } from './cognitive/ReverseEngineeringModal';
import { RelatorioSessaoQuestoes, type SolvedQuestionItem } from './questoes/RelatorioSessaoQuestoes';
import { useSimplifiedMode } from '../context/SimplifiedModeContext';

interface Option {
  label?: string;
  text?: string;
}

interface SupportMaterial {
  tipo?: string;
  titulo?: string;
  conteudoTexto?: string;
  mediaPath?: string;
}

interface Question {
  questionId: string;
  statement: string;
  options: string[] | Option[];
  metadata: {
    discipline: string;
    topic: string;
    board: string;
    year: number;
    supportMaterial?: SupportMaterial;
  };
}

export interface AttemptFeedback {
  attemptId: string;
  isCorrect: boolean | null;
  gabaritoStatus?: string;
  concursoPoint?: number;
  bloqueioCognitivo?: boolean;
  errosConsecutivos?: number;
  prescricaoTexto?: string;
  veiculo?: string;
}

interface SessionSummary {
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  overconfidenceCount: number;
  concursoScore?: number;
  anuladasCount?: number;
  errorDistribution?: Record<string, number>;
}

interface ConcursoOption {
  id: string;
  nome: string;
  orgao: string;
  cargo: string;
}

export interface MetaconFeedbackOption {
  code: string;
  label: string;
  shortLabel: string;
  type: 'acerto' | 'erro' | 'ambos';
  badgeColor: string;
  description: string;
}

export const METACON_FEEDBACK_OPTIONS: MetaconFeedbackOption[] = [
  { 
    code: 'SABIA_COM_CONVICCAO', 
    label: '🟢 Sabia e acertei com convicção', 
    shortLabel: 'Convicção Plena',
    type: 'acerto', 
    badgeColor: '#10b981',
    description: 'Domínio conceitual real e seguro, sem hesitação ou dúvida.' 
  },
  { 
    code: 'CHUTE_EDUCADO', 
    label: '🟡 Acertei no chute educado / eliminação', 
    shortLabel: 'Chute Educado',
    type: 'acerto', 
    badgeColor: '#f59e0b',
    description: 'Acertei por descarte ou técnica de prova, mas preciso revisar a teoria.' 
  },
  { 
    code: 'SABIA_MAS_CONFUNDI', 
    label: '🟠 Sabia, mas confundi / vacilei em detalhe', 
    shortLabel: 'Sabia, mas confundi',
    type: 'erro', 
    badgeColor: '#fb923c',
    description: 'Conheço a matéria, mas troquei conceitos semelhantes, prazos ou caí em exceção.' 
  },
  { 
    code: 'NAO_SABIA_MATERIA', 
    label: '🔴 Não sabia a matéria (Lacuna teórica pura)', 
    shortLabel: 'Lacuna Teórica',
    type: 'erro', 
    badgeColor: '#ef4444',
    description: 'Nunca estudei esse assunto ou esqueci completamente os fundamentos.' 
  },
  { 
    code: 'NAO_LEMBRAVA', 
    label: '📉 Não lembrava (Falha de retenção / SRS)', 
    shortLabel: 'Não lembrava',
    type: 'erro', 
    badgeColor: '#a855f7',
    description: 'Já tinha estudado, mas a memória decaiu na Curva de Ebbinghaus.' 
  },
  { 
    code: 'FALTA_ATENCAO', 
    label: '🟣 Falta de atenção / Interpretação do comando', 
    shortLabel: 'Atenção / Comando',
    type: 'erro', 
    badgeColor: '#8b5cf6',
    description: 'Comi bronha no enunciado (ignorado "incorreto", "salvo", "vedado").' 
  },
  { 
    code: 'TRAVAMENTO_PRATICO', 
    label: '🔵 Sabia a teoria, mas travei na aplicação prática', 
    shortLabel: 'Trava Prática',
    type: 'erro', 
    badgeColor: '#38bdf8',
    description: 'Entendo o conceito abstrato, mas travei no cálculo ou na subsunção ao caso.' 
  },
];

export interface SessionAttemptHistoryItem {
  attemptId: string;
  questionId: string;
  statement: string;
  discipline: string;
  topic: string;
  board: string;
  year: number;
  options: string[];
  selectedOption: string;
  isCorrect: boolean | null;
  gabaritoStatus?: string;
  concursoPoint?: number;
  confidenceLevel: number;
  activeTimeMs: number;
  tempoHesitacaoMs: number;
  trocasCount: number;
  friccaoScore: number;
  chuteEducadoDetectado: boolean;
  fluenciaNeurologica: string;
  causaErro?: string;
  naCordaBamba?: boolean;
  pensouContrario?: boolean;
}

const ERROR_TAXONOMIES = METACON_FEEDBACK_OPTIONS;

const QuestionViewer: React.FC = () => {
  const { isSimplifiedMode } = useSimplifiedMode();
  const [sessionStarted, setSessionStarted] = useState(() => sessionStorage.getItem('fiscalstudy_sessionStarted') === 'true');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [feedback, setFeedback] = useState<AttemptFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const pendingAttemptRef = useRef<AttemptSubmission | null>(null);
  const submittingRef = useRef(false);
  const submissionScopeRef = useRef('');
  const prospectiveRef = useRef<ProspectivePreparation | null>(null);
  const [prospectiveStatus, setProspectiveStatus] = useState<'PREPARING' | 'READY' | 'ERROR'>('PREPARING');
  const [prospectiveRetry, setProspectiveRetry] = useState(0);

  // Configuração da Sessão Personalizada (Fase 8)
  const [concursos, setConcursos] = useState<ConcursoOption[]>([]);
  const [selectedConcursoId, setSelectedConcursoId] = useState<string>(() => localStorage.getItem('fiscalstudy_active_concurso_id') || '');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>(() => sessionStorage.getItem('fiscalstudy_filter_discipline') || '');
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [selectedAssunto, setSelectedAssunto] = useState<string>(() => sessionStorage.getItem('fiscalstudy_filter_assunto') || '');
  const [studyMode, setStudyMode] = useState<string>('LEARNING'); // LEARNING, EXAM, RETENTION, CREDIARIO
  const [includeAnswered, setIncludeAnswered] = useState<boolean>(false);
  const [questionCountLimit, setQuestionCountLimit] = useState<number>(() => cachedStudyPreferences().dailyQuestions);
  const [selectedCausaErro, setSelectedCausaErro] = useState<string>('');
  const [showSupportMaterial, setShowSupportMaterial] = useState<boolean>(true);
  const [sessionHistory, setSessionHistory] = useState<SessionAttemptHistoryItem[]>([]);

  // Navegação entre Questões e Mapa da Sessão
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answeredMap, setAnsweredMap] = useState<Record<string, {
    selectedOption: string | null;
    confidence: number;
    feedback: AttemptFeedback | null;
    biometricResult: any | null;
    activeTimeMs: number;
    selectedCausaErro?: string;
    naCordaBamba?: boolean;
    pensouContrario?: boolean;
  }>>({});

  // Parser inteligente para formatar enunciados de PDF de forma limpa e organizada
  const renderFormattedStatement = (statementText: string) => {
    if (!statementText) return null;

    // Detectar se o enunciado possui um comando de bloco no topo (separado por \n\n ou inline)
    const blockCommandRegex = /^(?:(?:Com rela[çc][ãa]o|A respeito|Acerca|No que se refere|No que tange|No que concerne|Considerando|Tendo em vista|Em rela[çc][ãa]o|Quanto [aà]|A partir d[oe]|Com base n[oe]|Em cada um dos itens|Julgue)[^\.]*?julgue\s+[^\.]*?[\.:])/i;

    const paragraphs = statementText.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
    let blockHeader: string | null = null;
    let mainStatement = statementText;

    if (paragraphs.length >= 2 && blockCommandRegex.test(paragraphs[0])) {
      blockHeader = paragraphs[0];
      mainStatement = paragraphs.slice(1).join('\n\n');
    } else {
      const matchInline = statementText.match(/^((?:(?:Com rela[çc][ãa]o|A respeito|Acerca|No que se refere|No que tange|No que concerne|Considerando|Tendo em vista|Em rela[çc][ãa]o|Quanto [aà]|A partir d[oe]|Com base n[oe]|Em cada um dos itens|Julgue)[^\.]*?julgue\s+[^\.]*?[\.:]))\s*([\s\S]+)$/i);
      if (matchInline) {
        blockHeader = matchInline[1].trim();
        mainStatement = matchInline[2].trim();
      }
    }

    const rawLines = mainStatement.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0 && !blockHeader) return null;

    const itemPattern = /^((?:[I|V|X|L]+|\d+|[a-eA-E])\s*[-–.)])\s*(.*)$/;
    const commandPattern = /^(estão\s+(?:corretas?|incorretas?|certas?|erradas?)|assinale\s+a\s+alternativa|qual\s+(?:das\s+afirmativas|é\s+a\s+alternativa)|a\s+respeito\s+d(?:o|a)s?\s+afirmativas?|quanto\s+a(?:os?)?\s+itens)/i;

    const elements: React.ReactNode[] = [];
    let currentParagraph = '';

    const flushParagraph = (key: string | number) => {
      if (currentParagraph) {
        const isCommand = commandPattern.test(currentParagraph) || currentParagraph.endsWith(':');
        elements.push(
          <p key={key} className={isCommand ? 'statement-command' : 'statement-paragraph'}>
            {currentParagraph}
          </p>
        );
        currentParagraph = '';
      }
    };

    rawLines.forEach((line, index) => {
      const itemMatch = line.match(itemPattern);
      const isCommand = commandPattern.test(line);

      if (itemMatch) {
        flushParagraph(`p-before-${index}`);
        elements.push(
          <div key={`item-${index}`} className="statement-item-card">
            <span className="statement-item-prefix">{itemMatch[1]}</span>
            <span className="statement-item-body">{itemMatch[2]}</span>
          </div>
        );
      } else if (isCommand) {
        flushParagraph(`p-before-cmd-${index}`);
        elements.push(
          <p key={`cmd-${index}`} className="statement-command">
            {line}
          </p>
        );
      } else {
        if (currentParagraph) {
          currentParagraph += ' ' + line;
        } else {
          currentParagraph = line;
        }
      }
    });

    flushParagraph('p-last');

    return (
      <div className="statement-blocks">
        {blockHeader && (
          <div className="statement-block-header">
            <div className="statement-block-tag">📌 Contexto / Comando do Bloco</div>
            <p className="statement-block-text">{blockHeader}</p>
          </div>
        )}
        <div className={blockHeader ? 'statement-block-space' : undefined}>
          {elements}
        </div>
      </div>
    );
  };

  // Estados Cognitivos Módulo 1, 2 e 3
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [brainDumpText, setBrainDumpText] = useState('');
  const [brainDumpSavedMsg, setBrainDumpSavedMsg] = useState('');
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [nextSessionHandoff, setNextSessionHandoff] = useState('');
  const [sessionActivityType, setSessionActivityType] = useState<'HE' | 'HRE'>('HE');

  // Pensar o Contrário (Galinsky & Mussweiler) e Na Corda Bamba
  const [pensarContrarioOpen, setPensarContrarioOpen] = useState(false);
  const [pensouContrario, setPensouContrario] = useState(false);
  const [naCordaBamba, setNaCordaBamba] = useState(false);

  // Desmembramento Lateral (Rascunho de Árvore Conceitual)
  const [showDesmembramento, setShowDesmembramento] = useState(false);
  const [desmembramentoText, setDesmembramentoText] = useState('');

  // Biometria da Decisão & Anti-Cheat (Detecção de Fraude Cognitiva e Dunning-Kruger)
  const [firstHoverMs, setFirstHoverMs] = useState<number | null>(null);
  const [optionSwitchCount, setOptionSwitchCount] = useState<number>(0);
  const [cursorTravelPx, setCursorTravelPx] = useState<number>(0);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
  const [biometricResult, setBiometricResult] = useState<{
    tempoLeituraMs: number;
    tempoHesitacaoMs: number;
    trocasCount: number;
    distanciaCursorPx: number;
    friccaoScore: number;
    chuteEducadoDetectado: boolean;
    fluenciaNeurologica: string;
  } | null>(null);

  // Auditoria de Erros Críticos (Feynman Constrangido Fail-Safe)
  const [feynmanAuditRequired, setFeynmanAuditRequired] = useState(false);
  const [feynmanAuditCompleted, setFeynmanAuditCompleted] = useState(false);
  const [pegadinhaExplicacao, setPegadinhaExplicacao] = useState('');
  const [regraCorretaExplicacao, setRegraCorretaExplicacao] = useState('');
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState('');

  // Colisão de Domínios Modal
  const [showCrossDomainModal, setShowCrossDomainModal] = useState(false);

  // 3. Roteamento Inteligente de Mídia & Bloqueio Cognitivo
  const [isCognitiveLockOpen, setIsCognitiveLockOpen] = useState(false);
  const [cognitiveLockResolved, setCognitiveLockResolved] = useState(false);
  const [mediaPrescription, setMediaPrescription] = useState<{
    veiculo: string;
    titulo: string;
    prescricaoTexto: string;
    categoriaDisciplina?: string;
    nivelFamiliaridade?: string;
    velocidadeSugerida?: string;
    blocoInicio?: number;
    blocoFim?: number;
    paginaSugerida?: number;
    errosConsecutivos?: number;
  } | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);

  // Simulado / Inoculação de Estresse (Chaos Engineering)
  const [simuladoConfig] = useState<any>(() => {
    try {
      const stored = sessionStorage.getItem('fiscalstudy_simulado_config');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeTimeMs, setActiveTimeMs] = useState<number>(0);
  const [lastFocusTime, setLastFocusTime] = useState<number>(0);

  // Timer contínuo de tempo ativo (garante milissegundos estritamente positivos para o motor em R)
  useEffect(() => {
    if (!sessionStarted || sessionEnded || !question || feedback) return;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveTimeMs((prev) => prev + 1000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStarted, sessionEnded, question, feedback]);

  // Atalho de Teclado Ctrl+D para Brain Dump e teclas 1-5 para Confiança
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setShowBrainDump((prev) => !prev);
        return;
      }

      // Evita disparar atalhos numéricos quando digitando em campos de texto
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl?.getAttribute('contenteditable') === 'true';
      if (isInput) return;

      if (!feedback && !pendingAttemptRef.current && prospectiveRef.current?.ready && prospectiveRef.current.questionId === question?.questionId && ['1', '2', '3', '4', '5'].includes(e.key)) {
        setConfidence(Number(e.key));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback, question?.questionId]);

  const handleSelectOption = (opt: string) => {
    if (feedback || pendingAttemptRef.current || !prospectiveRef.current?.ready || prospectiveRef.current.questionId !== question?.questionId) return;
    if (selectedOption && selectedOption !== opt) {
      setOptionSwitchCount((prev) => prev + 1);
      const fromLetter = selectedOption.match(/^([A-E])\)?/)?.[1] || selectedOption.charAt(0);
      const toLetter = opt.match(/^([A-E])\)?/)?.[1] || opt.charAt(0);
      fetch('/api/v1/cognitive/switch-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: question?.questionId,
          fromOption: fromLetter,
          toOption: toLetter,
          timeSpentSeconds: Math.round(activeTimeMs / 1000)
        })
      }).catch(() => {});
    }
    setSelectedOption(opt);
  };

  const handleSaveFeynmanAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || pegadinhaExplicacao.trim().length < 10 || regraCorretaExplicacao.trim().length < 10) return;
    setAuditSubmitting(true);
    try {
      const res = await fetch('/api/v1/cognitive/feynman-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.questionId,
          sessionId,
          selectedOption: selectedOption ? (selectedOption.match(/^([A-E])\)?/)?.[1] || selectedOption.charAt(0)) : 'A',
          pegadinhaExplicacao: pegadinhaExplicacao.trim(),
          regraCorretaExplicacao: regraCorretaExplicacao.trim()
        })
      });
      if (res.ok) {
        setFeynmanAuditCompleted(true);
        setAuditSuccessMsg('✅ Modelo mental consertado! Avanço desbloqueado.');
      }
    } catch (err) {
      console.error('Failed to submit Feynman audit:', err);
    } finally {
      setAuditSubmitting(false);
    }
  };

  const handleSaveBrainDump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brainDumpText.trim()) return;
    try {
      await fetch('/api/v1/cognitive/distractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          concursoId: selectedConcursoId,
          distractionText: brainDumpText.trim()
        })
      });
      setBrainDumpSavedMsg('Distração arquivada! Mente limpa para continuar.');
      setBrainDumpText('');
      setTimeout(() => {
        setBrainDumpSavedMsg('');
        setShowBrainDump(false);
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  };

  const confirmEndSessionWithHandoff = async () => {
    setShowHandoffModal(false);
    try {
      const totalSessionMs = sessionHistory.reduce((acc, i) => acc + (i.activeTimeMs || 0), 0) + (activeTimeMs || 0);
      const totalQ = sessionHistory.length > 0 ? sessionHistory.length : 1;
      const totalCorrect = sessionHistory.filter(i => i.isCorrect).length;
      const confSum = sessionHistory.reduce((acc, i) => acc + (i.confidenceLevel || 3), 0);
      const avgConf = totalQ > 0 ? Math.round((confSum / totalQ) * 10) / 10 : 3.0;

      await fetch('/api/v1/study-sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          concursoId: selectedConcursoId,
          disciplina: question?.metadata?.discipline || selectedDiscipline || 'Geral',
          topicoId: question?.metadata?.topic || selectedAssunto || 'Resolução de Questões',
          durationSeconds: Math.max(1, Math.round(totalSessionMs / 1000)),
          questoesFeitas: totalQ,
          questoesAcertadas: totalCorrect,
          rendimentoPercentual: Math.round((totalCorrect / totalQ) * 100),
          confiancaMedia: avgConf,
          activityType: sessionActivityType,
          nextSessionHandoff: nextSessionHandoff.trim()
        })
      });
    } catch (e) {
      console.error("Failed to record study session handoff", e);
    }
    endSession();
  };
  
  // Create or retrieve session ID with persistence across page reloads
  const generateNewSessionId = () => {
    const id = 'session-' + crypto.randomUUID();
    sessionStorage.setItem('fiscalstudy_sessionId', id);
    return id;
  };

  const getInitialSessionId = () => {
    let stored = sessionStorage.getItem('fiscalstudy_sessionId');
    if (!stored) {
      stored = generateNewSessionId();
    }
    return stored;
  };
  const [sessionId, setSessionId] = useState<string>(getInitialSessionId);
  submissionScopeRef.current = sessionId + '|' + (question?.questionId || '');

  // The answer controls unlock only after a separate pre-answer request has committed.
  useEffect(() => {
    if (!question || feedback) return;
    let active = true;
    let intent = prospectiveRef.current;
    if (!intent || intent.questionId !== question.questionId || intent.sessionId !== sessionId) {
      try { intent = new ProspectivePreparation(question.questionId, sessionId); }
      catch { setProspectiveStatus('ERROR'); return; }
      prospectiveRef.current = intent;
    }
    setProspectiveStatus('PREPARING');
    intent.prepare().then(() => {
      if (!active) return;
      const saved = readAttemptJournal(question.questionId, sessionId);
      if (saved?.payload) {
        pendingAttemptRef.current = new AttemptSubmission(saved.payload, saved.attemptId);
        const letter = String(saved.payload.selectedOption);
        const options = question.options.map(o => typeof o === 'string' ? o : (o.label + ') ' + o.text));
        const restored = options.find(o => o.startsWith(letter)) ||
          (options.length === 2 && (letter === 'C' || letter === 'E') ? options[letter === 'C' ? 0 : 1] : letter);
        setSelectedOption(restored); setConfidence(Number(saved.payload.confidenceLevel));
        setActiveTimeMs(Number(saved.payload.activeTimeMs));
      }
      if (intent.recoveredResult) setFeedback(intent.recoveredResult);
      setProspectiveStatus('READY');
    })
      .catch(() => { if (active) setProspectiveStatus('ERROR'); });
    return () => { active = false; };
  }, [question?.questionId, sessionId, feedback, prospectiveRetry]);

  const prospectiveReady = prospectiveStatus === 'READY' &&
    prospectiveRef.current?.questionId === question?.questionId &&
    prospectiveRef.current?.sessionId === sessionId && prospectiveRef.current.ready;


  // Carrega Concursos e Disciplinas disponíveis
  useEffect(() => {
    fetch('/api/v1/concursos')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ConcursoOption[]) => {
        setConcursos(data || []);
        if (!selectedConcursoId && data && data.length > 0) {
          setSelectedConcursoId(data[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/v1/questions/disciplines')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDisciplines(data || []))
      .catch(() => {});
  }, [selectedConcursoId]);

  // Carrega Assuntos dinamicamente quando a disciplina mudar
  useEffect(() => {
    if (selectedDiscipline) {
      fetch(`/api/v1/questions/assuntos?disciplina=${encodeURIComponent(selectedDiscipline)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setAssuntos(data || []))
        .catch(() => setAssuntos([]));
    } else {
      setAssuntos([]);
      setSelectedAssunto('');
    }
  }, [selectedDiscipline]);

  const resetQuestionInteractions = () => {
    pendingAttemptRef.current = null;
    prospectiveRef.current = null;
    setProspectiveStatus('PREPARING');
    setProspectiveRetry(value => value + 1);
    submittingRef.current = false;
    setFeedback(null);
    setSelectedOption(null);
    setConfidence(0);
    setIsSubmitting(false);
    setSelectedCausaErro('');
    setPensarContrarioOpen(false);
    setPensouContrario(false);
    setNaCordaBamba(false);
    setShowDesmembramento(false);
    setDesmembramentoText('');
    setFirstHoverMs(null);
    setOptionSwitchCount(0);
    setCursorTravelPx(0);
    setLastMousePos(null);
    setBiometricResult(null);
    setFeynmanAuditRequired(false);
    setFeynmanAuditCompleted(false);
    setIsCognitiveLockOpen(false);
    setCognitiveLockResolved(false);
    setPegadinhaExplicacao('');
    setRegraCorretaExplicacao('');
    setAuditSuccessMsg('');
  };

  const loadQuestionAtIndex = useCallback((idx: number, list: Question[] = sessionQuestions, targetSessionId = sessionId) => {
    const targetQ = list[idx];
    if (!targetQ) return;

    resetQuestionInteractions();
    saveQuestionSession(targetSessionId, list, idx);
    setQuestion(targetQ);
    setCurrentQuestionIndex(idx);

    const saved = answeredMap[targetQ.questionId];
    if (saved) {
      setSelectedOption(saved.selectedOption);
      setConfidence(saved.confidence);
      setFeedback(saved.feedback);
      setBiometricResult(saved.biometricResult);
      setSelectedCausaErro(saved.selectedCausaErro || '');
      setNaCordaBamba(!!saved.naCordaBamba);
      setPensouContrario(!!saved.pensouContrario);
      setActiveTimeMs(saved.activeTimeMs || 0);
      setLastFocusTime(Date.now());
    } else {
      setActiveTimeMs(0);
      setLastFocusTime(Date.now());
      fetch(`/api/v1/questions/${targetQ.questionId}/presented`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: targetSessionId })
      }).catch(() => {});
    }

    fetch(`/api/v1/cognitive/media-routing/evaluate?disciplina=${encodeURIComponent(targetQ.metadata?.discipline || '')}&assunto=${encodeURIComponent(targetQ.metadata?.topic || '')}&sessionId=${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((presc) => {
        if (presc) setMediaPrescription(presc);
      })
      .catch(() => {});
  }, [sessionQuestions, answeredMap, sessionId]);

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      if (question) {
        const spentNow = Math.max(1000, activeTimeMs + (document.visibilityState === 'visible' && lastFocusTime > 0 ? (Date.now() - lastFocusTime) : 0));
        setAnsweredMap(prev => ({
          ...prev,
          [question.questionId]: {
            selectedOption,
            confidence,
            feedback,
            biometricResult,
            activeTimeMs: spentNow,
            selectedCausaErro,
            naCordaBamba,
            pensouContrario
          }
        }));
      }
      loadQuestionAtIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < sessionQuestions.length - 1) {
      if (question) {
        const spentNow = Math.max(1000, activeTimeMs + (document.visibilityState === 'visible' && lastFocusTime > 0 ? (Date.now() - lastFocusTime) : 0));
        setAnsweredMap(prev => ({
          ...prev,
          [question.questionId]: {
            selectedOption,
            confidence,
            feedback,
            biometricResult,
            activeTimeMs: spentNow,
            selectedCausaErro,
            naCordaBamba,
            pensouContrario
          }
        }));
      }
      loadQuestionAtIndex(currentQuestionIndex + 1);
    }
  };

  const handleJumpToQuestion = (targetIdx: number) => {
    if (targetIdx >= 0 && targetIdx < sessionQuestions.length && targetIdx !== currentQuestionIndex) {
      if (question) {
        const spentNow = Math.max(1000, activeTimeMs + (document.visibilityState === 'visible' && lastFocusTime > 0 ? (Date.now() - lastFocusTime) : 0));
        setAnsweredMap(prev => ({
          ...prev,
          [question.questionId]: {
            selectedOption,
            confidence,
            feedback,
            biometricResult,
            activeTimeMs: spentNow,
            selectedCausaErro,
            naCordaBamba,
            pensouContrario
          }
        }));
      }
      loadQuestionAtIndex(targetIdx);
    }
  };

  const fetchNextQuestion = useCallback(async (overrideSessionId?: string) => {
    const currentSession = overrideSessionId || sessionId;
    setLoading(true);
    resetQuestionInteractions();

    try {
      const recovered = restoreQuestionSession(currentSession);
      if (recovered) {
        setSessionQuestions(recovered.questions);
        loadQuestionAtIndex(recovered.index, recovered.questions, currentSession);
        return;
      }
      let batchUrl = `/api/v1/questions/batch?sessionId=${currentSession}&limit=${questionCountLimit || 15}`;
      if (selectedConcursoId) batchUrl += `&concursoId=${encodeURIComponent(selectedConcursoId)}`;
      if (selectedDiscipline) batchUrl += `&disciplina=${encodeURIComponent(selectedDiscipline)}`;
      if (selectedAssunto) batchUrl += `&assunto=${encodeURIComponent(selectedAssunto)}`;
      if (includeAnswered) batchUrl += `&includeAnswered=true`;

      const response = await fetch(batchUrl);
      if (response.ok) {
        const batchData = await response.json();
        if (Array.isArray(batchData) && batchData.length > 0) {
          setSessionQuestions(batchData);
          setCurrentQuestionIndex(0);
          loadQuestionAtIndex(0, batchData, currentSession);
          return;
        }
      }

      // Fallback para /next caso /batch retorne vazio
      const nextRes = await fetch(`/api/v1/questions/next?sessionId=${currentSession}${selectedConcursoId ? `&concursoId=${encodeURIComponent(selectedConcursoId)}` : ''}`);
      if (nextRes.ok) {
        const singleQ = await nextRes.json();
        setSessionQuestions([singleQ]);
        setCurrentQuestionIndex(0);
        loadQuestionAtIndex(0, [singleQ], currentSession);
      } else {
        setQuestion(null);
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedConcursoId, selectedDiscipline, selectedAssunto, includeAnswered, questionCountLimit, loadQuestionAtIndex]);

  useEffect(() => {
    if (sessionStarted && !question && !sessionEnded) {
      const timer = setTimeout(() => {
        fetchNextQuestion();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sessionStarted, question, sessionEnded, fetchNextQuestion]);

  const startSession = async () => {
    try {
      const freshSessionId = generateNewSessionId();
      setSessionId(freshSessionId);
      await fetch(`/api/v1/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: freshSessionId })
      });
      sessionStorage.setItem('fiscalstudy_sessionStarted', 'true');
      setSessionStarted(true);
      fetchNextQuestion(freshSessionId);
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  // Se o usuário clicou em 'Resolver Questões Deste Tópico' no edital verticalizado, inicia direto
  useEffect(() => {
    const autoStart = sessionStorage.getItem('fiscalstudy_auto_start');
    if (autoStart === 'true') {
      sessionStorage.removeItem('fiscalstudy_auto_start');
      startSession();
    }
  }, []);

  const endSession = async () => {
    try {
      // 1. Auto-submissão da questão ativa se houver alternativa e confiança marcadas
      if (question && selectedOption && confidence > 0 && !feedback && !isSubmitting) {
        await handleSubmit();
      }

      // 2. Finaliza no backend
      await fetch(`/api/v1/sessions/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      // 3. Obtém o resumo consolidado do backend
      let summaryData: SessionSummary | null = null;
      try {
        const res = await fetch(`/api/v1/sessions/${sessionId}/summary`);
        if (res.ok) {
          summaryData = await res.json();
        }
      } catch (e) {
        console.error("Erro ao obter resumo do backend:", e);
      }
      
      // 4. Reconciliação Cognitiva:
      // Se summaryData for nulo ou totalAnswered === 0 mas houver histórico de respostas,
      // calculamos os dados a partir do histórico para blindar a exibição contra latência de banco.
      if (!summaryData || summaryData.totalAnswered === 0) {
        let history = [...sessionHistory];
        if (question && selectedOption && feedback?.attemptId && confidence > 0 && !history.some(h => h.questionId === question.questionId)) {
          const isCE = Array.isArray(question.options) && question.options.length === 2;
          let optLetter = selectedOption.match(/^([A-Ea-e])\)?/)?.[1]?.toUpperCase() || selectedOption.charAt(0).toUpperCase();
          if (isCE) {
            if (selectedOption.toUpperCase().includes('CERT') || optLetter === 'C' || optLetter === 'A') optLetter = 'C';
            else if (selectedOption.toUpperCase().includes('ERR') || optLetter === 'E' || optLetter === 'B') optLetter = 'E';
          }
          history.push({
            attemptId: feedback.attemptId,
            questionId: question.questionId,
            statement: question.statement,
            discipline: question.metadata?.discipline || selectedDiscipline || 'Geral',
            topic: question.metadata?.topic || '',
            board: question.metadata?.board || 'Banca',
            year: question.metadata?.year || 2024,
            options: [],
            selectedOption: optLetter,
            isCorrect: feedback.isCorrect,
            gabaritoStatus: feedback?.gabaritoStatus || 'DEFINITIVO',
            concursoPoint: feedback.concursoPoint,
            confidenceLevel: confidence,
            activeTimeMs: Math.max(1200, activeTimeMs),
            tempoHesitacaoMs: 0,
            trocasCount: optionSwitchCount,
            friccaoScore: 0.1,
            chuteEducadoDetectado: false,
            fluenciaNeurologica: 'ALTA_FLUENCIA',
            causaErro: selectedCausaErro || '',
            naCordaBamba,
            pensouContrario
          });
        }

        if (history.length > 0) {
          const totalAns = history.length;
          const corrects = history.filter(i => i.isCorrect).length;
          const totalMs = history.reduce((acc, i) => acc + (i.activeTimeMs || 0), 0);
          const overconf = history.filter(i => i.confidenceLevel === 5 && !i.isCorrect).length;
          const anuladas = history.filter(i => i.gabaritoStatus === 'ANULADA').length;
          const nonAnuladas = history.filter(i => i.gabaritoStatus !== 'ANULADA');
          const nonAnuladasCorrect = nonAnuladas.filter(i => i.isCorrect).length;
          const accuracy = nonAnuladas.length > 0 ? (nonAnuladasCorrect / nonAnuladas.length) * 100 : 0;
          
          summaryData = {
            totalAnswered: totalAns,
            correctCount: corrects,
            accuracy,
            averageTimeMs: totalAns > 0 ? (totalMs / totalAns) : 0,
            overconfidenceCount: overconf,
            concursoScore: corrects + anuladas,
            anuladasCount: anuladas
          };
        }
      }

      setSummary(summaryData);
      sessionStorage.removeItem('fiscalstudy_sessionStarted');
      sessionStorage.removeItem('fiscalstudy_sessionId');
      setSessionEnded(true);
    } catch (err) {
      console.error("Failed to end session", err);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!sessionStarted || sessionEnded) return;
      
      if (document.visibilityState === 'hidden') {
        if (lastFocusTime > 0) {
          setActiveTimeMs(prev => prev + (Date.now() - lastFocusTime));
        }
      } else {
        setLastFocusTime(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lastFocusTime, sessionStarted, sessionEnded]);

  const handleSubmit = async () => {
    if (!question || !selectedOption || confidence === 0 || isSubmitting || submittingRef.current || feedback || !prospectiveReady) return;
    const submissionScope = submissionScopeRef.current;
    submittingRef.current = true;
    setIsSubmitting(true);

    let finalActiveTime = Math.max(1200, activeTimeMs);
    if (document.visibilityState === 'visible' && lastFocusTime > 0) {
      const elapsed = Date.now() - lastFocusTime;
      if (elapsed > 0 && elapsed < 7200000) {
        finalActiveTime = Math.max(1200, activeTimeMs + elapsed);
      }
    }
    
    if (pendingAttemptRef.current) finalActiveTime = Number(pendingAttemptRef.current.payload.activeTimeMs);

    // Identificar questões de Certo ou Errado (Cebraspe)
    const isCE = Array.isArray(question.options) && question.options.length === 2;

    let optionLetter = selectedOption.match(/^([A-Ea-e])\)?/)?.[1]?.toUpperCase() || selectedOption.charAt(0).toUpperCase();
    if (isCE) {
      if (selectedOption.toUpperCase().includes('CERT') || optionLetter === 'C' || optionLetter === 'A') {
        optionLetter = 'C';
      } else if (selectedOption.toUpperCase().includes('ERR') || optionLetter === 'E' || optionLetter === 'B') {
        optionLetter = 'E';
      }
    }

    // Cálculo da Biometria da Decisão (Anti-Cheat Cognitivo):
    const finalLeituraMs = firstHoverMs !== null ? firstHoverMs : finalActiveTime;
    const finalHesitacaoMs = Math.max(0, finalActiveTime - finalLeituraMs);
    const ratioHesitacao = finalActiveTime > 0 ? (finalHesitacaoMs / finalActiveTime) : 0;
    const switchPenalty = Math.min(0.5, optionSwitchCount * 0.25);
    const frictionScore = Math.min(1.0, Math.max(0.0, (ratioHesitacao * 0.5) + switchPenalty));
    const isChute = frictionScore > 0.65 || (confidence >= 4 && optionSwitchCount >= 2);
    const fluencia = frictionScore < 0.25 ? 'ALTA_FLUENCIA' : (frictionScore < 0.65 ? 'FRICCAO_MODERADA' : 'CHUTE_EDUCADO_PROVAVEL');

    const bioPayload = {
      tempoLeituraMs: finalLeituraMs,
      tempoHesitacaoMs: finalHesitacaoMs,
      trocasOpcaoCount: optionSwitchCount,
      distanciaCursorPx: Math.round(cursorTravelPx),
      friccaoCognitivaScore: Math.round(frictionScore * 1000) / 1000,
      chuteEducadoDetectado: isChute,
      fluenciaNeurologica: fluencia
    };

    setBiometricResult({
      tempoLeituraMs: finalLeituraMs,
      tempoHesitacaoMs: finalHesitacaoMs,
      trocasCount: optionSwitchCount,
      distanciaCursorPx: Math.round(cursorTravelPx),
      friccaoScore: frictionScore,
      chuteEducadoDetectado: isChute,
      fluenciaNeurologica: fluencia
    });

    const hasApoio = Boolean(question.metadata?.supportMaterial && showSupportMaterial);
    const currentIntervention = naCordaBamba 
      ? 'NA_CORDA_BAMBA' 
      : (pensouContrario ? 'PENSAR_CONTRARIO' : (studyMode === 'EMERGENCY' ? 'BLOCO_EMERGENCIA_15MIN' : 'REGULAR'));

    try {
      pendingAttemptRef.current ??= new AttemptSubmission({
          selectedOption: optionLetter,
          confidenceLevel: confidence,
          activeTimeMs: finalActiveTime,
          sessionId,
          causaErro: selectedCausaErro || undefined,
          naCordaBamba: naCordaBamba,
          pensouContrario: pensouContrario,
          usedHelp: hasApoio,
          helpType: hasApoio ? 'MATERIAL_APOIO' : 'NENHUM',
          interventionType: currentIntervention,
          origin: 'REAL_STUDY',
          ...bioPayload
        }, prospectiveRef.current!.attemptId);
      const result = await pendingAttemptRef.current.send(question.questionId);
      if (submissionScopeRef.current !== submissionScope) return;
      {
        setFeedback(result);

        const currentOptions = Array.isArray(question.options) 
          ? (typeof question.options[0] === 'string' ? (question.options as string[]) : (question.options as Option[]).map(o => `${o.label}) ${o.text}`))
          : [];

        // Interaction heuristics and confidence do not establish an error's cause.
        const defaultCausa = '';

        const historyItem: SessionAttemptHistoryItem = {
          attemptId: result.attemptId,
          questionId: question.questionId,
          statement: question.statement,
          discipline: question.metadata?.discipline || 'Geral',
          topic: question.metadata?.topic || '',
          board: question.metadata?.board || 'Banca',
          year: question.metadata?.year || 2023,
          options: currentOptions,
          selectedOption: optionLetter,
          isCorrect: result.isCorrect,
          gabaritoStatus: result.gabaritoStatus,
          concursoPoint: result.concursoPoint,
          confidenceLevel: confidence,
          activeTimeMs: finalActiveTime,
          tempoHesitacaoMs: finalHesitacaoMs,
          trocasCount: optionSwitchCount,
          friccaoScore: frictionScore,
          chuteEducadoDetectado: isChute,
          fluenciaNeurologica: fluencia,
          causaErro: selectedCausaErro || defaultCausa,
          naCordaBamba,
          pensouContrario
        };

        setSessionHistory(prev => {
          const filtered = prev.filter(item => item.questionId !== question.questionId);
          return [...filtered, historyItem];
        });

        setAnsweredMap(prev => ({
          ...prev,
          [question.questionId]: {
            selectedOption: optionLetter,
            confidence,
            feedback: result,
            biometricResult: bioPayload,
            activeTimeMs: finalActiveTime,
            selectedCausaErro: selectedCausaErro || defaultCausa,
            naCordaBamba,
            pensouContrario
          }
        }));

        if (result.isCorrect === false) {
          setFeynmanAuditRequired(true);
          setFeynmanAuditCompleted(false);
          if (result.bloqueioCognitivo || (result.errosConsecutivos && result.errosConsecutivos >= 3)) {
            setIsCognitiveLockOpen(true);
            setCognitiveLockResolved(false);
          }
        }
      }
    } catch (error) {
      if (submissionScopeRef.current !== submissionScope) return;
      console.error("Failed to submit attempt:", error);
      alert("Não foi possível confirmar a gravação. Reenvie a mesma tentativa. " + (error instanceof Error ? error.message : ""));
    } finally {
      if (submissionScopeRef.current === submissionScope) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  // Envia ou atualiza a causa do erro pós-feedback se o estudante selecionar (suporta ID da questão do histórico)
  const handleSelectCausaErroPostSubmission = async (code: string, targetQuestionId?: string) => {
    const qId = targetQuestionId || question?.questionId;
    const targetItem = sessionHistory.find(i => i.questionId === qId);
    const attemptId = targetItem?.attemptId || feedback?.attemptId;
    if (!qId || !attemptId) return;
    try {
      await annotateAttempt(qId, attemptId, sessionId, code);
      if (qId === question?.questionId) setSelectedCausaErro(code);
      setSessionHistory(prev => prev.map(item => item.attemptId === attemptId ? { ...item, causaErro: code } : item));
      setAnsweredMap(prev => prev[qId] ? { ...prev, [qId]: { ...prev[qId], selectedCausaErro: code } } : prev);
    } catch (error) {
      alert('A anotação não foi salva: ' + (error instanceof Error ? error.message : 'falha de conexão'));
    }
  };

  // TELA 1: Configuração Personalizada da Sessão (Fase 8)
  if (!sessionStarted) {
    return (
      <div className="viewer-container empty">
        <div className="glass session-config-card">
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h2 style={{ color: 'var(--text-color)', margin: 0, fontSize: '1.45rem', fontWeight: 700 }}>⚙️ Nova Sessão de Estudo Personalizada</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0 0', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Defina o foco pedagógico, concurso-alvo e filtros temáticos para iniciar:
            </p>
          </div>

          <div className="session-config-grid">
            {/* Concurso Alvo */}
            <div className="form-group">
              <label>Concurso / Cargo Alvo</label>
              <select
                className="form-control"
                value={selectedConcursoId}
                onChange={(e) => setSelectedConcursoId(e.target.value)}
              >
                <option value="">Todos os Concursos (Geral)</option>
                {concursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.cargo || c.orgao})
                  </option>
                ))}
              </select>
            </div>

            {/* Disciplina */}
            <div className="form-group">
              <label>Disciplina</label>
              <select
                className="form-control"
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
              >
                <option value="">Todas as Disciplinas</option>
                {disciplines.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="session-config-grid">
            {/* Assunto */}
            <div className="form-group">
              <label>Assunto / Tópico Programático</label>
              <select
                className="form-control"
                value={selectedAssunto}
                onChange={(e) => setSelectedAssunto(e.target.value)}
                disabled={!selectedDiscipline || assuntos.length === 0}
              >
                <option value="">Todos os Assuntos</option>
                {assuntos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade de Questões */}
            <div className="form-group">
              <label>Meta de Questões</label>
              <select
                className="form-control"
                value={questionCountLimit}
                onChange={(e) => setQuestionCountLimit(Number(e.target.value))}
              >
                {![5, 10, 20, 50].includes(questionCountLimit) && <option value={questionCountLimit}>{questionCountLimit} Questões (Preferência pessoal)</option>}
                <option value={5}>5 Questões (Sessão Rápida)</option>
                <option value={10}>10 Questões (Padrão)</option>
                <option value={20}>20 Questões (Aprofundamento)</option>
                <option value={50}>50 Questões (Simulado Extenso)</option>
              </select>
            </div>
          </div>

          {/* Modo de Estudo */}
          <div className="form-group">
            <label>Modo de Estudo Pedagógico</label>
            <div className="mode-selector">
              <button
                type="button"
                className={`mode-btn ${studyMode === 'LEARNING' ? 'active' : ''}`}
                onClick={() => setStudyMode('LEARNING')}
              >
                📘 Treino (Gabarito na Hora)
              </button>
              <button
                type="button"
                className={`mode-btn ${studyMode === 'EXAM' ? 'active' : ''}`}
                onClick={() => setStudyMode('EXAM')}
              >
                ⏱️ Simulado (Gabarito no Final)
              </button>
              <button
                type="button"
                className={`mode-btn ${studyMode === 'RETENTION' ? 'active' : ''}`}
                onClick={() => setStudyMode('RETENTION')}
              >
                🔄 Foco em Dificuldades (Revisão Inteligente)
              </button>
            </div>
          </div>

          {/* Opções Avançadas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="includeAnswered"
              checked={includeAnswered}
              onChange={(e) => setIncludeAnswered(e.target.checked)}
              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
            />
            <label htmlFor="includeAnswered" style={{ color: 'var(--text-color)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 }}>
              Incluir questões já respondidas anteriormente neste concurso
            </label>
          </div>

          <button className="btn" onClick={startSession} style={{ marginTop: '0.75rem', padding: '12px 20px', fontSize: '1rem' }}>
            🚀 Iniciar Sessão de Estudo
          </button>
        </div>
      </div>
    );
  }

  // TELA 2: Relatório Final da Sessão (T22 — Relatório da Sessão de Questões)
  if (sessionEnded) {
    if (sessionHistory.length > 0) {
      const solvedQuestions: SolvedQuestionItem[] = sessionHistory.map(item => ({
        questionId: item.questionId,
        statement: item.statement,
        discipline: item.discipline,
        topic: item.topic,
        board: item.board,
        year: item.year,
        userSelectedOption: item.selectedOption,
        correctOption: (answeredMap[item.questionId]?.feedback as any)?.correctOption || (item.isCorrect ? item.selectedOption : undefined),
        isCorrect: item.isCorrect,
        gabaritoStatus: item.gabaritoStatus || 'DEFINITIVO',
        confidenceLevel: item.confidenceLevel,
        activeTimeMs: item.activeTimeMs,
        causaErro: item.causaErro,
        explicacao: (answeredMap[item.questionId]?.feedback as any)?.explicacao || 'Resolução fundamentada com base no edital e jurisprudência.'
      }));

      return (
        <RelatorioSessaoQuestoes
          tituloSessao={`Relatório da Sessão — ${question?.metadata?.discipline || selectedDiscipline || 'Estudo Ativo'}`}
          modoResolucao={studyMode}
          questions={solvedQuestions}
          onVoltarAoInicio={() => {
            const newId = generateNewSessionId();
            setSessionId(newId);
            setSessionEnded(false);
            setSessionStarted(false);
            setQuestion(null);
            setSummary(null);
            setSessionHistory([]);
            setAnsweredMap({});
            setSessionQuestions([]);
            setCurrentQuestionIndex(0);
          }}
          onIniciarRecuperacao={() => {
            setSessionEnded(false);
          }}
        />
      );
    }

    return (
      <div className="viewer-container empty">
        <div className="glass empty-state" style={{ maxWidth: '920px', width: '100%', padding: '2.25rem' }}>
          <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>📊 Relatório Final da Sessão de Estudo</span>
            <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
              Sessão: {sessionId.slice(0, 16)}...
            </span>
          </h2>
          {summary ? (
            <div style={{ textAlign: 'left', fontSize: '1rem' }}>
              <div className="summary-score-banner">
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Pontuação Oficial Concurso</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>
                    {summary.concursoScore ?? summary.correctCount} / {summary.totalAnswered}
                  </div>
                  <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Inclui pontos de anuladas pelas regras da banca</small>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Acurácia Pedagógica Real</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: summary.accuracy >= 70 ? '#34d399' : '#fbbf24' }}>
                    {summary.accuracy.toFixed(1)}%
                  </div>
                  <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Exclui questões anuladas (evidência de domínio puro)</small>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                  <span>Questões Respondidas:</span> <strong>{summary.totalAnswered}</strong>
                </p>
                <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                  <span>Acertos Efetivos:</span> <strong>{summary.correctCount}</strong>
                </p>
                {summary.anuladasCount !== undefined && summary.anuladasCount > 0 && (
                  <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, color: '#fbbf24' }}>
                    <span>Questões Anuladas:</span> <strong>{summary.anuladasCount}</strong>
                  </p>
                )}
                <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                  <span>Tempo Médio por Questão:</span> <strong>{(summary.averageTimeMs / 1000).toFixed(1)}s</strong>
                </p>
              </div>

              {/* Ponto de Atenção: Certeza no Erro */}
              {summary.overconfidenceCount > 0 && (
                <div style={{ marginTop: '15px', padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
                  <h4 style={{ color: '#f87171', margin: '0 0 6px 0', fontSize: '0.92rem' }}>⚠️ Ponto de Atenção: Certeza no Erro</h4>
                  <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.45', color: '#fecaca' }}>
                    Você marcou com 100% de certeza em <strong>{summary.overconfidenceCount}</strong> questão(ões) que estavam incorretas. Vale a pena revisar esses tópicos com calma para evitar pegadinhas semelhantes no concurso.
                  </p>
                </div>
              )}

              {/* Revisão Detalhada Questão a Questão */}
              {sessionHistory.length > 0 && (
                <div className="metacon-audit-section">
                  <div className="metacon-audit-title-wrap">
                    <h3 className="metacon-audit-title">
                      <span>🔍</span> Revisão Questão a Questão
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600 }}>
                      {sessionHistory.length} questão(ões) resolvida(s)
                    </span>
                  </div>
                  <p className="metacon-audit-sub">
                    O autodiagnóstico honesto é a chave da aprovação: classifique o motivo real de cada resposta ("sabia, mas confundi", "chute educado", "lacuna teórica") para calibrar o Gêmeo Digital e evitar ilusão de competência.
                  </p>

                  {/* Quadro Resumo de Sinceridade */}
                  <div className="metacon-summary-pills">
                    <span className="metacon-count-pill" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}>
                      🟢 Convicção Plena: {sessionHistory.filter(i => i.causaErro === 'SABIA_COM_CONVICCAO').length}
                    </span>
                    <span className="metacon-count-pill" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
                      🟡 Chute Educado: {sessionHistory.filter(i => i.causaErro === 'CHUTE_EDUCADO').length}
                    </span>
                    <span className="metacon-count-pill" style={{ borderColor: 'rgba(251, 146, 60, 0.4)', color: '#fdba74' }}>
                      🟠 Sabia, mas confundi: {sessionHistory.filter(i => i.causaErro === 'SABIA_MAS_CONFUNDI').length}
                    </span>
                    <span className="metacon-count-pill" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
                      🔴 Lacuna Teórica: {sessionHistory.filter(i => i.causaErro === 'NAO_SABIA_MATERIA').length}
                    </span>
                    <span className="metacon-count-pill" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: '#d8b4fe' }}>
                      🟣 Falta de Atenção: {sessionHistory.filter(i => i.causaErro === 'FALTA_ATENCAO').length}
                    </span>
                  </div>

                  {/* Lista de Questões da Sessão */}
                  <div className="metacon-questions-list">
                    {sessionHistory.map((item, idx) => {
                      const isUnverified = item.gabaritoStatus === 'AUSENTE' || item.gabaritoStatus === 'SOB_REVISAO';
                      const isAnulada = item.gabaritoStatus === 'ANULADA';

                      return (
                        <div key={item.questionId || idx} className="metacon-question-card animate-fade-in">
                          <div className="metacon-q-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className="metacon-q-num">Questão #{idx + 1}</span>
                              <span className={`metacon-q-status ${isAnulada ? 'correct' : (isUnverified ? '' : (item.isCorrect ? 'correct' : 'incorrect'))}`}>
                                {isAnulada ? '⚠️ Anulada' : isUnverified ? 'ℹ️ Em Revisão' : (item.isCorrect ? '✅ Acertou' : '❌ Errou')}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              Confiança Registrada: <strong>{item.confidenceLevel}/5</strong> ({item.confidenceLevel === 5 ? 'Certeza' : (item.confidenceLevel === 4 ? 'Seguro' : (item.confidenceLevel === 3 ? 'Parcial' : (item.confidenceLevel === 2 ? 'Dúvida' : 'Chute')))})
                            </span>
                          </div>

                          <div className="metacon-q-meta">
                            <span>🏛️ {item.board} {item.year}</span>
                            <span>•</span>
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{item.discipline}</span>
                            {item.topic && <span>› {item.topic}</span>}
                          </div>

                          <div className="metacon-q-snippet">
                            <div style={{ marginBottom: '0.4rem', fontWeight: 500, color: '#f1f5f9' }}>
                              {item.statement.length > 220 ? `${item.statement.slice(0, 220)}...` : item.statement}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                              Sua resposta: <strong style={{ color: item.isCorrect ? '#34d399' : '#f87171' }}>Alternativa {item.selectedOption}</strong>
                            </div>
                          </div>

                          {/* Telemetria Antifraude Comportamental da Questão */}
                          <div className="metacon-telemetry-strip">
                            <span>⏱️ Tempo: <strong>{(item.activeTimeMs / 1000).toFixed(1)}s</strong></span>
                            <span>•</span>
                            <span>⏳ Hesitação: <strong>{(item.tempoHesitacaoMs / 1000).toFixed(1)}s</strong></span>
                            <span>•</span>
                            <span>🔄 Trocas de Alternativa: <strong>{item.trocasCount}</strong></span>
                            <span>•</span>
                            <span className={`biometric-badge ${item.fluenciaNeurologica}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                              {item.chuteEducadoDetectado 
                                ? '⚠️ Chute Educado Detectado' 
                                : (item.fluenciaNeurologica === 'ALTA_FLUENCIA' 
                                    ? (isSimplifiedMode ? '⚡ Resposta Confiante' : '⚡ Alta Fluência') 
                                    : (isSimplifiedMode ? '🔍 Análise Cuidadosa' : '🔍 Fricção Moderada'))}
                            </span>
                          </div>

                          {/* Seletor de Feedback Metacognitivo Sincero */}
                          <div>
                            <span className="metacon-selector-title">
                              {isSimplifiedMode 
                                ? '🎯 Como você se sentiu nesta questão? (Clique para ajustar):' 
                                : '🎯 Classificação de Sinceridade Metacognitiva (Clique para ajustar):'}
                            </span>
                            <div className="metacon-options-grid">
                              {METACON_FEEDBACK_OPTIONS.map((opt) => {
                                const isSelected = item.causaErro === opt.code;
                                return (
                                  <button
                                    key={opt.code}
                                    type="button"
                                    className={`metacon-pill-btn ${isSelected ? 'active' : ''}`}
                                    style={isSelected ? { borderColor: opt.badgeColor, background: `${opt.badgeColor}25` } : undefined}
                                    onClick={() => handleSelectCausaErroPostSubmission(opt.code, item.questionId)}
                                    title={opt.description}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Diagnósticos de Calibração Sincera */}
                          {item.confidenceLevel === 5 && item.isCorrect === false && (
                            <div className="metacon-alert-box warning">
                              ⚠️ <strong>Ponto de Atenção (Certeza no Erro):</strong> Você assinalou certeza máxima (nível 5), mas errou o item. Vale a pena revisar com calma a regra para não cair nessa pegadinha de novo.
                            </div>
                          )}

                          {item.isCorrect && item.chuteEducadoDetectado && item.causaErro === 'CHUTE_EDUCADO' && (
                            <div className="metacon-alert-box info">
                              🎯 <strong>Bom Autodiagnóstico:</strong> Você reconheceu que acertou por eliminação/chute. A questão voltará no momento certo para fixar o conteúdo.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                className="btn"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={() => {
                  const newId = generateNewSessionId();
                  setSessionId(newId);
                  setSessionEnded(false);
                  setSessionStarted(false);
                  setQuestion(null);
                  setSummary(null);
                  setSessionHistory([]);
                  setAnsweredMap({});
                  setSessionQuestions([]);
                  setCurrentQuestionIndex(0);
                }}
              >
                🔄 Configurar Nova Sessão
              </button>
            </div>
          ) : (
            <p>Carregando resumo analítico...</p>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="viewer-container loading">
        <div className="spinner"></div>
        <p>Buscando questão adaptativa...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="viewer-container empty">
        <div className="glass empty-state">
          <h2>Nenhuma questão disponível para estes filtros{selectedDiscipline ? ` (${selectedDiscipline})` : ''}</h2>
          <p style={{ color: '#94a3b8', margin: '0.75rem 0 1.5rem' }}>
            Não há questões cadastradas para os critérios selecionados ou todas já foram respondidas.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => {
              setSessionStarted(false);
              sessionStorage.removeItem('fiscalstudy_sessionStarted');
            }}>
              ⚙️ Ajustar Filtros
            </button>
            <button className="btn btn-secondary" onClick={endSession}>
              📊 Encerrar Sessão
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCertoErrado = Array.isArray(question.options) && question.options.length === 2;

  let optionsList: string[] = [];
  if (Array.isArray(question.options)) {
    if (typeof question.options[0] === 'string') {
      optionsList = [...(question.options as string[])];
    } else {
      optionsList = (question.options as Option[]).map((o: Option) => `${o.label}) ${o.text}`);
    }
    if (isCertoErrado) {
      // Garante que a 1ª seja C) CERTO e a 2ª seja E) ERRADO
      optionsList = optionsList.map((opt, idx) => {
        const clean = opt.replace(/^([A-Ea-e])\)?\s*/, '').trim();
        const letter = idx === 0 ? 'C' : 'E';
        return `${letter}) ${clean || (idx === 0 ? 'CERTO' : 'ERRADO')}`;
      });
    } else {
      // Garante ordenação alfabética estrita das alternativas (A, B, C, D, E)
      optionsList.sort((a, b) => {
        const letterA = a.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
        const letterB = b.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
        return letterA.localeCompare(letterB);
      });
    }
  }

  return (
    <div className="viewer-container animate-fade-in">
      <header className="viewer-header">
        <div className="viewer-header-meta">
          <div className="meta-breadcrumb">
            <span className="meta-pill board-pill">{question.metadata.board || 'Banca'}</span>
            <span className="meta-pill discipline-pill">{question.metadata.discipline || 'Geral'}</span>
            {question.metadata.topic && (
              <span className="meta-pill" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                {question.metadata.topic}
              </span>
            )}
            <span className="meta-pill year-pill">{question.metadata.year || 2023}</span>
          </div>
          <div className="meta-status">
            <span className="meta-pill mode-pill">Modo {studyMode}</span>
            {mediaPrescription && (
              <button
                type="button"
                className="meta-pill prescription-btn"
                onClick={() => setShowMediaModal(true)}
                title="Matriz de Complexidade vs. Familiaridade • Clique para ver a prescrição de mídia"
              >
                {mediaPrescription.veiculo === 'VIDEOAULA' ? '🎥 Videoaula 1.5x' : '📄 PDF Direto'}
              </button>
            )}
          </div>
        </div>

        <div className="viewer-header-toolbar">
          <div className="toolbar-tools">
            <button
              type="button"
              className="tool-btn"
              onClick={() => setShowBrainDump(true)}
              title="Anotações rápidas / Rascunho da questão"
            >
              <span>📝</span>
              <span>Rascunho</span>
            </button>
          </div>
          <button
            type="button"
            className="end-session-btn"
            onClick={() => setShowHandoffModal(true)}
          >
            Encerrar Sessão
          </button>
        </div>
      </header>

      {/* MAPA DA SESSÃO E NAVEGAÇÃO DE QUESTÕES */}
      {sessionQuestions.length > 0 && (
        <div className="session-map-bar glass animate-fade-in">
          <div className="map-info">
            <div className="map-badge-counter">
              <span className="map-title-label">🗺️ Mapa da Sessão:</span>
              <span className="map-count">
                Questão <strong>{currentQuestionIndex + 1}</strong> de <strong>{sessionQuestions.length}</strong>
              </span>
              <span className="map-progress-pct">
                ({Math.round((Object.keys(answeredMap).length / Math.max(sessionQuestions.length, 1)) * 100)}% respondido)
              </span>
            </div>

            <div className="map-nav-controls">
              <button
                type="button"
                className="map-nav-btn prev"
                onClick={handlePrevQuestion}
                disabled={currentQuestionIndex === 0}
                title="Voltar para a questão anterior"
              >
                ⬅ Anterior
              </button>
              <button
                type="button"
                className="map-nav-btn next"
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex >= sessionQuestions.length - 1}
                title="Ir para a próxima questão"
              >
                Próxima ➔
              </button>
            </div>
          </div>

          <div className="map-pills-scroll">
            {sessionQuestions.map((q, idx) => {
              const isCurrent = idx === currentQuestionIndex;
              const ans = answeredMap[q.questionId];
              const isAnswered = !!ans;
              const isAnulada = ans?.feedback?.gabaritoStatus === 'ANULADA';
              const isCorrect = ans?.feedback?.isCorrect;

              let pillClass = 'unanswered';
              let icon = '';
              if (isAnswered) {
                if (isAnulada) {
                  pillClass = 'anulada';
                  icon = '⚠️';
                } else if (isCorrect === true) {
                  pillClass = 'correct';
                  icon = '✓';
                } else if (isCorrect === false) {
                  pillClass = 'incorrect';
                  icon = '✗';
                } else {
                  pillClass = 'answered';
                  icon = '•';
                }
              }

              return (
                <button
                  key={q.questionId || idx}
                  type="button"
                  className={`map-pill-btn ${pillClass} ${isCurrent ? 'current' : ''}`}
                  onClick={() => handleJumpToQuestion(idx)}
                  title={`Questão ${idx + 1}: ${q.metadata?.discipline || ''} • ${isAnswered ? (isCorrect ? 'Acertou' : 'Errou') : 'Pendente'}`}
                >
                  <span className="pill-num">{idx + 1}</span>
                  {icon && <span className="pill-icon">{icon}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desmembramento Lateral (Rascunho de Árvore Conceitual) */}
      {showDesmembramento && (
        <div className="glass animate-fade-in" style={{ padding: '1rem', border: '1px solid rgba(59, 130, 246, 0.4)', background: 'rgba(15, 23, 42, 0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#60a5fa' }}>
              🌳 Desmembramento Lateral (Combate ao Piloto Automático)
            </span>
            <button className="timer-close-btn" onClick={() => setShowDesmembramento(false)}>✕</button>
          </div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#94a3b8' }}>
            Puxe de memória a árvore conceitual deste instituto. Coloque <strong>?</strong> nas lacunas esquecidas para checar na teoria ou comentários:
          </p>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Ex.: Princípio X -> Regra Geral, Exceção A (?), Prazo B (?)"
            value={desmembramentoText}
            onChange={(e) => setDesmembramentoText(e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
        </div>
      )}

      {/* Material de Apoio Compartilhado (Fase 5 - Textos-base, tabelas, figuras) */}
      {question.metadata?.supportMaterial && question.metadata.supportMaterial.conteudoTexto && (
        <div className="support-material-drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>
              📎 {question.metadata.supportMaterial.titulo || 'Material de Apoio / Texto-Base'}
            </h4>
            <button
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              onClick={() => setShowSupportMaterial((prev) => !prev)}
            >
              {showSupportMaterial ? 'Recolher' : 'Expandir'}
            </button>
          </div>
          {showSupportMaterial && (
            <div style={{ marginTop: '0.5rem', color: '#e2e8f0', fontSize: '0.92rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {question.metadata.supportMaterial.conteudoTexto}
            </div>
          )}
        </div>
      )}

      {/* Banner de Simulado com Treino de Pressão */}
      {simuladoConfig?.chaosModeEnabled && (
        <div className="chaos-stress-banner animate-fade-in">
          <span>⏱️</span>
          <div>
            <strong>Treino de Pressão de Tempo Ativo</strong>
            <span style={{ display: 'block', fontSize: '0.76rem', color: '#fecaca' }}>
              Questões com tempo mais restrito para simular o ritmo real de prova.
            </span>
          </div>
        </div>
      )}

      {/* Simulação de Prova Extensa (Textos Densos) */}
      {simuladoConfig?.stressFatigueSimulation && (
        <div className="fatigue-support-box animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#93c5fd', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>📄 Questão com Texto Extenso (Treino de Resistência de Leitura)</span>
          </div>
          <p style={{ margin: '0.4rem 0 0', color: '#cbd5e1', fontSize: '0.78rem', lineHeight: '1.45' }}>
            Mantenha o foco nos verbos principais e nas palavras-chave da questão.
          </p>
        </div>
      )}

      <main 
        className="question-content glass"
        onMouseMove={(e) => {
          if (feedback) return;
          if (lastMousePos) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            setCursorTravelPx((prev) => prev + dist);
          }
          setLastMousePos({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="statement">
          {renderFormattedStatement(question.statement)}
        </div>

        {/* Imagem de Apoio da Questão (Tabelas, Figuras, Charges, Gráficos) */}
        {question.metadata?.supportMaterial?.mediaPath && (
          <div className="question-figure-container animate-fade-in">
            <div className="question-figure-header">
              <span className="figure-icon">🖼️</span>
              <span className="figure-title">
                {question.metadata.supportMaterial.titulo || 'Imagem de Apoio da Questão'}
              </span>
            </div>
            <div className="question-figure-box">
              <img
                src={
                  question.metadata.supportMaterial.mediaPath.startsWith('http')
                    ? question.metadata.supportMaterial.mediaPath
                    : `http://localhost:8080/${question.metadata.supportMaterial.mediaPath.replace(/^\/+/, '')}`
                }
                alt={question.metadata.supportMaterial.titulo || 'Figura da questão'}
                className="question-support-image"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <div className="options" aria-busy={!prospectiveReady && !feedback} role="radiogroup" aria-label="Alternativas da questão">
          {optionsList.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            const letter = isCertoErrado 
              ? (idx === 0 ? 'C' : 'E') 
              : (opt.match(/^([A-Ea-e])\)?/)?.[1]?.toUpperCase() || opt.charAt(0).toUpperCase());
            const isUnverifiedGabarito = feedback?.gabaritoStatus === 'AUSENTE' || feedback?.gabaritoStatus === 'SOB_REVISAO';
            return (
              <div 
                key={idx}
                role="radio"
                aria-checked={isSelected}
                aria-disabled={Boolean(feedback) || !prospectiveReady}
                tabIndex={feedback ? -1 : 0}
                aria-label={`Alternativa ${letter}: ${opt.replace(/^([A-Ea-e])\)?\s*/, '')}`}
                className={`option-card ${isSelected ? 'selected' : ''} ${feedback && isSelected ? (isUnverifiedGabarito ? 'selected' : (feedback.isCorrect ? 'correct' : 'incorrect')) : ''} ${feedback ? 'disabled' : ''}`}
                onMouseEnter={() => {
                  if (firstHoverMs === null && !feedback) {
                    setFirstHoverMs(activeTimeMs);
                  }
                }}
                onClick={() => handleSelectOption(opt)}
                onKeyDown={(e) => {
                  if (!feedback && !pendingAttemptRef.current && prospectiveReady) {
                    handleKeyActivate(e, () => handleSelectOption(opt));
                  }
                }}
              >
                <div className="option-marker" aria-hidden="true">{letter}</div>
                <div className="option-text">{opt.replace(/^([A-Ea-e])\)?\s*/, '')}</div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Card Dica Antipegadinha */}
      {pensarContrarioOpen && !feedback && (
        <div className="glass animate-fade-in" style={{ padding: '0.85rem 1.25rem', border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 600, fontSize: '0.88rem' }}>
            <span>🤔 Dica Antipegadinha: Pense no Contrário</span>
          </div>
          <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.83rem', color: '#cbd5e1', lineHeight: '1.45' }}>
            A alternativa parece óbvia demais? Verifique se não há uma exceção oculta, prazos específicos ou termos restritivos como <em>"salvo"</em>, <em>"vedado"</em> ou <em>"apenas"</em>.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#fef08a', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pensouContrario}
              onChange={(e) => setPensouContrario(e.target.checked)}
            />
            <span>Analisei possíveis pegadinhas da banca antes de confirmar</span>
          </label>
        </div>
      )}

      {!feedback ? (
        <div className="interaction-bar glass animate-fade-in">
          <div className="confidence-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
              <span id="qw-confidence-label" style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Nível de Certeza:</span>
              {selectedOption && confidence === 0 && (
                <span role="status" style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  Marque seu nível de certeza para responder
                </span>
              )}
            </div>
            <div className="confidence-buttons" role="group" aria-labelledby="qw-confidence-label">
              {[
                { lvl: 1, label: 'Chute' },
                { lvl: 2, label: 'Baixa' },
                { lvl: 3, label: 'Média' },
                { lvl: 4, label: 'Alta' },
                { lvl: 5, label: 'Certeza' },
              ].map(({ lvl, label }) => (
                <button 
                  key={lvl} 
                  type="button"
                  aria-pressed={confidence === lvl}
                  aria-label={`Nível de certeza ${lvl}: ${label}`}
                  className={`conf-btn ${confidence === lvl ? 'active' : ''}`}
                  onClick={() => prospectiveReady && !pendingAttemptRef.current && setConfidence(lvl)}
                  title={`Nível ${lvl} — ${label} (tecla ${lvl})`}
                >
                  <span className="conf-num">{lvl}</span>
                  <span className="conf-label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              onClick={() => setPensarContrarioOpen(prev => !prev)}
              title="Ajuda a checar pegadinhas antes de marcar"
            >
              🤔 Checar Pegadinhas
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={naCordaBamba}
                onChange={(e) => setNaCordaBamba(e.target.checked)}
              />
              <span>🟡 Marcar como Dúvida</span>
            </label>

            <button 
              className="btn submit-btn" 
              disabled={!selectedOption || confidence === 0 || isSubmitting || !prospectiveReady}
              aria-busy={isSubmitting}
              onClick={handleSubmit}
              title={
                !selectedOption 
                  ? 'Selecione uma alternativa antes de responder' 
                  : confidence === 0 
                    ? 'Indique seu Nível de Confiança (1 a 5) para liberar o botão Responder' 
                    : isSubmitting 
                      ? 'Gravando resposta...' 
                      : pendingAttemptRef.current
                        ? 'Reenviar mesma tentativa para gravação'
                        : 'Confirmar resposta (Brier Score / Calibração)'
              }
            >
              {isSubmitting ? 'Gravando...' : pendingAttemptRef.current ? 'Reenviar tentativa' : 'Responder'}
            </button>
            {!prospectiveReady && !feedback && (
              <p role={prospectiveStatus === 'ERROR' ? 'alert' : 'status'}>
                {prospectiveStatus === 'ERROR' ? 'Não foi possível preparar a questão. Sua resposta ainda não foi enviada.' : 'Preparando questão...'}
                {prospectiveStatus === 'ERROR' && <button type="button" onClick={() => setProspectiveRetry(value => value + 1)}>Tentar novamente</button>}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div 
          className={`feedback-bar glass animate-fade-in ${
            feedback.gabaritoStatus === 'ANULADA' ? 'feedback-correct' :
            (feedback.gabaritoStatus === 'AUSENTE' || feedback.gabaritoStatus === 'SOB_REVISAO') ? '' :
            (feedback.isCorrect ? 'feedback-correct' : 'feedback-error')
          }`}
          style={
            (feedback.gabaritoStatus === 'AUSENTE' || feedback.gabaritoStatus === 'SOB_REVISAO')
              ? { background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.5)' }
              : undefined
          }
        >
          <div className="feedback-message" style={{ width: '100%' }}>
            {feedback.gabaritoStatus === 'ANULADA' ? (
              <div>
                <h3>✅ Questão Anulada pela Banca Oficial</h3>
                <p style={{ margin: '0.2rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Ponto atribuído pelas regras do concurso. Excluída da acurácia pedagógica para não produzir evidência artificial de domínio.
                </p>
              </div>
            ) : feedback.gabaritoStatus === 'AUSENTE' ? (
              <h3 style={{ color: '#facc15' }}>ℹ️ Resposta Registrada (Gabarito Ausente)</h3>
            ) : feedback.gabaritoStatus === 'SOB_REVISAO' ? (
              <h3 style={{ color: '#facc15' }}>⚠️ Resposta Registrada (Gabarito sob Revisão)</h3>
            ) : feedback.isCorrect ? (
              <h3>✅ Resposta Correta! {feedback.gabaritoStatus === 'RETIFICADO' ? '(Gabarito Retificado)' : ''}</h3>
            ) : (
              <div>
                <h3>❌ Resposta Incorreta {feedback.gabaritoStatus === 'RETIFICADO' ? '(Gabarito Retificado)' : ''}</h3>
                {/* Diagnóstico da Causa do Erro (Fase 8) */}
                <div className="error-taxonomy-selector">
                  <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>
                    Qual foi o fator determinante para este erro?
                  </span>
                  <div className="taxonomy-pills">
                    {ERROR_TAXONOMIES.map((tax) => (
                      <button
                        key={tax.code}
                        type="button"
                        className={`tax-pill ${selectedCausaErro === tax.code ? 'active' : ''}`}
                        onClick={() => handleSelectCausaErroPostSubmission(tax.code)}
                      >
                        {tax.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Travamentos (O Bloqueio Cognitivo) - Alerta Interativo com IA */}
                {(feedback.bloqueioCognitivo || (feedback.errosConsecutivos && feedback.errosConsecutivos >= 3)) && (
                  <div style={{
                    margin: '0.85rem 0',
                    padding: '0.85rem 1.1rem',
                    background: 'rgba(239, 68, 68, 0.16)',
                    border: '1.5px solid rgba(239, 68, 68, 0.65)',
                    borderRadius: '10px',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>🛑</span>
                        <strong style={{ color: '#fca5a5', fontSize: '0.92rem' }}>
                          Travamento Detectado: Bloqueio Cognitivo ({feedback.errosConsecutivos || 3} erros seguidos)
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.3)', color: '#fecaca', borderRadius: 12, fontWeight: 600 }}>
                        {cognitiveLockResolved ? '✓ Destravado' : 'Avanço Interrompido'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#fecaca', lineHeight: 1.45 }}>
                      Notei que você não entendeu esse conceito (<strong>{question.metadata.topic || 'Conceito da Questão'}</strong>). O avanço está bloqueado para impedir a ilusão de fluência. Fale com a IA agora para alinhar seu modelo mental.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.2rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                          color: '#ffffff',
                          fontWeight: 700,
                          padding: '8px 16px',
                          fontSize: '0.84rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => setIsCognitiveLockOpen(true)}
                      >
                        <span>🤖 Fale com a IA Agora (Dono de Supermercado) ➔</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Diagnóstico de Decisão & Confiança */}
            {biometricResult && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span className={`biometric-badge ${biometricResult.fluenciaNeurologica}`}>
                  {biometricResult.chuteEducadoDetectado 
                    ? '⚠️ Atenção: Resposta com hesitação prolongada (Dúvida / Chute provável)'
                    : (biometricResult.fluenciaNeurologica === 'ALTA_FLUENCIA' 
                      ? '⚡ Alta Segurança: Resposta rápida e certeira' 
                      : '🔍 Resposta ponderada')}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Tempo de decisão: {(biometricResult.tempoHesitacaoMs / 1000).toFixed(1)}s • Trocas de alternativa: {biometricResult.trocasCount}
                </span>
              </div>
            )}

            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
              Confiança Declarada: {confidence}/5 • Tempo Total: {(activeTimeMs / 1000).toFixed(1)}s
              {(feedback.gabaritoStatus === 'AUSENTE' || feedback.gabaritoStatus === 'SOB_REVISAO') && ' — Não impacta acurácia pedagógica.'}
            </p>

            {/* FAIL-SAFE BLOQUEANTE: Auditoria de Erros Críticos via Feynman Constrangido */}
            {feedback.isCorrect === false && (
              <div className="feynman-failsafe-card">
                <div className="feynman-failsafe-header">
                  <span>🔒 BLOQUEIO COGNITIVO ATIVADO (Fail-Safe)</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#fca5a5' }}>
                    {feynmanAuditCompleted ? '✓ Desbloqueado' : 'Avanço Bloqueado'}
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0.65rem', fontSize: '0.79rem', color: '#fecaca', lineHeight: '1.4' }}>
                  A ilusão de fluência impede você de aprender apenas lendo a resposta passivamente. O avanço foi desativado até você consertar seu modelo mental:
                </p>

                {auditSuccessMsg ? (
                  <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600 }}>
                    {auditSuccessMsg}
                  </div>
                ) : (
                  <form onSubmit={handleSaveFeynmanAudit}>
                    <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                      1. Qual foi a pegadinha / armadilha da banca na alternativa que você marcou?
                    </label>
                    <textarea
                      rows={2}
                      className="feynman-failsafe-textarea"
                      placeholder="Ex: Confundi prazo de decadência tributária de 5 anos com a prescrição..."
                      value={pegadinhaExplicacao}
                      onChange={e => setPegadinhaExplicacao(e.target.value)}
                    />

                    <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                      2. Qual é a regra jurídica / contábil correta com suas próprias palavras?
                    </label>
                    <textarea
                      rows={2}
                      className="feynman-failsafe-textarea"
                      placeholder="Ex: A decadência extingue o próprio direito potestativo de lançar, contado do 1º dia do exercício seguinte..."
                      value={regraCorretaExplicacao}
                      onChange={e => setRegraCorretaExplicacao(e.target.value)}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="submit"
                        className="btn"
                        disabled={auditSubmitting || pegadinhaExplicacao.trim().length < 10 || regraCorretaExplicacao.trim().length < 10}
                        style={{ padding: '6px 14px', fontSize: '0.8rem', background: '#dc2626' }}
                      >
                        {auditSubmitting ? 'Validando...' : '🛠️ Consertar Modelo Mental & Destravar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
          
          {(() => {
            const isCognitiveLocked = Boolean((feedback?.bloqueioCognitivo || (feedback?.errosConsecutivos != null && feedback.errosConsecutivos >= 3)) && !cognitiveLockResolved);
            const isAdvanceBlocked = Boolean((feynmanAuditRequired && !feynmanAuditCompleted) || isCognitiveLocked);
            const isLastInBatch = currentQuestionIndex >= sessionQuestions.length - 1;

            return (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignSelf: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                >
                  ⬅ Questão Anterior
                </button>
                <button 
                  className="btn" 
                  onClick={async () => {
                    if (selectedOption && confidence > 0 && !feedback && !isSubmitting) {
                      await handleSubmit();
                    }
                    if (isLastInBatch) {
                      await endSession();
                    } else {
                      handleNextQuestion();
                    }
                  }} 
                  disabled={isAdvanceBlocked}
                  style={{ 
                    alignSelf: 'flex-end',
                    opacity: isAdvanceBlocked ? 0.45 : 1,
                    cursor: isAdvanceBlocked ? 'not-allowed' : 'pointer',
                    background: isLastInBatch ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined
                  }}
                  title={
                    isCognitiveLocked
                      ? 'Avanço bloqueado: fale com a IA para destravar o bloqueio cognitivo'
                      : (feynmanAuditRequired && !feynmanAuditCompleted) 
                        ? 'Avanço bloqueado: conserte seu modelo mental na auditoria Feynman acima' 
                        : (isLastInBatch ? 'Encerrar sessão e auditar respostas' : 'Avançar para a próxima questão')
                  }
                >
                  {isCognitiveLocked
                    ? '🛑 Travamento: Fale com a IA para Destravar'
                    : (feynmanAuditRequired && !feynmanAuditCompleted) 
                      ? '🔒 Avanço Bloqueado (Feynman Pendente)' 
                      : (isLastInBatch ? '📊 Concluir Sessão & Ver Relatório ➔' : 'Próxima Questão ➔')}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL COGNITIVO 1: Brain Dump / Lista de Distrações (Ctrl+D) */}
      {showBrainDump && (
        <div className="modal-backdrop animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass modal-card" style={{ maxWidth: 480, width: '90%', padding: '1.5rem', borderRadius: 12, background: '#0f172a', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>🧠 Brain Dump (Modo Monge)</h3>
              <button
                onClick={() => setShowBrainDump(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 1rem', lineHeight: '1.4' }}>
              Despeje qualquer pensamento intrusivo ou tarefa pendente em 3 segundos. Ela será arquivada e ocultada para você não perder o foco na questão atual.
            </p>
            {brainDumpSavedMsg ? (
              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: 8, textAlign: 'center', fontWeight: 600 }}>
                {brainDumpSavedMsg}
              </div>
            ) : (
              <form onSubmit={handleSaveBrainDump}>
                <input
                  type="text"
                  autoFocus
                  className="form-control"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0b0e17', border: '1px solid #3b82f6', color: '#fff', borderRadius: 6, marginBottom: '0.75rem' }}
                  placeholder="Ex: Pagar boleto da internet; responder João no WhatsApp..."
                  value={brainDumpText}
                  onChange={(e) => setBrainDumpText(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowBrainDump(false)} style={{ padding: '5px 12px' }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '5px 15px' }}>
                    Arquivar & Focar (Enter)
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL COGNITIVO 2: Mensagem para o Eu do Futuro (next_session_handoff) & Tipo de Hora */}
      {showHandoffModal && (
        <div className="modal-backdrop animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass modal-card" style={{ maxWidth: 520, width: '90%', padding: '1.75rem', borderRadius: 12, background: '#0f172a', border: '1px solid #3b82f6' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#f8fafc', fontSize: '1.25rem' }}>
              ✉️ Mensagem para o Seu Eu do Futuro
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: '1.4' }}>
              O que o seu "eu" do próximo ciclo precisa saber imediatamente ao abrir esta disciplina?
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.3rem', fontWeight: 600 }}>
                Classificação da Hora:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn ${sessionActivityType === 'HE' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}
                  onClick={() => setSessionActivityType('HE')}
                >
                  ⚡ HE (Estudo Ativo / Raiz)
                </button>
                <button
                  type="button"
                  className={`btn ${sessionActivityType === 'HRE' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}
                  onClick={() => setSessionActivityType('HRE')}
                >
                  🗂️ HRE (Operacional)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.3rem', fontWeight: 600 }}>
                Handoff para o Próximo Bloco:
              </label>
              <textarea
                className="form-control"
                rows={3}
                style={{ width: '100%', padding: '0.65rem', background: '#0b0e17', border: '1px solid #334155', color: '#fff', borderRadius: 6, fontSize: '0.85rem' }}
                placeholder="Ex: Parou na pág. 34 do PDF 03; iniciar fazendo as questões múltiplos de 3 do final do capítulo..."
                value={nextSessionHandoff}
                onChange={(e) => setNextSessionHandoff(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowHandoffModal(false)}
              >
                Continuar Estudando
              </button>
              <button
                type="button"
                className="btn btn-rec-action"
                onClick={confirmEndSessionWithHandoff}
              >
                Salvar Recado & Encerrar Sessão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COGNITIVO 3: Colisão de Domínios Interdisciplinares */}
      <CrossDomainBridgeModal
        isOpen={showCrossDomainModal}
        onClose={() => setShowCrossDomainModal(false)}
        disciplinaFiltro={question?.metadata?.discipline || selectedDiscipline}
        sessionId={sessionId}
      />

      {/* 3. Travamentos: Modal de Bloqueio Cognitivo & Chat IA Embutido */}
      <CognitiveLockModal
        isOpen={isCognitiveLockOpen}
        onClose={() => setIsCognitiveLockOpen(false)}
        sessionId={sessionId}
        concursoId={selectedConcursoId}
        disciplina={question?.metadata?.discipline || selectedDiscipline || 'Direito Tributário'}
        assunto={question?.metadata?.topic || 'Substituição Tributária para Frente'}
        consecutiveErrors={feedback?.errosConsecutivos || 3}
        onUnlock={() => {
          setCognitiveLockResolved(true);
        }}
      />

      {/* Modal de Detalhes da Matriz de Mídia */}
      {showMediaModal && mediaPrescription && (
        <div className="modal-backdrop animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowMediaModal(false)}>
          <div className="glass modal-card" role="dialog" aria-modal="true" aria-labelledby="media-modal-title" style={{ maxWidth: 520, width: '92%', padding: '1.5rem', borderRadius: 12, background: '#0f172a', border: '1px solid #334155' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 id="media-modal-title" style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span aria-hidden="true">{mediaPrescription.veiculo === 'VIDEOAULA' ? '🎥' : '📄'}</span>
                <span>{mediaPrescription.titulo}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                aria-label="Fechar detalhes da mídia"
                title="Fechar (Esc)"
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ margin: '0.75rem 0', padding: '0.85rem', background: 'rgba(30, 41, 59, 0.7)', borderRadius: 8, border: '1px solid #334155' }}>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {mediaPrescription.prescricaoTexto}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.75rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              <div><strong>Matéria:</strong> {question.metadata.discipline}</div>
              <div><strong>Categoria:</strong> {mediaPrescription.categoriaDisciplina}</div>
              <div><strong>Familiaridade:</strong> {mediaPrescription.nivelFamiliaridade}</div>
              {mediaPrescription.velocidadeSugerida && (
                <div><strong>Velocidade:</strong> {mediaPrescription.velocidadeSugerida}</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowMediaModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 4. Engenharia Reversa como Padrão de Estudo (Estudo Reverso Orientado) */}
      <ReverseEngineeringModal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        disciplina={question?.metadata?.discipline || selectedDiscipline || 'Direito Tributário'}
        assunto={question?.metadata?.topic || 'Substituição Tributária para Frente'}
        concursoId={selectedConcursoId}
        banca={question?.metadata?.board || 'FGV'}
        onPrescriptionReady={(presc) => {
          if (presc) {
            setMediaPrescription({
              veiculo: 'PDF_DIRETO',
              titulo: 'Teoria Recortada (Estudo Reverso)',
              prescricaoTexto: presc.prescricaoRecorteTexto,
              categoriaDisciplina: 'Leis / Exceções',
              nivelFamiliaridade: 'INTERMEDIARIO',
              paginaSugerida: presc.paginaInicioRecorte,
              errosConsecutivos: 0
            });
          }
        }}
      />
    </div>
  );
};

export default QuestionViewer;
