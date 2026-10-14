import React, { useState, useEffect } from 'react';
import './ImportStudio.css';

interface StagingDocument {
  id: string;
  originalFilename: string;
  role: string;
  sizeBytes: number;
  format: string;
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
  const [activeTab, setActiveTab] = useState<'ACERVO' | 'UPLOAD'>('ACERVO');

  // Helper defensivo para chamadas HTTP
  async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, init);
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
      const qList = await safeFetchJson<StagingQuestion[]>(`/api/v1/ingestion/staging-files/${file.id}/questions`);
      setQuestions(qList);
      if (qList.length > 0) {
        setActiveQuestionId(qList[0].id);
      } else {
        setActiveQuestionId(null);
      }
    } catch (err: any) {
      alert('Erro ao carregar questões do caderno: ' + err.message);
    } finally {
      setIsProcessing(false);
      setActionMessage(null);
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
      const url = session
        ? `/api/v1/ingestion/sessions/${session.sessionId}/questions/${activeQuestion.id}`
        : `/api/v1/ingestion/staging-questions/${activeQuestion.id}`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: activeQuestion.statement,
          options: activeQuestion.options,
          correctOption: activeQuestion.correctOption,
          gabaritoStatus: activeQuestion.gabaritoStatus,
          disciplina: activeQuestion.disciplina,
          assunto: activeQuestion.assunto,
          subassunto: activeQuestion.subassunto,
          editalTopicoId: activeQuestion.editalTopicoId,
          rejectionType: activeQuestion.rejectionType,
          supportMaterial: activeQuestion.supportMaterial,
          status: activeQuestion.status,
          reviewNotes: activeQuestion.reviewNotes,
        }),
      });
      if (res.ok) {
        const savedQ: StagingQuestion = await res.json();
        setQuestions((prev) => prev.map((q) => (q.id === savedQ.id ? savedQ : q)));
        alert('Correções salvas com sucesso no staging!');
      }
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  const handleMarkVerified = async () => {
    if (!activeQuestion) return;
    try {
      const url = session
        ? `/api/v1/ingestion/sessions/${session.sessionId}/questions/${activeQuestion.id}/verify`
        : `/api/v1/ingestion/staging-questions/${activeQuestion.id}/verify`;

      const res = await fetch(url, { method: 'POST' });
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

      await fetch(putUrl, {
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

      const res = await fetch(postUrl, { method: 'POST' });
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
        const res = await fetch(`/api/v1/ingestion/sessions/${session.sessionId}/simulate-import`, {
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
        const res = await fetch(`/api/v1/ingestion/sessions/${session.sessionId}/import-confirmed`, {
          method: 'POST',
        });
        if (res.ok) {
          const result = await res.json();
          alert(`Importação concluída com sucesso! ${result.imported_count} questões verificadas salvas.`);
          setIsSimulationOpen(false);
        }
      } else if (selectedStagingFile) {
        const res = await fetch(`/api/v1/ingestion/staging-publish?fileId=${selectedStagingFile.id}`, {
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
    if (filterStatus === 'INCOMPLETE') return !q.options || q.options.length < 4 || !q.statement;
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
              <p style={{ color: '#f8fafc', margin: '0.35rem 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{processingError}</p>
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
            <strong>⚡ Validação Imediata com o Golden Set Oficial</strong>
            <span>
              Teste em 1 clique a Questão 15 do cargo 532 (higienização de rabiscos, separação do cabeçalho de Informática e alerta matemático de 336 vs 3.360 anagramas).
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

      {/* Mode Switcher Tabs */}
      {(!session && !selectedStagingFile || questions.length === 0) && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <button
            className={`btn ${activeTab === 'ACERVO' ? '' : 'btn-secondary'}`}
            style={activeTab === 'ACERVO' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('ACERVO')}
          >
            📚 Acervo Digital em Staging ({stagingFiles.length} Provas Catalogadas)
          </button>
          <button
            className={`btn ${activeTab === 'UPLOAD' ? '' : 'btn-secondary'}`}
            style={activeTab === 'UPLOAD' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
            onClick={() => setActiveTab('UPLOAD')}
          >
            📤 Upload Manual / Nova Sessão Local
          </button>
        </div>
      )}

      {/* Acervo Browser View */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'ACERVO' && (
        <div className="upload-card glass animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', margin: 0 }}>
                Catálogo de Documentos do Acervo (Isolamento Staging)
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Selecione qualquer caderno de prova para abrir o visualizador de auditoria lado a lado com a evidência PDF original.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="stat-pill pill-valid" style={{ fontSize: '0.8rem' }}>
                {stagingFiles.filter((f) => f.questionCount > 0).length} Provas Processadas
              </span>
              <span className="stat-pill pill-total" style={{ fontSize: '0.8rem' }}>
                {stagingFiles.reduce((acc, f) => acc + f.questionCount, 0)} Questões Extraídas
              </span>
              <button
                className="btn btn-secondary"
                onClick={loadStagingFiles}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                title="Recarregar catálogo"
              >
                🔄 Atualizar
              </button>
            </div>
          </div>

          {/* Search Filter */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Filtrar por Banca (ex: FGV, IBGP, CONSULPAM), Ano, Cargo ou nome do arquivo..."
              value={stagingSearch}
              onChange={(e) => setStagingSearch(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
            />
          </div>

          {/* Files List Table */}
          <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Documento / Prova</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Banca</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ano</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cargo</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Questões Extraídas</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {stagingFiles
                  .filter((f) => {
                    if (!stagingSearch.trim()) return true;
                    const q = stagingSearch.toLowerCase();
                    return (
                      f.filename.toLowerCase().includes(q) ||
                      (f.banca && f.banca.toLowerCase().includes(q)) ||
                      (f.cargo && f.cargo.toLowerCase().includes(q)) ||
                      (f.ano && String(f.ano).includes(q))
                    );
                  })
                  .slice(0, 100)
                  .map((f) => (
                    <tr
                      key={f.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: f.questionCount > 0 ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>📄</span>
                          <span title={f.filename} style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.filename}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="suggestion-chip" style={{ fontSize: '0.75rem' }}>
                          {f.banca || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                        {f.ano || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.cargo || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {f.questionCount > 0 ? (
                          <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                            {f.questionCount} questões
                            {f.verifiedCount > 0 && ` (${f.verifiedCount} verificadas)`}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>Aguardando extração</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          className="btn"
                          disabled={f.questionCount === 0 || isProcessing}
                          onClick={() => handleSelectStagingFile(f)}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.8rem',
                            background: f.questionCount > 0 ? '#0284c7' : '#334155',
                          }}
                        >
                          {f.questionCount > 0 ? '👁️ Auditar Prova' : 'Sem questões'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 1: Upload & Configuration (Show if in UPLOAD mode and no active questions) */}
      {(!session && !selectedStagingFile || questions.length === 0) && activeTab === 'UPLOAD' && (
        <div className="upload-card glass">
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
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

      {/* Section 2: Review Studio Side-by-Side (When questions are loaded) */}
      {questions.length > 0 && (
        <div className="review-studio">
          {/* Active File/Session Information Banner */}
          <div className="glass" style={{ padding: '0.75rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #0284c7' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                {selectedStagingFile ? '📚 Caderno do Acervo em Auditoria:' : '📤 Sessão Manual / Upload:'}
              </span>
              <h4 style={{ margin: '0.2rem 0 0', color: '#f8fafc', fontSize: '1.05rem' }}>
                {selectedStagingFile ? selectedStagingFile.filename : 'Upload Direto'}
              </h4>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {selectedStagingFile
                  ? `${selectedStagingFile.banca || 'Banca'} • ${selectedStagingFile.ano || ''} • ${selectedStagingFile.cargo || ''}`
                  : `${banca} • ${ano} • ${cargo}`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={handleResetSession}
                style={{ fontSize: '0.85rem', padding: '6px 14px' }}
              >
                ← Voltar ao Catálogo do Acervo
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
          {activeQuestion && (
            <div className="side-by-side-grid">
              {/* Left Pane: Evidence Viewer */}
              <div className="evidence-pane glass">
                <div className="evidence-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
                      📄 Evidência Documental (Página {activeQuestion.pages.join(', ')})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => setZoomLevel((z) => Math.max(z - 15, 60))}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{zoomLevel}%</span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => setZoomLevel((z) => Math.min(z + 15, 200))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="evidence-img-container">
                  {session && activeQuestion.evidenceImage ? (
                    <img
                      src={`/api/v1/ingestion/sessions/${session.sessionId}/evidence/${activeQuestion.evidenceImage}`}
                      alt={`Página ${activeQuestion.pages[0]} da prova`}
                      className="evidence-img"
                      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                    />
                  ) : activeQuestion ? (
                    <img
                      src={`/api/v1/ingestion/staging-questions/${activeQuestion.id}/evidence-image`}
                      alt="Página da prova original"
                      className="evidence-img"
                      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                  ) : (
                    <div style={{ padding: '3rem', color: '#64748b', textAlign: 'center' }}>
                      Visualização de página não disponível para este formato.
                    </div>
                  )}
                  <div style={{ display: 'none', padding: '3rem', color: '#64748b', textAlign: 'center' }}>
                    Visualização de página não disponível para este documento.
                  </div>
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

                <div className="editor-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
                      Questão {activeQuestion.numeroOriginal}
                    </h3>
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
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCurrentCorrect = activeQuestion.correctOption === letter;
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
                      value={activeQuestion.correctOption || 'AUSENTE'}
                      onChange={(e) =>
                        handleUpdateQuestionField(
                          'correctOption',
                          e.target.value === 'AUSENTE' ? null : e.target.value
                        )
                      }
                    >
                      <option value="AUSENTE">AUSENTE / NÃO INFORMADO</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                      <option value="ANULADA">ANULADA</option>
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
                  <button className="btn btn-secondary" onClick={handleSaveCorrections}>
                    💾 Salvar Alterações
                  </button>

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
          )}
        </div>
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
    </div>
  );
}
