import { ingestionFetch, setIngestionToken } from '../../utils/ingestionAccess';
import React, { useState, useEffect } from 'react';
import './ImportStudio.css';
import { AuditCockpit } from './AuditCockpit';
import { CentralProcessamento } from './CentralProcessamento';
import { AssistenteImportacaoWizard } from './AssistenteImportacaoWizard';
import { QualidadeBancoQuestoes } from './QualidadeBancoQuestoes';

interface StagingDocument {
  id: string;
  originalFilename: string;
  role: string;
  sizeBytes: number;
  format: string;
}

export interface StagingDocRole {
  id: string;
  fileId: string;
  docRole: string;
  pageStart: number;
  pageEnd: number;
  banca?: string;
  orgao?: string;
  cargo?: string;
  ano?: number;
  status?: string;
}

interface SupportMaterial {
  tipo?: string;
  titulo?: string;
  conteudoTexto?: string;
  mediaPath?: string;
  docOrigem?: string;
  paginaInicio?: number;
  paginaFim?: number;
}

export interface StagingFile {
  id: string;
  relPath: string;
  filename: string;
  fileSizeBytes: number;
  sha256: string;
  totalPages: number;
  hasSelectableText: boolean;
  isScanned: boolean;
  docFamily: string;
  banca: string;
  ano: number | null;
  orgao: string;
  cargo: string;
  status: string;
  questionCount: number;
  verifiedCount: number;
  needsReviewCount: number;
  hasInconsistency?: boolean;
  inconsistencyReason?: string;
}

interface StagingQuestion {
  id: string;
  numeroOriginal: number;
  statement: string;
  options: string[];
  correctOption: string | null;
  gabaritoStatus: string;
  disciplina: string;
  assunto?: string;
  subassunto?: string;
  editalTopicoId?: string;
  disciplinaSugerida?: string;
  assuntoSugerido?: string;
  subassuntoSugerido?: string;
  rejectionType?: string; // RECUPERAVEL, DEFINITIVA
  supportMaterial?: SupportMaterial;
  justificativa?: string;
  textoApoio?: string;
  textoApoioTitulo?: string;
  status: string; // EXTRACTED, STRUCTURALLY_VALID, NEEDS_REVIEW, SOURCE_VERIFIED, REJECTED
  flags: string[];
  pages: number[];
  evidenceImage: string | null;
  reviewNotes?: string;
  modifiedByUser?: boolean;
}

interface StagingSession {
  sessionId: string;
  status: string;
  stepDescription: string;
  progressPercent: number;
  documents: StagingDocument[];
  metadata: Record<string, any>;
  summary?: {
    total_questions?: number;
    structurally_valid?: number;
    needs_review?: number;
    rejected?: number;
    raw_blocks_level2?: number;
    audit_exclusions_count?: number;
  };
  errorMessage?: string;
}

interface ImportSimulation {
  mode: string;
  totalStagingQuestions: number;
  verifiedReadyToImport: number;
  needsReviewCount: number;
  rejectedCount: number;
  collidingExistingQuestions: number;
  collidingQuestionIds: string[];
  warnings: string[];
  safeToImport: boolean;
  byDiscipline: Record<string, number>;
}

export default function ImportStudio() {
  const [ingestionToken, updateIngestionToken] = useState('');
  const [session, setSession] = useState<StagingSession | null>(null);
  const [questions, setQuestions] = useState<StagingQuestion[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Form metadata
  const [banca, setBanca] = useState('IBGP');
  const [ano, setAno] = useState('2023');
  const [orgao, setOrgao] = useState('Prefeitura Municipal de Araguari - MG');
  const [cargo, setCargo] = useState('Técnico Fiscal da Receita Municipal');
  const [cargoCodigo, setCargoCodigo] = useState('532');

  // Files to upload
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; role: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [simulationData, setSimulationData] = useState<ImportSimulation | null>(null);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Staging Acervo Discovery
  const [stagingFiles, setStagingFiles] = useState<StagingFile[]>([]);
  const [selectedStagingFile, setSelectedStagingFile] = useState<StagingFile | null>(null);
  const [stagingSearch, setStagingSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CENTRAL' | 'WIZARD' | 'ACERVO' | 'QUALIDADE' | 'UPLOAD'>('CENTRAL');
  const [stagingFilter, setStagingFilter] = useState<'ALL' | 'INCONSISTENT' | 'VERIFIED' | 'MANUAL'>('ALL');
  const [evidenceMode, setEvidenceMode] = useState<'PDF' | 'IMAGE'>('PDF');
  const [evidenceTab, setEvidenceTab] = useState<'PROVA' | 'GABARITO' | 'DUAL'>('DUAL');
  const [fileDocuments, setFileDocuments] = useState<StagingDocRole[]>([]);
  const [activeProvaPage, setActiveProvaPage] = useState<number>(1);
  const [activeGabaritoPage, setActiveGabaritoPage] = useState<number>(1);
  const [forceMultipleChoice, setForceMultipleChoice] = useState(false);
  const [isAuditingCockpitOpen, setIsAuditingCockpitOpen] = useState(false);

  useEffect(() => {
    setForceMultipleChoice(false);
  }, [activeQuestionId]);

  // Helper para identificar questões de Certo ou Errado (Cebraspe / CESPE)
  const isQuestionCertoErrado = (q?: StagingQuestion | null): boolean => {
    if (!q) return false;
    if (q.options && q.options.length === 2) {
      return true;
    }
    const stmt = (q.statement || '').toUpperCase();
    if (stmt.includes('JULGUE O ITEM') || stmt.includes('JULGUE OS ITENS') || stmt.includes('CERTO OU ERRADO')) {
      return true;
    }
    return false;
  };

  // Modais de Criação Manual
  const [isCreateExamModalOpen, setIsCreateExamModalOpen] = useState(false);
  const [newExamData, setNewExamData] = useState({
    banca: 'FGV',
    ano: '2024',
    orgao: 'SEFAZ-MG',
    cargo: 'Auditor Fiscal da Receita Estadual',
    filename: '',
  });

  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [newQuestionData, setNewQuestionData] = useState({
    numeroOriginal: 1,
    disciplina: 'Direito Tributário',
    assunto: '',
    subassunto: '',
    statement: '',
    options: [
      'A) ',
      'B) ',
      'C) ',
      'D) ',
      'E) ',
    ],
    correctOption: 'A',
    gabaritoStatus: 'PRELIMINAR',
    page: 1,
  });

  // Helper defensivo para chamadas HTTP
  async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await ingestionFetch(url, init);
    } catch (netErr: any) {
      throw new Error(`Falha de conexão com o servidor (${netErr.message || 'Failed to fetch'}). Verifique se o backend está em execução.`);
    }

    const rawText = await res.text();
    let data: any = null;
    if (rawText && rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText);
      } catch {
        if (!res.ok) {
          throw new Error(`Erro do servidor (HTTP ${res.status}): ${rawText.slice(0, 200)}`);
        }
        throw new Error(`Resposta inválida do servidor (HTTP ${res.status}): Conteúdo retornado não é JSON.`);
      }
    }

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `Erro na requisição (HTTP ${res.status})`;
      const execId = data?.executionId ? ` [ID: ${data.executionId}]` : '';
      throw new Error(`${errorMsg}${execId}`);
    }

    return data as T;
  }

  // Resume active session on reload
  useEffect(() => {
    let active = true;
    const sid = sessionStorage.getItem('fiscalstudy_staging_session_id');
    if (sid) {
      safeFetchJson<StagingSession>(`/api/v1/ingestion/sessions/${sid}`)
        .then((data: StagingSession) => {
          if (active && data) {
            setSession(data);
            if (data.status === 'FAILED') {
              setProcessingError(data.errorMessage || 'Sessão anterior finalizada com erro.');
            }
            return safeFetchJson<StagingQuestion[]>(`/api/v1/ingestion/sessions/${sid}/questions`);
          }
          return null;
        })
        .then((qList: StagingQuestion[] | null) => {
          if (active && qList && qList.length > 0) {
            setQuestions(qList);
            setActiveQuestionId(qList[0].id);
          }
        })
        .catch((e) => {
          console.error('Erro ao retomar sessão de staging:', e);
          sessionStorage.removeItem('fiscalstudy_staging_session_id');
        });
    }
    return () => {
      active = false;
    };
  }, []);

  const loadStagingFiles = () => {
    safeFetchJson<StagingFile[]>('/api/v1/ingestion/staging-files')
      .then((data) => {
        if (Array.isArray(data)) {
          setStagingFiles(data);
        }
      })
      .catch((err) => console.error('Erro ao buscar arquivos do staging:', err));
  };

  useEffect(() => {
    loadStagingFiles();
  }, []);

  const handleSelectStagingFile = async (file: StagingFile) => {
    setIsProcessing(true);
    setSelectedStagingFile(file);
    setSession(null);
    setActionMessage(`Carregando questões do caderno: ${file.filename}...`);
    try {
      const [qList, docs] = await Promise.all([
        safeFetchJson<StagingQuestion[]>(`/api/v1/ingestion/staging-files/${file.id}/questions`),
        safeFetchJson<StagingDocRole[]>(`/api/v1/ingestion/staging-files/${file.id}/documents`).catch(() => [])
      ]);
      const rawList = qList || [];
      // 1. Identificar Gaps na Numeração (Garantir que todas as questões da prova existam sem omissões)
      const existingNums = new Set(rawList.map((q) => q.numeroOriginal));
      const maxNum = rawList.reduce((max, q) => Math.max(max, q.numeroOriginal || 0), 0);
      const filledList: StagingQuestion[] = [...rawList];

      if (maxNum > 0) {
        for (let num = 1; num <= maxNum; num++) {
          if (!existingNums.has(num)) {
            // Cria questão pendente de preenchimento (Lacuna detectada)
            filledList.push({
              id: `gap-${file.id}-${num}`,
              numeroOriginal: num,
              statement: '⚠️ [Questão não detectada automaticamente pelo extrator. Por favor, consulte o caderno original ao lado e digite o enunciado e alternativas.]',
              options: [],
              correctOption: null,
              gabaritoStatus: 'PRELIMINAR',
              disciplina: file.cargo || 'Geral',
              status: 'INCOMPLETE',
              flags: ['EXTRACTION_GAP_DETECTED'],
              pages: [1],
              evidenceImage: null,
              reviewNotes: 'Questão gerada automaticamente como lacuna pendente de auditoria manual.',
            });
          }
        }
      }

      // Ordenar rigorosamente pela numeração sequencial original
      filledList.sort((a, b) => a.numeroOriginal - b.numeroOriginal);

      const normalizedQuestions = filledList.map((q) => {
        const normQ = { ...q };
        // Todas as provas que vamos fazer a auditoria devem ter gabarito status como PRELIMINAR
        if (!normQ.gabaritoStatus || normQ.gabaritoStatus === 'DEFINITIVO' || normQ.gabaritoStatus === 'AUSENTE') {
          normQ.gabaritoStatus = 'PRELIMINAR';
        }
        // Se a questão possui textoApoio mas supportMaterial está nulo/indefinido, sintetiza
        if (!normQ.supportMaterial && normQ.textoApoio) {
          normQ.supportMaterial = {
            tipo: 'TEXTO_BASE',
            titulo: normQ.textoApoioTitulo || 'Texto de Apoio 1',
            conteudoTexto: normQ.textoApoio,
            docOrigem: 'Caderno de Prova',
          };
        } else if (normQ.supportMaterial && !normQ.textoApoio) {
          normQ.textoApoio = normQ.supportMaterial.conteudoTexto || '';
          normQ.textoApoioTitulo = normQ.supportMaterial.titulo || '';
        }
        return normQ;
      });
      setQuestions(normalizedQuestions);
      setFileDocuments(docs || []);

      const gabDoc = docs?.find((d) => d.docRole && d.docRole.includes('GABARITO'));
      if (gabDoc && gabDoc.pageStart) {
        setActiveGabaritoPage(gabDoc.pageStart);
      } else {
        setActiveGabaritoPage(file.totalPages || 1);
      }

      if (qList && qList.length > 0) {
        setActiveQuestionId(qList[0].id);
        if (qList[0].pages && qList[0].pages.length > 0) {
          setActiveProvaPage(qList[0].pages[0]);
        } else {
          setActiveProvaPage(1);
        }
        setIsAuditingCockpitOpen(true);
      } else {
        setActiveQuestionId(null);
        setActiveProvaPage(1);
      }
    } catch (err: any) {
      alert('Erro ao carregar questões do caderno: ' + err.message);
    } finally {
      setIsProcessing(false);
      setActionMessage(null);
    }
  };

  const handleOpenPdfInNewTab = (fileId?: string, page?: number) => {
    const fid = fileId || selectedStagingFile?.id;
    if (fid) {
      const pageHash = page && page > 1 ? `#page=${page}` : '';
      window.open(`/api/v1/ingestion/staging-files/${fid}/pdf${pageHash}`, '_blank');
    } else if (session?.sessionId) {
      const pageHash = page && page > 1 ? `#page=${page}` : '';
      window.open(`/api/v1/ingestion/sessions/${session.sessionId}/pdf${pageHash}`, '_blank');
    } else {
      alert('Nenhum documento PDF disponível para abrir.');
    }
  };

  const handleDeleteExam = async (fileId: string, filename: string) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir permanentemente o caderno:\n"${filename}"?\n\nEsta ação apagará todas as questões e registros associados do acervo.`
    );
    if (!confirmed) return;

    try {
      setIsProcessing(true);
      setActionMessage(`Excluindo caderno ${filename}...`);
      const res = await ingestionFetch(`/api/v1/ingestion/staging-files/${fileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erro HTTP ${res.status}`);
      }
      alert('Prova excluída com sucesso do acervo!');
      if (selectedStagingFile?.id === fileId) {
        setSelectedStagingFile(null);
        setQuestions([]);
        setActiveQuestionId(null);
      }
      loadStagingFiles();
    } catch (err: any) {
      alert('Falha ao excluir prova: ' + err.message);
    } finally {
      setIsProcessing(false);
      setActionMessage(null);
    }
  };

  const handleCreateManualExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamData.banca.trim()) {
      alert('Informe a banca examinadora da prova.');
      return;
    }
    try {
      setIsProcessing(true);
      setActionMessage('Cadastrando novo caderno de prova manual...');
      const created = await safeFetchJson<StagingFile>('/api/v1/ingestion/staging-files/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExamData),
      });
      setIsCreateExamModalOpen(false);
      setNewExamData({ banca: 'FGV', ano: '2024', orgao: 'SEFAZ-MG', cargo: 'Auditor Fiscal da Receita Estadual', filename: '' });
      loadStagingFiles();
      alert(`Caderno "${created.filename}" criado com sucesso! Agora você pode cadastrar as questões.`);
      handleSelectStagingFile(created);
    } catch (err: any) {
      alert('Erro ao cadastrar prova: ' + err.message);
    } finally {
      setIsProcessing(false);
      setActionMessage(null);
    }
  };

  const handleCreateManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStagingFile) {
      alert('Selecione um caderno de prova antes de cadastrar uma questão.');
      return;
    }
    if (!newQuestionData.statement.trim()) {
      alert('Informe o enunciado da questão.');
      return;
    }
    const cleanOptions = newQuestionData.options.filter((o) => o && o.trim().length > 0);
    if (cleanOptions.length < 2) {
      alert('Informe pelo menos 2 alternativas válidas para a questão.');
      return;
    }

    try {
      setIsProcessing(true);
      setActionMessage('Salvando questão manual...');
      const payload = {
        numeroOriginal: newQuestionData.numeroOriginal,
        statement: newQuestionData.statement,
        options: cleanOptions,
        correctOption: newQuestionData.correctOption,
        gabaritoStatus: newQuestionData.gabaritoStatus,
        disciplina: newQuestionData.disciplina,
        assunto: newQuestionData.assunto,
        subassunto: newQuestionData.subassunto,
        pages: [newQuestionData.page || 1],
        status: 'SOURCE_VERIFIED',
      };

      const created = await safeFetchJson<StagingQuestion>(
        `/api/v1/ingestion/staging-files/${selectedStagingFile.id}/questions/manual`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      setIsAddQuestionModalOpen(false);
      setNewQuestionData({
        numeroOriginal: (created.numeroOriginal || questions.length) + 1,
        disciplina: newQuestionData.disciplina,
        assunto: newQuestionData.assunto,
        subassunto: '',
        statement: '',
        options: ['A) ', 'B) ', 'C) ', 'D) ', 'E) '],
        correctOption: 'A',
        gabaritoStatus: 'DEFINITIVO',
        page: newQuestionData.page || 1,
      });

      setQuestions((prev) => [...prev, created]);
      setActiveQuestionId(created.id);
      loadStagingFiles();
      alert(`Questão ${created.numeroOriginal} salva com sucesso como verificada!`);
    } catch (err: any) {
      alert('Erro ao cadastrar questão manual: ' + err.message);
    } finally {
      setIsProcessing(false);
      setActionMessage(null);
    }
  };

  const handleDeleteCurrentQuestion = async () => {
    if (!activeQuestion) return;
    const confirmed = window.confirm(
      `Deseja realmente excluir a Questão ${activeQuestion.numeroOriginal}?`
    );
    if (!confirmed) return;

    try {
      await ingestionFetch(`/api/v1/ingestion/staging-questions/${activeQuestion.id}`, {
        method: 'DELETE',
      });
      const remaining = questions.filter((q) => q.id !== activeQuestion.id);
      setQuestions(remaining);
      setActiveQuestionId(remaining.length > 0 ? remaining[0].id : null);
      loadStagingFiles();
      alert('Questão removida.');
    } catch (err: any) {
      alert('Erro ao excluir questão: ' + err.message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((f) => {
        const nameUpper = f.name.toUpperCase();
        let role = 'PROVA';
        if (nameUpper.includes('GAB_DEF') || nameUpper.includes('DEFINITIVO')) role = 'GABARITO_DEFINITIVO';
        else if (nameUpper.includes('GAB')) role = 'GABARITO_PRELIMINAR';
        else if (nameUpper.includes('EDITAL') || nameUpper.includes('PROGRAMATICO') || nameUpper.includes('PROGRAMÁTICO')) role = 'EDITAL';
        return { file: f, role };
      });
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0) {
      alert('Selecione pelo menos um arquivo de prova para iniciar.');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    setActionMessage('Criando sessão de staging...');

    try {
      // 1. Cria sessão com identificador seguro
      const sessData = await safeFetchJson<StagingSession>('/api/v1/ingestion/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banca,
          ano: parseInt(ano, 10),
          orgao,
          cargo,
          cargo_codigo: cargoCodigo,
        }),
      });
      const sessionId = sessData.sessionId;
      sessionStorage.setItem('fiscalstudy_staging_session_id', sessionId);
      setSession(sessData);

      // 2. Envia arquivos individualmente verificando status e integridade
      for (const item of selectedFiles) {
        setActionMessage(`Enviando ${item.file.name} (${(item.file.size / (1024 * 1024)).toFixed(1)} MB)...`);
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('role', item.role);

        await safeFetchJson<StagingDocument>(`/api/v1/ingestion/sessions/${sessionId}/upload`, {
          method: 'POST',
          body: formData,
        });
      }

      // 3. Dispara processamento documental no backend (retorno assíncrono imediato)
      setActionMessage('Disparando pipeline de extração e análise documental...');
      const initSession = await safeFetchJson<StagingSession>(`/api/v1/ingestion/sessions/${sessionId}/process`, {
        method: 'POST',
      });
      setSession(initSession);

      // 4. Polling ativo de progresso em tempo real
      let currentStatus = initSession.status;
      let pollSession = initSession;
      while (currentStatus !== 'AWAITING_REVIEW' && currentStatus !== 'FAILED' && currentStatus !== 'CANCELLED') {
        await new Promise((r) => setTimeout(r, 1200));
        pollSession = await safeFetchJson<StagingSession>(`/api/v1/ingestion/sessions/${sessionId}`);
        setSession(pollSession);
        currentStatus = pollSession.status;
        if (pollSession.stepDescription) {
          setActionMessage(`${pollSession.stepDescription} (${pollSession.progressPercent}%)`);
        }
      }

      if (pollSession.status === 'FAILED') {
        setProcessingError(pollSession.errorMessage || 'Falha na extração de questões do documento.');
        setActionMessage(null);
        return;
      }

      if (pollSession.status === 'CANCELLED') {
        setProcessingError('Processamento cancelado.');
        setActionMessage(null);
        return;
      }

      // 5. Carrega questões extraídas
      setActionMessage('Carregando questões estruturadas para o Studio...');
      const qList = await safeFetchJson<StagingQuestion[]>(`/api/v1/ingestion/sessions/${sessionId}/questions`);
      setQuestions(qList);
      if (qList.length > 0) {
        setActiveQuestionId(qList[0].id);
      }
      setActionMessage(null);
    } catch (err: any) {
      console.error(err);
      setProcessingError(err.message || 'Erro inesperado durante o processamento.');
      setActionMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelProcessing = async () => {
    if (!session) return;
    try {
      setActionMessage('Solicitando cancelamento do pipeline...');
      const cancelledSession = await safeFetchJson<StagingSession>(`/api/v1/ingestion/sessions/${session.sessionId}/cancel`, {
        method: 'POST',
      });
      setSession(cancelledSession);
      setActionMessage(null);
      setProcessingError('Processamento cancelado pelo usuário.');
    } catch (e: any) {
      alert('Erro ao cancelar: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetSession = () => {
    sessionStorage.removeItem('fiscalstudy_staging_session_id');
    setSession(null);
    setQuestions([]);
    setActiveQuestionId(null);
    setProcessingError(null);
    setActionMessage(null);
  };

  const handleRunDemoPreset = async (code: string) => {
    setIsProcessing(true);
    setProcessingError(null);
    setActionMessage(
      code === '503'
        ? 'Carregando Golden Set Auditor Fiscal 503...'
        : 'Carregando Golden Set Técnico Fiscal 532 (Prova IBGP 2023)...'
    );
    try {
      const demoSession = await safeFetchJson<StagingSession>(`/api/v1/ingestion/demo?cargo=${code}`, {
        method: 'POST',
      });
      setSession(demoSession);
      sessionStorage.setItem('fiscalstudy_staging_session_id', demoSession.sessionId);

      if (demoSession.status === 'FAILED') {
        setProcessingError(demoSession.errorMessage || 'Falha ao processar preset.');
        return;
      }

      const qList = await safeFetchJson<StagingQuestion[]>(`/api/v1/ingestion/sessions/${demoSession.sessionId}/questions`);
      setQuestions(qList);
      if (qList.length > 0) {
        const q15 = qList.find((q) => q.numeroOriginal === 15);
        setActiveQuestionId(q15 ? q15.id : qList[0].id);
      }
    } catch (e: any) {
      console.error(e);
      setProcessingError(e.message || 'Erro ao carregar preset demo.');
    } finally {
      setIsProcessing(false);
      setActionMessage(null);
    }
  };

  const [editalTopicos, setEditalTopicos] = useState<{ id: string; disciplina: string; assunto: string; subassunto?: string }[]>([]);

  useEffect(() => {
    const activeConcursoId = localStorage.getItem('fiscalstudy_active_concurso_id');
    if (!activeConcursoId) return;
    safeFetchJson<any>(`/api/v1/concursos/${activeConcursoId}/edital`)
      .then((data) => {
        if (data && Array.isArray(data.topicos)) {
          setEditalTopicos(data.topicos);
        }
      })
      .catch(() => {});
  }, []);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  useEffect(() => {
    if (activeQuestion?.pages && activeQuestion.pages.length > 0) {
      setActiveProvaPage(activeQuestion.pages[0]);
    }
  }, [activeQuestionId]);

  const handleProvaPageChange = (delta: number) => {
    const maxP = selectedStagingFile?.totalPages || 999;
    setActiveProvaPage((p) => Math.min(maxP, Math.max(1, p + delta)));
  };

  const handleGabaritoPageChange = (delta: number) => {
    const maxP = selectedStagingFile?.totalPages || 999;
    setActiveGabaritoPage((p) => Math.min(maxP, Math.max(1, p + delta)));
  };

  const handleUpdateQuestionField = (field: string, value: any) => {
    if (!activeQuestion) return;
    setQuestions((prev) =>
      prev.map((q) => (q.id === activeQuestion.id ? { ...q, [field]: value, modifiedByUser: true } : q))
    );
  };

  const handleUpdateOption = (index: number, newText: string) => {
    if (!activeQuestion) return;
    const newOptions = [...activeQuestion.options];
    newOptions[index] = newText;
    handleUpdateQuestionField('options', newOptions);
  };

  const handleAddOption = () => {
    if (!activeQuestion) return;
    const nextLetter = String.fromCharCode(65 + activeQuestion.options.length);
    const newOptions = [...activeQuestion.options, `${nextLetter}) Nova alternativa`];
    handleUpdateQuestionField('options', newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (!activeQuestion) return;
    if (activeQuestion.options.length <= 1) {
      alert('A questão deve possuir ao menos 1 alternativa.');
      return;
    }
    const newOptions = activeQuestion.options.filter((_, idx) => idx !== index);
    handleUpdateQuestionField('options', newOptions);
  };

  const handleMoveOption = (index: number, direction: 'UP' | 'DOWN') => {
    if (!activeQuestion) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeQuestion.options.length) return;
    const newOptions = [...activeQuestion.options];
    const temp = newOptions[index];
    newOptions[index] = newOptions[targetIdx];
    newOptions[targetIdx] = temp;
    handleUpdateQuestionField('options', newOptions);
  };

  const handleApplySuggestion = () => {
    if (!activeQuestion) return;
    if (activeQuestion.disciplinaSugerida) {
      handleUpdateQuestionField('disciplina', activeQuestion.disciplinaSugerida);
    }
    if (activeQuestion.assuntoSugerido) {
      handleUpdateQuestionField('assunto', activeQuestion.assuntoSugerido);
    }
    if (activeQuestion.subassuntoSugerido) {
      handleUpdateQuestionField('subassunto', activeQuestion.subassuntoSugerido);
    }
    if (activeQuestion.editalTopicoId) {
      handleUpdateQuestionField('editalTopicoId', activeQuestion.editalTopicoId);
    }
  };

  const handleSelectEditalTopico = (topicoId: string) => {
    const topico = editalTopicos.find((t) => t.id === topicoId);
    if (!topico) return;
    handleUpdateQuestionField('editalTopicoId', topico.id);
    handleUpdateQuestionField('disciplina', topico.disciplina);
    handleUpdateQuestionField('assunto', topico.assunto);
    if (topico.subassunto) {
      handleUpdateQuestionField('subassunto', topico.subassunto);
    }
  };

  const handlePrevQuestion = () => {
    if (!filteredQuestions.length || !activeQuestion) return;
    const currIdx = filteredQuestions.findIndex((q) => q.id === activeQuestion.id);
    if (currIdx > 0) {
      setActiveQuestionId(filteredQuestions[currIdx - 1].id);
    }
  };

  const handleNextQuestion = () => {
    if (!filteredQuestions.length || !activeQuestion) return;
    const currIdx = filteredQuestions.findIndex((q) => q.id === activeQuestion.id);
    if (currIdx < filteredQuestions.length - 1) {
      setActiveQuestionId(filteredQuestions[currIdx + 1].id);
    }
  };

  const handleSaveCorrections = async () => {
    if (!activeQuestion) return;
    try {
      const isCE = isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice;
      let finalCorrectOption = activeQuestion.correctOption;
      if (isCE && finalCorrectOption) {
        const upper = finalCorrectOption.toUpperCase().trim();
        if (upper === 'A' || upper === 'C' || upper.startsWith('CERT') || upper === 'CORRETO') {
          finalCorrectOption = 'C';
        } else if (upper === 'B' || upper === 'E' || upper.startsWith('ERR') || upper === 'INCORRETO') {
          finalCorrectOption = 'E';
        }
      }

      let finalOptions = activeQuestion.options;
      if (isCE && Array.isArray(finalOptions) && finalOptions.length === 2) {
        const o0 = (finalOptions[0] || '').trim();
        const o1 = (finalOptions[1] || '').trim();
        const clean0 = o0.toUpperCase().startsWith('C)') ? o0 : `C) ${o0.replace(/^[A-Za-z]\)\s*/, '') || 'CERTO'}`;
        const clean1 = o1.toUpperCase().startsWith('E)') ? o1 : `E) ${o1.replace(/^[A-Za-z]\)\s*/, '') || 'ERRADO'}`;
        finalOptions = [clean0, clean1];
      }

      const finalTextoApoio = (activeQuestion.supportMaterial?.conteudoTexto !== undefined)
        ? (activeQuestion.supportMaterial?.conteudoTexto || '')
        : (activeQuestion.textoApoio || '');
      const finalTextoApoioTitulo = (activeQuestion.supportMaterial?.titulo !== undefined)
        ? (activeQuestion.supportMaterial?.titulo || '')
        : (activeQuestion.textoApoioTitulo || '');

      const finalSupportMaterial: SupportMaterial | undefined = finalTextoApoio ? {
        tipo: activeQuestion.supportMaterial?.tipo || 'TEXTO_BASE',
        titulo: finalTextoApoioTitulo || 'Texto de Apoio 1',
        conteudoTexto: finalTextoApoio,
        docOrigem: activeQuestion.supportMaterial?.docOrigem || 'Caderno de Prova',
      } : undefined;

      let res: Response;
      if (activeQuestion.id.startsWith('gap-') && selectedStagingFile) {
        // Gap preenchido manualmente: persiste como nova questão no staging
        res = await ingestionFetch(`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/questions/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numeroOriginal: activeQuestion.numeroOriginal,
            pages: [activeProvaPage],
            statement: activeQuestion.statement,
            options: finalOptions,
            correctOption: finalCorrectOption,
            gabaritoStatus: activeQuestion.gabaritoStatus || 'PRELIMINAR',
            disciplina: activeQuestion.disciplina || selectedStagingFile.cargo || 'Geral',
            assunto: activeQuestion.assunto,
            subassunto: activeQuestion.subassunto,
            editalTopicoId: activeQuestion.editalTopicoId,
            justificativa: activeQuestion.justificativa,
            textoApoio: finalTextoApoio,
            textoApoioTitulo: finalTextoApoioTitulo,
            supportMaterial: finalSupportMaterial,
            status: activeQuestion.status === 'INCOMPLETE' ? 'NEEDS_REVIEW' : activeQuestion.status,
            reviewNotes: activeQuestion.reviewNotes,
          }),
        });
      } else {
        const url = session
          ? `/api/v1/ingestion/sessions/${session.sessionId}/questions/${activeQuestion.id}`
          : `/api/v1/ingestion/staging-questions/${activeQuestion.id}`;

        res = await ingestionFetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numeroOriginal: activeQuestion.numeroOriginal,
            pages: [activeProvaPage],
            statement: activeQuestion.statement,
            options: finalOptions,
            correctOption: finalCorrectOption,
            gabaritoStatus: activeQuestion.gabaritoStatus,
            disciplina: activeQuestion.disciplina,
            assunto: activeQuestion.assunto,
            subassunto: activeQuestion.subassunto,
            editalTopicoId: activeQuestion.editalTopicoId,
            rejectionType: activeQuestion.rejectionType,
            supportMaterial: finalSupportMaterial,
            justificativa: activeQuestion.justificativa,
            textoApoio: finalTextoApoio,
            textoApoioTitulo: finalTextoApoioTitulo,
            status: activeQuestion.status,
            reviewNotes: activeQuestion.reviewNotes,
          }),
        });
      }

      if (res.ok) {
        const savedQ: StagingQuestion = await res.json();
        const mergedSavedQ: StagingQuestion = {
          ...savedQ,
          pages: [activeProvaPage],
          supportMaterial: savedQ.supportMaterial || finalSupportMaterial,
          textoApoio: savedQ.textoApoio ?? finalTextoApoio,
          textoApoioTitulo: savedQ.textoApoioTitulo ?? finalTextoApoioTitulo,
        };
        setQuestions((prev) =>
          prev.map((q) => (q.id === activeQuestion.id || q.id === savedQ.id ? mergedSavedQ : q))
        );
        setActiveQuestionId(savedQ.id);
        alert('Correções salvas com sucesso no staging!');
      } else {
        const errText = await res.text();
        throw new Error(errText || `Erro HTTP ${res.status}`);
      }
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  const handleReplicateSupportMaterial = (sourceQ: StagingQuestion, targetQuestionId: string) => {
    const finalTexto = (sourceQ.supportMaterial?.conteudoTexto !== undefined)
      ? sourceQ.supportMaterial?.conteudoTexto
      : sourceQ.textoApoio;
    const finalTitulo = (sourceQ.supportMaterial?.titulo !== undefined)
      ? sourceQ.supportMaterial?.titulo
      : sourceQ.textoApoioTitulo;

    const mat: SupportMaterial | undefined = finalTexto ? {
      tipo: sourceQ.supportMaterial?.tipo || 'TEXTO_BASE',
      titulo: finalTitulo || 'Texto de Apoio 1',
      conteudoTexto: finalTexto,
      docOrigem: sourceQ.supportMaterial?.docOrigem || 'Caderno de Prova',
    } : undefined;

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === targetQuestionId
          ? {
              ...q,
              supportMaterial: mat ? { ...mat } : undefined,
              textoApoio: finalTexto || '',
              textoApoioTitulo: finalTitulo || '',
              modifiedByUser: true,
            }
          : q
      )
    );
  };

  const handleMarkVerified = async () => {
    if (!activeQuestion) return;
    try {
      const url = session
        ? `/api/v1/ingestion/sessions/${session.sessionId}/questions/${activeQuestion.id}/verify`
        : `/api/v1/ingestion/staging-questions/${activeQuestion.id}/verify`;

      const res = await ingestionFetch(url, { method: 'POST' });
      if (res.ok) {
        const verifiedQ: StagingQuestion = await res.json();
        setQuestions((prev) => prev.map((q) => (q.id === verifiedQ.id ? verifiedQ : q)));
        loadStagingFiles();
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleMarkRejected = async (type: 'RECUPERAVEL' | 'DEFINITIVA' = 'RECUPERAVEL') => {
    if (!activeQuestion) return;
    try {
      // Atualiza tipo de rejeição
      const putUrl = session
        ? `/api/v1/ingestion/sessions/${session.sessionId}/questions/${activeQuestion.id}`
        : `/api/v1/ingestion/staging-questions/${activeQuestion.id}`;

      await ingestionFetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionType: type,
        }),
      });

      const postUrl = session
        ? `/api/v1/ingestion/sessions/${session.sessionId}/questions/${activeQuestion.id}/reject`
        : `/api/v1/ingestion/staging-questions/${activeQuestion.id}/reject`;

      const res = await ingestionFetch(postUrl, { method: 'POST' });
      if (res.ok) {
        const rejectedQ: StagingQuestion = await res.json();
        rejectedQ.rejectionType = type;
        setQuestions((prev) => prev.map((q) => (q.id === rejectedQ.id ? rejectedQ : q)));
        loadStagingFiles();
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleSimulateImport = async () => {
    if (session) {
      try {
        const res = await ingestionFetch(`/api/v1/ingestion/sessions/${session.sessionId}/simulate-import`, {
          method: 'POST',
        });
        if (res.ok) {
          const simData: ImportSimulation = await res.json();
          setSimulationData(simData);
          setIsSimulationOpen(true);
        }
      } catch (e: any) {
        alert('Erro na simulação: ' + e.message);
      }
    } else if (selectedStagingFile) {
      const verified = questions.filter((q) => q.status === 'SOURCE_VERIFIED' || q.status === 'STRUCTURALLY_VALID').length;
      const needsRev = questions.filter((q) => q.status === 'NEEDS_REVIEW').length;
      const rej = questions.filter((q) => q.status === 'REJECTED').length;
      const simData: ImportSimulation = {
        mode: 'TEST_MODE_DRY_RUN (Acervo Staging)',
        totalStagingQuestions: questions.length,
        verifiedReadyToImport: verified,
        needsReviewCount: needsRev,
        rejectedCount: rej,
        collidingExistingQuestions: 0,
        collidingQuestionIds: [],
        warnings: needsRev > 0 ? [`${needsRev} questões ainda requerem revisão humana antes de publicação`] : [],
        safeToImport: verified > 0,
        byDiscipline: {},
      };
      setSimulationData(simData);
      setIsSimulationOpen(true);
    }
  };

  const handleConfirmedImport = async () => {
    if (!session && !selectedStagingFile) return;
    if (!confirm('Deseja realmente publicar as questões verificadas no repositório seguro com backup físico automático prévio?')) return;
    try {
      if (session) {
        const res = await ingestionFetch(`/api/v1/ingestion/sessions/${session.sessionId}/import-confirmed`, {
          method: 'POST',
        });
        if (res.ok) {
          const result = await res.json();
          alert(`Importação concluída com sucesso! ${result.imported_count} questões verificadas salvas.`);
          setIsSimulationOpen(false);
        }
      } else if (selectedStagingFile) {
        const res = await ingestionFetch(`/api/v1/ingestion/staging-publish?fileId=${selectedStagingFile.id}`, {
          method: 'POST',
        });
        if (res.ok) {
          const result = await res.json();
          alert(`Publicação autorizada concluída com sucesso!\n• Questões publicadas: ${result.published_count || 0}\n• Backup gerado: ${result.backup_path || 'Verificado'}`);
          setIsSimulationOpen(false);
          loadStagingFiles();
        } else {
          const err = await res.json();
          alert('Erro ao publicar: ' + (err.error || 'Falha na publicação'));
        }
      }
    } catch (e: any) {
      alert('Erro na importação: ' + e.message);
    }
  };

  // Filtragem estrita conforme requisitos da Fase 6
  const filteredQuestions = questions.filter((q) => {
    if (filterStatus === 'VERIFIED') return q.status === 'SOURCE_VERIFIED';
    if (filterStatus === 'PENDING') return q.status === 'NEEDS_REVIEW' || q.status === 'EXTRACTED';
    if (filterStatus === 'INCOMPLETE') {
      const minOpts = isQuestionCertoErrado(q) ? 2 : 4;
      return !q.options || q.options.length < minOpts || !q.statement;
    }
    if (filterStatus === 'REJECTED_EXTRACTOR') return q.status === 'REJECTED';
    if (filterStatus === 'SUSPECT_OCR') return q.flags && (q.flags.includes('SUSPECT_OCR') || q.flags.includes('SUSPECT_OCR_LIGATURE'));
    if (filterStatus === 'AMBIGUOUS_KEY') return q.gabaritoStatus === 'SOB_REVISAO' || (q.flags && q.flags.includes('AMBIGUOUS_ANSWER_KEY'));
    if (filterStatus === 'MISSING_SUPPORT_MATERIAL') return q.flags && q.flags.includes('SUPPORT_MATERIAL_MISSING');
    return true;
  });

  const validCount = questions.filter(
    (q) => q.status === 'STRUCTURALLY_VALID' || q.status === 'SOURCE_VERIFIED'
  ).length;
  const reviewCount = questions.filter((q) => q.status === 'NEEDS_REVIEW').length;
  const rejectedCount = questions.filter((q) => q.status === 'REJECTED').length;

  return (
    <div className="import-studio animate-fade-in">
      {/* Error Banner */}
      {processingError && (
        <div className="glass" style={{ borderLeft: '4px solid #ef4444', padding: '1rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h4 style={{ color: '#ef4444', margin: 0, fontSize: '1rem', fontWeight: 700 }}>⚠️ Falha ou Alerta no Pipeline Documental</h4>
              <p style={{ color: 'var(--text-color, #1e293b)', margin: '0.35rem 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{processingError}</p>
              {session?.stepDescription && (
                <p style={{ color: '#94a3b8', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Última etapa: {session.stepDescription}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleResetSession} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                Nova Importação
              </button>
              <button className="btn btn-secondary" onClick={() => setProcessingError(null)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                Dispensar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="studio-header glass">
        <div className="studio-title">
          <h2>Central de Ingestão & Revisão Documental</h2>
          <p>Extração fiel à fonte com isolamento de layout, rastreabilidade e verificação visual lado a lado</p>
        </div>
        <div className="header-actions">
          <label>Token administrativo
            <input type="password" autoComplete="off" value={ingestionToken} onChange={e => { updateIngestionToken(e.target.value); setIngestionToken(e.target.value); }} />
          </label>
          {(session || selectedStagingFile) && questions.length > 0 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleResetSession}
                style={{ fontSize: '0.85rem', padding: '6px 14px' }}
              >
                📁 Nova Importação / Voltar
              </button>
              <button className="btn btn-secondary" onClick={handleSimulateImport}>
                🔍 Simular Importação (Modo Teste)
              </button>
              <button
                className="btn"
                style={{ background: '#10b981' }}
                onClick={handleConfirmedImport}
                disabled={validCount === 0}
              >
                📥 Importar Aprovadas ({validCount})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preset Banner */}
      {(!session && !selectedStagingFile || questions.length === 0) && (
        <div className="preset-banner glass">
          <div className="preset-info">
            <strong>⚡ Teste Rápido com Caderno de Prova Modelo</strong>
            <span>
              Teste em 1 clique a extração e validação de gabarito oficial com cadernos reais de concursos anteriores.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleRunDemoPreset('532')}
              disabled={isProcessing}
            >
              Carregar Técnico Fiscal (532)
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleRunDemoPreset('503')}
              disabled={isProcessing}
            >
              Carregar Auditor Fiscal (503)
            </button>
          </div>
        </div>
      )}

      {/* Mode Switcher Tabs - Módulo H */}
      {(!session && !selectedStagingFile || questions.length === 0) && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'CENTRAL' ? '' : 'btn-secondary'}`}
            style={activeTab === 'CENTRAL' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('CENTRAL')}
            title="Acompanhar extrações, identificar problemas e reprocessar provas com integridade"
          >
            📊 Central de Processamento
          </button>
          <button
            className={`btn ${activeTab === 'WIZARD' ? '' : 'btn-secondary'}`}
            style={activeTab === 'WIZARD' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('WIZARD')}
            title="Assistente de importação de provas e gabaritos em 5 etapas com integridade em staging"
          >
            🪄 Assistente de Importação
          </button>
          <button
            className={`btn ${activeTab === 'ACERVO' ? '' : 'btn-secondary'}`}
            style={activeTab === 'ACERVO' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('ACERVO')}
            title="Catálogo geral de provas em staging para auditoria detalhada e cadastro manual"
          >
            📚 Catálogo do Acervo ({stagingFiles.length})
          </button>
          <button
            className={`btn ${activeTab === 'QUALIDADE' ? '' : 'btn-secondary'}`}
            style={activeTab === 'QUALIDADE' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('QUALIDADE')}
            title="Monitorar a confiabilidade do acervo publicado e suspender itens com inconsistência sem apagar histórico"
          >
            🛡️ Qualidade do Banco
          </button>
          <button
            className={`btn ${activeTab === 'UPLOAD' ? '' : 'btn-secondary'}`}
            style={activeTab === 'UPLOAD' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('UPLOAD')}
            title="Upload manual com drag-and-drop de arquivos para extração"
          >
            📤 Upload Local
          </button>
        </div>
      )}

      {/* T30: Central de Processamento */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'CENTRAL' && (
        <CentralProcessamento
          stagingFiles={stagingFiles}
          onOpenAudit={(fileId: string) => {
            const f = stagingFiles.find((s) => s.id === fileId);
            if (f) handleSelectStagingFile(f);
          }}
          onOpenWizard={() => setActiveTab('WIZARD')}
          onRefresh={loadStagingFiles}
        />
      )}

      {/* T29: Assistente de Importação de Provas (5 Etapas) */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'WIZARD' && (
        <AssistenteImportacaoWizard
          onComplete={(_res?: any) => {
            loadStagingFiles();
            setActiveTab('CENTRAL');
          }}
          onCancel={() => setActiveTab('CENTRAL')}
        />
      )}

      {/* T35: Qualidade do Banco de Questões */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'QUALIDADE' && (
        <QualidadeBancoQuestoes
          onOpenAudit={(_questionId?: string) => {
            // Se encontrar a prova correspondente no acervo, abre auditoria
            if (stagingFiles.length > 0) {
              handleSelectStagingFile(stagingFiles[0]);
            }
          }}
        />
      )}

      {/* Acervo Browser View */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'ACERVO' && (
        <div className="upload-card glass animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-color, #1e293b)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📚 Catálogo de Documentos do Acervo (Isolamento Staging)
              </h3>
              <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Audite provas lado a lado com o PDF original, filtre inconsistências ou cadastre cadernos e questões manualmente.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => setIsCreateExamModalOpen(true)}
                style={{ padding: '6px 14px', fontSize: '0.85rem', background: '#10b981', color: '#fff' }}
              >
                ➕ Cadastrar Nova Prova Manualmente
              </button>
              <button
                className="btn btn-secondary"
                onClick={loadStagingFiles}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                title="Recarregar catálogo"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs & Summary Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                className={`tab-filter-btn ${stagingFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStagingFilter('ALL')}
              >
                Todas ({stagingFiles.length})
              </button>
              <button
                className={`tab-filter-btn ${stagingFilter === 'INCONSISTENT' ? 'active' : ''}`}
                onClick={() => setStagingFilter('INCONSISTENT')}
                style={stagingFilter === 'INCONSISTENT' ? { background: '#d97706', borderColor: '#f59e0b' } : {}}
              >
                ⚠️ Com Inconsistências ({stagingFiles.filter((f) => f.hasInconsistency).length})
              </button>
              <button
                className={`tab-filter-btn ${stagingFilter === 'VERIFIED' ? 'active' : ''}`}
                onClick={() => setStagingFilter('VERIFIED')}
                style={stagingFilter === 'VERIFIED' ? { background: '#059669', borderColor: '#10b981' } : {}}
              >
                ✓ 100% Verificadas ({stagingFiles.filter((f) => f.questionCount > 0 && f.verifiedCount === f.questionCount).length})
              </button>
              <button
                className={`tab-filter-btn ${stagingFilter === 'MANUAL' ? 'active' : ''}`}
                onClick={() => setStagingFilter('MANUAL')}
              >
                ✏️ Manuais ({stagingFiles.filter((f) => f.relPath?.startsWith('manual/')).length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="stat-pill pill-total" style={{ fontSize: '0.8rem' }}>
                {stagingFiles.reduce((acc, f) => acc + f.questionCount, 0)} Questões Extraídas
              </span>
            </div>
          </div>

          {/* Search Filter */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Filtrar por Banca (ex: FGV, IBGP, CONSULPAM), Ano, Cargo, motivo de inconsistência ou arquivo..."
              value={stagingSearch}
              onChange={(e) => setStagingSearch(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Files List Table */}
          <div style={{ maxHeight: '460px', overflowY: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--calm-bg-subtle, #f8fafc)', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-muted, #64748b)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Documento / Prova</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Banca</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ano</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cargo</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status / Questões</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {stagingFiles
                  .filter((f) => {
                    if (stagingFilter === 'INCONSISTENT' && !f.hasInconsistency) return false;
                    if (stagingFilter === 'VERIFIED' && (f.questionCount === 0 || f.verifiedCount !== f.questionCount)) return false;
                    if (stagingFilter === 'MANUAL' && !f.relPath?.startsWith('manual/')) return false;

                    if (!stagingSearch.trim()) return true;
                    const q = stagingSearch.toLowerCase();
                    return (
                      f.filename.toLowerCase().includes(q) ||
                      (f.banca && f.banca.toLowerCase().includes(q)) ||
                      (f.cargo && f.cargo.toLowerCase().includes(q)) ||
                      (f.ano && String(f.ano).includes(q)) ||
                      (f.inconsistencyReason && f.inconsistencyReason.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 150)
                  .map((f) => {
                    const isManual = f.relPath?.startsWith('manual/');
                    return (
                      <tr
                        key={f.id}
                        style={{
                          borderBottom: '1px solid var(--border-color, #e2e8f0)',
                          background: f.hasInconsistency ? 'rgba(245, 158, 11, 0.04)' : f.questionCount > 0 ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-color, #1e293b)', fontWeight: 500 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{isManual ? '✏️' : '📄'}</span>
                              <span title={f.filename} style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.filename}
                              </span>
                              {isManual && (
                                <span className="suggestion-chip" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: '#10b981' }}>
                                  Manual
                                </span>
                              )}
                            </div>
                            {f.hasInconsistency && f.inconsistencyReason && (
                              <div>
                                <span className="inconsistency-pill">
                                  ⚠️ {f.inconsistencyReason}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="suggestion-chip" style={{ fontSize: '0.75rem' }}>
                            {f.banca || 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted, #64748b)' }}>
                          {f.ano || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted, #64748b)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.cargo || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {f.questionCount > 0 ? (
                            <div>
                              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                {f.questionCount} questões
                              </span>
                              {f.verifiedCount > 0 && (
                                <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                                  {f.verifiedCount} verificadas
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>
                              0 questões
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleOpenPdfInNewTab(f.id)}
                              style={{ padding: '4px 8px', fontSize: '0.78rem', color: '#38bdf8' }}
                              title="Abrir o PDF desta prova em uma nova aba"
                            >
                              📄 Ver PDF ↗
                            </button>
                            <button
                              className="btn"
                              disabled={isProcessing}
                              onClick={() => handleSelectStagingFile(f)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.78rem',
                                background: f.questionCount > 0 ? '#0284c7' : '#059669',
                              }}
                              title={f.questionCount > 0 ? 'Auditar questões extraídas' : 'Cadastrar questões manualmente'}
                            >
                              {f.questionCount > 0 ? '👁️ Auditar Prova' : '✏️ Cadastrar Questões'}
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleDeleteExam(f.id, f.filename)}
                              style={{ padding: '4px 8px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              title="Excluir esta prova do acervo"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 1: Upload & Configuration (Show if in UPLOAD mode and no active questions) */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'UPLOAD' && (
        <div className="upload-card glass">
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-color, #1e293b)', marginBottom: '0.5rem' }}>
            1. Selecionar Documentos do Computador
          </h3>

          <div className="metadata-grid">
            <div className="form-group">
              <label>Banca Examinadora</label>
              <input
                className="form-control"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Ano</label>
              <input
                className="form-control"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Órgão</label>
              <input
                className="form-control"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Cargo</label>
              <input
                className="form-control"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Código do Cargo</label>
              <input
                className="form-control"
                value={cargoCodigo}
                onChange={(e) => setCargoCodigo(e.target.value)}
              />
            </div>
          </div>

          {/* Drag & Drop */}
          <label className="dropzone">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.txt"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div className="dropzone-icon">📁</div>
            <div className="dropzone-text">Arraste seus arquivos PDF ou clique para selecionar</div>
            <div className="dropzone-hint">
              Suporta Caderno de Prova, Gabarito Preliminar, Gabarito Definitivo e Edital (PDF, Imagens, TXT)
            </div>
          </label>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Arquivos Selecionados ({selectedFiles.length})
              </h4>
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Nome do Arquivo</th>
                    <th>Tamanho</th>
                    <th>Papel Documental</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFiles.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.file.name}</td>
                      <td>{(item.file.size / 1024).toFixed(1)} KB</td>
                      <td>
                        <select
                          className="form-control"
                          value={item.role}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            setSelectedFiles((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, role: newRole } : f))
                            );
                          }}
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          <option value="PROVA">Prova / Caderno de Questões</option>
                          <option value="GABARITO_PRELIMINAR">Gabarito Preliminar</option>
                          <option value="GABARITO_DEFINITIVO">Gabarito Definitivo</option>
                          <option value="RETIFICACAO">Retificação de Gabarito</option>
                          <option value="EDITAL">Edital / Conteúdo Programático</option>
                          <option value="MATERIAL">Material com Questões</option>
                        </select>
                      </td>
                      <td>
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  onClick={handleStartProcessing}
                  disabled={isProcessing}
                  style={{ minWidth: '220px' }}
                >
                  {isProcessing ? 'Processando Documentos...' : '🚀 Iniciar Extração Documental'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracker Status e Acompanhamento de Processamento */}
      {isProcessing && (
        <div className="tracker-card glass" style={{ marginTop: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '1rem' }}>
                {actionMessage || 'Processando pipeline documental...'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                {session?.documents && session.documents.length > 0 && `Documentos na sessão: ${session.documents.length} • `}
                Status: {session?.status || 'EXECUTANDO'}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleCancelProcessing}
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', padding: '6px 14px', fontSize: '0.85rem' }}
            >
              🛑 Cancelar Processamento
            </button>
          </div>
          <div className="progress-bar-bg" style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              className="progress-bar-fill"
              style={{
                width: session?.progressPercent && session.progressPercent > 0 ? `${session.progressPercent}%` : '40%',
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                height: '100%',
                transition: 'width 0.4s ease'
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Section 2: Review Studio Side-by-Side (When exam is selected or session active) */}
      {(selectedStagingFile || (session && questions.length > 0)) && (
        <div className="review-studio">
          {/* Active File/Session Information Banner */}
          <div className="glass" style={{ padding: '0.75rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #0284c7', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>
                {selectedStagingFile ? '📚 Caderno do Acervo em Auditoria:' : '📤 Sessão Manual / Upload:'}
              </span>
              <h4 style={{ margin: '0.2rem 0 0', color: 'var(--text-color, #1e293b)', fontSize: '1.05rem' }}>
                {selectedStagingFile ? selectedStagingFile.filename : 'Upload Direto'}
              </h4>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {selectedStagingFile
                  ? `${selectedStagingFile.banca || 'Banca'} • ${selectedStagingFile.ano || ''} • ${selectedStagingFile.cargo || ''}`
                  : `${banca} • ${ano} • ${cargo}`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {questions.length > 0 && (
                <button
                  className="btn"
                  onClick={() => setIsAuditingCockpitOpen(true)}
                  style={{
                    fontSize: '0.85rem',
                    padding: '6px 16px',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    fontWeight: 700,
                    boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)',
                  }}
                  title="Abrir página dedicada em foco total para auditoria com gabarito sincronizado"
                >
                  ⚡ Modo Foco de Auditoria (Tela Cheia)
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => handleOpenPdfInNewTab(selectedStagingFile?.id, activeQuestion?.pages?.[0])}
                style={{ fontSize: '0.85rem', padding: '6px 14px', background: 'rgba(56, 189, 248, 0.1)', borderColor: '#38bdf8', color: '#38bdf8' }}
                title="Abrir o PDF em tela cheia numa nova aba"
              >
                📄 Abrir PDF em Nova Aba ↗
              </button>
              <button
                className="btn"
                onClick={() => setIsAddQuestionModalOpen(true)}
                style={{ fontSize: '0.85rem', padding: '6px 14px', background: '#10b981', color: '#fff' }}
              >
                ➕ Nova Questão Manual
              </button>
              {selectedStagingFile && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDeleteExam(selectedStagingFile.id, selectedStagingFile.filename)}
                  style={{ fontSize: '0.85rem', padding: '6px 14px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  title="Excluir este caderno de prova do acervo após auditar"
                >
                  🗑️ Excluir Prova
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleResetSession}
                style={{ fontSize: '0.85rem', padding: '6px 14px' }}
              >
                ← Voltar ao Catálogo
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="studio-stats-bar glass">
            <div className="stat-item">
              <span>Total de Questões:</span>
              <span className="stat-pill pill-total">{questions.length}</span>
            </div>
            <div className="stat-item">
              <span>Válidas / Verificadas:</span>
              <span className="stat-pill pill-valid">{validCount}</span>
            </div>
            <div className="stat-item">
              <span>Requerem Revisão:</span>
              <span className="stat-pill pill-review">{reviewCount}</span>
            </div>
            <div className="stat-item">
              <span>Incompletas / Rejeitadas:</span>
              <span className="stat-pill pill-rejected">{rejectedCount}</span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <select
                className="form-control"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              >
                <option value="ALL">Todas ({questions.length})</option>
                <option value="PENDING">Pendentes de Revisão</option>
                <option value="INCOMPLETE">Incompletas (&lt; 4 Opções)</option>
                <option value="REJECTED_EXTRACTOR">Rejeitadas pelo Extrator</option>
                <option value="SUSPECT_OCR">Com OCR Suspeito</option>
                <option value="AMBIGUOUS_KEY">Com Gabarito Ambíguo</option>
                <option value="MISSING_SUPPORT_MATERIAL">Material de Apoio Ausente</option>
                <option value="VERIFIED">Apenas Verificadas</option>
              </select>
            </div>
          </div>

          {/* Question Selector Strip */}
          <div className="question-strip">
            {filteredQuestions.map((q) => {
              const isAct = q.id === activeQuestionId;
              let statusCls = 'status-valid';
              if (q.status === 'SOURCE_VERIFIED') statusCls = 'status-verified';
              else if (q.status === 'NEEDS_REVIEW') statusCls = 'status-review';
              else if (q.status === 'REJECTED') statusCls = 'status-rejected';

              return (
                <button
                  key={q.id}
                  className={`q-badge-btn ${statusCls} ${isAct ? 'active' : ''}`}
                  onClick={() => setActiveQuestionId(q.id)}
                  title={`Q${q.numeroOriginal} - ${q.status}`}
                >
                  Q{q.numeroOriginal}
                  {q.status === 'NEEDS_REVIEW' && '⚠️'}
                  {q.status === 'SOURCE_VERIFIED' && '✓'}
                </button>
              );
            })}
          </div>

          {/* Side-by-Side Split View */}
          {questions.length === 0 ? (
            <div className="side-by-side-grid">
              {/* Left Pane: Evidence Viewer */}
              <div className="evidence-pane glass">
                <div className="evidence-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-color, #1e293b)', fontSize: '0.95rem' }}>
                      📄 Prova Original (PDF Interativo)
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleOpenPdfInNewTab(selectedStagingFile?.id)}
                    style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#0284c7' }}
                  >
                    ↗ Abrir PDF em Nova Aba
                  </button>
                </div>
                <div className="evidence-img-container" style={{ padding: 0, overflow: 'hidden' }}>
                  {selectedStagingFile ? (
                    <iframe
                      src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/pdf`}
                      title="PDF da Prova Original"
                      className="evidence-pdf-frame"
                    />
                  ) : (
                    <div style={{ padding: '3rem', color: '#64748b', textAlign: 'center' }}>
                      Nenhum arquivo PDF carregado para este caderno.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Empty state allowing manual question entry */}
              <div className="editor-pane glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                <h3 style={{ color: 'var(--text-color, #1e293b)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  Caderno de Prova Sem Questões Extraídas
                </h3>
                <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', maxWidth: '460px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  A extração automática não detectou questões neste arquivo ou o documento requer transcrição. Você pode consultar o PDF original ao lado e cadastrar as questões manualmente.
                </p>
                <button
                  className="btn"
                  onClick={() => setIsAddQuestionModalOpen(true)}
                  style={{ padding: '10px 24px', fontSize: '0.95rem', background: '#10b981', color: '#fff' }}
                >
                  ➕ Cadastrar 1ª Questão Desta Prova
                </button>
              </div>
            </div>
          ) : activeQuestion ? (
            <div className="side-by-side-grid">
              {/* Left Pane: Evidence Viewer (Prova + Gabarito) */}
              <div className="evidence-pane glass">
                <div className="evidence-toolbar">
                  {/* Abas de Visualização: Dividida, Só Prova, Só Gabarito */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px' }}>
                      <button
                        className={`opt-btn-mini ${evidenceTab === 'DUAL' ? 'active' : ''}`}
                        style={evidenceTab === 'DUAL' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
                        onClick={() => setEvidenceTab('DUAL')}
                        title="Visualizar Prova e Gabarito lado a lado para auditoria simultânea"
                      >
                        ◫ Prova + Gabarito
                      </button>
                      <button
                        className={`opt-btn-mini ${evidenceTab === 'PROVA' ? 'active' : ''}`}
                        style={evidenceTab === 'PROVA' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
                        onClick={() => setEvidenceTab('PROVA')}
                        title="Exibir caderno de prova completo"
                      >
                        📄 Prova (Pág. {activeProvaPage})
                      </button>
                      <button
                        className={`opt-btn-mini ${evidenceTab === 'GABARITO' ? 'active' : ''}`}
                        style={evidenceTab === 'GABARITO' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
                        onClick={() => setEvidenceTab('GABARITO')}
                        title="Exibir folha do gabarito oficial"
                      >
                        📑 Gabarito (Pág. {activeGabaritoPage})
                      </button>
                    </div>

                    {/* Toggle PDF vs Foto */}
                    <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px' }}>
                      <button
                        className={`opt-btn-mini ${evidenceMode === 'PDF' ? 'active' : ''}`}
                        style={evidenceMode === 'PDF' ? { background: '#059669', color: '#fff', fontWeight: 600 } : {}}
                        onClick={() => setEvidenceMode('PDF')}
                      >
                        📄 PDF
                      </button>
                      <button
                        className={`opt-btn-mini ${evidenceMode === 'IMAGE' ? 'active' : ''}`}
                        style={evidenceMode === 'IMAGE' ? { background: '#059669', color: '#fff', fontWeight: 600 } : {}}
                        onClick={() => setEvidenceMode('IMAGE')}
                      >
                        🖼️ Foto
                      </button>
                    </div>

                    {fileDocuments.length > 0 && (
                      <span className="suggestion-chip" style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)' }}>
                        {fileDocuments.map((d) => `${d.docRole.replace('_PRELIMINAR', '').replace('_DEFINITIVO', '')}: p.${d.pageStart}-${d.pageEnd}`).join(' • ')}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {/* Botão de abrir em nova aba */}
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenPdfInNewTab(selectedStagingFile?.id, activeProvaPage)}
                      style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#38bdf8' }}
                      title="Abrir PDF original em tela cheia em nova aba"
                    >
                      ↗ Nova Aba
                    </button>
                    {evidenceMode === 'IMAGE' && (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                          onClick={() => setZoomLevel((z) => Math.max(z - 15, 60))}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{zoomLevel}%</span>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                          onClick={() => setZoomLevel((z) => Math.min(z + 15, 200))}
                        >
                          +
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Conteúdo do Visualizador de Evidências */}
                <div className="evidence-img-container" style={{ padding: 0, overflow: 'hidden' }}>
                  {evidenceTab === 'DUAL' ? (
                    <div className="dual-evidence-split">
                      {/* Sub-painel 1: Prova */}
                      <div className="evidence-subpane" style={{ borderRight: '1px solid rgba(56, 189, 248, 0.25)' }}>
                        <div className="evidence-subpane-header">
                          <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.82rem' }}>
                            📄 Caderno de Prova
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 7px', fontSize: '0.75rem' }}
                              onClick={() => handleProvaPageChange(-1)}
                              title="Página anterior da prova"
                            >
                              ◄
                            </button>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-color, #1e293b)', fontWeight: 600 }}>
                              Pág. {activeProvaPage}
                            </span>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 7px', fontSize: '0.75rem' }}
                              onClick={() => handleProvaPageChange(1)}
                              title="Próxima página da prova"
                            >
                              ►
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.75rem', color: '#38bdf8' }}
                              onClick={() => handleOpenPdfInNewTab(selectedStagingFile?.id, activeProvaPage)}
                              title="Abrir página da prova em nova aba"
                            >
                              ↗
                            </button>
                          </div>
                        </div>
                        <div className="evidence-subpane-body">
                          {evidenceMode === 'PDF' && selectedStagingFile ? (
                            <iframe
                              key={`pdf-dual-prova-${selectedStagingFile.id}-p${activeProvaPage}`}
                              src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/pdf#page=${activeProvaPage}`}
                              title="Caderno de Prova"
                              className="evidence-pdf-frame"
                            />
                          ) : evidenceMode === 'PDF' && session ? (
                            <iframe
                              key={`pdf-dual-sess-prova-${session.sessionId}-p${activeProvaPage}`}
                              src={`/api/v1/ingestion/sessions/${session.sessionId}/pdf#page=${activeProvaPage}`}
                              title="Caderno de Prova"
                              className="evidence-pdf-frame"
                            />
                          ) : selectedStagingFile ? (
                            <img
                              key={`img-dual-prova-${selectedStagingFile.id}-p${activeProvaPage}`}
                              src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/page-image?page=${activeProvaPage}`}
                              alt={`Página ${activeProvaPage} da prova`}
                              className="evidence-img"
                              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                            />
                          ) : (
                            <div style={{ padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                              Arquivo da prova não localizado.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sub-painel 2: Gabarito Oficial */}
                      <div className="evidence-subpane" style={{ borderLeft: '1px solid rgba(52, 211, 153, 0.25)' }}>
                        <div className="evidence-subpane-header">
                          <span style={{ fontWeight: 600, color: '#059669', fontSize: '0.82rem' }}>
                            📑 Gabarito Oficial
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 7px', fontSize: '0.75rem' }}
                              onClick={() => handleGabaritoPageChange(-1)}
                              title="Página anterior do gabarito"
                            >
                              ◄
                            </button>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-color, #1e293b)', fontWeight: 600 }}>
                              Pág. {activeGabaritoPage}
                            </span>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 7px', fontSize: '0.75rem' }}
                              onClick={() => handleGabaritoPageChange(1)}
                              title="Próxima página do gabarito"
                            >
                              ►
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.75rem', color: '#34d399' }}
                              onClick={() => handleOpenPdfInNewTab(selectedStagingFile?.id, activeGabaritoPage)}
                              title="Abrir gabarito em nova aba"
                            >
                              ↗
                            </button>
                          </div>
                        </div>
                        <div className="evidence-subpane-body">
                          {evidenceMode === 'PDF' && selectedStagingFile ? (
                            <iframe
                              key={`pdf-dual-gab-${selectedStagingFile.id}-p${activeGabaritoPage}`}
                              src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/pdf#page=${activeGabaritoPage}`}
                              title="Gabarito Oficial"
                              className="evidence-pdf-frame"
                            />
                          ) : evidenceMode === 'PDF' && session ? (
                            <iframe
                              key={`pdf-dual-sess-gab-${session.sessionId}-p${activeGabaritoPage}`}
                              src={`/api/v1/ingestion/sessions/${session.sessionId}/pdf#page=${activeGabaritoPage}`}
                              title="Gabarito Oficial"
                              className="evidence-pdf-frame"
                            />
                          ) : selectedStagingFile ? (
                            <img
                              key={`img-dual-gab-${selectedStagingFile.id}-p${activeGabaritoPage}`}
                              src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/page-image?page=${activeGabaritoPage}`}
                              alt={`Página ${activeGabaritoPage} do gabarito`}
                              className="evidence-img"
                              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                            />
                          ) : (
                            <div style={{ padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                              Arquivo do gabarito não localizado.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : evidenceTab === 'PROVA' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div className="evidence-subpane-header">
                        <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem' }}>
                          📄 Caderno de Prova (Página {activeProvaPage})
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '3px 8px' }} onClick={() => handleProvaPageChange(-1)}>◄</button>
                          <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Pág. {activeProvaPage}</span>
                          <button className="btn btn-secondary" style={{ padding: '3px 8px' }} onClick={() => handleProvaPageChange(1)}>►</button>
                        </div>
                      </div>
                      <div style={{ flex: 1, minHeight: '620px' }}>
                        {evidenceMode === 'PDF' && selectedStagingFile ? (
                          <iframe
                            key={`pdf-full-prova-${selectedStagingFile.id}-p${activeProvaPage}`}
                            src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/pdf#page=${activeProvaPage}`}
                            title="Caderno de Prova"
                            className="evidence-pdf-frame"
                          />
                        ) : selectedStagingFile ? (
                          <img
                            key={`img-full-prova-${selectedStagingFile.id}-p${activeProvaPage}`}
                            src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/page-image?page=${activeProvaPage}`}
                            alt={`Página ${activeProvaPage} da prova`}
                            className="evidence-img"
                            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div className="evidence-subpane-header">
                        <span style={{ fontWeight: 600, color: '#34d399', fontSize: '0.85rem' }}>
                          📑 Gabarito Oficial (Página {activeGabaritoPage})
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '3px 8px' }} onClick={() => handleGabaritoPageChange(-1)}>◄</button>
                          <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Pág. {activeGabaritoPage}</span>
                          <button className="btn btn-secondary" style={{ padding: '3px 8px' }} onClick={() => handleGabaritoPageChange(1)}>►</button>
                        </div>
                      </div>
                      <div style={{ flex: 1, minHeight: '620px' }}>
                        {evidenceMode === 'PDF' && selectedStagingFile ? (
                          <iframe
                            key={`pdf-full-gab-${selectedStagingFile.id}-p${activeGabaritoPage}`}
                            src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/pdf#page=${activeGabaritoPage}`}
                            title="Gabarito Oficial"
                            className="evidence-pdf-frame"
                          />
                        ) : selectedStagingFile ? (
                          <img
                            key={`img-full-gab-${selectedStagingFile.id}-p${activeGabaritoPage}`}
                            src={`/api/v1/ingestion/staging-files/${selectedStagingFile.id}/page-image?page=${activeGabaritoPage}`}
                            alt={`Página ${activeGabaritoPage} do gabarito`}
                            className="evidence-img"
                            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Question Editor */}
              <div className="editor-pane glass">
                {/* Navigation Strip */}
                <div className="nav-buttons-strip">
                  <button
                    className="btn btn-secondary"
                    onClick={handlePrevQuestion}
                    style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                  >
                    ← Questão Anterior
                  </button>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Questão {filteredQuestions.findIndex((q) => q.id === activeQuestion.id) + 1} de {filteredQuestions.length}
                  </span>
                  <button
                    className="btn btn-secondary"
                    onClick={handleNextQuestion}
                    style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                  >
                    Próxima Questão →
                  </button>
                </div>

                <div className="editor-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Nº:</label>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: '65px', padding: '0.3rem 0.4rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}
                        value={activeQuestion.numeroOriginal}
                        onChange={(e) => handleUpdateQuestionField('numeroOriginal', parseInt(e.target.value) || 1)}
                        title="Corrigir número da questão na prova"
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>Pág. Prova:</label>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: '65px', padding: '0.3rem 0.4rem', fontSize: '0.9rem', textAlign: 'center', color: '#38bdf8', fontWeight: 'bold' }}
                        value={activeProvaPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setActiveProvaPage(val);
                          handleUpdateQuestionField('pages', [val]);
                        }}
                        title="Página do caderno em que a questão se localiza"
                      />
                    </div>

                    <span
                      className={`status-badge ${
                        activeQuestion.status === 'SOURCE_VERIFIED'
                          ? 'verified'
                          : activeQuestion.status === 'NEEDS_REVIEW'
                          ? 'review'
                          : activeQuestion.status === 'REJECTED'
                          ? 'rejected'
                          : 'valid'
                      }`}
                    >
                      {activeQuestion.status}
                      {activeQuestion.rejectionType && ` (${activeQuestion.rejectionType})`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Disciplina:</label>
                    <input
                      className="form-control"
                      value={activeQuestion.disciplina}
                      onChange={(e) => handleUpdateQuestionField('disciplina', e.target.value)}
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '180px' }}
                    />
                  </div>
                </div>

                {/* Barra de Correção Rápida de Gabarito (Auditoria Prova x Gabarito) */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.25)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <label style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 600 }}>
                        🎯 Gabarito Oficial (Clique para Auditar / Corrigir):
                      </label>
                      <button
                        type="button"
                        onClick={() => setForceMultipleChoice((prev) => !prev)}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                        title="Alternar entre modo Cebraspe (Certo/Errado) e Múltipla Escolha tradicional (A-E)"
                      >
                        {isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice
                          ? '🔄 Mudar para Múltipla Escolha (A-E)'
                          : '🔄 Mudar para C/E (Cebraspe)'}
                      </button>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: activeQuestion.correctOption ? '#34d399' : '#f59e0b', fontWeight: 'bold' }}>
                      {activeQuestion.correctOption ? `Gabarito Definido: ${activeQuestion.correctOption}` : '⚠️ Sem Gabarito'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice ? (
                      <>
                        <button
                          type="button"
                          className="fast-gabarito-btn"
                          style={{
                            padding: '8px 22px',
                            fontSize: '0.95rem',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                            background: (activeQuestion.correctOption === 'C' || activeQuestion.correctOption === 'A') ? '#10b981' : 'rgba(255,255,255,0.06)',
                            color: (activeQuestion.correctOption === 'C' || activeQuestion.correctOption === 'A') ? '#ffffff' : '#cbd5e1',
                            border: (activeQuestion.correctOption === 'C' || activeQuestion.correctOption === 'A') ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.15)',
                            boxShadow: (activeQuestion.correctOption === 'C' || activeQuestion.correctOption === 'A') ? '0 0 12px rgba(16, 185, 129, 0.5)' : 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleUpdateQuestionField('correctOption', 'C')}
                        >
                          ✓ C (CERTO)
                        </button>
                        <button
                          type="button"
                          className="fast-gabarito-btn"
                          style={{
                            padding: '8px 22px',
                            fontSize: '0.95rem',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                            background: (activeQuestion.correctOption === 'E' || activeQuestion.correctOption === 'B') ? '#ef4444' : 'rgba(255,255,255,0.06)',
                            color: (activeQuestion.correctOption === 'E' || activeQuestion.correctOption === 'B') ? '#ffffff' : '#cbd5e1',
                            border: (activeQuestion.correctOption === 'E' || activeQuestion.correctOption === 'B') ? '2px solid #f87171' : '1px solid rgba(255,255,255,0.15)',
                            boxShadow: (activeQuestion.correctOption === 'E' || activeQuestion.correctOption === 'B') ? '0 0 12px rgba(239, 68, 68, 0.5)' : 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleUpdateQuestionField('correctOption', 'E')}
                        >
                          ✗ E (ERRADO)
                        </button>
                      </>
                    ) : (
                      ['A', 'B', 'C', 'D', 'E'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="fast-gabarito-btn"
                          style={{
                            padding: '6px 16px',
                            fontSize: '0.95rem',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                            background: activeQuestion.correctOption === opt ? '#10b981' : 'rgba(255,255,255,0.06)',
                            color: activeQuestion.correctOption === opt ? '#ffffff' : '#cbd5e1',
                            border: activeQuestion.correctOption === opt ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.15)',
                            boxShadow: activeQuestion.correctOption === opt ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleUpdateQuestionField('correctOption', opt)}
                        >
                          {opt}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      className="fast-gabarito-btn"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        background: activeQuestion.correctOption === 'ANULADA' ? '#f59e0b' : 'rgba(255,255,255,0.06)',
                        color: activeQuestion.correctOption === 'ANULADA' ? '#000000' : '#fbbf24',
                        border: activeQuestion.correctOption === 'ANULADA' ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleUpdateQuestionField('correctOption', 'ANULADA')}
                    >
                      ⚠️ ANULADA
                    </button>
                    <button
                      type="button"
                      className="fast-gabarito-btn"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        background: activeQuestion.correctOption === 'DESCONSIDERADA' ? '#ef4444' : 'rgba(255,255,255,0.06)',
                        color: activeQuestion.correctOption === 'DESCONSIDERADA' ? '#ffffff' : '#f87171',
                        border: activeQuestion.correctOption === 'DESCONSIDERADA' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleUpdateQuestionField('correctOption', 'DESCONSIDERADA')}
                    >
                      🚫 DESCONSIDERADA
                    </button>
                  </div>
                </div>

                {/* Flags Warning Box */}
                {activeQuestion.flags && activeQuestion.flags.length > 0 && (
                  <div className="warning-alert">
                    <strong>⚠️ Alertas Estruturais & Documentais:</strong>
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem' }}>
                      {activeQuestion.flags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Classificação Temática & Edital Verticalizado */}
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                      🏷️ Classificação Temática & Edital Verticalizado
                    </label>
                    {activeQuestion.assuntoSugerido && (
                      <button
                        className="btn btn-secondary"
                        onClick={handleApplySuggestion}
                        style={{ padding: '3px 10px', fontSize: '0.75rem', borderColor: '#38bdf8', color: '#38bdf8' }}
                      >
                        💡 Aplicar Sugestão do Edital
                      </button>
                    )}
                  </div>

                  {activeQuestion.assuntoSugerido && (
                    <div style={{ marginBottom: '0.65rem' }}>
                      <span className="suggestion-chip">
                        Sugestão: {activeQuestion.disciplinaSugerida} ➔ {activeQuestion.assuntoSugerido}
                        {activeQuestion.subassuntoSugerido ? ` (${activeQuestion.subassuntoSugerido})` : ''}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group">
                      <label>Assunto</label>
                      <input
                        className="form-control"
                        placeholder="Ex: Imunidade Tributária"
                        value={activeQuestion.assunto || ''}
                        onChange={(e) => handleUpdateQuestionField('assunto', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Subassunto</label>
                      <input
                        className="form-control"
                        placeholder="Ex: Espécies e Fato Gerador"
                        value={activeQuestion.subassunto || ''}
                        onChange={(e) => handleUpdateQuestionField('subassunto', e.target.value)}
                      />
                    </div>
                  </div>

                  {editalTopicos.length > 0 && (
                    <div className="form-group">
                      <label>Vincular a Item do Edital Verticalizado</label>
                      <select
                        className="form-control"
                        value={activeQuestion.editalTopicoId || ''}
                        onChange={(e) => handleSelectEditalTopico(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <option value="">-- Selecione o tópico do edital --</option>
                        {editalTopicos.map((top) => (
                          <option key={top.id} value={top.id}>
                            [{top.disciplina}] {top.assunto} {top.subassunto ? `- ${top.subassunto}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Material de Apoio Compartilhado (Fase 5) */}
                <div className="support-material-box">
                  <div className="support-material-header">
                    <span>📎 Material de Apoio / Texto-Base / Gráficos</span>
                    {activeQuestion.supportMaterial ? (
                      <button
                        className="opt-btn-mini"
                        onClick={() => handleUpdateQuestionField('supportMaterial', undefined)}
                        style={{ color: '#ef4444' }}
                      >
                        Remover Material
                      </button>
                    ) : (
                      <button
                        className="opt-btn-mini"
                        onClick={() =>
                          handleUpdateQuestionField('supportMaterial', {
                            tipo: 'TEXTO_BASE',
                            titulo: 'Texto de Apoio',
                            conteudoTexto: '',
                            docOrigem: 'Caderno de Prova',
                          })
                        }
                      >
                        + Adicionar Material de Apoio
                      </button>
                    )}
                  </div>

                  {activeQuestion.supportMaterial ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                        <select
                          className="form-control"
                          value={activeQuestion.supportMaterial.tipo || 'TEXTO_BASE'}
                          onChange={(e) =>
                            handleUpdateQuestionField('supportMaterial', {
                              ...activeQuestion.supportMaterial,
                              tipo: e.target.value,
                            })
                          }
                          style={{ fontSize: '0.8rem' }}
                        >
                          <option value="TEXTO_BASE">Texto-base</option>
                          <option value="TABELA">Tabela</option>
                          <option value="GRAFICO">Gráfico</option>
                          <option value="FIGURA">Figura / Imagem</option>
                          <option value="FORMULA">Fórmula</option>
                          <option value="MAPA">Mapa</option>
                          <option value="ESTUDO_DE_CASO">Estudo de Caso</option>
                        </select>
                        <input
                          className="form-control"
                          placeholder="Título do material (Ex: Texto 1 - Crônica)"
                          value={activeQuestion.supportMaterial.titulo || ''}
                          onChange={(e) =>
                            handleUpdateQuestionField('supportMaterial', {
                              ...activeQuestion.supportMaterial,
                              titulo: e.target.value,
                            })
                          }
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Conteúdo textual do texto-base, tabela ou instruções compartilhadas..."
                        value={activeQuestion.supportMaterial.conteudoTexto || ''}
                        onChange={(e) =>
                          handleUpdateQuestionField('supportMaterial', {
                            ...activeQuestion.supportMaterial,
                            conteudoTexto: e.target.value,
                          })
                        }
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {activeQuestion.flags?.includes('SUPPORT_MATERIAL_MISSING') ? (
                        <span style={{ color: '#fbbf24' }}>
                          ⚠️ Esta questão referencia texto-base ou instrução compartilhada não localizada. Adicione o texto para completar a revisão.
                        </span>
                      ) : (
                        'Nenhum material de apoio vinculado. Questão autossuficiente.'
                      )}
                    </div>
                  )}
                </div>

                {/* Enunciado */}
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Enunciado da Questão</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={activeQuestion.statement}
                    onChange={(e) => handleUpdateQuestionField('statement', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Alternativas com manipulação completa */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Alternativas ({activeQuestion.options.length})</label>
                    <button
                      className="opt-btn-mini"
                      onClick={handleAddOption}
                      style={{ color: '#38bdf8', borderColor: '#38bdf8' }}
                    >
                      + Adicionar Alternativa Ausente
                    </button>
                  </div>
                  <div className="options-editor-list">
                    {activeQuestion.options.map((optText, optIdx) => {
                      const isCE = isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice;
                      const letter = isCE ? (optIdx === 0 ? 'C' : 'E') : String.fromCharCode(65 + optIdx);
                      const isCurrentCorrect = isCE
                        ? (optIdx === 0
                            ? (activeQuestion.correctOption === 'C' || activeQuestion.correctOption === 'A')
                            : (activeQuestion.correctOption === 'E' || activeQuestion.correctOption === 'B'))
                        : activeQuestion.correctOption === letter;
                      return (
                        <div key={optIdx} className="option-edit-row">
                          <div
                            className="opt-letter-tag"
                            style={
                              isCurrentCorrect
                                ? { background: '#10b981', color: '#fff', fontWeight: 'bold' }
                                : undefined
                            }
                          >
                            {letter}
                          </div>
                          <input
                            className="form-control"
                            style={{ flex: 1 }}
                            value={optText}
                            onChange={(e) => handleUpdateOption(optIdx, e.target.value)}
                          />
                          <div className="opt-actions-group">
                            <button
                              className="opt-btn-mini"
                              title="Mover para cima"
                              disabled={optIdx === 0}
                              onClick={() => handleMoveOption(optIdx, 'UP')}
                            >
                              ▲
                            </button>
                            <button
                              className="opt-btn-mini"
                              title="Mover para baixo"
                              disabled={optIdx === activeQuestion.options.length - 1}
                              onClick={() => handleMoveOption(optIdx, 'DOWN')}
                            >
                              ▼
                            </button>
                            <button
                              className="opt-btn-mini"
                              title="Definir como Gabarito Correto"
                              style={isCurrentCorrect ? { borderColor: '#10b981', color: '#10b981' } : undefined}
                              onClick={() => handleUpdateQuestionField('correctOption', letter)}
                            >
                              {isCurrentCorrect ? '★ Correta' : '☆ Gabarito'}
                            </button>
                            <button
                              className="opt-btn-mini"
                              title="Excluir alternativa incorretamente identificada"
                              style={{ color: '#ef4444' }}
                              onClick={() => handleRemoveOption(optIdx)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Gabarito e Disciplina */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Opção Correta (Gabarito Oficial)</label>
                    <select
                      className="form-control"
                      value={
                        (isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice)
                          ? (activeQuestion.correctOption === 'A' ? 'C' : activeQuestion.correctOption === 'B' ? 'E' : activeQuestion.correctOption || 'AUSENTE')
                          : (activeQuestion.correctOption || 'AUSENTE')
                      }
                      onChange={(e) =>
                        handleUpdateQuestionField(
                          'correctOption',
                          e.target.value === 'AUSENTE' ? null : e.target.value
                        )
                      }
                    >
                      <option value="AUSENTE">AUSENTE / NÃO INFORMADO</option>
                      {isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice ? (
                        <>
                          <option value="C">C (CERTO)</option>
                          <option value="E">E (ERRADO)</option>
                        </>
                      ) : (
                        <>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E</option>
                        </>
                      )}
                      <option value="ANULADA">ANULADA</option>
                      <option value="DESCONSIDERADA">DESCONSIDERADA</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status do Gabarito</label>
                    <select
                      className="form-control"
                      value={activeQuestion.gabaritoStatus}
                      onChange={(e) => handleUpdateQuestionField('gabaritoStatus', e.target.value)}
                    >
                      <option value="PRELIMINAR">PRELIMINAR</option>
                      <option value="DEFINITIVO">DEFINITIVO</option>
                      <option value="ANULADA">ANULADA</option>
                      <option value="RETIFICADO">RETIFICADO</option>
                      <option value="AUSENTE">AUSENTE</option>
                      <option value="SOB_REVISAO">SOB REVISÃO</option>
                    </select>
                  </div>
                </div>

                {/* Anotações de Revisão Humana */}
                <div className="form-group">
                  <label>Anotações do Revisor</label>
                  <input
                    className="form-control"
                    placeholder="Ex: Conferido visualmente contra gabarito preliminar oficial pág. 9"
                    value={activeQuestion.reviewNotes || ''}
                    onChange={(e) => handleUpdateQuestionField('reviewNotes', e.target.value)}
                  />
                </div>

                {/* Action Buttons */}
                <div className="editor-actions">
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={handleSaveCorrections}>
                      💾 Salvar Alterações
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleDeleteCurrentQuestion}
                      style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      title="Excluir esta questão permanentemente deste caderno"
                    >
                      🗑️ Excluir Questão
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      style={{ background: '#f59e0b', fontSize: '0.85rem' }}
                      onClick={() => handleMarkRejected('RECUPERAVEL')}
                      title="Rejeição técnica temporária (permanece na fila de revisão para correção)"
                    >
                      ⚠️ Rejeição Recuperável
                    </button>
                    <button
                      className="btn"
                      style={{ background: '#ef4444', fontSize: '0.85rem' }}
                      onClick={() => handleMarkRejected('DEFINITIVA')}
                      title="Rejeição definitiva (conteúdo inviável ou descartado)"
                    >
                      🚫 Rejeição Definitiva
                    </button>
                    <button
                      className="btn"
                      style={{ background: '#10b981', fontSize: '0.85rem' }}
                      onClick={handleMarkVerified}
                    >
                      ✅ Aprovar (SOURCE_VERIFIED)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Cockpit de Auditoria Imersivo / Foco Total */}
      {isAuditingCockpitOpen && questions.length > 0 && (
        <AuditCockpit
          file={selectedStagingFile}
          session={session}
          questions={questions}
          activeQuestionId={activeQuestionId}
          fileDocuments={fileDocuments}
          editalTopicos={editalTopicos}
          onSelectQuestion={(id) => setActiveQuestionId(id)}
          onUpdateQuestionField={handleUpdateQuestionField}
          onReplicateSupportMaterial={handleReplicateSupportMaterial}
          onSaveCorrections={handleSaveCorrections}
          onMarkVerified={handleMarkVerified}
          onMarkRejected={handleMarkRejected}
          onClose={() => setIsAuditingCockpitOpen(false)}
          onReloadAcervo={loadStagingFiles}
        />
      )}

      {/* Simulation Dry-Run Modal */}
      {isSimulationOpen && simulationData && (
        <div className="modal-backdrop" onClick={() => setIsSimulationOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Simulação de Importação (Modo Teste Seguro)</h3>
              <button className="btn-close" onClick={() => setIsSimulationOpen(false)}>
                ×
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Esta simulação valida a conformidade das questões e a integridade do banco operacional sem gravar nenhuma alteração permanente.
            </p>

            <div className="sim-metric-grid">
              <div className="sim-metric-card">
                <span>Total no Staging</span>
                <strong>{simulationData.totalStagingQuestions}</strong>
              </div>
              <div className="sim-metric-card">
                <span>Aprovadas / Prontas</span>
                <strong style={{ color: '#34d399' }}>{simulationData.verifiedReadyToImport}</strong>
              </div>
              <div className="sim-metric-card">
                <span>Pendentes de Revisão</span>
                <strong style={{ color: '#fbbf24' }}>{simulationData.needsReviewCount}</strong>
              </div>
              <div className="sim-metric-card">
                <span>Colisões com Banco Existente</span>
                <strong style={{ color: simulationData.collidingExistingQuestions === 0 ? '#34d399' : '#ef4444' }}>
                  {simulationData.collidingExistingQuestions}
                </strong>
              </div>
            </div>

            {simulationData.warnings && simulationData.warnings.length > 0 && (
              <div className="warning-alert">
                <strong>Avisos da Simulação:</strong>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                  {simulationData.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {simulationData.warnings.length > 5 && (
                    <li>... e mais {simulationData.warnings.length - 5} avisos.</li>
                  )}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsSimulationOpen(false)}>
                Fechar Relatório
              </button>
              <button
                className="btn"
                style={{ background: '#10b981' }}
                onClick={handleConfirmedImport}
                disabled={!simulationData.safeToImport}
              >
                Concluir Importação Segura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar Novo Caderno de Prova Manualmente */}
      {isCreateExamModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateExamModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Cadastrar Nova Prova Manualmente</h3>
              <button className="btn-close" onClick={() => setIsCreateExamModalOpen(false)}>
                ×
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Crie a entrada de um novo caderno no acervo para digitar ou colar as questões manualmente quando a extração automática do PDF não for possível.
            </p>

            <form onSubmit={handleCreateManualExam}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Banca Examinadora *</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Ex: FGV, Cebraspe, IBGP, FCC..."
                    value={newExamData.banca}
                    onChange={(e) => setNewExamData({ ...newExamData, banca: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ano do Concurso *</label>
                  <input
                    className="form-control"
                    type="number"
                    required
                    value={newExamData.ano}
                    onChange={(e) => setNewExamData({ ...newExamData, ano: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Órgão</label>
                  <input
                    className="form-control"
                    placeholder="Ex: SEFAZ-MG, Pref. Araguari..."
                    value={newExamData.orgao}
                    onChange={(e) => setNewExamData({ ...newExamData, orgao: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Cargo</label>
                  <input
                    className="form-control"
                    placeholder="Ex: Auditor Fiscal da Receita Estadual..."
                    value={newExamData.cargo}
                    onChange={(e) => setNewExamData({ ...newExamData, cargo: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>Nome / Identificador do Caderno (Opcional)</label>
                <input
                  className="form-control"
                  placeholder="Deixe em branco para gerar automaticamente"
                  value={newExamData.filename}
                  onChange={(e) => setNewExamData({ ...newExamData, filename: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateExamModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: '#10b981' }}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Cadastrando...' : 'Criar Caderno de Prova'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar Nova Questão Manual */}
      {isAddQuestionModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddQuestionModalOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                ➕ Cadastrar Nova Questão Manual
                {selectedStagingFile && (
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                    ({selectedStagingFile.banca} • {selectedStagingFile.cargo || selectedStagingFile.filename})
                  </span>
                )}
              </h3>
              <button className="btn-close" onClick={() => setIsAddQuestionModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateManualQuestion}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Número</label>
                  <input
                    className="form-control"
                    type="number"
                    required
                    value={newQuestionData.numeroOriginal}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, numeroOriginal: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div className="form-group">
                  <label>Disciplina *</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Ex: Direito Tributário, Contabilidade, etc."
                    value={newQuestionData.disciplina}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, disciplina: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Assunto (Opcional)</label>
                  <input
                    className="form-control"
                    placeholder="Ex: Impostos Municipais, ISS, etc."
                    value={newQuestionData.assunto}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, assunto: e.target.value })}
                  />
                </div>
              </div>

              {/* Enunciado */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Enunciado da Questão * (Cole o texto copiado do PDF)</label>
                <textarea
                  className="form-control"
                  rows={5}
                  required
                  placeholder="Copie e cole o texto do enunciado diretamente da prova em PDF..."
                  value={newQuestionData.statement}
                  onChange={(e) => setNewQuestionData({ ...newQuestionData, statement: e.target.value })}
                  style={{ resize: 'vertical', fontSize: '0.9rem' }}
                />
              </div>

              {/* Formato da Questão (Múltipla Escolha vs Cebraspe C/E) */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Formato da Questão:</span>
                <button
                  type="button"
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: newQuestionData.options.length !== 2 ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                  onClick={() => {
                    setNewQuestionData({
                      ...newQuestionData,
                      options: ['A) ', 'B) ', 'C) ', 'D) ', 'E) '],
                      correctOption: 'A',
                    });
                  }}
                >
                  Múltipla Escolha (A-E)
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: newQuestionData.options.length === 2 ? '#10b981' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                  onClick={() => {
                    setNewQuestionData({
                      ...newQuestionData,
                      options: ['C) CERTO', 'E) ERRADO'],
                      correctOption: 'C',
                    });
                  }}
                >
                  Certo / Errado (Cebraspe)
                </button>
              </div>

              {/* Alternativas */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Alternativas (Preencha as opções da questão)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {newQuestionData.options.map((opt, idx) => {
                    const isCE = newQuestionData.options.length === 2;
                    const letter = isCE ? (idx === 0 ? 'C' : 'E') : String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: newQuestionData.correctOption === letter ? '#10b981' : 'rgba(255,255,255,0.08)',
                            color: newQuestionData.correctOption === letter ? '#fff' : '#94a3b8',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                          }}
                        >
                          {letter}
                        </div>
                        <input
                          className="form-control"
                          style={{ flex: 1, fontSize: '0.85rem' }}
                          placeholder={`Texto da alternativa ${letter}...`}
                          value={opt}
                          onChange={(e) => {
                            const updated = [...newQuestionData.options];
                            updated[idx] = e.target.value;
                            setNewQuestionData({ ...newQuestionData, options: updated });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gabarito e Página */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label>Gabarito Correto</label>
                  <select
                    className="form-control"
                    value={newQuestionData.correctOption}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, correctOption: e.target.value })}
                  >
                    {newQuestionData.options.length === 2 ? (
                      <>
                        <option value="C">C (CERTO)</option>
                        <option value="E">E (ERRADO)</option>
                      </>
                    ) : (
                      <>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                      </>
                    )}
                    <option value="ANULADA">ANULADA</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status do Gabarito</label>
                  <select
                    className="form-control"
                    value={newQuestionData.gabaritoStatus}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, gabaritoStatus: e.target.value })}
                  >
                    <option value="DEFINITIVO">DEFINITIVO</option>
                    <option value="PRELIMINAR">PRELIMINAR</option>
                    <option value="ANULADA">ANULADA</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Página no PDF</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    value={newQuestionData.page}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, page: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddQuestionModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: '#10b981' }}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Salvando...' : 'Salvar Questão e Validar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
