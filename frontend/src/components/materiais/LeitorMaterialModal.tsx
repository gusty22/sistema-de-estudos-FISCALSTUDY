import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Bookmark,
  Layers,
  ArrowLeft
} from 'lucide-react';
import type { StudyMaterialItem, TopicMaterialLink } from './BibliotecaMateriais';
import './LeitorMaterialModal.css';

export interface LeitorMaterialModalProps {
  material: StudyMaterialItem;
  topicLinks?: TopicMaterialLink[];
  onClose: (finalPage: number) => void;
  onUpdateProgress?: (materialId: string, newPage: number) => void;
}

export const LeitorMaterialModal: React.FC<LeitorMaterialModalProps> = ({
  material,
  topicLinks = [],
  onClose,
  onUpdateProgress
}) => {
  const totalPages = material.totalPaginas > 0 ? material.totalPaginas : 100;
  const initialPage = Math.max(1, Math.min(material.paginaAtual || 1, totalPages));

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [inputVal, setInputVal] = useState<string>(String(initialPage));
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [showTopicsSidebar, setShowTopicsSidebar] = useState<boolean>(true);
  const saveTimeoutRef = useRef<any>(null);
  const currentPageRef = useRef<number>(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Função para salvar progresso automaticamente no backend
  const persistProgress = useCallback(async (page: number) => {
    setSaveStatus('saving');
    try {
      let res = await fetch(`/api/v1/materials/${encodeURIComponent(material.id)}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paginaAtual: page })
      });
      if (!res.ok) {
        res = await fetch(`/api/v1/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...material, paginaAtual: page })
        });
      }
      if (res.ok) {
        if (onUpdateProgress) {
          onUpdateProgress(material.id, page);
        }
      }
    } catch (err) {
      console.warn('Falha no auto-save de progresso:', err);
    } finally {
      setTimeout(() => setSaveStatus('saved'), 400);
    }
  }, [material.id, onUpdateProgress]);

  // Dispara auto-save com debounce de 600ms a cada troca de página
  const changePage = useCallback((newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
    setInputVal(String(clamped));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => {
      persistProgress(clamped);
    }, 600);
  }, [totalPages, persistProgress]);

  // Teclas de atalho para navegação fluida (← e →)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        changePage(currentPageRef.current + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        changePage(currentPageRef.current - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changePage]);

  // Ao fechar, garante que a página atual seja salva imediatamente
  const handleClose = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    persistProgress(currentPageRef.current);
    onClose(currentPageRef.current);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed)) {
      changePage(parsed);
    } else {
      setInputVal(String(currentPage));
    }
  };

  const percentProgress = Math.min(100, Math.round((currentPage / totalPages) * 100));

  // Tópicos vinculados deste material
  const relatedLinks = topicLinks.filter(l => l.materialId === material.id);

  // Determina URL de exibição do arquivo
  const isExternalLink = material.formato === 'LINK' && material.urlOuCaminho;
  const backendFileUrl = `/api/v1/materials/${encodeURIComponent(material.id)}/file#page=${currentPage}`;

  return (
    <div className="leitor-modal-overlay">
      <div className="leitor-modal-container">
        
        {/* HEADER SUPERIOR DO LEITOR */}
        <header className="leitor-header">
          <div className="leitor-header-left">
            <button
              type="button"
              onClick={handleClose}
              className="btn-fechar-leitor"
              title="Voltar e salvar progresso (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Concluir Leitura</span>
            </button>

            <div className="leitor-material-info">
              <div className="leitor-material-title-box">
                <span className="leitor-format-tag">{material.formato || 'PDF'}</span>
                <span className="leitor-material-title" title={material.titulo}>
                  {material.titulo}
                </span>
              </div>
              <div className="leitor-material-meta">
                <span>{material.disciplina || 'Disciplina Geral'}</span>
                {material.autor && <span> • {material.autor}</span>}
              </div>
            </div>
          </div>

          {/* NAVEGAÇÃO DE PÁGINAS CENTRAL */}
          <div className="leitor-header-center">
            <button
              type="button"
              className="leitor-nav-btn"
              disabled={currentPage <= 1}
              onClick={() => changePage(currentPage - 1)}
              title="Página anterior (←)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <form onSubmit={handleInputSubmit} className="leitor-page-box">
              <span>Pág.</span>
              <input
                type="text"
                className="leitor-page-input"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onBlur={handleInputSubmit}
                title="Pressione Enter para pular para a página"
              />
              <span>de {totalPages}</span>
            </form>

            <button
              type="button"
              className="leitor-nav-btn"
              disabled={currentPage >= totalPages}
              onClick={() => changePage(currentPage + 1)}
              title="Próxima página (→)"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* STATUS DE AUTO-SAVE E AÇÕES */}
          <div className="leitor-header-right">
            <div className="auto-save-pill" title="Seu progresso é gravado automaticamente">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {saveStatus === 'saving'
                  ? 'Gravando...'
                  : `Progresso: ${percentProgress}% (pág. ${currentPage})`}
              </span>
            </div>

            {relatedLinks.length > 0 && (
              <button
                type="button"
                className="btn-toggle-topics"
                onClick={() => setShowTopicsSidebar(!showTopicsSidebar)}
                title="Mostrar/ocultar tópicos do edital vinculados"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{relatedLinks.length} tópicos</span>
              </button>
            )}

            {material.urlOuCaminho && (
              <a
                href={isExternalLink ? material.urlOuCaminho : backendFileUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-toggle-topics"
                title="Abrir em aba independente ou leitor nativo do sistema"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Nova Aba</span>
              </a>
            )}
          </div>
        </header>

        {/* BARRA DE PROGRESSO VISUAL NO TOPO */}
        <div className="leitor-progress-bar-track">
          <div
            className="leitor-progress-bar-fill"
            style={{ width: `${percentProgress}%` }}
          />
        </div>

        {/* CORPO DO LEITOR */}
        <main className="leitor-body">
          <div className="leitor-viewer-main">
            {isExternalLink ? (
              /* Link externo com iframe ou fallback */
              <iframe
                src={material.urlOuCaminho}
                className="leitor-frame"
                title={material.titulo}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            ) : material.urlOuCaminho ? (
              /* PDF ou arquivo local através do backend stream */
              <iframe
                src={backendFileUrl}
                className="leitor-frame"
                title={material.titulo}
              />
            ) : (
              /* Fallback Calmo: Quando não há arquivo físico ou é referência de livro */
              <div className="leitor-fallback-container">
                <div className="leitor-fallback-icon">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="leitor-fallback-title">{material.titulo}</h3>
                <p className="leitor-fallback-desc">
                  Este material está registrado como <strong>{material.formato || 'LIVRO'}</strong> na sua biblioteca.
                  Conforme você lê, utilize as setas <strong>←</strong> e <strong>→</strong> do teclado ou os botões superiores para folhear e registrar seu avanço. O sistema salvará cada página lida automaticamente sem que você precise preencher nada manualmente.
                </p>

                <div className="leitor-fallback-actions">
                  <button
                    type="button"
                    className="btn-open-external"
                    onClick={() => changePage(currentPage + 1)}
                  >
                    Avançar para Página {Math.min(currentPage + 1, totalPages)}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PAINEL LATERAL DE TÓPICOS CURRICULARES */}
          {showTopicsSidebar && relatedLinks.length > 0 && (
            <aside className="leitor-sidebar-topics">
              <div className="leitor-sidebar-header">
                <h4>
                  <Bookmark className="w-4 h-4 text-emerald-400" />
                  Tópicos Vinculados
                </h4>
                <button
                  type="button"
                  onClick={() => setShowTopicsSidebar(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="leitor-sidebar-list">
                {relatedLinks.map((link) => {
                  const hasPageRange = link.paginaInicio != null && link.paginaFim != null;
                  const isCurrentInRange = hasPageRange &&
                    currentPage >= (link.paginaInicio || 0) &&
                    currentPage <= (link.paginaFim || 9999);

                  return (
                    <div
                      key={link.id}
                      className={`leitor-topic-item ${isCurrentInRange ? 'active-range' : ''}`}
                      onClick={() => {
                        if (link.paginaInicio) {
                          changePage(link.paginaInicio);
                        }
                      }}
                      title={hasPageRange ? `Ir para a página ${link.paginaInicio}` : 'Tópico curricular vinculado'}
                    >
                      <span className="leitor-topic-title">
                        {link.topicoAssunto || 'Tópico do Edital'}
                      </span>
                      {hasPageRange && (
                        <span className="leitor-topic-pages">
                          Páginas {link.paginaInicio} a {link.paginaFim}
                          {isCurrentInRange && ' (Trecho Atual)'}
                        </span>
                      )}
                      {link.anotacoes && (
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--calm-text-muted)', fontStyle: 'italic' }}>
                          "{link.anotacoes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
};

export default LeitorMaterialModal;
