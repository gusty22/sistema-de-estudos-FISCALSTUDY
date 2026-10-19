import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { StagingFile, StagingDocRole } from './ImportStudio';
import { QuestionPreviewModal } from './QuestionPreviewModal';
import './AuditCockpit.css';

export interface StagingQuestion {
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
  rejectionType?: string;
  supportMaterial?: any;
  status: string;
  flags: string[];
  pages: number[];
  evidenceImage: string | null;
  reviewNotes?: string;
  modifiedByUser?: boolean;
  justificativa?: string;
  textoApoio?: string;
  textoApoioTitulo?: string;
}

interface AuditCockpitProps {
  file: StagingFile | null;
  session: any | null;
  questions: StagingQuestion[];
  activeQuestionId: string | null;
  fileDocuments: StagingDocRole[];
  editalTopicos: { id: string; disciplina: string; assunto: string; subassunto?: string }[];
  onSelectQuestion: (id: string) => void;
  onUpdateQuestionField: (field: string, value: any) => void;
  onReplicateSupportMaterial?: (sourceQuestion: StagingQuestion, targetQuestionId: string) => void;
  onSaveCorrections: () => Promise<void>;
  onMarkVerified: () => Promise<void>;
  onMarkRejected: (type: 'RECUPERAVEL' | 'DEFINITIVA') => Promise<void>;
  onClose: () => void;
  onReloadAcervo: () => void;
}

export const AuditCockpit: React.FC<AuditCockpitProps> = ({
  file,
  session,
  questions,
  activeQuestionId,
  fileDocuments,
  editalTopicos,
  onSelectQuestion,
  onUpdateQuestionField,
  onReplicateSupportMaterial,
  onSaveCorrections,
  onMarkVerified,
  onMarkRejected,
  onClose,
  onReloadAcervo: _onReloadAcervo,
}) => {
  // Proporção do Splitter entre Prova e Gabarito (em porcentagem da área dos docs, padrão 52% Prova, 48% Gabarito)
  const [provaWidthPct, setProvaWidthPct] = useState<number>(53);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLElement>(null);

  // Páginas ativas individuais
  const [provaPage, setProvaPage] = useState<number>(1);
  const [gabaritoPage, setGabaritoPage] = useState<number>(1);
  const [evidenceMode, setEvidenceMode] = useState<'PDF' | 'IMAGE'>('PDF');
  const [forceMultipleChoice, setForceMultipleChoice] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [isFullTextOpen, setIsFullTextOpen] = useState<boolean>(false);
  const [isSupportMaterialOpen, setIsSupportMaterialOpen] = useState<boolean>(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Módulo H - T31: 4 Modos de Layout Ajustáveis
  const [layoutMode, setLayoutMode] = useState<'FULL_COMPARISON' | 'EXTRACTION_FOCUS' | 'ANSWER_KEY_FOCUS' | 'STUDENT_PREVIEW'>('FULL_COMPARISON');

  // Módulo H - T31: Rastreamento de Questões Visitadas (Visitada nunca significa validada!)
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => new Set(activeQuestionId ? [activeQuestionId] : []));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);

  // Módulo H - T32: Rastreabilidade Estrita de Alteração Manual de Gabarito
  const [isGabaritoModalOpen, setIsGabaritoModalOpen] = useState<boolean>(false);
  const [gabaritoChangeForm, setGabaritoChangeForm] = useState({
    oldVal: '',
    newVal: 'A',
    motivo: '',
    fonte: 'Gabarito Oficial Retificado',
    responsavel: 'Auditor Fiscal / Especialista',
  });

  // Módulo H - T34: Validação e Publicação em Lote
  const [isBatchPublishOpen, setIsBatchPublishOpen] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId) || questions[0];
  const activeIndex = questions.findIndex((q) => q.id === activeQuestion?.id);

  // Marca questão atual como visitada
  useEffect(() => {
    if (activeQuestionId) {
      setVisitedIds((prev) => {
        if (prev.has(activeQuestionId)) return prev;
        const next = new Set(prev);
        next.add(activeQuestionId);
        return next;
      });
    }
  }, [activeQuestionId]);

  // Material de apoio com fallback bidirecional para textoApoio
  const effectiveSupportMaterial = activeQuestion?.supportMaterial || (activeQuestion?.textoApoio ? {
    tipo: 'TEXTO_BASE',
    titulo: activeQuestion.textoApoioTitulo || 'Texto de Apoio 1',
    conteudoTexto: activeQuestion.textoApoio,
    docOrigem: 'Caderno de Prova',
  } : null);

  const handleUpdateSupportMaterial = (newMaterial: any) => {
    onUpdateQuestionField('supportMaterial', newMaterial);
    onUpdateQuestionField('textoApoio', newMaterial?.conteudoTexto ?? '');
    onUpdateQuestionField('textoApoioTitulo', newMaterial?.titulo ?? '');
  };

  // Identifica página padrão de gabarito a partir dos docRoles
  const defaultGabaritoPage = React.useMemo(() => {
    const gabDoc = fileDocuments?.find((d) => d.docRole && d.docRole.includes('GABARITO'));
    if (gabDoc && gabDoc.pageStart) return gabDoc.pageStart;
    return file?.totalPages || 1;
  }, [fileDocuments, file]);

  // Sincronização inteligente ao mudar de questão
  useEffect(() => {
    if (activeQuestion) {
      if (activeQuestion.pages && activeQuestion.pages.length > 0) {
        setProvaPage(activeQuestion.pages[0]);
      }
      // Se a questão ou documento mapeia gabarito, sincroniza
      if (defaultGabaritoPage) {
        setGabaritoPage(defaultGabaritoPage);
      }
      setForceMultipleChoice(false);
    }
  }, [activeQuestionId, defaultGabaritoPage]);

  // Auto-deslocamento horizontal da régua para manter a questão ativa visível e centralizada
  useEffect(() => {
    if (activeQuestion?.id && stripRef.current) {
      const activeBtn = stripRef.current.querySelector(`[data-question-id="${activeQuestion.id}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeQuestionId]);

  // Detector de Certo / Errado (Cebraspe)
  const isQuestionCertoErrado = useCallback((q?: StagingQuestion | null): boolean => {
    if (!q) return false;
    if (q.options && q.options.length === 2) return true;
    const stmt = (q.statement || '').toUpperCase();
    return stmt.includes('JULGUE O ITEM') || stmt.includes('JULGUE OS ITENS') || stmt.includes('CERTO OU ERRADO');
  }, []);

  const isCE = isQuestionCertoErrado(activeQuestion) && !forceMultipleChoice;

  // Navegação entre questões
  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      onSelectQuestion(questions[activeIndex - 1].id);
    }
  }, [activeIndex, questions, onSelectQuestion]);

  const handleNext = useCallback(() => {
    if (activeIndex < questions.length - 1) {
      onSelectQuestion(questions[activeIndex + 1].id);
    }
  }, [activeIndex, questions, onSelectQuestion]);

  // Gabarito rápido
  const handleSetGabarito = useCallback(
    (opt: string) => {
      onUpdateQuestionField('correctOption', opt);
      if (opt === 'ANULADA') {
        onUpdateQuestionField('gabaritoStatus', 'ANULADA');
      } else {
        // Todas as provas auditadas devem ter gabarito status como PRELIMINAR por padrão
        if (!activeQuestion.gabaritoStatus || activeQuestion.gabaritoStatus === 'DEFINITIVO' || activeQuestion.gabaritoStatus === 'AUSENTE') {
          onUpdateQuestionField('gabaritoStatus', 'PRELIMINAR');
        }
      }
    },
    [onUpdateQuestionField, activeQuestion]
  );

  // Aprovar e ir para próxima automaticamente (Fluxo turbo)
  const handleVerifyAndNext = useCallback(async () => {
    await onMarkVerified();
    if (activeIndex < questions.length - 1) {
      onSelectQuestion(questions[activeIndex + 1].id);
    }
  }, [onMarkVerified, activeIndex, questions, onSelectQuestion]);

  // Atalhos de teclado ergonômicos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalhos se o usuário estiver digitando em input ou textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleVerifyAndNext();
      } else if (isCE) {
        if (e.key === 'c' || e.key === 'C') handleSetGabarito('C');
        if (e.key === 'e' || e.key === 'E') handleSetGabarito('E');
      } else {
        const k = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E'].includes(k)) {
          handleSetGabarito(k);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleVerifyAndNext, handleSetGabarito, isCE]);

  // Gerenciamento de arrasto do Splitter (Redimensionador Prova x Gabarito)
  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitter || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const totalW = rect.width;
      const pct = Math.max(25, Math.min(75, (offsetX / totalW) * 100));
      setProvaWidthPct(pct);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    if (isDraggingSplitter) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // Contadores e métricas de elegibilidade para publicação (T34)
  const verifiedCount = questions.filter((q) => q.status === 'SOURCE_VERIFIED').length;
  const reviewCount = questions.filter((q) => q.status === 'NEEDS_REVIEW' || q.status === 'STRUCTURALLY_VALID').length;
  const rejectedCount = questions.filter((q) => q.status === 'REJECTED').length;

  const eligibleQuestions = questions.filter((q) => {
    const isCEq = isQuestionCertoErrado(q);
    return q.status === 'SOURCE_VERIFIED' && q.correctOption && q.statement && (isCEq || (q.options && q.options.length >= 2));
  });

  const blockingQuestions = questions.filter((q) => {
    const isCEq = isQuestionCertoErrado(q);
    return !q.statement || (!q.correctOption && q.gabaritoStatus !== 'ANULADA') || (!isCEq && (!q.options || q.options.length < 2));
  });

  const needsReviewList = questions.filter((q) => q.status !== 'SOURCE_VERIFIED' && !blockingQuestions.some(b => b.id === q.id));

  const fileId = file?.id;
  const sessionId = session?.sessionId;

  // Função para os 7 estados visuais canônicos da faixa horizontal (T31)
  const getQuestionVisualState = (q: StagingQuestion) => {
    if (q.status === 'PUBLISHED') {
      return { state: 'PUBLICADA', label: 'Publicada', icon: '★', cls: 'status-publicada', desc: 'Disponível no banco oficial' };
    }
    if (q.status === 'SOURCE_VERIFIED') {
      return { state: 'VALIDADA', label: 'Validada', icon: '✓', cls: 'status-validada', desc: 'Conferência humana concluída' };
    }
    if (q.modifiedByUser || q.flags?.includes('MANUALLY_EDITED')) {
      return { state: 'EM_REVISAO', label: 'Em revisão', icon: '✏️', cls: 'status-em-revisao', desc: 'Correção humana em andamento' };
    }
    if ((q.flags && q.flags.length > 0) || q.rejectionType) {
      return { state: 'COM_ALERTA', label: 'Com alerta', icon: '⚡', cls: 'status-alerta', desc: `Existe inconsistência: ${q.flags?.join(', ') || q.rejectionType}` };
    }
    const isCEq = isQuestionCertoErrado(q);
    if (!q.statement || (!isCEq && (!q.options || q.options.length < 2)) || (!q.correctOption && q.gabaritoStatus !== 'ANULADA')) {
      return { state: 'INCOMPLETA', label: 'Incompleta', icon: '⚠️', cls: 'status-incompleta', desc: 'Faltam enunciado, alternativas ou gabarito' };
    }
    if (visitedIds.has(q.id)) {
      return { state: 'VISITADA', label: 'Visitada', icon: '👁️', cls: 'status-visitada', desc: 'Aberta, mas ainda não validada' };
    }
    return { state: 'NAO_VISITADA', label: 'Não visitada', icon: '○', cls: 'status-nao-visitada', desc: 'Ainda não foi aberta' };
  };

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setIsExitConfirmOpen(true);
    } else {
      onClose();
    }
  };

  // Executa publicação em lote para o banco de dados oficial (T34)
  const handleExecuteBatchPublish = async () => {
    if (!fileId && !sessionId) return;
    try {
      setIsPublishing(true);
      setPublishFeedback(null);
      const targetId = fileId || sessionId;
      const res = await fetch(`/api/v1/ingestion/staging-publish/${targetId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Falha ao publicar questões.');
      }
      setPublishFeedback(`Sucesso! ${data.publishedCount || eligibleQuestions.length} questões publicadas transacionalmente com sucesso.`);
      setHasUnsavedChanges(false);
      setTimeout(() => {
        setIsBatchPublishOpen(false);
        setPublishFeedback(null);
      }, 2000);
    } catch (err: any) {
      setPublishFeedback(`Erro: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="audit-cockpit-overlay">
      {/* 1. Header do Cockpit */}
      <header className="audit-cockpit-header">
        <div className="audit-cockpit-title-group">
          <button
            className="btn btn-secondary"
            onClick={handleRequestClose}
            style={{ padding: '5px 12px', fontSize: '0.82rem', borderColor: 'rgba(255,255,255,0.2)' }}
            title="Sair do modo focado de auditoria"
          >
            ← Sair da Auditoria
          </button>
          <h2>{file ? file.filename : 'Auditoria de Caderno de Prova'}</h2>
          <span className="audit-cockpit-meta-chip">
            {file ? `${file.banca} • ${file.ano || ''} • ${file.cargo || ''}` : 'Sessão em Auditoria'}
          </span>
        </div>

        {/* 4 Modos de Layout T31 */}
        <div className="layout-mode-group" title="Alternar entre os 4 modos canônicos de auditoria">
          <button
            className={`layout-mode-btn ${layoutMode === 'FULL_COMPARISON' ? 'active' : ''}`}
            onClick={() => setLayoutMode('FULL_COMPARISON')}
            title="Prova + Gabarito + Extração"
          >
            ◫ Comparação Completa
          </button>
          <button
            className={`layout-mode-btn ${layoutMode === 'EXTRACTION_FOCUS' ? 'active' : ''}`}
            onClick={() => setLayoutMode('EXTRACTION_FOCUS')}
            title="Prova + Questão editável"
          >
            📄 Foco na Extração
          </button>
          <button
            className={`layout-mode-btn ${layoutMode === 'ANSWER_KEY_FOCUS' ? 'active' : ''}`}
            onClick={() => setLayoutMode('ANSWER_KEY_FOCUS')}
            title="Questão + Documento oficial"
          >
            🎯 Foco no Gabarito
          </button>
          <button
            className={`layout-mode-btn ${layoutMode === 'STUDENT_PREVIEW' ? 'active' : ''}`}
            onClick={() => setIsPreviewOpen(true)}
            title="Questão como aparecerá ao estudante"
          >
            👁️ Pré-visualização
          </button>
        </div>

        <div className="audit-cockpit-stats">
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>Total: {questions.length}</span>
          <span style={{ color: '#34d399' }}>✓ {verifiedCount} Verificadas</span>
          <span style={{ color: '#fbbf24' }}>⚠️ {reviewCount} Pendentes</span>
          {rejectedCount > 0 && <span style={{ color: '#ef4444' }}>🚫 {rejectedCount} Rejeitadas</span>}
        </div>

        <div className="audit-cockpit-header-actions">
          {/* Toggle PDF / Foto */}
          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px' }}>
            <button
              className={`opt-btn-mini ${evidenceMode === 'PDF' ? 'active' : ''}`}
              style={evidenceMode === 'PDF' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
              onClick={() => setEvidenceMode('PDF')}
            >
              📄 PDF
            </button>
            <button
              className={`opt-btn-mini ${evidenceMode === 'IMAGE' ? 'active' : ''}`}
              style={evidenceMode === 'IMAGE' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
              onClick={() => setEvidenceMode('IMAGE')}
            >
              🖼️ Foto
            </button>
          </div>

          {/* Botão de Publicação em Lote T34 */}
          <button
            className="btn"
            onClick={() => setIsBatchPublishOpen(true)}
            style={{
              padding: '5px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Validar e publicar questões auditadas para o banco oficial dos estudantes"
          >
            <span>📦 Publicar em Lote</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => {
              const url = fileId
                ? `/api/v1/ingestion/staging-files/${fileId}/pdf#page=${provaPage}`
                : `/api/v1/ingestion/sessions/${sessionId}/pdf#page=${provaPage}`;
              window.open(url, '_blank');
            }}
            style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#38bdf8' }}
            title="Abrir PDF original em tela cheia numa nova aba"
          >
            ↗ Nova Aba
          </button>
        </div>
      </header>

      {/* 2. Régua Horizontal com os 7 Estados Visuais Canônicos (T31) */}
      <nav className="audit-cockpit-strip" ref={stripRef}>
        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px', whiteSpace: 'nowrap' }}>
          Questões ({questions.length}):
        </span>
        {questions.map((q) => {
          const isAct = q.id === activeQuestion?.id;
          const visual = getQuestionVisualState(q);

          return (
            <button
              key={q.id}
              data-question-id={q.id}
              className={`audit-strip-item ${visual.cls} ${isAct ? 'is-selected' : ''}`}
              onClick={() => onSelectQuestion(q.id)}
              title={`Questão ${q.numeroOriginal} • ${visual.label}: ${visual.desc}`}
            >
              <span className="status-indicator-dot">{visual.icon}</span>
              <span>Q{q.numeroOriginal}</span>
              <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>{visual.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. Área Principal: Splitter Prova x Gabarito (~75%) + Dock de Validação (~25%) */}
      <div className="audit-cockpit-main">
        {/* Document Comparison Section com Layout Ajustável T31 */}
        <div className="audit-docs-container" ref={containerRef} style={{ flex: 1 }}>
          {/* Subcoluna 1: Caderno de Prova (Visível em FULL_COMPARISON e EXTRACTION_FOCUS) */}
          {layoutMode !== 'ANSWER_KEY_FOCUS' && (
            <div
              className="audit-doc-column"
              style={{ width: layoutMode === 'EXTRACTION_FOCUS' ? '100%' : `${provaWidthPct}%` }}
            >
              <div className="audit-doc-header">
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>📄 Caderno de Prova</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => setProvaPage((p) => Math.max(1, p - 1))}
                    title="Página anterior da prova"
                  >
                    ◄
                  </button>
                  <span style={{ fontWeight: 600, color: 'var(--audit-text, #0f172a)', fontSize: '0.8rem' }}>Pág. {provaPage}</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => setProvaPage((p) => p + 1)}
                    title="Próxima página da prova"
                  >
                    ►
                  </button>
                </div>
              </div>

              <div className="audit-doc-body">
                {evidenceMode === 'PDF' && (fileId || sessionId) ? (
                  <iframe
                    key={`audit-pdf-prova-${fileId || sessionId}`}
                    src={
                      fileId
                        ? `/api/v1/ingestion/staging-files/${fileId}/pdf#page=${provaPage}`
                        : `/api/v1/ingestion/sessions/${sessionId}/pdf#page=${provaPage}`
                    }
                    title="Caderno de Prova"
                    className="audit-doc-iframe"
                  />
                ) : fileId ? (
                  <div className="audit-doc-image-wrap">
                    <img
                      key={`audit-img-prova-${fileId}-p${provaPage}`}
                      src={`/api/v1/ingestion/staging-files/${fileId}/page-image?page=${provaPage}`}
                      alt={`Página ${provaPage} da prova`}
                      className="audit-doc-image"
                    />
                  </div>
                ) : (
                  <div style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>PDF não carregado</div>
                )}
              </div>
            </div>
          )}

          {/* Divisor Arrastável (Splitter) somente no modo FULL_COMPARISON */}
          {layoutMode === 'FULL_COMPARISON' && (
            <div
              className={`audit-splitter-handle ${isDraggingSplitter ? 'dragging' : ''}`}
              onMouseDown={handleMouseDownSplitter}
              title="Arraste para ajustar a largura entre Prova e Gabarito"
            />
          )}

          {/* Subcoluna 2: Gabarito Oficial (Visível em FULL_COMPARISON e ANSWER_KEY_FOCUS) */}
          {layoutMode !== 'EXTRACTION_FOCUS' && (
            <div
              className="audit-doc-column"
              style={{ width: layoutMode === 'ANSWER_KEY_FOCUS' ? '100%' : `${100 - provaWidthPct}%` }}
            >
              <div className="audit-doc-header">
                <span style={{ fontWeight: 700, color: '#34d399' }}>🎯 Gabarito Oficial</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => setGabaritoPage((p) => Math.max(1, p - 1))}
                    title="Página anterior do gabarito"
                  >
                    ◄
                  </button>
                  <span style={{ fontWeight: 600, color: 'var(--audit-text, #0f172a)', fontSize: '0.8rem' }}>Pág. {gabaritoPage}</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => setGabaritoPage((p) => p + 1)}
                    title="Próxima página do gabarito"
                  >
                    ►
                  </button>
                </div>
              </div>

              <div className="audit-doc-body">
                {evidenceMode === 'PDF' && (fileId || sessionId) ? (
                  <iframe
                    key={`audit-pdf-gab-${fileId || sessionId}`}
                    src={
                      fileId
                        ? `/api/v1/ingestion/staging-files/${fileId}/pdf#page=${gabaritoPage}`
                        : `/api/v1/ingestion/sessions/${sessionId}/pdf#page=${gabaritoPage}`
                    }
                    title="Gabarito Oficial"
                    className="audit-doc-iframe"
                  />
                ) : fileId ? (
                  <div className="audit-doc-image-wrap">
                    <img
                      key={`audit-img-gab-${fileId}-p${gabaritoPage}`}
                      src={`/api/v1/ingestion/staging-files/${fileId}/page-image?page=${gabaritoPage}`}
                      alt={`Página ${gabaritoPage} do gabarito`}
                      className="audit-doc-image"
                    />
                  </div>
                ) : (
                  <div style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>Gabarito não carregado</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Dock Lateral de Validação (Right Pane) */}
        <aside className="audit-validation-dock" style={{ width: '380px' }}>
          {activeQuestion ? (
            <>
              {/* Barra de Navegação Rápida entre Questões */}
              <div className="dock-nav-box">
                <button
                  className="btn btn-secondary"
                  onClick={handlePrev}
                  disabled={activeIndex === 0}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  title="Questão anterior [Seta Esquerda]"
                >
                  ◄ Anterior
                </button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--audit-text, #0f172a)' }}>
                    Q{activeQuestion.numeroOriginal}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {activeIndex + 1} de {questions.length}
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleNext}
                  disabled={activeIndex === questions.length - 1}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  title="Próxima questão [Seta Direita]"
                >
                  Próxima ►
                </button>
              </div>

              {/* Caixa Principal: Gabarito Oficial em 1 Clique */}
              <div className="dock-gabarito-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399' }}>
                    🎯 Resposta Oficial (Auditoria):
                  </span>
                  <button
                    type="button"
                    onClick={() => setForceMultipleChoice((prev) => !prev)}
                    style={{
                      fontSize: '0.7rem',
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {isCE ? 'Modo A-E' : 'Modo C/E'}
                  </button>
                </div>

                <div className="dock-botoeira-grid">
                  {isCE ? (
                    <>
                      <button
                        type="button"
                        className={`dock-gab-btn certo-btn ${
                          activeQuestion.correctOption === 'C' || activeQuestion.correctOption === 'A' ? 'selected' : ''
                        }`}
                        onClick={() => handleSetGabarito('C')}
                        title="Atalho: Tecla C"
                      >
                        ✓ CERTO <span className="kbd-badge">C</span>
                      </button>
                      <button
                        type="button"
                        className={`dock-gab-btn errado-btn ${
                          activeQuestion.correctOption === 'E' || activeQuestion.correctOption === 'B' ? 'selected' : ''
                        }`}
                        onClick={() => handleSetGabarito('E')}
                        title="Atalho: Tecla E"
                      >
                        ✗ ERRADO <span className="kbd-badge">E</span>
                      </button>
                    </>
                  ) : (
                    ['A', 'B', 'C', 'D', 'E'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`dock-gab-btn ${activeQuestion.correctOption === opt ? 'selected' : ''}`}
                        onClick={() => handleSetGabarito(opt)}
                        title={`Atalho: Tecla ${opt}`}
                      >
                        {opt}
                      </button>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                  <button
                    type="button"
                    className={`btn btn-secondary ${activeQuestion.correctOption === 'ANULADA' ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      fontSize: '0.78rem',
                      padding: '5px',
                      color: activeQuestion.correctOption === 'ANULADA' ? '#b45309' : 'var(--audit-text, #0f172a)',
                      borderColor: activeQuestion.correctOption === 'ANULADA' ? '#f59e0b' : 'var(--audit-card-border, rgba(255,255,255,0.15))',
                    }}
                    onClick={() => handleSetGabarito('ANULADA')}
                  >
                    ⚠️ ANULADA
                  </button>
                  <button
                    type="button"
                    className={`btn btn-secondary ${activeQuestion.correctOption === 'DESCONSIDERADA' ? 'active' : ''}`}
                    style={{
                      flex: 1,
                      fontSize: '0.78rem',
                      padding: '5px',
                      color: activeQuestion.correctOption === 'DESCONSIDERADA' ? '#ef4444' : 'var(--audit-text, #0f172a)',
                      borderColor: activeQuestion.correctOption === 'DESCONSIDERADA' ? '#ef4444' : 'var(--audit-card-border, rgba(255,255,255,0.15))',
                    }}
                    onClick={() => handleSetGabarito('DESCONSIDERADA')}
                  >
                    🚫 DESCONSIDERAR
                  </button>
                </div>
              </div>

              {/* Status & Pág da Prova */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pág. na Prova</label>
                  <input
                    type="number"
                    className="form-control"
                    value={activeQuestion.pages?.[0] || provaPage}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      onUpdateQuestionField('pages', [v]);
                      setProvaPage(v);
                    }}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Gabarito Status</label>
                  <select
                    className="form-control"
                    value={activeQuestion.gabaritoStatus || 'PRELIMINAR'}
                    onChange={(e) => onUpdateQuestionField('gabaritoStatus', e.target.value)}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                  >
                    <option value="PRELIMINAR">PRELIMINAR</option>
                    <option value="DEFINITIVO">DEFINITIVO</option>
                    <option value="ANULADA">ANULADA</option>
                    <option value="RETIFICADO">RETIFICADO</option>
                  </select>
                </div>
              </div>

              {/* Botão de Rastreabilidade Estrita de Alteração Manual de Gabarito (T32) */}
              <div style={{ marginTop: '0.4rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    fontSize: '0.75rem',
                    padding: '4px',
                    color: '#38bdf8',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                  onClick={() => {
                    setGabaritoChangeForm({
                      oldVal: activeQuestion.correctOption || 'AUSENTE',
                      newVal: activeQuestion.correctOption === 'A' ? 'B' : 'A',
                      motivo: '',
                      fonte: 'Gabarito Oficial Retificado / Definitivo',
                      responsavel: 'Auditor Fiscal / Especialista',
                    });
                    setIsGabaritoModalOpen(true);
                  }}
                  title="Registrar alteração manual de gabarito com motivo, fonte e responsável"
                >
                  <span>📝 Alteração de Gabarito com Rastreabilidade</span>
                </button>
              </div>

              {/* Gaveta Recolhível: Classificação Temática & Edital */}
              <div className="dock-meta-drawer">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setIsDrawerOpen((prev) => !prev)}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                    🏷️ Classificação & Edital
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{isDrawerOpen ? '▲ Recolher' : '▼ Expandir'}</span>
                </div>

                {isDrawerOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Disciplina</label>
                      <input
                        className="form-control"
                        value={activeQuestion.disciplina || ''}
                        onChange={(e) => onUpdateQuestionField('disciplina', e.target.value)}
                        placeholder="Ex: Auditoria, Tributário"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Assunto</label>
                        <input
                          className="form-control"
                          value={activeQuestion.assunto || ''}
                          onChange={(e) => onUpdateQuestionField('assunto', e.target.value)}
                          placeholder="Ex: Amostragem"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Subassunto</label>
                        <input
                          className="form-control"
                          value={activeQuestion.subassunto || ''}
                          onChange={(e) => onUpdateQuestionField('subassunto', e.target.value)}
                          placeholder="Ex: Não Estatística"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>

                    {editalTopicos.length > 0 && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Vincular ao Edital Verticalizado</label>
                        <select
                          className="form-control"
                          value={activeQuestion.editalTopicoId || ''}
                          onChange={(e) => {
                            const top = editalTopicos.find((t) => t.id === e.target.value);
                            if (top) {
                              onUpdateQuestionField('editalTopicoId', top.id);
                              onUpdateQuestionField('disciplina', top.disciplina);
                              onUpdateQuestionField('assunto', top.assunto);
                              if (top.subassunto) onUpdateQuestionField('subassunto', top.subassunto);
                            } else {
                              onUpdateQuestionField('editalTopicoId', '');
                            }
                          }}
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                        >
                          <option value="">-- Selecione o tópico --</option>
                          {editalTopicos.map((top) => (
                            <option key={top.id} value={top.id}>
                              [{top.disciplina}] {top.assunto} {top.subassunto ? `- ${top.subassunto}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bloco Dedicado: Material de Apoio / Texto-Base / Gráficos */}
              <div className="dock-support-material-box">
                <div className="dock-support-header">
                  <span className="dock-support-title">
                    📎 Texto de Apoio / Base
                    {effectiveSupportMaterial?.titulo && (
                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 'normal' }}>
                        ({effectiveSupportMaterial.titulo})
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {effectiveSupportMaterial ? (
                      <button
                        type="button"
                        className="opt-btn-mini"
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        onClick={() => handleUpdateSupportMaterial(null)}
                        title="Remover texto de apoio desta questão"
                      >
                        ✕ Remover
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="opt-btn-mini"
                        style={{ color: '#38bdf8', borderColor: '#38bdf8' }}
                        onClick={() =>
                          handleUpdateSupportMaterial({
                            tipo: 'TEXTO_BASE',
                            titulo: 'Texto de Apoio 1',
                            conteudoTexto: '',
                            docOrigem: 'Caderno de Prova',
                          })
                        }
                        title="Vincular novo texto de apoio a esta questão"
                      >
                        + Adicionar
                      </button>
                    )}
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}
                      onClick={() => setIsSupportMaterialOpen((prev) => !prev)}
                    >
                      {isSupportMaterialOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {isSupportMaterialOpen && (
                  <>
                    {effectiveSupportMaterial ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.35rem' }}>
                          <select
                            className="form-control"
                            value={effectiveSupportMaterial.tipo || 'TEXTO_BASE'}
                            onChange={(e) =>
                              handleUpdateSupportMaterial({
                                ...effectiveSupportMaterial,
                                tipo: e.target.value,
                              })
                            }
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
                          >
                            <option value="TEXTO_BASE">Texto-base</option>
                            <option value="TABELA">Tabela</option>
                            <option value="GRAFICO">Gráfico</option>
                            <option value="FIGURA">Figura / Imagem</option>
                            <option value="ESTUDO_DE_CASO">Estudo de Caso</option>
                          </select>
                          <input
                            className="form-control"
                            placeholder="Título (ex: TEXTO 01 / 02)"
                            value={effectiveSupportMaterial.titulo || ''}
                            onChange={(e) =>
                              handleUpdateSupportMaterial({
                                ...effectiveSupportMaterial,
                                titulo: e.target.value,
                              })
                            }
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem' }}
                          />
                        </div>

                        <textarea
                          className="form-control"
                          rows={4}
                          placeholder="Cole ou edite aqui o texto-base que subsidia esta questão para ser exibido ao resolver..."
                          value={effectiveSupportMaterial.conteudoTexto || ''}
                          onChange={(e) =>
                            handleUpdateSupportMaterial({
                              ...effectiveSupportMaterial,
                              conteudoTexto: e.target.value,
                            })
                          }
                          style={{ fontSize: '0.8rem', lineHeight: 1.4, resize: 'vertical' }}
                        />

                        {/* Atalho para replicar texto para a próxima questão */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
                          <button
                            type="button"
                            className="opt-btn-mini"
                            style={{ color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.4)' }}
                            onClick={() => {
                              if (activeIndex < questions.length - 1) {
                                const nextQ = questions[activeIndex + 1];
                                if (onReplicateSupportMaterial) {
                                  onReplicateSupportMaterial(activeQuestion, nextQ.id);
                                } else {
                                  onUpdateQuestionField('supportMaterial', { ...effectiveSupportMaterial });
                                }
                                alert(`Texto de apoio replicado para a Questão Q${nextQ.numeroOriginal}!`);
                              }
                            }}
                            title="Replicar este mesmo texto de apoio para a próxima questão (ex: questões 1 a 5 usam o mesmo texto)"
                          >
                            🔗 Replicar p/ Próxima Questão
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="dock-support-empty-hint">
                        {/* Se alguma questão anterior tiver material de apoio, oferecer vincular com 1 clique */}
                        {(() => {
                          const prevWithMaterial = questions.slice(0, activeIndex).reverse().find((q) => q.supportMaterial?.conteudoTexto || q.textoApoio);
                          if (prevWithMaterial) {
                            const prevMat = prevWithMaterial.supportMaterial || {
                              tipo: 'TEXTO_BASE',
                              titulo: prevWithMaterial.textoApoioTitulo || 'Texto de Apoio',
                              conteudoTexto: prevWithMaterial.textoApoio,
                              docOrigem: 'Caderno de Prova',
                            };
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span style={{ color: '#fbbf24' }}>⚠️ Nenhum texto de apoio vinculado a esta questão.</span>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#38bdf8', borderColor: '#38bdf8' }}
                                  onClick={() => handleUpdateSupportMaterial({ ...prevMat })}
                                >
                                  📎 Reutilizar Texto da Q{prevWithMaterial.numeroOriginal} ({prevMat.titulo || 'Texto-Base'})
                                </button>
                              </div>
                            );
                          }
                          return (
                            <span>Nenhum texto-base vinculado. Clique em <strong>+ Adicionar</strong> se esta questão depender de texto compartilhado da prova.</span>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Botão de Enunciado/Texto Extraído (Modal ou gaveta rápida) */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsFullTextOpen((prev) => !prev)}
                style={{ fontSize: '0.78rem', padding: '5px 10px', color: '#cbd5e1' }}
              >
                {isFullTextOpen ? '▲ Fechar Detalhes da Extração' : '📝 Ver / Editar Enunciado, Justificativa & Apoio'}
              </button>

              {isFullTextOpen && (
                <div style={{ background: 'var(--audit-card-subtle, #f8fafc)', border: '1px solid var(--audit-card-border, #e2e8f0)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, color: 'var(--audit-text, #0f172a)', fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block' }}>Enunciado:</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={activeQuestion.statement || ''}
                      onChange={(e) => onUpdateQuestionField('statement', e.target.value)}
                      style={{ fontSize: '0.78rem', lineHeight: 1.3, background: 'var(--audit-card-bg, #ffffff)', color: 'var(--audit-text, #0f172a)', border: '1px solid var(--audit-card-border, #cbd5e1)' }}
                    />
                  </div>

                  {(activeQuestion.textoApoio !== undefined || activeQuestion.textoApoioTitulo || effectiveSupportMaterial) && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, color: '#0284c7', fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block' }}>
                        Texto de Apoio {effectiveSupportMaterial?.titulo ? `(${effectiveSupportMaterial.titulo})` : ''}:
                      </label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={effectiveSupportMaterial?.conteudoTexto || activeQuestion.textoApoio || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateSupportMaterial({
                            ...(effectiveSupportMaterial || { tipo: 'TEXTO_BASE', titulo: 'Texto de Apoio 1' }),
                            conteudoTexto: val,
                          });
                        }}
                        placeholder="Texto de apoio associado..."
                        style={{ fontSize: '0.78rem', lineHeight: 1.3, background: 'var(--audit-card-bg, #ffffff)', color: 'var(--audit-text, #0f172a)', border: '1px solid var(--audit-card-border, #cbd5e1)' }}
                      />
                    </div>
                  )}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, color: '#b45309', fontSize: '0.75rem', marginBottom: '0.2rem', display: 'block' }}>
                      Justificativa Oficial / Comentada:
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={activeQuestion.justificativa || ''}
                      onChange={(e) => onUpdateQuestionField('justificativa', e.target.value)}
                      placeholder="Sem justificativa cadastrada"
                      style={{ fontSize: '0.78rem', lineHeight: 1.3, background: 'var(--audit-card-bg, #ffffff)', color: 'var(--audit-text, #0f172a)', border: '1px solid var(--audit-card-border, #cbd5e1)' }}
                    />
                  </div>

                  {activeQuestion.options && activeQuestion.options.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Alternativas:</div>
                      {activeQuestion.options.map((opt, i) => (
                        <div key={i} style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px', paddingLeft: '4px' }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Ação Final no Rodapé do Dock */}
              <div className="dock-action-buttons">
                <button
                  className="btn"
                  onClick={handleVerifyAndNext}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  title="Aprovar e avançar para próxima questão [Ctrl+Enter]"
                >
                  <span>✅ Aprovar & Próxima</span>
                  <span className="kbd-badge" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>Ctrl+Enter</span>
                </button>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onSaveCorrections()}
                    style={{ flex: 1, fontSize: '0.78rem', padding: '6px' }}
                  >
                    💾 Salvar Dados
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onMarkRejected('RECUPERAVEL')}
                    style={{ flex: 1, fontSize: '0.78rem', padding: '6px', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                  >
                    ⚠️ Rejeitar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>
              Nenhuma questão selecionada
            </div>
          )}
        </aside>
      </div>

      {/* Modal de Pré-Visualização e Edição no Modo Estudante */}
      {isPreviewOpen && activeQuestion && (
        <QuestionPreviewModal
          question={activeQuestion}
          banca={file?.banca}
          ano={file?.ano ? Number(file.ano) : undefined}
          orgao={file?.orgao}
          cargo={file?.cargo}
          editalTopicos={editalTopicos}
          onUpdateQuestionField={(f, v) => {
            onUpdateQuestionField(f, v);
            setHasUnsavedChanges(true);
          }}
          onSave={async () => {
            await onSaveCorrections();
            setHasUnsavedChanges(false);
          }}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* Modal 1: Diálogo de Saída com Alterações Pendentes (T31) */}
      {isExitConfirmOpen && (
        <div className="audit-dialog-backdrop" onClick={() => setIsExitConfirmOpen(false)}>
          <div className="audit-dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="audit-dialog-header">
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Alterações Não Salvas
              </h3>
              <button className="btn-close" onClick={() => setIsExitConfirmOpen(false)}>✕</button>
            </div>
            <div className="audit-dialog-body" style={{ textAlign: 'left', lineHeight: 1.5, fontSize: '0.9rem', color: 'var(--audit-text, #0f172a)' }}>
              <p style={{ margin: '0 0 1rem', fontWeight: 600, color: 'var(--audit-text, #0f172a)' }}>
                Existem alterações pendentes. Deseja salvar, descartar ou continuar editando?
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--audit-text-muted, #64748b)' }}>
                Se você descartar, as modificações manuais realizadas nesta sessão de auditoria serão revertidas para o estado anterior da extração.
              </p>
            </div>
            <div className="audit-dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsExitConfirmOpen(false)}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                ↩ Continuar Editando
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setIsExitConfirmOpen(false);
                  onClose();
                }}
                style={{ fontSize: '0.82rem', padding: '6px 12px', color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}
              >
                🗑️ Descartar e Sair
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await onSaveCorrections();
                  setHasUnsavedChanges(false);
                  setIsExitConfirmOpen(false);
                  onClose();
                }}
                style={{ fontSize: '0.82rem', padding: '6px 14px', background: '#10b981', color: '#fff', fontWeight: 700 }}
              >
                💾 Salvar e Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Rastreabilidade Estrita de Alteração Manual de Gabarito (T32) */}
      {isGabaritoModalOpen && activeQuestion && (
        <div className="audit-dialog-backdrop" onClick={() => setIsGabaritoModalOpen(false)}>
          <div className="audit-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="audit-dialog-header">
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📝 Registro de Alteração Manual de Gabarito
              </h3>
              <button className="btn-close" onClick={() => setIsGabaritoModalOpen(false)}>✕</button>
            </div>
            <div className="audit-dialog-body">
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#fbbf24' }}>
                ⚖️ <strong>Regra de Integridade:</strong> A alteração manual de gabarito não é mascarada como gabarito oficial da banca. Ela registra formalmente o valor anterior, o novo, a justificativa e o responsável técnico.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Gabarito Anterior</label>
                  <input
                    type="text"
                    className="form-control"
                    value={gabaritoChangeForm.oldVal}
                    disabled
                    style={{ background: 'var(--audit-card-subtle, #f1f5f9)', color: 'var(--audit-text, #0f172a)', border: '1px solid var(--audit-card-border, #cbd5e1)' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>Novo Gabarito Auditado</label>
                  <select
                    className="form-control"
                    value={gabaritoChangeForm.newVal}
                    onChange={(e) => setGabaritoChangeForm({ ...gabaritoChangeForm, newVal: e.target.value })}
                    style={{ borderColor: '#10b981', color: '#34d399', fontWeight: 700 }}
                  >
                    {isCE ? (
                      <>
                        <option value="C">C (CERTO)</option>
                        <option value="E">E (ERRADO)</option>
                        <option value="ANULADA">ANULADA</option>
                      </>
                    ) : (
                      <>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                        <option value="ANULADA">ANULADA</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Motivo da Alteração *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Ex: Retificação oficial do gabarito preliminar pela banca; divergência de chave de resposta..."
                  value={gabaritoChangeForm.motivo}
                  onChange={(e) => setGabaritoChangeForm({ ...gabaritoChangeForm, motivo: e.target.value })}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fonte Documental</label>
                  <input
                    type="text"
                    className="form-control"
                    value={gabaritoChangeForm.fonte}
                    onChange={(e) => setGabaritoChangeForm({ ...gabaritoChangeForm, fonte: e.target.value })}
                    placeholder="Ex: Gabarito Definitivo Oficial"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Responsável Técnico</label>
                  <input
                    type="text"
                    className="form-control"
                    value={gabaritoChangeForm.responsavel}
                    onChange={(e) => setGabaritoChangeForm({ ...gabaritoChangeForm, responsavel: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="audit-dialog-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setIsGabaritoModalOpen(false)}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                Cancelar
              </button>
              <button
                className="btn"
                disabled={!gabaritoChangeForm.motivo.trim()}
                onClick={() => {
                  const stamp = `[${new Date().toLocaleString('pt-BR')}] Gabarito alterado de ${gabaritoChangeForm.oldVal} para ${gabaritoChangeForm.newVal}. Motivo: ${gabaritoChangeForm.motivo}. Fonte: ${gabaritoChangeForm.fonte}. Auditor: ${gabaritoChangeForm.responsavel}`;
                  onUpdateQuestionField('correctOption', gabaritoChangeForm.newVal);
                  onUpdateQuestionField('gabaritoStatus', gabaritoChangeForm.newVal === 'ANULADA' ? 'ANULADA' : 'RETIFICADO');
                  onUpdateQuestionField('modifiedByUser', true);
                  onUpdateQuestionField('reviewNotes', activeQuestion.reviewNotes ? `${activeQuestion.reviewNotes}\n${stamp}` : stamp);
                  setHasUnsavedChanges(true);
                  setIsGabaritoModalOpen(false);
                }}
                style={{ fontSize: '0.82rem', padding: '6px 14px', background: '#0284c7', color: '#fff', fontWeight: 700 }}
              >
                ✓ Confirmar Alteração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Validação Estrutural e Publicação em Lote (T34) */}
      {isBatchPublishOpen && (
        <div className="audit-dialog-backdrop" onClick={() => !isPublishing && setIsBatchPublishOpen(false)}>
          <div className="audit-dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="audit-dialog-header">
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚀 Validação e Publicação em Lote
              </h3>
              <button className="btn-close" disabled={isPublishing} onClick={() => setIsBatchPublishOpen(false)}>✕</button>
            </div>
            <div className="audit-dialog-body">
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                Transfere transacionalmente as questões validadas da área de preparação (staging) para o banco de estudo oficial dos alunos (<code style={{ color: '#38bdf8' }}>fiscalstudy.db</code>).
              </p>

              {/* Resumo Canônico T34 */}
              <div style={{ background: 'var(--audit-card-subtle, #f8fafc)', border: '1px solid var(--audit-card-border, #e2e8f0)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--audit-text, #0f172a)', marginBottom: '0.5rem' }}>
                  Resumo Estrutural da Prova:
                </div>
                <div style={{ fontSize: '0.95rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  {questions.length} questões selecionadas. {eligibleQuestions.length} elegíveis. {needsReviewList.length} exigem revisão. {blockingQuestions.length} possuem inconsistências impeditivas.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{questions.length}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total</div>
                  </div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>{eligibleQuestions.length}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Elegíveis</div>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>{needsReviewList.length}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Revisão</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>{blockingQuestions.length}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Impeditivas</div>
                  </div>
                </div>
              </div>

              {blockingQuestions.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#f87171' }}>
                  🚫 <strong>Bloqueios Detectados:</strong> As seguintes questões não podem ser publicadas devido a inconsistências: {blockingQuestions.map(b => `Q${b.numeroOriginal}`).join(', ')}. Não é permitida a publicação silenciosa de itens inválidos.
                </div>
              )}

              {publishFeedback && (
                <div style={{ padding: '0.75rem', borderRadius: '6px', background: publishFeedback.startsWith('Erro') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: publishFeedback.startsWith('Erro') ? '#f87171' : '#34d399', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {publishFeedback}
                </div>
              )}
            </div>
            <div className="audit-dialog-footer">
              <button
                className="btn btn-secondary"
                disabled={isPublishing}
                onClick={() => setIsBatchPublishOpen(false)}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                Fechar
              </button>
              <button
                className="btn"
                disabled={isPublishing || eligibleQuestions.length === 0}
                onClick={handleExecuteBatchPublish}
                style={{ fontSize: '0.82rem', padding: '6px 16px', background: '#10b981', color: '#fff', fontWeight: 700 }}
              >
                {isPublishing ? 'Publicando Transacionalmente...' : `🚀 Publicar ${eligibleQuestions.length} Questões Elegíveis`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
