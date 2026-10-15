import React, { useState, useEffect, useRef, useCallback } from 'react';
import './QuestionViewer.css';
import { CrossDomainBridgeModal } from './cognitive/CrossDomainBridgeModal';
import { AnkiHubModal } from './anki/AnkiHubModal';
import { CognitiveLockModal } from './cognitive/CognitiveLockModal';
import { ReverseEngineeringModal } from './cognitive/ReverseEngineeringModal';

interface Option {
  label?: string;
  text?: string;
}

interface SupportMaterial {
  tipo?: string;
  titulo?: string;
  conteudoTexto?: string;
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

const ERROR_TAXONOMIES = [
  { code: 'NAO_SABIA_MATERIA', label: '1. Não sabia a matéria (Lacuna teórica pura)' },
  { code: 'NAO_LEMBRAVA', label: '2. Não lembrava (Falha de retenção / SRS)' },
  { code: 'INTERPRETACAO_EQUIVOCADA', label: '3. Interpretação equivocada (Comando / enunciado)' },
  { code: 'CONFUSAO_CONCEITUAL', label: '4. Confusão entre conceitos (Faltou Feynman / macro)' },
  { code: 'FALTA_ATENCAO', label: '5. Falta de atenção (Leitura rápida / ignorou restritivos)' },
];

const QuestionViewer: React.FC = () => {
  const [sessionStarted, setSessionStarted] = useState(() => sessionStorage.getItem('fiscalstudy_sessionStarted') === 'true');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean | null;
    gabaritoStatus?: string;
    concursoPoint?: number;
    bloqueioCognitivo?: boolean;
    errosConsecutivos?: number;
    prescricaoTexto?: string;
    veiculo?: string;
  } | null>(null);

  // Configuração da Sessão Personalizada (Fase 8)
  const [concursos, setConcursos] = useState<ConcursoOption[]>([]);
  const [selectedConcursoId, setSelectedConcursoId] = useState<string>(() => localStorage.getItem('fiscalstudy_active_concurso_id') || '');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>(() => sessionStorage.getItem('fiscalstudy_filter_discipline') || '');
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [selectedAssunto, setSelectedAssunto] = useState<string>(() => sessionStorage.getItem('fiscalstudy_filter_assunto') || '');
  const [studyMode, setStudyMode] = useState<string>('LEARNING'); // LEARNING, EXAM, RETENTION, CREDIARIO
  const [includeAnswered, setIncludeAnswered] = useState<boolean>(false);
  const [questionCountLimit, setQuestionCountLimit] = useState<number>(10);
  const [selectedCausaErro, setSelectedCausaErro] = useState<string>('');
  const [showSupportMaterial, setShowSupportMaterial] = useState<boolean>(true);

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

  // Automação Extrema: Integração Silenciosa AnkiConnect
  const [isAnkiModalOpen, setIsAnkiModalOpen] = useState(false);
  const [ankiStatus, setAnkiStatus] = useState<{ connected: boolean; pendingQueueCount: number } | null>(null);

  const refreshAnkiStatus = () => {
    fetch('/api/v1/anki/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAnkiStatus({ connected: !!data.connected, pendingQueueCount: data.pendingQueueCount || 0 });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshAnkiStatus();
  }, []);

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

  // Atalho de Teclado Ctrl+D para Brain Dump (Lista de Distrações Anti-AIDA)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setShowBrainDump((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectOption = (opt: string) => {
    if (feedback) return;
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
      await fetch('/api/v1/study-sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          concursoId: selectedConcursoId,
          disciplina: question?.metadata?.discipline || selectedDiscipline || 'Geral',
          durationSeconds: Math.round(activeTimeMs / 1000),
          questoesFeitas: 1,
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
  const getInitialSessionId = () => {
    let stored = sessionStorage.getItem('fiscalstudy_sessionId');
    if (!stored) {
      stored = 'session-' + crypto.randomUUID();
      sessionStorage.setItem('fiscalstudy_sessionId', stored);
    }
    return stored;
  };
  const sessionId = useRef(getInitialSessionId()).current;

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

  const fetchNextQuestion = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    setSelectedOption(null);
    setConfidence(0);
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
    try {
      let url = `/api/v1/questions/next?sessionId=${sessionId}`;
      if (selectedConcursoId) {
        url += `&concursoId=${encodeURIComponent(selectedConcursoId)}`;
      }
      if (selectedDiscipline) {
        url += `&disciplina=${encodeURIComponent(selectedDiscipline)}`;
      }
      if (selectedAssunto) {
        url += `&assunto=${encodeURIComponent(selectedAssunto)}`;
      }
      if (includeAnswered) {
        url += `&includeAnswered=true`;
      }
      if (studyMode) {
        url += `&studyMode=${encodeURIComponent(studyMode)}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setQuestion(data);

        // Avaliar Roteamento de Mídia para esta questão
        fetch(`/api/v1/cognitive/media-routing/evaluate?disciplina=${encodeURIComponent(data.metadata?.discipline || '')}&assunto=${encodeURIComponent(data.metadata?.topic || '')}&sessionId=${sessionId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((presc) => {
            if (presc) setMediaPrescription(presc);
          })
          .catch(() => {});
        
        // Registrar a apresentação explicitamente (Append-Only Event Store)
        await fetch(`/api/v1/questions/${data.questionId}/presented`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        // Iniciar cronômetro só após registrar apresentação com sucesso
        setActiveTimeMs(0);
        setLastFocusTime(Date.now());
      } else {
        setQuestion(null);
      }
    } catch (error) {
      console.error("Failed to fetch question:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedConcursoId, selectedDiscipline, selectedAssunto, includeAnswered, studyMode]);

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
      await fetch(`/api/v1/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      sessionStorage.setItem('fiscalstudy_sessionStarted', 'true');
      setSessionStarted(true);
      fetchNextQuestion();
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
      await fetch(`/api/v1/sessions/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      const res = await fetch(`/api/v1/sessions/${sessionId}/summary`);
      if (res.ok) {
        setSummary(await res.json());
      }
      
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
    if (!question || !selectedOption || confidence === 0) return;

    let finalActiveTime = activeTimeMs;
    if (document.visibilityState === 'visible' && lastFocusTime > 0) {
      finalActiveTime += (Date.now() - lastFocusTime);
    }
    
    // extrair apenas a letra se vier no formato 'A) ...'
    const optionLetter = selectedOption.match(/^([A-E])\)?/)?.[1] || selectedOption.charAt(0);

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

    try {
      const response = await fetch(`/api/v1/questions/${question.questionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption: optionLetter,
          confidenceLevel: confidence,
          activeTimeMs: finalActiveTime,
          sessionId,
          causaErro: selectedCausaErro || undefined,
          naCordaBamba: naCordaBamba,
          pensouContrario: pensouContrario,
          ...bioPayload
        })
      });

      if (response.ok) {
        const result = await response.json();
        setFeedback(result);
        if (result.isCorrect === false) {
          setFeynmanAuditRequired(true);
          setFeynmanAuditCompleted(false);
          refreshAnkiStatus();
          if (result.bloqueioCognitivo || (result.errosConsecutivos && result.errosConsecutivos >= 3)) {
            setIsCognitiveLockOpen(true);
            setCognitiveLockResolved(false);
          }
        }
      }
    } catch (error) {
      console.error("Failed to submit attempt:", error);
    }
  };

  // Envia ou atualiza a causa do erro pós-feedback se o estudante selecionar
  const handleSelectCausaErroPostSubmission = async (code: string) => {
    setSelectedCausaErro(code);
    if (!question) return;
    try {
      // Reenvia attempt idempotentemente com causa do erro registrada
      const optionLetter = selectedOption ? (selectedOption.match(/^([A-E])\)?/)?.[1] || selectedOption.charAt(0)) : 'A';
      await fetch(`/api/v1/questions/${question.questionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption: optionLetter,
          confidenceLevel: confidence || 3,
          activeTimeMs,
          sessionId,
          causaErro: code,
          naCordaBamba: naCordaBamba,
          pensouContrario: pensouContrario
        })
      });
    } catch (e) {
      console.error("Failed to register error cause:", e);
    }
  };

  // TELA 1: Configuração Personalizada da Sessão (Fase 8)
  if (!sessionStarted) {
    return (
      <div className="viewer-container empty">
        <div className="glass session-config-card">
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            <h2 style={{ color: '#f8fafc', margin: 0, fontSize: '1.4rem' }}>⚙️ Nova Sessão de Estudo Personalizada</h2>
            <p style={{ color: '#94a3b8', margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
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
                📘 Aprendizagem (Feedback Imediato)
              </button>
              <button
                type="button"
                className={`mode-btn ${studyMode === 'EXAM' ? 'active' : ''}`}
                onClick={() => setStudyMode('EXAM')}
              >
                ⏱️ Simulado Oficial (Tempo Ativo)
              </button>
              <button
                type="button"
                className={`mode-btn ${studyMode === 'RETENTION' ? 'active' : ''}`}
                onClick={() => setStudyMode('RETENTION')}
              >
                🔄 Fixação (Revisão Espaçada)
              </button>
              <button
                type="button"
                className={`mode-btn ${studyMode === 'CREDIARIO' ? 'active' : ''}`}
                onClick={() => setStudyMode('CREDIARIO')}
              >
                💳 Método do Crediário (Saltos 1, 4, 7...)
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
            <label htmlFor="includeAnswered" style={{ color: '#cbd5e1', fontSize: '0.88rem', cursor: 'pointer' }}>
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

  // TELA 2: Relatório Final da Sessão
  if (sessionEnded) {
    return (
      <div className="viewer-container empty">
        <div className="glass empty-state" style={{ maxWidth: '620px', width: '100%', padding: '2rem' }}>
          <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
            📊 Relatório da Sessão de Estudo
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

              {/* Alerta de Falsa Fluência (Overconfidence) */}
              {summary.overconfidenceCount > 0 && (
                <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '8px' }}>
                  <h4 style={{ color: '#f87171', margin: '0 0 6px 0', fontSize: '0.95rem' }}>⚠️ Alerta de Falsa Fluência (Overconfidence)</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                    Você assinalou certeza absoluta (nível 5) em <strong>{summary.overconfidenceCount}</strong> questão(ões) que estavam incorretas. Atenção redobrada a pegadinhas e conceitos mal consolidados.
                  </p>
                </div>
              )}

              {/* Diagnóstico de Causas de Erro Registradas */}
              {summary.errorDistribution && Object.keys(summary.errorDistribution).length > 0 && (
                <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  <h4 style={{ color: '#38bdf8', margin: '0 0 8px 0', fontSize: '0.95rem' }}>🎯 Diagnóstico das Causas de Erro:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {Object.entries(summary.errorDistribution).map(([code, count]) => {
                      const match = ERROR_TAXONOMIES.find((t) => t.code === code);
                      return (
                        <span key={code} className="tax-pill active" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                          {match ? match.label : code}: <strong>{count}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fechamento da Sessão: Integração Silenciosa Anki */}
              <div style={{
                marginTop: '15px',
                padding: '14px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ maxWidth: '420px' }}>
                    <h4 style={{ color: '#60a5fa', margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                      ⚡ Fechamento de Sessão: Flashcards Anki
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                      As regras dos erros que você cometeu foram convertidas silenciosamente em perguntas curtas e diretas, agendadas para amanhã no seu Anki.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.82rem', background: '#3b82f6', whiteSpace: 'nowrap' }}
                    onClick={() => setIsAnkiModalOpen(true)}
                  >
                    Ver Cards no Anki Hub ➔
                  </button>
                </div>
              </div>

              <button
                className="btn"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={() => {
                  setSessionEnded(false);
                  setSessionStarted(false);
                  setQuestion(null);
                  setSummary(null);
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

  let optionsList: string[] = [];
  if (Array.isArray(question.options)) {
    if (typeof question.options[0] === 'string') {
      optionsList = [...(question.options as string[])];
    } else {
      optionsList = (question.options as Option[]).map((o: Option) => `${o.label}) ${o.text}`);
    }
    // Garante ordenação alfabética estrita das alternativas (A, B, C, D, E)
    optionsList.sort((a, b) => {
      const letterA = a.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
      const letterB = b.match(/^([A-E])\)?/i)?.[1]?.toUpperCase() || '';
      return letterA.localeCompare(letterB);
    });
  }

  return (
    <div className="viewer-container animate-fade-in">
      <header className="viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="metadata-tags">
          <span className="tag">{question.metadata.board || 'Banca'}</span>
          <span className="tag">{question.metadata.discipline || 'Geral'}</span>
          {question.metadata.topic && <span className="tag">{question.metadata.topic}</span>}
          <span className="tag">{question.metadata.year || 2023}</span>
          <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            Modo {studyMode}
          </span>
          {mediaPrescription && (
            <button
              type="button"
              className="tag"
              style={{
                cursor: 'pointer',
                background: mediaPrescription.veiculo === 'VIDEOAULA' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                color: mediaPrescription.veiculo === 'VIDEOAULA' ? '#fca5a5' : '#93c5fd',
                borderColor: mediaPrescription.veiculo === 'VIDEOAULA' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: '6px',
                padding: '2px 8px',
                fontWeight: 600
              }}
              onClick={() => setShowMediaModal(true)}
              title="Matriz de Complexidade vs. Familiaridade • Clique para ver a prescrição de mídia"
            >
              {mediaPrescription.veiculo === 'VIDEOAULA' ? '🎥 Videoaula 1.5x' : '📄 PDF Direto'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '5px 12px',
              fontSize: '0.8rem',
              background: '#1e293b',
              border: ankiStatus?.connected ? '1px solid #10b981' : '1px solid #f59e0b',
              color: ankiStatus?.connected ? '#6ee7b7' : '#fcd34d',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setIsAnkiModalOpen(true)}
            title="Integração Silenciosa AnkiConnect • Clique para abrir o Anki Hub"
          >
            <span>⚡</span>
            <span>
              {ankiStatus?.connected ? 'AnkiConnect: Online' : `Anki: ${ankiStatus?.pendingQueueCount || 0} na Fila`}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '5px 12px',
              fontSize: '0.8rem',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid #818cf8',
              color: '#c7d2fe',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setIsReverseModalOpen(true)}
            title="Estudo Reverso Orientado (Engenharia Reversa): Resolva 5 questões da banca foco para mapear pegadinhas e recortar a teoria do PDF"
          >
            <span>🎯</span>
            <span>Estudo Reverso</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.8rem', background: '#1e293b', border: '1px solid #3b82f6', color: '#93c5fd' }}
            onClick={() => setShowDesmembramento(prev => !prev)}
            title="Desmembramento Lateral: Resgate a árvore conceitual deste instituto de memória"
          >
            🌳 Desmembramento Lateral
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.8rem', background: '#1e293b', border: '1px solid #334155' }}
            onClick={() => setShowBrainDump(true)}
            title="Lista de Distrações / Brain Dump (Ctrl+D)"
          >
            🧠 Brain Dump (Ctrl+D)
          </button>
          <button
            className="btn"
            style={{ padding: '5px 15px', fontSize: '0.85rem', background: 'transparent', border: '1px solid #fff', color: '#fff' }}
            onClick={() => setShowHandoffModal(true)}
          >
            Encerrar Sessão
          </button>
        </div>
      </header>

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

      {/* Banner de Inoculação de Estresse / Chaos Engineering */}
      {simuladoConfig?.chaosModeEnabled && (
        <div className="chaos-stress-banner animate-fade-in">
          <span>⚡</span>
          <div>
            <strong>MODO CAOS ATIVO: Inoculação de Estresse (Chaos Engineering)</strong>
            <span style={{ display: 'block', fontSize: '0.76rem', color: '#fecaca' }}>
              Treino de controle emocional e gestão de tempo sob quebra brusca de ritmo da banca.
            </span>
          </div>
        </div>
      )}

      {/* Simulação de Fadiga Neuro-Cognitiva (Exaustão e Textos Densos) */}
      {simuladoConfig?.stressFatigueSimulation && (
        <div className="fatigue-support-box animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#93c5fd', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>🧠 Texto-Base de Alta Densidade (Treino de Fadiga sob Queda Glicêmica)</span>
          </div>
          <p style={{ margin: '0.4rem 0 0', color: '#cbd5e1', fontSize: '0.78rem', lineHeight: '1.45' }}>
            Considere a complexidade estrutural das normas fiscais aplicadas e execute a leitura dinâmica focada nos verbos núcleos e exceções sem interrupções.
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
          {question.statement.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        <div className="options">
          {optionsList.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            const letter = opt.match(/^([A-E])\)?/)?.[1] || opt.charAt(0);
            const isUnverifiedGabarito = feedback?.gabaritoStatus === 'AUSENTE' || feedback?.gabaritoStatus === 'SOB_REVISAO';
            return (
              <div 
                key={idx} 
                className={`option-card ${isSelected ? 'selected' : ''} ${feedback && isSelected ? (isUnverifiedGabarito ? 'selected' : (feedback.isCorrect ? 'correct' : 'incorrect')) : ''} ${feedback ? 'disabled' : ''}`}
                onMouseEnter={() => {
                  if (firstHoverMs === null && !feedback) {
                    setFirstHoverMs(activeTimeMs);
                  }
                }}
                onClick={() => handleSelectOption(opt)}
              >
                <div className="option-marker">{letter}</div>
                <div className="option-text">{opt.replace(/^([A-E])\)?\s*/, '')}</div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Card Pensar o Contrário (Galinsky & Mussweiler) */}
      {pensarContrarioOpen && !feedback && (
        <div className="glass animate-fade-in" style={{ padding: '0.85rem 1.25rem', border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontWeight: 600, fontSize: '0.9rem' }}>
            <span>🤔 Deliberação Sistema 2 (Galinsky & Mussweiler)</span>
          </div>
          <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.83rem', color: '#cbd5e1' }}>
            Neutralize o efeito âncora e o viés da facilidade heurística: busque argumentos concretos contra a alternativa que parece óbvia. Há alguma exceção oculta, termo restritivo (salvo, exceto, nunca) ou pegadinha clássica da banca?
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#fef08a', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pensouContrario}
              onChange={(e) => setPensouContrario(e.target.checked)}
            />
            <span>Exercitei deliberadamente "Pensar o Contrário" antes de confirmar a resposta</span>
          </label>
        </div>
      )}

      {!feedback ? (
        <div className="interaction-bar glass animate-fade-in">
          <div className="confidence-section">
            <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Nível de Confiança:</span>
            <div className="confidence-buttons">
              {[
                { lvl: 1, label: '1: Chute' },
                { lvl: 2, label: '2: Dúvida' },
                { lvl: 3, label: '3: Parcial' },
                { lvl: 4, label: '4: Seguro' },
                { lvl: 5, label: '5: Certeza' },
              ].map(({ lvl, label }) => (
                <button 
                  key={lvl} 
                  className={`conf-btn ${confidence === lvl ? 'active' : ''}`}
                  onClick={() => setConfidence(lvl)}
                  title={label}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: '#38bdf8', color: '#38bdf8' }}
              onClick={() => setShowCrossDomainModal(true)}
              title="Construção de pontes neurais entre domínios conceituais distintos"
            >
              ⚡ Colisão de Domínios
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: pensarContrarioOpen ? '#f59e0b' : '#334155', color: pensarContrarioOpen ? '#fbbf24' : '#e2e8f0' }}
              onClick={() => setPensarContrarioOpen(prev => !prev)}
              title="Induz a reflexão contra a alternativa óbvia"
            >
              🤔 Pensar o Contrário
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={naCordaBamba}
                onChange={(e) => setNaCordaBamba(e.target.checked)}
              />
              <span>🟡 Na Corda Bamba (Dúvida)</span>
            </label>

            <button 
              className="btn submit-btn" 
              disabled={!selectedOption || confidence === 0}
              onClick={handleSubmit}
            >
              Responder
            </button>
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

                {/* Automação Extrema: Integração Silenciosa AnkiConnect */}
                <div style={{
                  margin: '0.75rem 0',
                  padding: '0.65rem 0.95rem',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>⚡</span>
                    <span style={{ fontSize: '0.83rem', color: '#93c5fd', lineHeight: 1.4 }}>
                      <strong>Flashcard gerado silenciosamente:</strong> A regra que você errou foi sintetizada em pergunta curta e enviada para o seu Anki (agendado para amanhã).
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', border: '1px solid #3b82f6', color: '#60a5fa' }}
                    onClick={() => setIsAnkiModalOpen(true)}
                  >
                    Ver no Anki Hub ➔
                  </button>
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
            
            {/* Biometria da Decisão & Telemetria Anti-Cheat */}
            {biometricResult && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span className={`biometric-badge ${biometricResult.fluenciaNeurologica}`}>
                  {biometricResult.chuteEducadoDetectado 
                    ? '⚠️ Alerta Anti-Cheat: Chute Educado / Fragilidade Sináptica Detectada'
                    : (biometricResult.fluenciaNeurologica === 'ALTA_FLUENCIA' 
                      ? '⚡ Fluência Neural Máxima: Decisão Imediata / Domínio Absoluto' 
                      : '🔍 Fricção Cognitiva Moderada: Hesitação Detectada')}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Fricção: {biometricResult.friccaoScore.toFixed(2)} • Hesitação: {(biometricResult.tempoHesitacaoMs / 1000).toFixed(1)}s • Trocas: {biometricResult.trocasCount}
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

            return (
              <button 
                className="btn" 
                onClick={fetchNextQuestion} 
                disabled={isAdvanceBlocked}
                style={{ 
                  marginTop: '0.75rem', 
                  alignSelf: 'flex-end',
                  opacity: isAdvanceBlocked ? 0.45 : 1,
                  cursor: isAdvanceBlocked ? 'not-allowed' : 'pointer'
                }}
                title={
                  isCognitiveLocked
                    ? 'Avanço bloqueado: fale com a IA para destravar o bloqueio cognitivo'
                    : (feynmanAuditRequired && !feynmanAuditCompleted) 
                      ? 'Avanço bloqueado: conserte seu modelo mental na auditoria Feynman acima' 
                      : 'Próxima Questão'
                }
              >
                {isCognitiveLocked
                  ? '🛑 Travamento: Fale com a IA para Destravar'
                  : (feynmanAuditRequired && !feynmanAuditCompleted) 
                    ? '🔒 Avanço Bloqueado (Feynman Pendente)' 
                    : 'Próxima Questão ➔'}
              </button>
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

      {/* Automação Extrema: AnkiConnect Modal Hub */}
      <AnkiHubModal
        isOpen={isAnkiModalOpen}
        onClose={() => {
          setIsAnkiModalOpen(false);
          refreshAnkiStatus();
        }}
        activeConcursoId={selectedConcursoId}
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
        <div className="modal-backdrop animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass modal-card" style={{ maxWidth: 520, width: '92%', padding: '1.5rem', borderRadius: 12, background: '#0f172a', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{mediaPrescription.veiculo === 'VIDEOAULA' ? '🎥' : '📄'}</span>
                <span>{mediaPrescription.titulo}</span>
              </h3>
              <button
                onClick={() => setShowMediaModal(false)}
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
