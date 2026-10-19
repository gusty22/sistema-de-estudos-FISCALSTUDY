import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Folder,
  FolderOpen,
  Trash2,
  Copy,
  Edit3,
  Search,
  Check,
  X
} from 'lucide-react';
import type { StudyMaterialItem, EditalTopic, TopicMaterialLink } from './BibliotecaMateriais';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './VinculacaoMaterialConteudo.css';

export interface VinculacaoMaterialConteudoProps {
  activeConcurso: ConcursoItem | null;
  materials: StudyMaterialItem[];
  topics: EditalTopic[];
  links: TopicMaterialLink[];
  initialSelectedTopicId?: string | null;
  selectedDisciplina?: string;
  onSelectDisciplina?: (disc: string) => void;
  onRefreshData: () => void;
  onClose?: () => void;
}

export const VinculacaoMaterialConteudo: React.FC<VinculacaoMaterialConteudoProps> = ({
  activeConcurso,
  materials,
  topics,
  links,
  initialSelectedTopicId,
  selectedDisciplina,
  onSelectDisciplina,
  onRefreshData,
  onClose
}) => {
  // Tópico selecionado no painel esquerdo
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initialSelectedTopicId || (topics.length > 0 ? topics[0].id : null)
  );

  // Busca no currículo
  const [curriculoSearch, setCurriculoSearch] = useState('');
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Record<string, boolean>>({});

  // Formulário do painel direito (Novo Vínculo ou Edição)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [paginaInicio, setPaginaInicio] = useState<number>(1);
  const [paginaFim, setPaginaFim] = useState<number>(20);
  const [anotacoes, setAnotacoes] = useState<string>('');
  const [confidenceLevel, setConfidenceLevel] = useState<'ALTA' | 'MEDIA' | 'BAIXA'>('ALTA');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Modal para Reutilizar Vínculo em Outro Objetivo
  const [cloneLinkTarget, setCloneLinkTarget] = useState<TopicMaterialLink | null>(null);
  const [availableConcursos, setAvailableConcursos] = useState<ConcursoItem[]>([]);
  const [targetConcursoId, setTargetConcursoId] = useState<string>('');
  const [isCloning, setIsCloning] = useState(false);

  // Mensagem de feedback
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'warning' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'warning' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Inicializa o primeiro material disponível se houver
  useEffect(() => {
    if (materials.length > 0 && !selectedMaterialId) {
      setSelectedMaterialId(materials[0].id);
    }
  }, [materials]);

  // Carregar concursos para clonagem de vínculos
  useEffect(() => {
    const fetchConcursos = async () => {
      try {
        const res = await fetch('/api/v1/concursos');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setAvailableConcursos(data.filter((c: ConcursoItem) => c.id !== activeConcurso?.id));
          }
        }
      } catch (err) {
        console.error('Falha ao carregar concursos para replicação:', err);
      }
    };
    fetchConcursos();
  }, [activeConcurso?.id]);

  // Expandir todas as disciplinas por padrão
  useEffect(() => {
    const initialExp: Record<string, boolean> = {};
    topics.forEach(t => {
      if (t.disciplina) initialExp[t.disciplina] = true;
    });
    setExpandedDisciplinas(initialExp);
  }, [topics]);

  // Auto-expandir ao buscar
  useEffect(() => {
    if (curriculoSearch.trim()) {
      const next: Record<string, boolean> = {};
      topics.forEach(t => {
        if (t.disciplina) next[t.disciplina] = true;
      });
      setExpandedDisciplinas(prev => ({ ...prev, ...next }));
    }
  }, [curriculoSearch, topics]);

  // Auto-expandir a disciplina selecionada pelo filtro superior
  useEffect(() => {
    if (selectedDisciplina && selectedDisciplina !== 'TODAS') {
      setExpandedDisciplinas(prev => ({ ...prev, [selectedDisciplina]: true }));
    }
  }, [selectedDisciplina]);

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    topics.forEach(t => {
      if (t.disciplina) next[t.disciplina] = true;
    });
    setExpandedDisciplinas(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    topics.forEach(t => {
      if (t.disciplina) next[t.disciplina] = false;
    });
    setExpandedDisciplinas(next);
  };

  // Agrupamento hierárquico do currículo por disciplina
  const curriculoTree = useMemo(() => {
    const groups: Record<string, EditalTopic[]> = {};
    topics.forEach(t => {
      const disc = t.disciplina || 'Outras';
      if (!groups[disc]) groups[disc] = [];
      groups[disc].push(t);
    });

    return Object.entries(groups)
      .filter(([disc]) => {
        if (!selectedDisciplina || selectedDisciplina === 'TODAS') return true;
        return disc.toLowerCase() === selectedDisciplina.toLowerCase();
      })
      .map(([disc, topList]) => {
        const filtered = topList.filter(t => {
          if (!curriculoSearch.trim()) return true;
          const query = curriculoSearch.toLowerCase();
          return (
            t.assunto.toLowerCase().includes(query) ||
            (t.subassunto && t.subassunto.toLowerCase().includes(query)) ||
            disc.toLowerCase().includes(query)
          );
        });

        return {
          disciplina: disc,
          topics: filtered,
          totalLinks: links.filter(l => topList.some(item => item.id === l.topicoId)).length
        };
      })
      .filter(g => g.topics.length > 0);
  }, [topics, links, curriculoSearch, selectedDisciplina]);

  const selectedTopic = useMemo(() => {
    return topics.find(t => t.id === selectedTopicId) || null;
  }, [topics, selectedTopicId]);

  const selectedMaterial = useMemo(() => {
    return materials.find(m => m.id === selectedMaterialId) || null;
  }, [materials, selectedMaterialId]);

  // Vínculos existentes para o tópico atualmente selecionado
  const topicLinks = useMemo(() => {
    if (!selectedTopicId) return [];
    return links.filter(l => l.topicoId === selectedTopicId);
  }, [links, selectedTopicId]);

  // Handler para salvar/adicionar vínculo
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId || !selectedMaterialId) {
      showFeedback('Selecione um tópico e um material.', 'warning');
      return;
    }

    if (paginaInicio > paginaFim) {
      showFeedback('A página inicial não pode ser maior que a final.', 'warning');
      return;
    }

    const payload = {
      id: editingLinkId || undefined,
      topicoId: selectedTopicId,
      materialId: selectedMaterialId,
      paginaInicio,
      paginaFim,
      paginasLidas: 0,
      status: 'CONFIRMADO', // Salvo manualmente pelo usuário
      anotacoes,
      confidenceScore: confidenceLevel === 'ALTA' ? 0.95 : confidenceLevel === 'MEDIA' ? 0.75 : 0.45
    };

    try {
      const res = await fetch('/api/v1/materials/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showFeedback(editingLinkId ? 'Vínculo atualizado com sucesso!' : 'Vínculo estabelecido com sucesso!');
        setEditingLinkId(null);
        setAnotacoes('');
        onRefreshData();
      } else {
        showFeedback('Erro ao salvar vínculo.', 'warning');
      }
    } catch {
      showFeedback('Falha de conexão com o servidor.', 'warning');
    }
  };

  // Confirmar vínculo sugerido por IA (Regra: sugestão de IA não é tratada como validada automaticamente)
  const handleConfirmSuggestion = async (link: TopicMaterialLink) => {
    try {
      const res = await fetch('/api/v1/materials/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...link,
          status: 'CONFIRMADO'
        })
      });

      if (res.ok) {
        showFeedback('Correspondência confirmada pelo usuário!');
        onRefreshData();
      }
    } catch {
      showFeedback('Erro ao confirmar correspondência.', 'warning');
    }
  };

  // Carregar dados no editor para correção
  const handleStartEdit = (link: TopicMaterialLink) => {
    setEditingLinkId(link.id);
    setSelectedMaterialId(link.materialId);
    setPaginaInicio(link.paginaInicio || 1);
    setPaginaFim(link.paginaFim || 20);
    setAnotacoes(link.anotacoes || '');
    if (link.confidenceScore && link.confidenceScore < 0.6) {
      setConfidenceLevel('BAIXA');
    } else if (link.confidenceScore && link.confidenceScore < 0.85) {
      setConfidenceLevel('MEDIA');
    } else {
      setConfidenceLevel('ALTA');
    }
  };

  // Remover vínculo
  const handleDeleteLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/v1/materials/links/${linkId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showFeedback('Vínculo removido da grade curricular.');
        onRefreshData();
      }
    } catch {
      showFeedback('Erro ao remover vínculo.', 'warning');
    }
  };

  // Reutilizar vínculo em outro objetivo
  const handleExecuteClone = async () => {
    if (!cloneLinkTarget || !targetConcursoId) return;
    setIsCloning(true);
    try {
      // 1. Obter o edital do concurso alvo para localizar tópico homônimo ou equivalente
      const editalRes = await fetch(`/api/v1/concursos/${targetConcursoId}/edital`);
      if (editalRes.ok) {
        const editalData = await editalRes.json();
        const targetTopics: EditalTopic[] = Array.isArray(editalData.topicos) ? editalData.topicos : [];
        
        // Tenta encontrar por assunto ou disciplina similar
        const matchedTopic = targetTopics.find(
          t => t.assunto.toLowerCase() === (cloneLinkTarget.topicoAssunto || '').toLowerCase() ||
               t.disciplina.toLowerCase() === (cloneLinkTarget.disciplina || '').toLowerCase()
        ) || (targetTopics.length > 0 ? targetTopics[0] : null);

        if (matchedTopic) {
          const clonedPayload = {
            topicoId: matchedTopic.id,
            materialId: cloneLinkTarget.materialId,
            paginaInicio: cloneLinkTarget.paginaInicio,
            paginaFim: cloneLinkTarget.paginaFim,
            paginasLidas: 0,
            status: 'CONFIRMADO',
            anotacoes: `[Reutilizado do objetivo ${activeConcurso?.nome || ''}] ${cloneLinkTarget.anotacoes || ''}`,
            confidenceScore: 0.95
          };

          const cloneRes = await fetch('/api/v1/materials/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clonedPayload)
          });

          if (cloneRes.ok) {
            showFeedback(`Vínculo replicado com sucesso no objetivo selecionado!`);
            setCloneLinkTarget(null);
            setTargetConcursoId('');
          } else {
            showFeedback('Falha ao replicar vínculo no objetivo destino.', 'warning');
          }
        } else {
          showFeedback('O objetivo destino não possui disciplinas compatíveis.', 'warning');
        }
      }
    } catch {
      showFeedback('Erro ao conectar com o serviço de clonagem.', 'warning');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="vinculacao-wrapper">
      {/* Cabeçalho */}
      <div className="vinculacao-header">
        <div className="vinculacao-header-info">
          <h2>
            <Layers className="w-5 h-5 text-emerald-400" />
            Editor de Vinculação Material-Conteúdo
          </h2>
          <p>
            Relacione trechos e páginas de materiais didáticos a tópicos específicos do edital, com garantia de referências auditáveis e conferência de correspondência.
          </p>
        </div>

        {onClose && (
          <button onClick={onClose} className="btn-link-action" style={{ padding: '0.45rem 0.85rem' }}>
            <X className="w-4 h-4" /> Fechar Editor
          </button>
        )}
      </div>

      {feedback && (
        <div style={{
          padding: '0.65rem 1rem',
          borderRadius: '8px',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: feedback.type === 'success' ? '#34d399' : '#fbbf24',
          border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#f59e0b'}`,
          fontSize: '0.85rem'
        }}>
          {feedback.text}
        </div>
      )}

      {/* Grid de Dois Painéis */}
      <div className="vinculacao-panels-grid">
        {/* ===================================================================
            PAINEL ESQUERDO: ÁRVORE CURRICULAR
            =================================================================== */}
        <div className="panel-curriculo">
          <div className="panel-header">
            <div className="panel-title">
              <span>Árvore Curricular</span>
              <span className="topic-badge-count">{topics.length} tópicos</span>
            </div>

            <div className="panel-tree-actions">
              <button
                type="button"
                className="btn-tree-toggle-all"
                onClick={handleExpandAll}
                title="Expandir todas as disciplinas"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                Expandir Tudo
              </button>
              <button
                type="button"
                className="btn-tree-toggle-all"
                onClick={handleCollapseAll}
                title="Recolher todas as disciplinas"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
                Recolher Tudo
              </button>
            </div>

            {selectedDisciplina && selectedDisciplina !== 'TODAS' && onSelectDisciplina && (
              <div className="disciplina-filtro-tag">
                <span>Filtrando: <strong>{selectedDisciplina}</strong></span>
                <button
                  type="button"
                  className="btn-limpar-filtro-disc"
                  onClick={() => onSelectDisciplina('TODAS')}
                  title="Exibir todas as matérias"
                >
                  ✕ Ver Todas
                </button>
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="panel-search"
                placeholder="Filtrar tópicos ou matérias..."
                value={curriculoSearch}
                onChange={(e) => setCurriculoSearch(e.target.value)}
              />
              <Search className="w-3.5 h-3.5" style={{ position: 'absolute', right: '10px', top: '10px', opacity: 0.5 }} />
            </div>
          </div>

          <div className="panel-curriculo-tree">
            {curriculoTree.map(group => {
              const isExp = expandedDisciplinas[group.disciplina] ?? false;
              const hasSelectedTopic = group.topics.some(t => t.id === selectedTopicId);
              return (
                <div
                  key={group.disciplina}
                  className={`curriculo-disc-item ${hasSelectedTopic ? 'has-selected-topic' : ''}`}
                >
                  <div
                    className="curriculo-disc-header"
                    onClick={() => setExpandedDisciplinas(prev => ({ ...prev, [group.disciplina]: !isExp }))}
                  >
                    <span className="curriculo-disc-title" title={group.disciplina}>
                      {isExp ? <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" /> : <Folder className="w-4 h-4 text-stone-400 shrink-0" />}
                      {isExp ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                      <span className="truncate">{group.disciplina}</span>
                    </span>
                    <div className="curriculo-disc-badges">
                      <span className="topic-badge-count">{group.topics.length} tópicos</span>
                      {group.totalLinks > 0 && (
                        <span className="topic-badge-count has-links">{group.totalLinks} links</span>
                      )}
                    </div>
                  </div>

                  {isExp && (
                    <div className="curriculo-topic-list">
                      {group.topics.map(t => {
                        const isSelected = selectedTopicId === t.id;
                        const topicLinkCount = links.filter(l => l.topicoId === t.id).length;
                        return (
                          <button
                            key={t.id}
                            className={`curriculo-topic-btn ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedTopicId(t.id);
                              setEditingLinkId(null);
                            }}
                          >
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={t.subassunto ? `${t.assunto} — ${t.subassunto}` : t.assunto}>
                              {t.subassunto ? `${t.assunto} › ${t.subassunto}` : t.assunto}
                            </span>
                            <span className="topic-badge-count">
                              {topicLinkCount > 0 ? `${topicLinkCount} ref` : '0'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===================================================================
            PAINEL DIREITO: DOCUMENTO E REFERÊNCIAS
            =================================================================== */}
        <div className="panel-documento">
          {/* Banner do Tópico Ativo */}
          <div className="selected-topic-banner">
            <div>
              <div className="selected-topic-title">
                {selectedTopic ? selectedTopic.assunto : 'Nenhum tópico selecionado'}
              </div>
              <div className="selected-topic-subtitle">
                {selectedTopic?.disciplina} {selectedTopic?.subassunto && `› ${selectedTopic.subassunto}`}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge-confidence">
                {topicLinks.length} material(is) vinculado(s)
              </span>
            </div>
          </div>

          {/* Formulário de Vinculação */}
          <form className="editor-form-box" onSubmit={handleSaveLink}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--calm-text)' }}>
                {editingLinkId ? 'Corrigir Associação de Material' : 'Vincular Novo Trecho / Material'}
              </span>
              {editingLinkId && (
                <button
                  type="button"
                  onClick={() => setEditingLinkId(null)}
                  className="btn-link-action"
                  style={{ fontSize: '0.72rem' }}
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            <div className="editor-form-grid">
              <div className="form-field">
                <label className="form-label">Material de Estudo</label>
                <select
                  className="form-select"
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  required
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.formato}] {m.titulo} ({m.totalPaginas > 0 ? `${m.totalPaginas} págs` : 'Web'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Página Início</label>
                <input
                  type="number"
                  min="1"
                  max={selectedMaterial?.totalPaginas || 9999}
                  className="form-input"
                  value={paginaInicio}
                  onChange={(e) => setPaginaInicio(parseInt(e.target.value) || 1)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">Página Fim</label>
                <input
                  type="number"
                  min={paginaInicio}
                  max={selectedMaterial?.totalPaginas || 9999}
                  className="form-input"
                  value={paginaFim}
                  onChange={(e) => setPaginaFim(parseInt(e.target.value) || paginaInicio)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '0.85rem' }}>
              <div className="form-field">
                <label className="form-label">Instrução ou Trecho Selecionado</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Ler seções 2.1 a 2.4 e atentar para as hipóteses de extinção..."
                  value={anotacoes}
                  onChange={(e) => setAnotacoes(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Confiança da Vinculação</label>
                <select
                  className="form-select"
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(e.target.value as any)}
                >
                  <option value="ALTA">Alta (95%)</option>
                  <option value="MEDIA">Média (75%)</option>
                  <option value="BAIXA">Baixa (45%)</option>
                </select>
              </div>
            </div>

            {/* Trecho / Conferência Visual de Conteúdo */}
            {selectedMaterial && (
              <div className="preview-trecho-card">
                <div className="preview-trecho-header">
                  <span>Visualização e Conferência de Páginas</span>
                  <span>{paginaFim - paginaInicio + 1} páginas selecionadas</span>
                </div>
                <div className="preview-trecho-content">
                  📖 <strong>{selectedMaterial.titulo}</strong> — Páginas confirmadas: <u>{paginaInicio} a {paginaFim}</u>.
                  <br />
                  <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
                    Origem: {selectedMaterial.urlOuCaminho || 'Local'} • Tamanho estimado: {selectedMaterial.size || '3.5 MB'}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" className="btn-link-action confirm" style={{ padding: '0.55rem 1rem' }}>
                <Check className="w-4 h-4" />
                {editingLinkId ? 'Salvar Alterações' : 'Confirmar Associação'}
              </button>
            </div>
          </form>

          {/* Lista de Vínculos Existentes para o Tópico */}
          <div className="links-list-container">
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '0', color: 'var(--calm-text)' }}>
              Materiais Vinculados a Este Tópico ({topicLinks.length})
            </h4>

            {topicLinks.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                borderRadius: '10px',
                border: '1px dashed var(--calm-card-border)',
                color: 'var(--calm-text-muted)',
                fontSize: '0.84rem'
              }}>
                Nenhum material vinculado a este tópico curricular ainda. Preencha o formulário acima para associar páginas.
              </div>
            ) : (
              topicLinks.map(link => {
                const isAuto = link.status === 'SUGERIDO_AUTO' || (!link.status && (link.confidenceScore || 0) < 0.9);
                const isConfirmed = link.status === 'CONFIRMADO';
                const isPending = link.status === 'PENDENTE_CONFERENCIA';
                const isUnavailable = link.status === 'INDISPONIVEL';

                return (
                  <div key={link.id} className="link-card-item">
                    <div className="link-card-header">
                      <div className="link-material-title">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>{link.materialTitulo || 'Material Vinculado'}</span>
                      </div>

                      <div className="link-badges-group">
                        {isAuto && (
                          <span className="badge-status sugerido">
                            <Sparkles className="w-3 h-3" /> Sugerido Automaticamente
                          </span>
                        )}
                        {isPending && (
                          <span className="badge-status pendente">
                            <AlertTriangle className="w-3 h-3" /> Pendente de Conferência
                          </span>
                        )}
                        {isConfirmed && (
                          <span className="badge-status confirmado">
                            <CheckCircle2 className="w-3 h-3" /> Confirmado pelo Usuário
                          </span>
                        )}
                        {isUnavailable && (
                          <span className="badge-status indisponivel">
                            <AlertTriangle className="w-3 h-3" /> Referência Indisponível
                          </span>
                        )}

                        <span className="badge-confidence">
                          Confiança: {Math.round((link.confidenceScore || 0.95) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Alerta de transparência se sugerido por IA */}
                    {(isAuto || isPending) && (
                      <div className="ai-disclaimer-box">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>
                          <strong>Atenção:</strong> Sugestão de correspondência automática gerada por IA. A correspondência deve ser conferida e confirmada para evitar recomendações incorretas.
                        </span>
                      </div>
                    )}

                    {link.anotacoes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--calm-text)', fontStyle: 'italic' }}>
                        "{link.anotacoes}"
                      </div>
                    )}

                    <div className="link-actions-row">
                      <div className="link-pages-info">
                        📖 Páginas: <strong>{link.paginaInicio || 1} a {link.paginaFim || link.paginaInicio || 1}</strong>
                        {link.paginasLidas ? ` • ${link.paginasLidas} lidas` : ''}
                      </div>

                      <div className="link-buttons-group">
                        {!isConfirmed && (
                          <button
                            className="btn-link-action confirm"
                            onClick={() => handleConfirmSuggestion(link)}
                            title="Confirmar correspondência para validação definitiva"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                          </button>
                        )}

                        <button
                          className="btn-link-action"
                          onClick={() => handleStartEdit(link)}
                          title="Corrigir intervalo de páginas ou instruções"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Corrigir
                        </button>

                        <button
                          className="btn-link-action"
                          onClick={() => setCloneLinkTarget(link)}
                          title="Reutilizar vínculo em outro objetivo curricular"
                        >
                          <Copy className="w-3.5 h-3.5" /> Reutilizar Vínculo
                        </button>

                        <button
                          className="btn-link-action danger"
                          onClick={() => handleDeleteLink(link.id)}
                          title="Remover vínculo deste tópico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL: REUTILIZAR VÍNCULO EM OUTRO OBJETIVO
          ===================================================================== */}
      {cloneLinkTarget && (
        <div className="clone-modal-backdrop" onClick={() => setCloneLinkTarget(null)}>
          <div className="clone-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="clone-modal-header">
              <h3>Reutilizar Vínculo em Outro Objetivo</h3>
              <button onClick={() => setCloneLinkTarget(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--calm-text-muted)', margin: 0 }}>
              Replique as referências do material <strong>"{cloneLinkTarget.materialTitulo || 'Selecionado'}"</strong> (págs. {cloneLinkTarget.paginaInicio} a {cloneLinkTarget.paginaFim}) para a grade curricular de outro concurso.
            </p>

            <div className="form-field">
              <label className="form-label">Selecione o Objetivo Destino</label>
              {availableConcursos.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#fbbf24', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px' }}>
                  Não há outros objetivos cadastrados. Crie outro concurso em "Meus Objetivos" para poder replicar vínculos.
                </div>
              ) : (
                <select
                  className="form-select"
                  value={targetConcursoId}
                  onChange={(e) => setTargetConcursoId(e.target.value)}
                >
                  <option value="">Selecione um concurso...</option>
                  {availableConcursos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.cargo || 'Fiscal'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-link-action" onClick={() => setCloneLinkTarget(null)}>
                Cancelar
              </button>
              <button
                className="btn-link-action confirm"
                disabled={!targetConcursoId || isCloning}
                onClick={handleExecuteClone}
              >
                {isCloning ? 'Replicando...' : 'Reutilizar Vínculo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
