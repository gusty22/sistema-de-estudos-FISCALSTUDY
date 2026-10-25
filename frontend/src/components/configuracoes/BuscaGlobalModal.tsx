import React, { useState, useEffect, useRef } from 'react';
import { useModalA11y } from '../../utils/accessibility';
import {
  Search,
  BookOpen,
  HelpCircle,
  FileText,
  Target,
  ArrowRight,
  X,
  Sparkles,
  Command
} from 'lucide-react';
import './BuscaGlobalModal.css';

export interface BuscaGlobalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (targetTab: string, payload?: any) => void;
}

export const BuscaGlobalModal: React.FC<BuscaGlobalModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  useModalA11y({ isOpen, onClose, closeOnEscape: true, restoreFocus: true });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    CONTEUDOS: any[];
    QUESTOES: any[];
    MATERIAIS: any[];
    ATIVIDADES: any[];
  }>({
    CONTEUDOS: [],
    QUESTOES: [],
    MATERIAIS: [],
    ATIVIDADES: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ CONTEUDOS: [], QUESTOES: [], MATERIAIS: [], ATIVIDADES: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!query || query.trim().length < 2) {
      setResults({ CONTEUDOS: [], QUESTOES: [], MATERIAIS: [], ATIVIDADES: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(() => {
      fetch(`/api/v1/system/search?q=${encodeURIComponent(query.trim())}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setResults({
              CONTEUDOS: data.CONTEUDOS || [],
              QUESTOES: data.QUESTOES || [],
              MATERIAIS: data.MATERIAIS || [],
              ATIVIDADES: data.ATIVIDADES || []
            });
          }
        })
        .catch(err => console.warn('Erro na busca global:', err))
        .finally(() => setIsSearching(false));
    }, 200);

    return () => clearTimeout(handler);
  }, [query, isOpen]);

  // Atalho Esc para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalResults =
    results.CONTEUDOS.length +
    results.QUESTOES.length +
    results.MATERIAIS.length +
    results.ATIVIDADES.length;

  const handleSelectResult = (item: any) => {
    onClose();
    if (item.targetTab) {
      if (item.tipo === 'QUESTAO') {
        sessionStorage.setItem('fiscalstudy_target_question_id', item.id);
      } else if (item.tipo === 'CONTEUDO') {
        sessionStorage.setItem('fiscalstudy_filter_discipline', item.disciplina || '');
        sessionStorage.setItem('fiscalstudy_filter_assunto', item.assunto || '');
      }
      onNavigate(item.targetTab, item);
    }
  };

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div
        className="search-modal-dialog animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global no acervo"
        onClick={e => e.stopPropagation()}
      >
        {/* Barra de Input */}
        <div className="search-input-header">
          <Search className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="search-input-field"
            placeholder="Buscar por disciplina, tópico, questão, prova, material ou objetivo..."
            value={query}
            aria-label="Campo de busca global"
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="search-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Limpar termo de busca"
              title="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="kbd-shortcut-hint">
            <Command className="w-3.5 h-3.5 inline" /> ESC
          </div>
        </div>

        {/* Resultados Agrupados */}
        <div className="search-results-container">
          {isSearching ? (
            <div className="search-feedback-state">
              <Sparkles className="w-5 h-5 text-sky-400 animate-spin" />
              <span>Pesquisando no acervo do FiscalStudy...</span>
            </div>
          ) : query.trim().length >= 2 && totalResults === 0 ? (
            <div className="search-feedback-state">
              <p style={{ color: '#94a3b8', margin: 0 }}>Nenhum recurso encontrado para "{query}".</p>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Tente buscar por termos como "tributário", "crédito", "patrimônio" ou "auditoria".</span>
            </div>
          ) : query.trim().length < 2 ? (
            <div className="search-hints-box">
              <span className="hints-title">💡 Dica de Busca Global</span>
              <p>Digite qualquer termo para encontrar instantaneamente conteúdos do edital, enunciados de questões, materiais de estudo e revisões pendentes.</p>
            </div>
          ) : (
            <div className="grouped-results-list">
              {/* 1. CONTEÚDOS */}
              {results.CONTEUDOS.length > 0 && (
                <div className="category-section">
                  <div className="category-header">
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    <span>CONTEÚDOS & EDITAL ({results.CONTEUDOS.length})</span>
                  </div>
                  {results.CONTEUDOS.map((item, i) => (
                    <div key={i} className="search-result-item" onClick={() => handleSelectResult(item)}>
                      <div className="item-title-col">
                        <span className="item-title">{item.titulo}</span>
                        <span className="item-sub">Tópico do edital verticalizado</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 item-arrow" />
                    </div>
                  ))}
                </div>
              )}

              {/* 2. QUESTÕES */}
              {results.QUESTOES.length > 0 && (
                <div className="category-section">
                  <div className="category-header">
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    <span>QUESTÕES RELACIONADAS ({results.QUESTOES.length})</span>
                  </div>
                  {results.QUESTOES.map((item, i) => (
                    <div key={i} className="search-result-item" onClick={() => handleSelectResult(item)}>
                      <div className="item-title-col">
                        <span className="item-title">{item.titulo}</span>
                        <span className="item-sub">{item.disciplina} • {item.assunto}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 item-arrow" />
                    </div>
                  ))}
                </div>
              )}

              {/* 3. MATERIAIS */}
              {results.MATERIAIS.length > 0 && (
                <div className="category-section">
                  <div className="category-header">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>MATERIAIS & DOCUMENTOS ({results.MATERIAIS.length})</span>
                  </div>
                  {results.MATERIAIS.map((item, i) => (
                    <div key={i} className="search-result-item" onClick={() => handleSelectResult(item)}>
                      <div className="item-title-col">
                        <span className="item-title">{item.titulo}</span>
                        <span className="item-sub">{item.formato} • {item.paginas} páginas vinculadas confirmadas</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 item-arrow" />
                    </div>
                  ))}
                </div>
              )}

              {/* 4. ATIVIDADES */}
              {results.ATIVIDADES.length > 0 && (
                <div className="category-section">
                  <div className="category-header">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span>ATIVIDADES & SIMULADOS ({results.ATIVIDADES.length})</span>
                  </div>
                  {results.ATIVIDADES.map((item, i) => (
                    <div key={i} className="search-result-item" onClick={() => handleSelectResult(item)}>
                      <div className="item-title-col">
                        <span className="item-title">{item.titulo}</span>
                        <span className="item-sub">Modo: {item.modo}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 item-arrow" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="search-modal-footer">
          <span>Pressione <strong>ESC</strong> para fechar ou clique em um resultado para abrir diretamente</span>
        </div>
      </div>
    </div>
  );
};

export default BuscaGlobalModal;
