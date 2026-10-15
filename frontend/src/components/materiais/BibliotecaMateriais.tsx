import React, { useState, useEffect, useMemo } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './BibliotecaMateriais.css';

export interface StudyMaterialItem {
  id: string;
  concursoId?: string;
  disciplina: string;
  titulo: string;
  autor?: string;
  formato: 'PDF' | 'LIVRO' | 'VIDEO' | 'LEI_SECA' | 'LINK';
  totalPaginas: number;
  paginaAtual: number;
  urlOuCaminho?: string;
  notas?: string;
}

export interface EditalTopic {
  id: string;
  editalId: string;
  concursoId: string;
  disciplina: string;
  assunto: string;
  subassunto?: string;
  peso: number;
  questoesPrevistas?: number;
}

export interface TopicMaterialLink {
  id: string;
  topicoId: string;
  materialId: string;
  paginaInicio?: number;
  paginaFim?: number;
  paginasLidas?: number;
  status?: string; // NAO_INICIADO, EM_ANDAMENTO, CONCLUIDO
  anotacoes?: string;
  confidenceScore?: number;
  materialTitulo?: string;
  materialFormato?: string;
  topicoAssunto?: string;
  disciplina?: string;
}

interface BibliotecaMateriaisProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy: (disciplina: string, assunto?: string) => void;
}

// Estrutura hierárquica do Edital Verticalizado
interface SubtopicGroup {
  id: string; // id do tópico no banco
  subassunto: string;
  rawTopic: EditalTopic;
  links: TopicMaterialLink[];
}

interface TopicGroup {
  assunto: string;
  disciplina: string;
  directId?: string; // se for tópico direto sem subtópico
  directTopic?: EditalTopic;
  subtopics: SubtopicGroup[];
  directLinks: TopicMaterialLink[];
  allLinksCount: number;
}

interface DisciplineGroup {
  disciplina: string;
  topics: TopicGroup[];
  totalTopics: number;
  totalSubtopics: number;
  totalLinks: number;
}

export const BibliotecaMateriais: React.FC<BibliotecaMateriaisProps> = ({ activeConcurso, onNavigateToStudy }) => {
  // Navigation / View Tab
  const [activeView, setActiveView] = useState<'TREE' | 'GRID'>('TREE');

  // Data states
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [topics, setTopics] = useState<EditalTopic[]>([]);
  const [links, setLinks] = useState<TopicMaterialLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');

  // Tree Expansion state
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Quick edit & page update
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [tempPageInput, setTempPageInput] = useState<number>(0);
  const [linkingMaterialId, setLinkingMaterialId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Modals
  // 1. Modal Manual Attach to specific Topic
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [selectedTopicForAttach, setSelectedTopicForAttach] = useState<EditalTopic | null>(null);
  const [attachForm, setAttachForm] = useState({
    materialId: '',
    paginaInicio: 1,
    paginaFim: 30,
    anotacoes: ''
  });

  // 2. Modal Register New Material (Manual or Smart Auto-link)
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDisciplina, setFormDisciplina] = useState('');
  const [formAutor, setFormAutor] = useState('');
  const [formFormato, setFormFormato] = useState<'PDF' | 'LIVRO' | 'VIDEO' | 'LEI_SECA' | 'LINK'>('PDF');
  const [formTotalPaginas, setFormTotalPaginas] = useState<number>(100);
  const [formNotas, setFormNotas] = useState('');
  const [formAutoLinkAfterSave, setFormAutoLinkAfterSave] = useState(true);

  // 3. Modal Zero-Friction Auto-Vinculação Instantânea
  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [smartFileName, setSmartFileName] = useState('');
  const [smartDiscipline, setSmartDiscipline] = useState('');
  const [smartContentText, setSmartContentText] = useState('');
  const [smartTotalPages, setSmartTotalPages] = useState<number>(80);
  const [isProcessingSmartImport, setIsProcessingSmartImport] = useState(false);

  const showFeedback = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  // Carregar materiais, tópicos do edital e links
  const loadAllData = async () => {
    if (!activeConcurso?.id) return;
    setIsLoading(true);
    try {
      const [resMats, resEdital, resLinks] = await Promise.all([
        fetch(`/api/v1/materials?concursoId=${encodeURIComponent(activeConcurso.id)}`),
        fetch(`/api/v1/concursos/${encodeURIComponent(activeConcurso.id)}/edital`),
        fetch(`/api/v1/materials/links?concursoId=${encodeURIComponent(activeConcurso.id)}`)
      ]);

      if (resMats.ok) {
        const data = await resMats.json();
        setMaterials(Array.isArray(data) ? data : []);
      }
      if (resEdital.ok) {
        const data = await resEdital.json();
        setTopics(Array.isArray(data.topicos) ? data.topicos : []);
      }
      if (resLinks.ok) {
        const data = await resLinks.json();
        setLinks(Array.isArray(data) ? data : []);
      }
    } catch {
      showFeedback('Erro ao carregar dados do edital e materiais.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeConcurso?.id]);

  // Montar árvore agrupada do Edital Verticalizado
  const hierarchyTree: DisciplineGroup[] = useMemo(() => {
    const discMap = new Map<string, DisciplineGroup>();

    topics.forEach(t => {
      const disc = t.disciplina || 'Outras Disciplinas';
      if (!discMap.has(disc)) {
        discMap.set(disc, {
          disciplina: disc,
          topics: [],
          totalTopics: 0,
          totalSubtopics: 0,
          totalLinks: 0
        });
      }
      const discGroup = discMap.get(disc)!;

      let topGroup = discGroup.topics.find(tg => tg.assunto.toLowerCase() === (t.assunto || '').toLowerCase());
      if (!topGroup) {
        topGroup = {
          assunto: t.assunto || 'Tópico Geral',
          disciplina: disc,
          subtopics: [],
          directLinks: [],
          allLinksCount: 0
        };
        discGroup.topics.push(topGroup);
        discGroup.totalTopics++;
      }

      const topicLinks = links.filter(l => l.topicoId === t.id);

      if (t.subassunto && t.subassunto.trim() !== '') {
        topGroup.subtopics.push({
          id: t.id,
          subassunto: t.subassunto,
          rawTopic: t,
          links: topicLinks
        });
        discGroup.totalSubtopics++;
        discGroup.totalLinks += topicLinks.length;
        topGroup.allLinksCount += topicLinks.length;
      } else {
        topGroup.directId = t.id;
        topGroup.directTopic = t;
        topGroup.directLinks.push(...topicLinks);
        discGroup.totalLinks += topicLinks.length;
        topGroup.allLinksCount += topicLinks.length;
      }
    });

    return Array.from(discMap.values()).sort((a, b) => a.disciplina.localeCompare(b.disciplina));
  }, [topics, links]);

  // Lista única de disciplinas para filtro
  const uniqueDisciplinas = useMemo(() => {
    const setDisc = new Set<string>();
    hierarchyTree.forEach(d => setDisc.add(d.disciplina));
    materials.forEach(m => {
      if (m.disciplina) setDisc.add(m.disciplina);
    });
    return ['TODAS', ...Array.from(setDisc).sort()];
  }, [hierarchyTree, materials]);

  // Filtro de árvore
  const filteredTree = useMemo(() => {
    return hierarchyTree
      .filter(d => selectedDisciplina === 'TODAS' || d.disciplina === selectedDisciplina)
      .map(d => {
        if (!searchQuery.trim()) return d;
        const q = searchQuery.toLowerCase();
        const matchedTopics = d.topics.filter(t => {
          const matchAssunto = t.assunto.toLowerCase().includes(q);
          const matchSub = t.subtopics.some(s => s.subassunto.toLowerCase().includes(q));
          const matchLink = [...t.directLinks, ...t.subtopics.flatMap(s => s.links)].some(
            l => l.materialTitulo?.toLowerCase().includes(q)
          );
          return matchAssunto || matchSub || matchLink;
        });
        return {
          ...d,
          topics: matchedTopics
        };
      })
      .filter(d => d.topics.length > 0 || !searchQuery.trim());
  }, [hierarchyTree, selectedDisciplina, searchQuery]);

  // Filtro de materiais em grade
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchDisc = selectedDisciplina === 'TODAS' || m.disciplina === selectedDisciplina;
      const matchQ = !searchQuery.trim() ||
        m.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.autor && m.autor.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchDisc && matchQ;
    });
  }, [materials, selectedDisciplina, searchQuery]);

  // Toggle de expansão
  const toggleDisciplina = (disc: string) => {
    setExpandedDisciplinas(prev => ({ ...prev, [disc]: !prev[disc] }));
  };

  const toggleTopic = (key: string) => {
    setExpandedTopics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const discObj: Record<string, boolean> = {};
    const topObj: Record<string, boolean> = {};
    hierarchyTree.forEach(d => {
      discObj[d.disciplina] = true;
      d.topics.forEach(t => {
        topObj[`${d.disciplina}:::${t.assunto}`] = true;
      });
    });
    setExpandedDisciplinas(discObj);
    setExpandedTopics(topObj);
  };

  const collapseAll = () => {
    setExpandedDisciplinas({});
    setExpandedTopics({});
  };

  // Ações de Materiais
  const handleAutoLinkMaterial = async (matId: string) => {
    if (!activeConcurso?.id) return;
    setLinkingMaterialId(matId);
    try {
      const res = await fetch(`/api/v1/materials/${matId}/auto-link?concursoId=${encodeURIComponent(activeConcurso.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const createdLinks: TopicMaterialLink[] = await res.json();
        showFeedback(
          `✓ Auto-vinculação concluída! ${createdLinks.length} tópicos/subtópicos foram conectados a este material.`,
          'success'
        );
        loadAllData();
      } else {
        showFeedback('⚠️ Não foi possível vincular automaticamente este material.', 'warning');
      }
    } catch {
      showFeedback('⚠️ Erro de rede ao executar auto-vinculação.', 'warning');
    } finally {
      setLinkingMaterialId(null);
    }
  };

  const handleAutoLinkAll = async () => {
    if (!activeConcurso?.id) return;
    setLinkingMaterialId('ALL');
    try {
      const res = await fetch(`/api/v1/materials/auto-link-all?concursoId=${encodeURIComponent(activeConcurso.id)}`, {
        method: 'POST'
      });
      if (res.ok) {
        const allCreated: TopicMaterialLink[] = await res.json();
        showFeedback(
          `✓ Auto-vinculação completa finalizada! ${allCreated.length} conexões automáticas geradas no edital.`,
          'success'
        );
        loadAllData();
      } else {
        showFeedback('⚠️ Falha ao auto-vincular materiais ao edital.', 'warning');
      }
    } catch {
      showFeedback('⚠️ Erro ao comunicar com o servidor.', 'warning');
    } finally {
      setLinkingMaterialId(null);
    }
  };

  const handleSaveMaterial = async () => {
    if (!formTitulo.trim() || !formDisciplina.trim()) {
      showFeedback('Informe o título e a disciplina do material.', 'warning');
      return;
    }

    const newMaterial = {
      concursoId: activeConcurso?.id || null,
      disciplina: formDisciplina.trim(),
      titulo: formTitulo.trim(),
      autor: formAutor.trim() || null,
      formato: formFormato,
      totalPaginas: Number(formTotalPaginas) || 0,
      paginaAtual: 0,
      notas: formNotas.trim() || null
    };

    try {
      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaterial)
      });
      if (res.ok) {
        const savedMat = await res.json();
        setIsNewMaterialModalOpen(false);
        setFormTitulo('');
        setFormDisciplina('');
        setFormAutor('');
        setFormTotalPaginas(100);
        setFormNotas('');

        if (formAutoLinkAfterSave && savedMat.id && activeConcurso?.id) {
          showFeedback('Material salvo! Executando auto-vinculação com tópicos do edital...', 'info');
          await handleAutoLinkMaterial(savedMat.id);
        } else {
          showFeedback('✓ Material cadastrado na biblioteca!', 'success');
          loadAllData();
        }
      }
    } catch {
      showFeedback('Erro ao salvar material.', 'warning');
    }
  };

  // Auto-Vinculação Instantânea / Zero-Friction (Smart Upload)
  const handleSmartImport = async () => {
    if (!smartFileName.trim()) {
      showFeedback('Informe o título ou nome do arquivo do material.', 'warning');
      return;
    }
    setIsProcessingSmartImport(true);

    try {
      // 1. Cadastra o material
      const matPayload = {
        concursoId: activeConcurso?.id || null,
        disciplina: smartDiscipline.trim() || 'Geral',
        titulo: smartFileName.trim(),
        autor: 'Importação Inteligente',
        formato: 'PDF',
        totalPaginas: Number(smartTotalPages) || 100,
        paginaAtual: 0,
        notas: smartContentText ? `Sumário extraído: ${smartContentText.substring(0, 150)}...` : 'Importado via Smart Vinculação'
      };

      const resMat = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matPayload)
      });

      if (!resMat.ok) throw new Error('Falha ao cadastrar o material base.');
      const savedMat = await resMat.json();

      // 2. Executa auto-linking enviando o texto de sumário/índice
      const resLink = await fetch(`/api/v1/materials/${savedMat.id}/auto-link?concursoId=${encodeURIComponent(activeConcurso?.id || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentText: smartContentText })
      });

      if (resLink.ok) {
        const createdLinks: TopicMaterialLink[] = await resLink.json();
        showFeedback(
          `✨ Sucesso! O material "${savedMat.titulo}" foi cadastrado e auto-vinculado a ${createdLinks.length} tópicos/subtópicos do edital verticalizado!`,
          'success'
        );
        setIsSmartImportModalOpen(false);
        setSmartFileName('');
        setSmartDiscipline('');
        setSmartContentText('');
        loadAllData();
      } else {
        showFeedback('Material salvo, mas a auto-vinculação encontrou poucas correspondências diretas.', 'info');
        setIsSmartImportModalOpen(false);
        loadAllData();
      }
    } catch (e: any) {
      showFeedback(`Erro na auto-vinculação: ${e.message}`, 'warning');
    } finally {
      setIsProcessingSmartImport(false);
    }
  };

  // Anexar material existente manualmente a um tópico específico
  const handleOpenAttachModal = (topic: EditalTopic) => {
    setSelectedTopicForAttach(topic);
    // Pre-selecionar o primeiro material compatível com a disciplina ou qualquer um
    const matchMat = materials.find(m => m.disciplina.toLowerCase() === topic.disciplina.toLowerCase()) || materials[0];
    setAttachForm({
      materialId: matchMat ? matchMat.id : '',
      paginaInicio: 1,
      paginaFim: 30,
      anotacoes: ''
    });
    setIsAttachModalOpen(true);
  };

  const handleSaveAttachLink = async () => {
    if (!selectedTopicForAttach || !attachForm.materialId) {
      showFeedback('Selecione um material para vincular.', 'warning');
      return;
    }

    const newLink = {
      topicoId: selectedTopicForAttach.id,
      materialId: attachForm.materialId,
      paginaInicio: Number(attachForm.paginaInicio) || 1,
      paginaFim: Number(attachForm.paginaFim) || 20,
      paginasLidas: 0,
      status: 'NAO_INICIADO',
      anotacoes: attachForm.anotacoes.trim() || 'Vinculado manualmente pelo usuário',
      confidenceScore: 1.0
    };

    try {
      const res = await fetch('/api/v1/materials/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLink)
      });
      if (res.ok) {
        setIsAttachModalOpen(false);
        showFeedback('✓ Material anexado ao tópico com sucesso!', 'success');
        loadAllData();
      } else {
        showFeedback('Erro ao salvar vínculo do material.', 'warning');
      }
    } catch {
      showFeedback('Erro de conexão ao salvar vínculo.', 'warning');
    }
  };

  // Remover vínculo de um material com um tópico
  const handleDeleteLink = async (linkId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Deseja desvincular este material deste tópico? O arquivo continuará na biblioteca.')) return;

    try {
      const res = await fetch(`/api/v1/materials/links/${linkId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showFeedback('Vínculo removido do tópico.', 'info');
        setLinks(prev => prev.filter(l => l.id !== linkId));
      }
    } catch {
      showFeedback('Erro ao desvincular material.', 'warning');
    }
  };

  const handleQuickPageUpdate = async (material: StudyMaterialItem, newPage: number) => {
    const updated = {
      ...material,
      paginaAtual: Math.min(material.totalPaginas > 0 ? material.totalPaginas : 9999, Math.max(0, newPage))
    };

    try {
      await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setEditingPageId(null);
      setMaterials(prev => prev.map(m => m.id === material.id ? updated : m));
    } catch {}
  };

  return (
    <div className="biblioteca-container animate-fade-in">
      {/* Header Principal */}
      <div className="biblioteca-header glass">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>📚 Biblioteca & Teoria do Edital</h2>
            <span className="badge-concurso-tag">
              {activeConcurso?.nome || 'Concurso Ativo'}
            </span>
          </div>
          <p className="biblioteca-subtitle">
            Organize e vincule seus PDFs, livros e leis secas diretamente à estrutura verticalizada do edital.
            Múltiplos materiais por tópico permitidos com auto-vinculação inteligente.
          </p>
        </div>

        <div className="biblioteca-actions">
          {/* Botão de Auto-Vinculação Instantânea */}
          <button
            className="btn-smart-link"
            onClick={() => setIsSmartImportModalOpen(true)}
            title="Envie o PDF ou sumário e o sistema descobre e vincula automaticamente no edital"
          >
            🤖 Cadastrar & Auto-Vincular
          </button>

          {activeConcurso?.id && (
            <button
              className="btn-secondary-action"
              disabled={linkingMaterialId === 'ALL'}
              onClick={handleAutoLinkAll}
              title="Analisa todos os materiais existentes e vincula aos tópicos do edital"
            >
              ⚡ {linkingMaterialId === 'ALL' ? 'Processando...' : 'Auto-Vincular Tudo'}
            </button>
          )}

          <button className="btn-add-material" onClick={() => setIsNewMaterialModalOpen(true)}>
            + Cadastrar Material
          </button>
        </div>
      </div>

      {/* Banner de Feedback */}
      {feedbackMsg && (
        <div
          className={`feedback-banner ${feedbackMsg.type}`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="feedback-close">✕</button>
        </div>
      )}

      {/* Barra de Controles: Modo de Exibição, Busca e Filtro de Disciplinas */}
      <div className="biblioteca-toolbar glass">
        <div className="view-mode-toggle">
          <button
            className={`btn-view-toggle ${activeView === 'TREE' ? 'active' : ''}`}
            onClick={() => setActiveView('TREE')}
          >
            🌳 Estrutura do Edital Verticalizado ({hierarchyTree.reduce((acc, d) => acc + d.totalTopics, 0)} tópicos)
          </button>
          <button
            className={`btn-view-toggle ${activeView === 'GRID' ? 'active' : ''}`}
            onClick={() => setActiveView('GRID')}
          >
            📑 Todos os Materiais ({materials.length})
          </button>
        </div>

        <div className="toolbar-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={activeView === 'TREE' ? 'Buscar no edital ou por material...' : 'Buscar material por título ou autor...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {activeView === 'TREE' && (
          <div className="tree-quick-toggles">
            <button className="btn-tree-tool" onClick={expandAll}>Expandir Tudo</button>
            <button className="btn-tree-tool" onClick={collapseAll}>Recolher Tudo</button>
          </div>
        )}
      </div>

      {/* Chips de Disciplina */}
      {uniqueDisciplinas.length > 1 && (
        <div className="materiais-filter-bar">
          {uniqueDisciplinas.map(disc => (
            <button
              key={disc}
              className={`filter-chip ${selectedDisciplina === disc ? 'active' : ''}`}
              onClick={() => setSelectedDisciplina(disc)}
            >
              {disc}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="biblioteca-loading">
          <div className="spinner"></div>
          <p>Carregando estrutura do edital e materiais didáticos...</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: ESTRUTURA DO EDITAL VERTICALIZADO COM MATERIAIS ANEXADOS         */}
      {/* ========================================================================= */}
      {!isLoading && activeView === 'TREE' && (
        <div className="edital-tree-wrapper">
          {filteredTree.length === 0 && (
            <div className="empty-state glass">
              <span style={{ fontSize: '42px', display: 'block', marginBottom: '12px' }}>📖</span>
              <h3>Nenhum tópico encontrado no Edital Verticalizado</h3>
              <p>
                {searchQuery
                  ? 'Nenhum tópico ou material corresponde aos termos pesquisados.'
                  : 'Certifique-se de importar o edital na aba "Edital Verticalizado" para habilitar a árvore hierárquica.'}
              </p>
            </div>
          )}

          {filteredTree.map(discGroup => {
            const isDiscExpanded = expandedDisciplinas[discGroup.disciplina] ?? true;

            return (
              <div key={discGroup.disciplina} className="discipline-accordion-card glass">
                {/* Cabeçalho da Disciplina */}
                <div
                  className="discipline-accordion-header"
                  onClick={() => toggleDisciplina(discGroup.disciplina)}
                >
                  <div className="discipline-info">
                    <span className="expand-indicator">{isDiscExpanded ? '▼' : '►'}</span>
                    <span className="discipline-title">{discGroup.disciplina}</span>
                    <span className="badge-count">
                      {discGroup.topics.length} assuntos • {discGroup.totalLinks} materiais anexados
                    </span>
                  </div>

                  <div className="discipline-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-practice-disc"
                      onClick={() => onNavigateToStudy(discGroup.disciplina)}
                      title={`Resolver questões de ${discGroup.disciplina}`}
                    >
                      📝 Praticar Matéria
                    </button>
                  </div>
                </div>

                {/* Lista de Tópicos e Subtópicos */}
                {isDiscExpanded && (
                  <div className="discipline-topics-container">
                    {discGroup.topics.map(topicGroup => {
                      const topicKey = `${discGroup.disciplina}:::${topicGroup.assunto}`;
                      const isTopicExpanded = expandedTopics[topicKey] ?? true;
                      const hasSubtopics = topicGroup.subtopics.length > 0;

                      return (
                        <div key={topicKey} className="topic-block-item">
                          {/* Cabeçalho do Assunto */}
                          <div
                            className="topic-block-header"
                            onClick={() => hasSubtopics && toggleTopic(topicKey)}
                            style={{ cursor: hasSubtopics ? 'pointer' : 'default' }}
                          >
                            <div className="topic-title-area">
                              {hasSubtopics ? (
                                <span className="topic-chevron">{isTopicExpanded ? '▾' : '▸'}</span>
                              ) : (
                                <span className="topic-bullet">•</span>
                              )}
                              <span className="topic-name">{topicGroup.assunto}</span>

                              {topicGroup.allLinksCount > 0 && (
                                <span className="badge-materials-count" title="Total de materiais vinculados a este assunto e seus subtópicos">
                                  📚 {topicGroup.allLinksCount} {topicGroup.allLinksCount === 1 ? 'material' : 'materiais'}
                                </span>
                              )}
                            </div>

                            <div className="topic-actions-area" onClick={e => e.stopPropagation()}>
                              {/* Botão de Praticar este Tópico */}
                              <button
                                className="btn-mini-practice"
                                onClick={() => onNavigateToStudy(discGroup.disciplina, topicGroup.assunto)}
                                title="Resolver questões específicas deste tópico"
                              >
                                🎯 Questões
                              </button>

                              {/* Botão Anexar Material ao Tópico Direto (se não tiver subtópicos ou se tiver tópico base) */}
                              {topicGroup.directTopic && (
                                <button
                                  className="btn-mini-attach"
                                  onClick={() => handleOpenAttachModal(topicGroup.directTopic!)}
                                  title="Anexar PDF, livro ou apostila a este tópico"
                                >
                                  + Anexar Material
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Materiais Diretos anexados a este tópico principal */}
                          {topicGroup.directLinks.length > 0 && (
                            <div className="attached-materials-strip">
                              <span className="strip-label">Materiais do Tópico:</span>
                              <div className="materials-chips-list">
                                {topicGroup.directLinks.map(link => (
                                  <div key={link.id} className="material-link-pill">
                                    <span className="pill-format">{link.materialFormato || 'PDF'}</span>
                                    <span className="pill-title" title={link.materialTitulo}>
                                      {link.materialTitulo || 'Material Vinculado'}
                                    </span>
                                    {link.paginaInicio && link.paginaFim && (
                                      <span className="pill-pages">
                                        (pág. {link.paginaInicio} - {link.paginaFim})
                                      </span>
                                    )}
                                    <button
                                      className="pill-remove-btn"
                                      title="Desvincular material deste tópico"
                                      onClick={(e) => handleDeleteLink(link.id, e)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Subtópicos Hierárquicos */}
                          {hasSubtopics && isTopicExpanded && (
                            <div className="subtopics-hierarchy-list">
                              {topicGroup.subtopics.map(sub => (
                                <div key={sub.id} className="subtopic-node-card">
                                  <div className="subtopic-info-row">
                                    <div className="subtopic-title-box">
                                      <span className="subtopic-dash">↳</span>
                                      <span className="subtopic-title">{sub.subassunto}</span>
                                    </div>

                                    <div className="subtopic-actions-box">
                                      <button
                                        className="btn-mini-practice"
                                        onClick={() => onNavigateToStudy(discGroup.disciplina, sub.subassunto)}
                                        title="Praticar questões deste subtópico"
                                      >
                                        🎯 Questões
                                      </button>
                                      <button
                                        className="btn-mini-attach"
                                        onClick={() => handleOpenAttachModal(sub.rawTopic)}
                                        title="Anexar PDF, resumo ou legislação a este subtópico"
                                      >
                                        + Anexar Material
                                      </button>
                                    </div>
                                  </div>

                                  {/* Materiais vinculados ao Subtópico */}
                                  {sub.links.length > 0 ? (
                                    <div className="attached-materials-strip subtopic-materials">
                                      <div className="materials-chips-list">
                                        {sub.links.map(link => (
                                          <div key={link.id} className="material-link-pill sub-pill">
                                            <span className="pill-format">{link.materialFormato || 'PDF'}</span>
                                            <span className="pill-title" title={link.materialTitulo}>
                                              {link.materialTitulo || 'Material Vinculado'}
                                            </span>
                                            {link.paginaInicio && link.paginaFim && (
                                              <span className="pill-pages">
                                                (pág. {link.paginaInicio} - {link.paginaFim})
                                              </span>
                                            )}
                                            <button
                                              className="pill-remove-btn"
                                              title="Desvincular material deste subtópico"
                                              onClick={(e) => handleDeleteLink(link.id, e)}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="subtopic-no-materials">
                                      <span>Nenhum material vinculado ainda.</span>
                                      <button
                                        className="link-add-inline"
                                        onClick={() => handleOpenAttachModal(sub.rawTopic)}
                                      >
                                        + Associar PDF agora
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: GRADE TRADICIONAL DE MATERIAIS CADASTRADOS                       */}
      {/* ========================================================================= */}
      {!isLoading && activeView === 'GRID' && (
        <div className="materiais-grid">
          {filteredMaterials.map(mat => {
            const pct = mat.totalPaginas > 0
              ? Math.round((mat.paginaAtual / mat.totalPaginas) * 100)
              : 0;

            const materialLinks = links.filter(l => l.materialId === mat.id);

            return (
              <div key={mat.id} className="material-card">
                <div>
                  <div className="mat-top-meta">
                    <span className={`mat-format-badge format-${mat.formato.toLowerCase()}`}>
                      {mat.formato}
                    </span>
                    <span className="mat-disc-badge" title={mat.disciplina}>
                      {mat.disciplina}
                    </span>
                  </div>

                  <h3 className="mat-title">{mat.titulo}</h3>
                  {mat.autor && <p className="mat-author">✍️ {mat.autor}</p>}

                  {/* Badges de vínculos no edital */}
                  <div className="mat-linked-topics-box">
                    <span className="linked-count-label">
                      {materialLinks.length > 0
                        ? `📌 Vinculado a ${materialLinks.length} tópicos do edital`
                        : '⚠️ Não vinculado a tópicos'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mat-progress-box">
                  <div className="mat-progress-labels">
                    <span>Progresso de Leitura</span>
                    <strong>
                      {mat.paginaAtual} / {mat.totalPaginas > 0 ? mat.totalPaginas : '∞'} pág ({pct}%)
                    </strong>
                  </div>
                  <div className="mat-progress-track">
                    <div className="mat-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>

                {/* Ações */}
                <div className="mat-actions-row">
                  {editingPageId === mat.id ? (
                    <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                      <input
                        type="number"
                        min="0"
                        max={mat.totalPaginas || 9999}
                        value={tempPageInput}
                        onChange={(e) => setTempPageInput(parseInt(e.target.value, 10) || 0)}
                        style={{
                          width: '70px',
                          background: '#13161e',
                          border: '1px solid #4f8ef7',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}
                      />
                      <button
                        className="btn-update-page"
                        onClick={() => handleQuickPageUpdate(mat, tempPageInput)}
                      >
                        Salvar
                      </button>
                      <button
                        className="btn-update-page"
                        onClick={() => setEditingPageId(null)}
                        style={{ borderColor: '#2e3347', color: '#a1a6c2' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-update-page"
                      onClick={() => {
                        setEditingPageId(mat.id);
                        setTempPageInput(mat.paginaAtual);
                      }}
                    >
                      📖 Pág. {mat.paginaAtual}
                    </button>
                  )}

                  <button
                    className="btn-open-caderno"
                    style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: '#3b82f6', color: '#60a5fa' }}
                    disabled={linkingMaterialId === mat.id}
                    onClick={() => handleAutoLinkMaterial(mat.id)}
                    title="Analisar conteúdo e associar aos tópicos do edital verticalizado"
                  >
                    ⚡ {linkingMaterialId === mat.id ? '...' : 'Auto-Vincular'}
                  </button>

                  <button
                    className="btn-open-caderno"
                    onClick={() => onNavigateToStudy(mat.disciplina)}
                    title={`Praticar questões de ${mat.disciplina}`}
                  >
                    📝 Questões
                  </button>
                </div>
              </div>
            );
          })}

          {filteredMaterials.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: '#a1a6c2' }}>
              <p style={{ fontSize: '15px', marginBottom: '12px' }}>Nenhum material didático encontrado.</p>
              <button className="btn-add-material" onClick={() => setIsNewMaterialModalOpen(true)}>
                Cadastrar Primeiro Livro ou PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ANEXAR MATERIAL A UM TÓPICO ESPECÍFICO                           */}
      {/* ========================================================================= */}
      {isAttachModalOpen && selectedTopicForAttach && (
        <div className="mat-modal-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget) setIsAttachModalOpen(false);
        }}>
          <div className="mat-modal-card">
            <div className="mat-modal-header">
              <div>
                <h3>Anexar Material ao Tópico</h3>
                <p style={{ fontSize: '12px', color: '#60a5fa', marginTop: '2px' }}>
                  {selectedTopicForAttach.disciplina} &gt; {selectedTopicForAttach.assunto}
                  {selectedTopicForAttach.subassunto && ` &gt; ${selectedTopicForAttach.subassunto}`}
                </p>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: '#a1a6c2', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setIsAttachModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mat-modal-body">
              <div className="mat-input-group">
                <label>Selecione o Material da Biblioteca</label>
                <select
                  value={attachForm.materialId}
                  onChange={(e) => setAttachForm({ ...attachForm, materialId: e.target.value })}
                >
                  <option value="">-- Escolha um material --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.formato}] {m.titulo} ({m.disciplina})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mat-form-row">
                <div className="mat-input-group">
                  <label>Página Início</label>
                  <input
                    type="number"
                    min="1"
                    value={attachForm.paginaInicio}
                    onChange={(e) => setAttachForm({ ...attachForm, paginaInicio: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div className="mat-input-group">
                  <label>Página Fim</label>
                  <input
                    type="number"
                    min="1"
                    value={attachForm.paginaFim}
                    onChange={(e) => setAttachForm({ ...attachForm, paginaFim: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>

              <div className="mat-input-group">
                <label>Notas de Estudo / Orientações</label>
                <input
                  type="text"
                  placeholder="Ex: Focar nas regras de imunidade recíproca"
                  value={attachForm.anotacoes}
                  onChange={(e) => setAttachForm({ ...attachForm, anotacoes: e.target.value })}
                />
              </div>
            </div>

            <div className="mat-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setIsAttachModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-add-material"
                onClick={handleSaveAttachLink}
                disabled={!attachForm.materialId}
              >
                Vincular ao Tópico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CADASTRO MANUAL DE MATERIAL                                      */}
      {/* ========================================================================= */}
      {isNewMaterialModalOpen && (
        <div className="mat-modal-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget) setIsNewMaterialModalOpen(false);
        }}>
          <div className="mat-modal-card">
            <div className="mat-modal-header">
              <h3>Adicionar Material de Estudo</h3>
              <button
                style={{ background: 'none', border: 'none', color: '#a1a6c2', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setIsNewMaterialModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mat-modal-body">
              <div className="mat-input-group">
                <label>Título do Livro / Curso / PDF</label>
                <input
                  type="text"
                  placeholder="Ex: Direito Tributário Esquematizado"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                />
              </div>

              <div className="mat-form-row">
                <div className="mat-input-group">
                  <label>Disciplina</label>
                  <input
                    type="text"
                    placeholder="Ex: Direito Tributário"
                    value={formDisciplina}
                    onChange={(e) => setFormDisciplina(e.target.value)}
                  />
                </div>
                <div className="mat-input-group">
                  <label>Formato</label>
                  <select
                    value={formFormato}
                    onChange={(e) => setFormFormato(e.target.value as any)}
                  >
                    <option value="PDF">PDF / Apostila</option>
                    <option value="LIVRO">Livro Físico / Digital</option>
                    <option value="LEI_SECA">Legislação Seca</option>
                    <option value="VIDEO">Videoaula / Curso</option>
                    <option value="LINK">Link Externo</option>
                  </select>
                </div>
              </div>

              <div className="mat-form-row">
                <div className="mat-input-group">
                  <label>Autor / Instituição</label>
                  <input
                    type="text"
                    placeholder="Ex: Ricardo Alexandre / Estratégia"
                    value={formAutor}
                    onChange={(e) => setFormAutor(e.target.value)}
                  />
                </div>
                <div className="mat-input-group">
                  <label>Total de Páginas / Horas</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 850"
                    value={formTotalPaginas}
                    onChange={(e) => setFormTotalPaginas(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

              <div className="mat-input-group">
                <label>Notas e Informações Adicionais</label>
                <input
                  type="text"
                  placeholder="Ex: Edição 2026 com reforma tributária"
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                />
              </div>

              <div className="smart-checkbox-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e8eaf2', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formAutoLinkAfterSave}
                    onChange={(e) => setFormAutoLinkAfterSave(e.target.checked)}
                  />
                  <span>⚡ <strong>Auto-vincular aos tópicos do edital</strong> logo após salvar</span>
                </label>
              </div>
            </div>

            <div className="mat-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setIsNewMaterialModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-add-material"
                onClick={handleSaveMaterial}
              >
                Salvar na Biblioteca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CADASTRO INTELIGENTE & AUTO-VINCULAÇÃO (ZERO-FRICTION)            */}
      {/* ========================================================================= */}
      {isSmartImportModalOpen && (
        <div className="mat-modal-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget && !isProcessingSmartImport) setIsSmartImportModalOpen(false);
        }}>
          <div className="mat-modal-card smart-modal">
            <div className="mat-modal-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🤖 Auto-Vinculação com Edital Verticalizado
                </h3>
                <p style={{ fontSize: '12px', color: '#a1a6c2', marginTop: '2px' }}>
                  Apenas insira os dados do material e o sistema faz toda a vinculação aos tópicos sozinho.
                </p>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: '#a1a6c2', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => !isProcessingSmartImport && setIsSmartImportModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mat-modal-body">
              <div className="smart-banner-info">
                <span>💡</span>
                <div>
                  <strong>Como funciona:</strong> Nosso algoritmo de parsing semântico analisa o título, disciplina e o sumário ou índice do PDF e cruza com todas as disciplinas, tópicos e subtópicos do edital oficial, criando as amarrações automaticamente.
                </div>
              </div>

              <div className="mat-input-group">
                <label>Nome do Arquivo / Título do Material</label>
                <input
                  type="text"
                  placeholder="Ex: Aula 03 - Impostos Municipais e ISSQN.pdf"
                  value={smartFileName}
                  onChange={(e) => {
                    setSmartFileName(e.target.value);
                    // Inferência rápida de disciplina se estiver no nome
                    if (!smartDiscipline) {
                      const lower = e.target.value.toLowerCase();
                      if (lower.includes('tribut') || lower.includes('iss') || lower.includes('icms')) setSmartDiscipline('Direito Tributário');
                      else if (lower.includes('constitucional')) setSmartDiscipline('Direito Constitucional');
                      else if (lower.includes('administra')) setSmartDiscipline('Direito Administrativo');
                      else if (lower.includes('contabil')) setSmartDiscipline('Contabilidade Geral');
                    }
                  }}
                />
              </div>

              <div className="mat-form-row">
                <div className="mat-input-group">
                  <label>Disciplina Sugerida (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Direito Tributário"
                    value={smartDiscipline}
                    onChange={(e) => setSmartDiscipline(e.target.value)}
                  />
                </div>
                <div className="mat-input-group">
                  <label>Total Estimado de Páginas</label>
                  <input
                    type="number"
                    min="1"
                    value={smartTotalPages}
                    onChange={(e) => setSmartTotalPages(parseInt(e.target.value, 10) || 80)}
                  />
                </div>
              </div>

              <div className="mat-input-group">
                <label>Sumário / Índice ou Texto do PDF (Opcional, aumenta a precisão)</label>
                <textarea
                  rows={5}
                  placeholder="Cole aqui o sumário do PDF, títulos das aulas ou palavras-chave para indexação perfeita no edital..."
                  value={smartContentText}
                  onChange={(e) => setSmartContentText(e.target.value)}
                  style={{
                    background: '#1a1e2a',
                    border: '1px solid #2e3347',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#e8eaf2',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div className="mat-modal-footer">
              <button
                className="btn-cancel"
                disabled={isProcessingSmartImport}
                onClick={() => setIsSmartImportModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-smart-link"
                disabled={isProcessingSmartImport || !smartFileName.trim()}
                onClick={handleSmartImport}
              >
                {isProcessingSmartImport ? '⚡ Processando e Vinculando...' : '🚀 Cadastrar & Vincular Sozinho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
