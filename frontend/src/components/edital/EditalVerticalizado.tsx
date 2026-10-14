import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EDITAL_EXTRACTION_PROMPT } from '../../constants/editalPromptMestre';
import './EditalVerticalizado.css';

export interface EditalDocument {
  id: string;
  concursoId: string;
  titulo: string;
  versao: string;
  tipo: string;
  filename: string;
  createdAt: string;
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
  docOrigem?: string;
  paginaOrigem?: number;
  trechoOrigem?: string;
  tipoClassificacao: string; // EXPLICITA, INFERIDA, CONFIRMADA
  confirmadoHumano: boolean;
}

export interface TopicMaterialLink {
  id: string;
  topicoId: string;
  materialId: string;
  paginaInicio?: number;
  paginaFim?: number;
  paginasLidas?: number;
  status?: string;
  anotacoes?: string;
  confidenceScore?: number;
  materialTitulo?: string;
  materialFormato?: string;
  topicoAssunto?: string;
  disciplina?: string;
}

export interface StudyMaterialOption {
  id: string;
  titulo: string;
  disciplina: string;
  formato: string;
  totalPaginas: number;
}

interface EditalVerticalizadoProps {
  concursoId: string;
  concursoNome: string;
  onNavigateToStudy?: (disciplina: string, assunto: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

interface SubtopicoNode {
  id: string;
  subassunto: string;
  peso: number;
  questoesPrevistas?: number;
  docOrigem?: string;
  paginaOrigem?: number;
  trechoOrigem?: string;
  tipoClassificacao: string;
  confirmadoHumano: boolean;
  raw: EditalTopic;
}

interface TopicoNode {
  assunto: string;
  disciplina: string;
  subtopicos: SubtopicoNode[];
  leafNode?: EditalTopic;
  pesoMax: number;
  totalQuestoesPrevistas: number;
}

interface MateriaNode {
  disciplina: string;
  topicos: TopicoNode[];
  totalTopicosCount: number;
  totalSubtopicosCount: number;
  totalQuestoesPrevistas: number;
  confirmadosCount: number;
  totalRowsCount: number;
}

export default function EditalVerticalizado({ concursoId, concursoNome, onNavigateToStudy, onNavigateToTab }: EditalVerticalizadoProps) {
  const [editais, setEditais] = useState<EditalDocument[]>([]);
  const [topicos, setTopicos] = useState<EditalTopic[]>([]);
  const [links, setLinks] = useState<TopicMaterialLink[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<StudyMaterialOption[]>([]);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [autoLinkMessage, setAutoLinkMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Filtragem por Edital se houver múltiplos
  const [selectedEditalId, setSelectedEditalId] = useState<string>('ALL');

  // Estados de expansão do acordeão hierárquico
  // 1. Matérias expandidas (por disciplina)
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Record<string, boolean>>({});
  // 2. Tópicos expandidos para revelar subtópicos (chave composta: `${disciplina}:::${topicName}`)
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Modal de dicas estratégicas
  const [dicasModalDisciplina, setDicasModalDisciplina] = useState<string | null>(null);

  // Modal 1: Publicação / Transição Pós-Edital
  const [isPostEditalModalOpen, setIsPostEditalModalOpen] = useState(false);
  const [postEditalForm, setPostEditalForm] = useState({
    titulo: '',
    versao: '2.0',
    tipo: 'EDITAL_OFICIAL_POS_EDITAL',
    filename: 'edital_oficial.pdf',
    updateConcursoSituacao: true,
    novaSituacaoConcurso: 'EDITAL_PUBLICADO',
    dataProva: '',
    linkEdital: '',
    replacePreviousTopics: true,
    rawJsonText: '',
  });
  const [postEditalValidation, setPostEditalValidation] = useState<{
    valid: boolean;
    status: string;
    totalMaterias: number;
    totalTopicos: number;
    totalSubtopicos: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [isValidatingPostEdital, setIsValidatingPostEdital] = useState(false);
  const [isImportingPostEdital, setIsImportingPostEdital] = useState(false);

  // Modal 2: Edição dos Metadados do Edital
  const [isEditEditalModalOpen, setIsEditEditalModalOpen] = useState(false);
  const [editingEdital, setEditingEdital] = useState<EditalDocument | null>(null);
  const [editalForm, setEditalForm] = useState({
    titulo: '',
    versao: '1.0',
    tipo: 'ORIGINAL',
    filename: '',
  });

  // Modal 3: Renomear Disciplina em Lote
  const [isRenameDisciplineModalOpen, setIsRenameDisciplineModalOpen] = useState(false);
  const [disciplineToRename, setDisciplineToRename] = useState<string>('');
  const [newDisciplineName, setNewDisciplineName] = useState<string>('');

  // Modal 4: Edição / Adição de Tópico
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState({
    disciplina: 'Direito Tributário',
    assunto: '',
    subassunto: '',
    peso: '1.0',
    questoesPrevistas: '',
    docOrigem: 'Edital 01/2023',
    paginaOrigem: '',
    trechoOrigem: '',
  });

  // Modal 5: Vincular Material
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkingTopic, setLinkingTopic] = useState<EditalTopic | null>(null);
  const [linkModalTab, setLinkModalTab] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [linkForm, setLinkForm] = useState({
    materialId: '',
    paginaInicio: 1,
    paginaFim: 20,
    anotacoes: '',
  });
  const [newMaterialForm, setNewMaterialForm] = useState({
    titulo: '',
    disciplina: '',
    formato: 'PDF',
    totalPaginas: 60,
    autor: '',
    urlOuCaminho: '',
  });

  const handleCopyPromptMestre = () => {
    navigator.clipboard.writeText(EDITAL_EXTRACTION_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const loadEditalData = async (editalIdFilter?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    const filterId = editalIdFilter !== undefined ? editalIdFilter : selectedEditalId;
    const editalParam = filterId && filterId !== 'ALL' ? `?editalId=${encodeURIComponent(filterId)}` : '';
    try {
      const [resEdital, resLinks, resMats] = await Promise.all([
        fetch(`/api/v1/concursos/${concursoId}/edital${editalParam}`),
        fetch(`/api/v1/materials/links?concursoId=${encodeURIComponent(concursoId)}`),
        fetch(`/api/v1/materials?concursoId=${encodeURIComponent(concursoId)}`),
      ]);

      if (resEdital.ok) {
        const data = await resEdital.json();
        setEditais(data.editais || []);
        setTopicos(data.topicos || []);
      }
      if (resLinks.ok) {
        const lData = await resLinks.json();
        setLinks(Array.isArray(lData) ? lData : []);
      }
      if (resMats.ok) {
        const mData = await resMats.json();
        setAvailableMaterials(Array.isArray(mData) ? mData : []);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao carregar dados do edital.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (concursoId) {
      loadEditalData();
    }
  }, [concursoId]);

  // Trava scroll de fundo e adiciona suporte à tecla ESC para fechar modais
  useEffect(() => {
    const isAnyModalOpen =
      isPostEditalModalOpen ||
      isEditEditalModalOpen ||
      isRenameDisciplineModalOpen ||
      isTopicModalOpen ||
      isLinkModalOpen ||
      !!dicasModalDisciplina;

    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsPostEditalModalOpen(false);
          setIsEditEditalModalOpen(false);
          setIsRenameDisciplineModalOpen(false);
          setIsTopicModalOpen(false);
          setIsLinkModalOpen(false);
          setDicasModalDisciplina(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [
    isPostEditalModalOpen,
    isEditEditalModalOpen,
    isRenameDisciplineModalOpen,
    isTopicModalOpen,
    isLinkModalOpen,
    dicasModalDisciplina,
  ]);

  const handleAutoLinkAll = async () => {
    setIsAutoLinking(true);
    setAutoLinkMessage(null);
    try {
      const res = await fetch(`/api/v1/materials/auto-link-all?concursoId=${encodeURIComponent(concursoId)}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Falha ao processar auto-vinculação.');
      const created: TopicMaterialLink[] = await res.json();
      setAutoLinkMessage(`Sucesso: ${created.length} novos vínculos foram associados com os tópicos do edital!`);
      const resLinks = await fetch(`/api/v1/materials/links?concursoId=${encodeURIComponent(concursoId)}`);
      if (resLinks.ok) {
        setLinks(await resLinks.json());
      }
      setTimeout(() => setAutoLinkMessage(null), 5000);
    } catch (e: any) {
      alert('Erro na auto-vinculação: ' + e.message);
    } finally {
      setIsAutoLinking(false);
    }
  };

  // --- Handlers de Acordeão Hierárquico ---
  const toggleMateria = (disciplina: string) => {
    setExpandedDisciplinas((prev) => ({
      ...prev,
      [disciplina]: !prev[disciplina],
    }));
  };

  const toggleTopic = (topicKey: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicKey]: !prev[topicKey],
    }));
  };

  const toggleAllMaterias = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    hierarchicalMaterias.forEach((m) => {
      next[m.disciplina] = expand;
    });
    setExpandedDisciplinas(next);
  };

  const toggleAllTopicsInMateria = (mat: MateriaNode, expand: boolean) => {
    setExpandedTopics((prev) => {
      const next = { ...prev };
      mat.topicos.forEach((t) => {
        next[`${mat.disciplina}:::${t.assunto}`] = expand;
      });
      return next;
    });
  };

  const areAllTopicsExpanded = (mat: MateriaNode) => {
    if (mat.topicos.length === 0) return false;
    return mat.topicos.every((t) => !!expandedTopics[`${mat.disciplina}:::${t.assunto}`]);
  };

  // --- Handlers para Post-Edital (Saiu o Edital!) ---
  const handleOpenPostEditalModal = () => {
    setPostEditalForm({
      titulo: `Edital Oficial — ${concursoNome}`,
      versao: '2.0',
      tipo: 'EDITAL_OFICIAL_POS_EDITAL',
      filename: 'edital_oficial_publicado.pdf',
      updateConcursoSituacao: true,
      novaSituacaoConcurso: 'EDITAL_PUBLICADO',
      dataProva: '',
      linkEdital: '',
      replacePreviousTopics: true,
      rawJsonText: '',
    });
    setPostEditalValidation(null);
    setIsPostEditalModalOpen(true);
  };

  const handleValidatePostEditalJson = async () => {
    if (!postEditalForm.rawJsonText.trim()) {
      alert('Cole o JSON do edital na caixa de texto para validar.');
      return;
    }
    setIsValidatingPostEdital(true);
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/validate-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: postEditalForm.rawJsonText,
      });
      if (!res.ok) throw new Error('Falha na validação do JSON.');
      const data = await res.json();
      setPostEditalValidation(data);
    } catch (e: any) {
      alert('Erro ao validar JSON: ' + e.message);
    } finally {
      setIsValidatingPostEdital(false);
    }
  };

  const handleSavePostEdital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postEditalForm.rawJsonText.trim()) {
      alert('Por favor, informe o JSON do edital oficial verticalizado gerado pelo Prompt Mestre.');
      return;
    }
    setIsImportingPostEdital(true);
    try {
      let payloadJson: any;
      try {
        payloadJson = JSON.parse(postEditalForm.rawJsonText);
      } catch (pe: any) {
        alert('O texto informado não é um JSON válido: ' + pe.message);
        setIsImportingPostEdital(false);
        return;
      }

      const reqPayload = {
        payload: payloadJson,
        confirmadoHumano: true,
        procedenciaStatus: 'STRUCTURE_HUMAN_REVIEWED',
        versao: postEditalForm.versao.trim() || '2.0',
        tipo: postEditalForm.tipo,
        titulo: postEditalForm.titulo.trim() || `Edital Oficial — ${concursoNome}`,
        overwrite: true,
        replaceAllPreviousTopics: postEditalForm.replacePreviousTopics,
        updateConcursoSituacao: postEditalForm.updateConcursoSituacao,
        novaSituacaoConcurso: postEditalForm.novaSituacaoConcurso,
        dataProva: postEditalForm.dataProva || null,
        linkEdital: postEditalForm.linkEdital || null,
      };

      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/import-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro ao importar (HTTP ${res.status})`);
      }

      const summary = await res.json();
      alert(`🎉 Edital Oficial cadastrado com sucesso! ${summary.totalTopicos} tópicos foram integrados. O histórico de estudos permanece preservado.`);
      setIsPostEditalModalOpen(false);
      setSelectedEditalId('ALL');
      loadEditalData('ALL');
    } catch (err: any) {
      alert('Falha ao cadastrar edital: ' + err.message);
    } finally {
      setIsImportingPostEdital(false);
    }
  };

  // --- Handlers para Edição dos Metadados do Edital ---
  const handleOpenEditEdital = (ed?: EditalDocument) => {
    const target = ed || (editais.length > 0 ? editais[0] : null);
    if (!target) {
      alert('Nenhum edital cadastrado para editar.');
      return;
    }
    setEditingEdital(target);
    setEditalForm({
      titulo: target.titulo || '',
      versao: target.versao || '1.0',
      tipo: target.tipo || 'ORIGINAL',
      filename: target.filename || '',
    });
    setIsEditEditalModalOpen(true);
  };

  const handleSaveEditalMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEdital) return;
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/${editingEdital.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editalForm),
      });
      if (!res.ok) throw new Error('Falha ao salvar metadados do edital.');
      setIsEditEditalModalOpen(false);
      loadEditalData();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  const handleDeleteEdital = async (editalId: string) => {
    if (!confirm('Deseja excluir este documento de edital e seus tópicos associados?')) return;
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/${editalId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao excluir edital.');
      setIsEditEditalModalOpen(false);
      loadEditalData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  // --- Handlers para Renomear Disciplina ---
  const handleOpenRenameDiscipline = (disc: string) => {
    setDisciplineToRename(disc);
    setNewDisciplineName(disc);
    setIsRenameDisciplineModalOpen(true);
  };

  const handleSaveRenameDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplineToRename || !newDisciplineName.trim() || disciplineToRename === newDisciplineName.trim()) {
      setIsRenameDisciplineModalOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/disciplines/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: disciplineToRename,
          newName: newDisciplineName.trim(),
        }),
      });
      if (!res.ok) throw new Error('Falha ao renomear disciplina.');
      setIsRenameDisciplineModalOpen(false);
      loadEditalData();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  // --- Handlers de Tópico ---
  const handleOpenAddTopic = () => {
    setEditingTopicId(null);
    setTopicForm({
      disciplina: hierarchicalMaterias.length > 0 ? hierarchicalMaterias[0].disciplina : 'Direito Tributário',
      assunto: '',
      subassunto: '',
      peso: '1.0',
      questoesPrevistas: '',
      docOrigem: editais.length > 0 ? editais[0].titulo : 'Edital Normativo',
      paginaOrigem: '',
      trechoOrigem: '',
    });
    setIsTopicModalOpen(true);
  };

  const handleOpenEditTopic = (t: EditalTopic) => {
    setEditingTopicId(t.id);
    setTopicForm({
      disciplina: t.disciplina,
      assunto: t.assunto,
      subassunto: t.subassunto || '',
      peso: t.peso ? t.peso.toString() : '1.0',
      questoesPrevistas: t.questoesPrevistas ? t.questoesPrevistas.toString() : '',
      docOrigem: t.docOrigem || '',
      paginaOrigem: t.paginaOrigem ? t.paginaOrigem.toString() : '',
      trechoOrigem: t.trechoOrigem || '',
    });
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.disciplina.trim() || !topicForm.assunto.trim()) {
      alert('Disciplina e Assunto são obrigatórios.');
      return;
    }

    try {
      const payload = {
        disciplina: topicForm.disciplina.trim(),
        assunto: topicForm.assunto.trim(),
        subassunto: topicForm.subassunto.trim() || null,
        peso: topicForm.peso ? parseFloat(topicForm.peso) : 1.0,
        questoesPrevistas: topicForm.questoesPrevistas ? parseInt(topicForm.questoesPrevistas, 10) : null,
        docOrigem: topicForm.docOrigem.trim() || null,
        paginaOrigem: topicForm.paginaOrigem ? parseInt(topicForm.paginaOrigem, 10) : null,
        trechoOrigem: topicForm.trechoOrigem.trim() || null,
        tipoClassificacao: editingTopicId ? 'CONFIRMADA' : 'EXPLICITA',
        confirmadoHumano: true,
      };

      let res: Response;
      if (editingTopicId) {
        res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics/${editingTopicId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Falha ao salvar tópico.');
      setIsTopicModalOpen(false);
      loadEditalData();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  const handleConfirmTopic = async (topicId: string) => {
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics/${topicId}/confirm`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Erro ao confirmar tópico.');
      const updated: EditalTopic = await res.json();
      setTopicos((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Deseja excluir este item do edital verticalizado?')) return;
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics/${topicId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir tópico.');
      setTopicos((prev) => prev.filter((t) => t.id !== topicId));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  // --- Handlers de Materiais e Estudo ---
  const handleOpenLinkModal = (topic: EditalTopic) => {
    setLinkingTopic(topic);
    setLinkModalTab(availableMaterials.length === 0 ? 'NEW' : 'EXISTING');
    setLinkForm({
      materialId: availableMaterials.length > 0 ? availableMaterials[0].id : '',
      paginaInicio: 1,
      paginaFim: 30,
      anotacoes: '',
    });
    setNewMaterialForm({
      titulo: `${topic.disciplina} — Material de Estudo`,
      disciplina: topic.disciplina,
      formato: 'PDF',
      totalPaginas: 60,
      autor: '',
      urlOuCaminho: '',
    });
    setIsLinkModalOpen(true);
  };

  const handleCreateMaterialAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTopic || !newMaterialForm.titulo.trim()) {
      alert('Informe o título do material didático.');
      return;
    }
    try {
      const matRes = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId,
          disciplina: newMaterialForm.disciplina || linkingTopic.disciplina,
          titulo: newMaterialForm.titulo.trim(),
          formato: newMaterialForm.formato,
          totalPaginas: Number(newMaterialForm.totalPaginas) || 50,
          paginaAtual: 0,
          autor: newMaterialForm.autor || null,
          urlOuCaminho: newMaterialForm.urlOuCaminho || null,
        }),
      });
      if (!matRes.ok) throw new Error('Falha ao cadastrar material didático.');
      const createdMat: StudyMaterialOption = await matRes.json();

      const linkPayload = {
        topicoId: linkingTopic.id,
        materialId: createdMat.id,
        paginaInicio: Number(linkForm.paginaInicio) || 1,
        paginaFim: Number(linkForm.paginaFim) || Math.min(30, createdMat.totalPaginas),
        anotacoes: linkForm.anotacoes.trim() || 'Vínculo cadastrado pelo estudante.',
        status: 'NAO_INICIADO',
      };
      const linkRes = await fetch('/api/v1/materials/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkPayload),
      });
      if (!linkRes.ok) throw new Error('Falha ao vincular material ao tópico.');

      setIsLinkModalOpen(false);
      loadEditalData();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  const handleSaveMaterialLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingTopic || !linkForm.materialId) {
      alert('Selecione um material para vincular.');
      return;
    }

    try {
      const payload = {
        topicoId: linkingTopic.id,
        materialId: linkForm.materialId,
        paginaInicio: Number(linkForm.paginaInicio),
        paginaFim: Number(linkForm.paginaFim),
        anotacoes: linkForm.anotacoes.trim() || 'Vínculo manual validado pelo estudante.',
        status: 'NAO_INICIADO',
      };

      const res = await fetch('/api/v1/materials/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Falha ao vincular material.');
      setIsLinkModalOpen(false);

      const resLinks = await fetch(`/api/v1/materials/links?concursoId=${encodeURIComponent(concursoId)}`);
      if (resLinks.ok) setLinks(await resLinks.json());
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Deseja desvincular este material deste tópico?')) return;
    try {
      await fetch(`/api/v1/materials/links/${linkId}`, { method: 'DELETE' });
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err: any) {
      alert('Erro ao desvincular: ' + err.message);
    }
  };

  const handleStudyTopic = (disciplina: string, topic: string) => {
    sessionStorage.setItem('fiscalstudy_filter_discipline', disciplina);
    sessionStorage.setItem('fiscalstudy_filter_assunto', topic);
    sessionStorage.setItem('fiscalstudy_auto_start', 'true');
    if (onNavigateToStudy) {
      onNavigateToStudy(disciplina, topic);
    }
  };

  // --- Estruturação Hierárquica: Matérias ➔ Tópicos ➔ Subtópicos ---
  const materiasMap = new Map<string, MateriaNode>();

  topicos.forEach((t) => {
    const discName = t.disciplina || 'Outras Disciplinas';
    if (!materiasMap.has(discName)) {
      materiasMap.set(discName, {
        disciplina: discName,
        topicos: [],
        totalTopicosCount: 0,
        totalSubtopicosCount: 0,
        totalQuestoesPrevistas: 0,
        confirmadosCount: 0,
        totalRowsCount: 0,
      });
    }

    const mat = materiasMap.get(discName)!;
    mat.totalRowsCount++;
    if (t.confirmadoHumano) mat.confirmadosCount++;
    if (t.questoesPrevistas) mat.totalQuestoesPrevistas += t.questoesPrevistas;

    let topNode = mat.topicos.find((top) => top.assunto === t.assunto);
    if (!topNode) {
      topNode = {
        assunto: t.assunto,
        disciplina: discName,
        subtopicos: [],
        pesoMax: t.peso || 1.0,
        totalQuestoesPrevistas: 0,
      };
      mat.topicos.push(topNode);
    }

    if (t.peso && t.peso > topNode.pesoMax) {
      topNode.pesoMax = t.peso;
    }
    if (t.questoesPrevistas) {
      topNode.totalQuestoesPrevistas += t.questoesPrevistas;
    }

    if (t.subassunto && t.subassunto.trim().length > 0) {
      topNode.subtopicos.push({
        id: t.id,
        subassunto: t.subassunto.trim(),
        peso: t.peso || 1.0,
        questoesPrevistas: t.questoesPrevistas,
        docOrigem: t.docOrigem,
        paginaOrigem: t.paginaOrigem,
        trechoOrigem: t.trechoOrigem,
        tipoClassificacao: t.tipoClassificacao,
        confirmadoHumano: t.confirmadoHumano,
        raw: t,
      });
      mat.totalSubtopicosCount++;
    } else {
      topNode.leafNode = t;
    }
  });

  materiasMap.forEach((mat) => {
    mat.totalTopicosCount = mat.topicos.length;
  });

  const hierarchicalMaterias = Array.from(materiasMap.values());
  const totalDisciplinas = hierarchicalMaterias.length;
  const totalTopicosGeral = hierarchicalMaterias.reduce((acc, m) => acc + m.totalTopicosCount, 0);
  const totalSubtopicosGeral = hierarchicalMaterias.reduce((acc, m) => acc + m.totalSubtopicosCount, 0);
  const totalConfirmados = topicos.filter((t) => t.confirmadoHumano).length;
  const percentConfirmado = topicos.length > 0 ? Math.round((totalConfirmados / topicos.length) * 100) : 0;

  const areAllMateriasExpanded = hierarchicalMaterias.length > 0 && hierarchicalMaterias.every((m) => !!expandedDisciplinas[m.disciplina]);

  const activeEdital = editais.length > 0 ? editais[0] : null;
  const isPreEdital = !activeEdital || activeEdital.tipo === 'PRE_EDITAL_ANTERIOR';

  if (!concursoId) {
    return (
      <div className="edital-container animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        <h2 style={{ color: '#f8fafc', marginBottom: '12px' }}>📋 Edital Verticalizado</h2>
        <p style={{ maxWidth: '500px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
          Nenhum concurso selecionado. Selecione um concurso no menu lateral ou cadastre um novo concurso com seu edital para visualizar a grade hierárquica.
        </p>
      </div>
    );
  }

  return (
    <div className="edital-container animate-fade-in">
      {/* Header com Ações Principais */}
      <div className="edital-header">
        <div className="edital-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>📋 Edital Verticalizado</h2>
            {isPreEdital ? (
              <span style={{
                background: 'rgba(234, 179, 8, 0.2)',
                color: '#facc15',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                📌 Pré-Edital (Edital Anterior)
              </span>
            ) : activeEdital?.tipo === 'RETIFICACAO' ? (
              <span style={{
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                📝 Retificação de Edital
              </span>
            ) : (
              <span style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                📄 Edital Oficial Publicado (Pós-Edital)
              </span>
            )}

            {activeEdital?.versao && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#cbd5e1',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.76rem',
                fontWeight: 600
              }}>
                v{activeEdital.versao}
              </span>
            )}
          </div>
          <p style={{ margin: '0.35rem 0 0' }}>
            Concurso: <strong style={{ color: '#60a5fa' }}>{concursoNome}</strong>
            {activeEdital?.titulo ? ` • Documento: ${activeEdital.titulo}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn-pos-edital"
            onClick={handleOpenPostEditalModal}
            title="Cadastrar o edital oficial publicado (Pós-Edital) ou retificação"
          >
            📢 {isPreEdital ? 'Saiu o Edital! (Pós-Edital)' : '+ Novo Edital / Retificação'}
          </button>

          {editais.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => handleOpenEditEdital(activeEdital || undefined)}
              style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Editar título, versão e metadados do documento do edital"
            >
              ⚙️ Dados do Edital
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleCopyPromptMestre}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: copiedPrompt ? 'rgba(16, 185, 129, 0.2)' : undefined,
              borderColor: copiedPrompt ? '#10b981' : undefined,
              color: copiedPrompt ? '#34d399' : undefined,
            }}
            title="Copiar prompt oficial para extrair JSON no Gemini / ChatGPT"
          >
            📋 {copiedPrompt ? '✓ Prompt Mestre Copiado!' : 'Copiar Prompt Mestre'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleAutoLinkAll}
            disabled={isAutoLinking}
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            title="Analisa o conteúdo dos PDFs e livros da biblioteca e associa automaticamente aos tópicos deste edital"
          >
            ⚡ {isAutoLinking ? 'Analisando...' : 'Auto-Vincular Materiais'}
          </button>

          <button className="btn" onClick={handleOpenAddTopic} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            + Adicionar Tópico
          </button>
        </div>
      </div>

      {/* Banner Informativo de Pré-Edital / Transição para Pós-Edital */}
      {isPreEdital && (
        <div className="pre-edital-banner animate-fade-in">
          <div className="banner-left">
            <span className="banner-icon">📌</span>
            <div className="banner-content">
              <h4>Modo Pré-Edital Ativo — Estudando com Base no Edital Anterior</h4>
              <p>
                Você está estudando com a grade programática do concurso anterior. Quando a banca examinadora publicar o novo edital oficial no Diário Oficial, utilize o botão <strong>"📢 Saiu o Edital Oficial!"</strong> para atualizar a grade de matérias. <strong>O seu histórico de horas líquidas, acertos de questões e o Gêmeo Digital permanecerão integralmente preservados!</strong>
              </p>
            </div>
          </div>
          <button className="btn-banner-action" onClick={handleOpenPostEditalModal}>
            📢 Saiu o Edital! Atualizar Agora
          </button>
        </div>
      )}

      {/* Seletor de Editais se houver mais de uma versão cadastrada */}
      {editais.length > 1 && (
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', marginBottom: '1.25rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Visualizar Versão do Edital:</span>
          <select
            className="form-control"
            style={{ maxWidth: '380px', fontSize: '0.82rem', background: '#0f172a', color: '#f8fafc', padding: '4px 8px' }}
            value={selectedEditalId}
            onChange={(e) => {
              setSelectedEditalId(e.target.value);
              loadEditalData(e.target.value);
            }}
          >
            <option value="ALL">Grade Consolidada ({topicos.length} tópicos totais)</option>
            {editais.map((ed) => (
              <option key={ed.id} value={ed.id}>
                [{ed.tipo}] {ed.titulo} (v{ed.versao})
              </option>
            ))}
          </select>
        </div>
      )}

      {autoLinkMessage && (
        <div className="glass" style={{ borderLeft: '4px solid #10b981', padding: '1rem', marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.1)' }}>
          <p style={{ color: '#34d399', margin: 0, fontWeight: 600 }}>✓ {autoLinkMessage}</p>
        </div>
      )}

      {errorMsg && (
        <div className="glass" style={{ borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ color: '#ef4444', margin: 0 }}>⚠️ {errorMsg}</p>
        </div>
      )}

      {/* Estatísticas do Edital */}
      <div className="edital-stats-grid">
        <div className="edital-stat-card">
          <span className="edital-stat-label">Disciplinas Cadastradas</span>
          <span className="edital-stat-value">{totalDisciplinas}</span>
        </div>
        <div className="edital-stat-card">
          <span className="edital-stat-label">Total de Tópicos</span>
          <span className="edital-stat-value">{totalTopicosGeral}</span>
        </div>
        <div className="edital-stat-card">
          <span className="edital-stat-label">Total de Subtópicos</span>
          <span className="edital-stat-value" style={{ color: '#38bdf8' }}>
            {totalSubtopicosGeral}
          </span>
        </div>
        <div className="edital-stat-card">
          <span className="edital-stat-label">Verificação Humana</span>
          <span className="edital-stat-value" style={{ color: '#34d399' }}>
            {percentConfirmado}% ({totalConfirmados}/{topicos.length})
          </span>
        </div>
      </div>

      {/* Barra de Ações Rápidas de Visualização */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>
          Clique em uma matéria para visualizar seus <strong>tópicos</strong> e clique na setinha (<strong>›</strong>) do tópico para expandir seus <strong>subtópicos</strong>.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => toggleAllMaterias(!areAllMateriasExpanded)}
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            {areAllMateriasExpanded ? '▴ Recolher Todas as Matérias' : '▾ Expandir Todas as Matérias'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Carregando matérias e tópicos do edital...
        </div>
      )}

      {!isLoading && hierarchicalMaterias.length === 0 && (
        <div className="glass" style={{ textAlign: 'center', padding: '3rem', borderRadius: '12px' }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Edital ainda não verticalizado</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            Adicione os tópicos programáticos manualmente ou cadastre o edital oficial através do botão abaixo.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-pos-edital" onClick={handleOpenPostEditalModal}>
              📢 Cadastrar Edital Oficial
            </button>
            <button className="btn btn-secondary" onClick={handleOpenAddTopic}>
              + Adicionar Tópico Manualmente
            </button>
          </div>
        </div>
      )}

      {/* Lista de Matérias (Nível 1) */}
      {hierarchicalMaterias.map((mat) => {
        const isMateriaOpen = !!expandedDisciplinas[mat.disciplina];

        return (
          <div key={mat.disciplina} className="materia-accordion-card">
            {/* Header da Matéria (Aparece somente este nível inicialmente!) */}
            <div
              className={`materia-accordion-header ${isMateriaOpen ? 'is-open' : ''}`}
              onClick={() => toggleMateria(mat.disciplina)}
            >
              <div className="materia-info-left">
                <span className={`materia-chevron ${isMateriaOpen ? 'rotated' : ''}`}>{isMateriaOpen ? '▾' : '▸'}</span>
                <h3 className="materia-title">{mat.disciplina}</h3>
                <span className="materia-badge-topics">
                  {mat.totalTopicosCount} {mat.totalTopicosCount === 1 ? 'tópico' : 'tópicos'}
                </span>
                <span className="materia-badge-subtopics">
                  {mat.totalSubtopicosCount} {mat.totalSubtopicosCount === 1 ? 'subtópico' : 'subtópicos'}
                </span>
                {mat.totalQuestoesPrevistas > 0 && (
                  <span className="materia-badge-questions">
                    ~{mat.totalQuestoesPrevistas} questões previstas
                  </span>
                )}
              </div>

              <div className="materia-header-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenRenameDiscipline(mat.disciplina)}
                  title={`Renomear ${mat.disciplina}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  ✏️ Renomear
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingTopicId(null);
                    setTopicForm({
                      disciplina: mat.disciplina,
                      assunto: '',
                      subassunto: '',
                      peso: '1.0',
                      questoesPrevistas: '',
                      docOrigem: editais.length > 0 ? editais[0].titulo : 'Edital Normativo',
                      paginaOrigem: '',
                      trechoOrigem: '',
                    });
                    setIsTopicModalOpen(true);
                  }}
                  title={`Adicionar novo tópico em ${mat.disciplina}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  + Tópico
                </button>
              </div>
            </div>

            {/* Conteúdo da Matéria: Lista de Tópicos (Abre ao clicar na matéria) */}
            {isMateriaOpen && (
              <div className="materia-accordion-body animate-fade-in">
                {/* Cabeçalho da Seção de Tópicos (Exatamente como na imagem enviada pelo usuário) */}
                <div className="topicos-section-header">
                  <div className="topicos-title-group">
                    <span className="topicos-heading">TÓPICOS</span>
                    <button
                      type="button"
                      className="btn-dicas-pill"
                      onClick={() => setDicasModalDisciplina(mat.disciplina)}
                      title="Ver dicas de estudo estratégicas para esta matéria"
                    >
                      ? Dicas
                    </button>
                  </div>
                  <div className="topicos-actions-group">
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={() => toggleAllTopicsInMateria(mat, !areAllTopicsExpanded(mat))}
                    >
                      {areAllTopicsExpanded(mat) ? '▴ Recolher Todos os Subtópicos' : '▾ Expandir Todos os Subtópicos'}
                    </button>
                  </div>
                </div>

                {/* Lista de Tópicos com setinha (›) e design idêntico ao modelo da imagem */}
                <div className="topicos-list">
                  {mat.topicos.map((top) => {
                    const topicKey = `${mat.disciplina}:::${top.assunto}`;
                    const isTopicExpanded = !!expandedTopics[topicKey];
                    const hasSubtopics = top.subtopicos.length > 0;
                    const repRow = top.leafNode || (top.subtopicos.length > 0 ? top.subtopicos[0].raw : null);

                    return (
                      <div key={topicKey} className={`topic-item-card ${isTopicExpanded ? 'expanded' : ''}`}>
                        {/* Linha do Tópico: Setinha na esquerda + Nome do Tópico + Badges/Ações */}
                        <div
                          className="topic-item-header"
                          onClick={() => toggleTopic(topicKey)}
                        >
                          <div className="topic-header-left">
                            <span
                              className={`topic-chevron ${isTopicExpanded ? 'open' : ''} ${!hasSubtopics ? 'leaf' : ''}`}
                              title={hasSubtopics ? (isTopicExpanded ? 'Recolher subtópicos' : 'Expandir subtópicos') : 'Tópico único'}
                            >
                              ›
                            </span>
                            <span className="topic-name">{top.assunto}</span>
                          </div>

                          <div className="topic-header-right" onClick={(e) => e.stopPropagation()}>
                            {hasSubtopics ? (
                              <span className="topic-subtopics-count-badge">
                                {top.subtopicos.length} {top.subtopicos.length === 1 ? 'subtópico' : 'subtópicos'}
                              </span>
                            ) : (
                              <span className="topic-leaf-badge">Tópico direto</span>
                            )}

                            <button
                              type="button"
                              className="btn-topic-action-study"
                              onClick={() => handleStudyTopic(mat.disciplina, top.assunto)}
                              title="Resolver questões deste tópico"
                            >
                              📝 Praticar
                            </button>

                            {repRow && (
                              <button
                                type="button"
                                className="btn-topic-icon"
                                onClick={() => handleOpenEditTopic(repRow)}
                                title="Editar este tópico"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Subtópicos revelados ao clicar na setinha */}
                        {isTopicExpanded && (
                          <div className="subtopics-container animate-fade-in">
                            {hasSubtopics ? (
                              <div className="subtopics-list">
                                {top.subtopicos.map((sub) => {
                                  const subLinks = links.filter((l) => l.topicoId === sub.id);
                                  const isDrawerOpen = expandedTopicId === sub.id;

                                  return (
                                    <div key={sub.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                      <div className="subtopic-row">
                                        <div className="subtopic-row-main">
                                          <div className="subtopic-title-line">
                                            <span className="subtopic-bullet">•</span>
                                            <span className="subtopic-name">{sub.subassunto}</span>
                                            <span className={`badge-classificacao badge-${sub.tipoClassificacao.toLowerCase()}`}>
                                              {sub.confirmadoHumano ? 'CONFIRMADO' : sub.tipoClassificacao}
                                            </span>
                                            {sub.peso && sub.peso !== 1.0 && (
                                              <span className="subtopic-weight-tag">Peso {sub.peso}x</span>
                                            )}
                                          </div>

                                          {(sub.docOrigem || sub.paginaOrigem || sub.trechoOrigem) && (
                                            <div className="subtopic-provenance">
                                              📄 {sub.docOrigem || 'Edital'}
                                              {sub.paginaOrigem ? ` (pág. ${sub.paginaOrigem})` : ''}
                                              {sub.trechoOrigem && <em> — "{sub.trechoOrigem}"</em>}
                                            </div>
                                          )}
                                        </div>

                                        <div className="subtopic-actions">
                                          <button
                                            type="button"
                                            className="btn-subtopic-materials"
                                            onClick={() => setExpandedTopicId(isDrawerOpen ? null : sub.id)}
                                            title="Visualizar ou vincular livros, apostilas e PDFs"
                                          >
                                            📚 {subLinks.length > 0 ? `${subLinks.length} material(is)` : '+ Material'}
                                            <span style={{ fontSize: '0.65rem', marginLeft: '3px' }}>{isDrawerOpen ? '▲' : '▼'}</span>
                                          </button>
                                          {!sub.confirmadoHumano && (
                                            <button
                                              type="button"
                                              className="btn-subtopic-confirm"
                                              onClick={() => handleConfirmTopic(sub.id)}
                                              title="Confirmar verificação humana"
                                            >
                                              ✓
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="btn-subtopic-icon"
                                            onClick={() => handleOpenEditTopic(sub.raw)}
                                            title="Editar subtópico"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-subtopic-delete"
                                            onClick={() => handleDeleteTopic(sub.id)}
                                            title="Excluir subtópico"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>

                                      {/* Drawer de Materiais Didáticos deste subtópico se expandido */}
                                      {isDrawerOpen && (
                                        <div className="topic-materials-drawer animate-fade-in" style={{ borderRadius: '6px', marginBottom: '0.5rem' }}>
                                          <div className="drawer-header">
                                            <h4>
                                              <span>📖</span> Materiais para: <u>{sub.subassunto}</u>
                                            </h4>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              <button
                                                className="btn btn-secondary"
                                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                                onClick={() => handleOpenLinkModal(sub.raw)}
                                              >
                                                + Vincular Material
                                              </button>
                                              <button
                                                className="btn"
                                                style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                                onClick={() => handleStudyTopic(mat.disciplina, `${top.assunto} — ${sub.subassunto}`)}
                                              >
                                                📝 Resolver Questões
                                              </button>
                                            </div>
                                          </div>

                                          {subLinks.length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0.25rem 0' }}>
                                              Nenhum material didático vinculado a este subtópico. Clique em "+ Vincular Material" para associar apostilas e livros da sua biblioteca.
                                            </p>
                                          ) : (
                                            <div className="drawer-materials-grid">
                                              {subLinks.map((link) => (
                                                <div key={link.id} className="drawer-material-card">
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <h5 className="drawer-mat-title">{link.materialTitulo || 'Material Didático'}</h5>
                                                    <button
                                                      onClick={() => handleDeleteLink(link.id)}
                                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                                                      title="Desvincular este material"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                  <div className="drawer-mat-meta">
                                                    <span className="htag htag-board">{link.materialFormato || 'PDF'}</span>
                                                    <span>
                                                      📖 Págs. {link.paginaInicio || 1} a {link.paginaFim || link.paginaInicio || 1}
                                                    </span>
                                                  </div>
                                                  {link.anotacoes && (
                                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                                                      "{link.anotacoes}"
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="subtopic-single-detail">
                                <p style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1', fontSize: '0.85rem' }}>
                                  Este tópico não possui subtópicos cadastrados. Você pode adicionar subtópicos para detalhar a ementa.
                                </p>
                                {repRow && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setEditingTopicId(null);
                                      setTopicForm({
                                        disciplina: mat.disciplina,
                                        assunto: top.assunto,
                                        subassunto: '',
                                        peso: '1.0',
                                        questoesPrevistas: '',
                                        docOrigem: repRow.docOrigem || '',
                                        paginaOrigem: '',
                                        trechoOrigem: '',
                                      });
                                      setIsTopicModalOpen(true);
                                    }}
                                  >
                                    + Adicionar Subtópico a este Tópico
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* MODAL: Dicas Estratégicas da Disciplina */}
      {dicasModalDisciplina && createPortal(
        <div className="edital-modal-backdrop" onClick={() => setDicasModalDisciplina(null)}>
          <div className="edital-modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="edital-modal-header">
              <div>
                <h3>💡 Dicas de Estudo: {dicasModalDisciplina}</h3>
                <p>Estratégia e orientações para retenção máxima</p>
              </div>
              <button
                type="button"
                className="edital-modal-close-btn"
                onClick={() => setDicasModalDisciplina(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <strong style={{ color: '#60a5fa' }}>1. Mapeamento de Frequência da Banca</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  Identifique os subtópicos com maior peso na prova. No modelo de preparação para carreiras fiscais, 20% dos subtópicos representam 80% das questões mais recorrentes.
                </p>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <strong style={{ color: '#34d399' }}>2. Alternância Ativa (Teoria ➔ Questões)</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  Não leia a teoria de forma passiva. Assim que concluir o estudo de um subtópico, clique em <strong>"📝 Praticar"</strong> para resolver uma bateria de 10 a 15 questões imediatas.
                </p>
              </div>

              <div style={{ background: 'rgba(234, 179, 8, 0.1)', borderLeft: '4px solid #eab308', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                <strong style={{ color: '#facc15' }}>3. Repetição Espaçada e Micro-Telemetria</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  O FiscalStudy rastreia automaticamente seus erros e tempo de hesitação em cada subtópico, agendando revisões preventivas nos momentos exatos da curva de esquecimento.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDicasModalDisciplina(null)}
                style={{ padding: '6px 18px' }}
              >
                Entendi, continuar estudando
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 1: Publicação de Novo Edital / Transição para Pós-Edital */}
      {isPostEditalModalOpen && createPortal(
        <div className="edital-modal-backdrop" onClick={() => setIsPostEditalModalOpen(false)}>
          <div className="edital-modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="edital-modal-header">
              <div>
                <h3>📢 Cadastrar Edital Oficial do Concurso (Pós-Edital)</h3>
                <p>
                  Concurso: <strong style={{ color: '#60a5fa' }}>{concursoNome}</strong>. Importe o conteúdo programático definitivo quando o edital for publicado pela banca.
                </p>
              </div>
              <button
                type="button"
                className="edital-modal-close-btn"
                onClick={() => setIsPostEditalModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePostEdital}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Tipo de Edital *
                  </label>
                  <select
                    className="form-control"
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc' }}
                    value={postEditalForm.tipo}
                    onChange={(e) => setPostEditalForm({ ...postEditalForm, tipo: e.target.value })}
                  >
                    <option value="EDITAL_OFICIAL_POS_EDITAL">📄 Edital Oficial (Pós-Edital)</option>
                    <option value="RETIFICACAO">📝 Retificação de Edital</option>
                    <option value="PRE_EDITAL_ANTERIOR">📌 Edital Anterior / Referência</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Versão do Documento *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: 2.0 ou Retif. 01"
                    value={postEditalForm.versao}
                    onChange={(e) => setPostEditalForm({ ...postEditalForm, versao: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Arquivo de Origem (PDF)
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="edital_oficial.pdf"
                    value={postEditalForm.filename}
                    onChange={(e) => setPostEditalForm({ ...postEditalForm, filename: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Título do Edital *
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  placeholder="Ex: Edital Oficial nº 01/2026 — ISS Araguari / MG"
                  value={postEditalForm.titulo}
                  onChange={(e) => setPostEditalForm({ ...postEditalForm, titulo: e.target.value })}
                  required
                />
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={postEditalForm.updateConcursoSituacao}
                    onChange={(e) => setPostEditalForm({ ...postEditalForm, updateConcursoSituacao: e.target.checked })}
                  />
                  <span>Atualizar situação do concurso para <strong>"Edital Publicado" (Pós-Edital)</strong></span>
                </label>

                {postEditalForm.updateConcursoSituacao && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                        Data Prevista da Prova (se divulgada)
                      </label>
                      <input
                        className="form-control"
                        type="date"
                        style={{ width: '100%' }}
                        value={postEditalForm.dataProva}
                        onChange={(e) => setPostEditalForm({ ...postEditalForm, dataProva: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                        Link Oficial do Edital (Diário Oficial / Banca)
                      </label>
                      <input
                        className="form-control"
                        type="url"
                        placeholder="https://..."
                        style={{ width: '100%' }}
                        value={postEditalForm.linkEdital}
                        onChange={(e) => setPostEditalForm({ ...postEditalForm, linkEdital: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  ⚙️ Tratamento do Conteúdo Programático Anterior:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="replaceMode"
                      checked={postEditalForm.replacePreviousTopics}
                      onChange={() => setPostEditalForm({ ...postEditalForm, replacePreviousTopics: true })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#f8fafc' }}>Substituir a grade anterior pelo Edital Oficial (Recomendado)</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        A verticalização passa a refletir fielmente o novo edital. <strong>Suas sessões de estudo, revisões e respostas de questões registradas no pré-edital NÃO são perdidas</strong> — continuam 100% preservadas e contabilizadas no Gêmeo Digital!
                      </p>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="replaceMode"
                      checked={!postEditalForm.replacePreviousTopics}
                      onChange={() => setPostEditalForm({ ...postEditalForm, replacePreviousTopics: false })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#f8fafc' }}>Manter tópicos anteriores como histórico complementar</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Adiciona a nova versão do edital mantendo também os tópicos do edital anterior.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '0.88rem', fontWeight: 600 }}>
                    Conteúdo Programático em JSON (via Prompt Mestre) *
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopyPromptMestre}
                    style={{ padding: '3px 9px', fontSize: '0.78rem' }}
                  >
                    {copiedPrompt ? '✓ Copiado!' : '📋 Copiar Prompt Mestre'}
                  </button>
                </div>

                <textarea
                  className="form-control"
                  style={{ width: '100%', minHeight: '160px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  placeholder={`Cole aqui o JSON gerado pela IA. Exemplo:\n{\n  "versao": "2.0",\n  "docOrigem": "edital_oficial_2026.pdf",\n  "materias": [\n    {\n      "id": "mat_01",\n      "nome": "Direito Tributário",\n      "topicos": [\n        { "id": "top_01", "nome": "Sistema Tributário Nacional", "subtopicos": [] }\n      ]\n    }\n  ]\n}`}
                  value={postEditalForm.rawJsonText}
                  onChange={(e) => setPostEditalForm({ ...postEditalForm, rawJsonText: e.target.value })}
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleValidatePostEditalJson}
                    disabled={isValidatingPostEdital}
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  >
                    {isValidatingPostEdital ? 'Validando...' : '🔍 Validar Estrutura do JSON'}
                  </button>

                  {postEditalValidation && (
                    <div>
                      {postEditalValidation.valid ? (
                        <span className="json-preview-badge">
                          ✓ Válido: {postEditalValidation.totalMaterias} matérias, {postEditalValidation.totalTopicos} tópicos, {postEditalValidation.totalSubtopicos} subtópicos
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>
                          ⚠️ JSON inválido: {postEditalValidation.errors?.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPostEditalModalOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-pos-edital"
                  disabled={isImportingPostEdital}
                  style={{ padding: '10px 24px', fontSize: '0.92rem' }}
                >
                  {isImportingPostEdital ? 'Importando e Ativando...' : '🚀 Salvar e Ativar Edital Oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Editar Metadados do Edital Atual */}
      {isEditEditalModalOpen && editingEdital && createPortal(
        <div className="edital-modal-backdrop" onClick={() => setIsEditEditalModalOpen(false)}>
          <div className="edital-modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="edital-modal-header">
              <div>
                <h3>⚙️ Editar Metadados do Edital</h3>
                <p>Ajuste o título, versão e tipo do documento selecionado.</p>
              </div>
              <button
                type="button"
                className="edital-modal-close-btn"
                onClick={() => setIsEditEditalModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditalMetadata}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Título do Documento *
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  value={editalForm.titulo}
                  onChange={(e) => setEditalForm({ ...editalForm, titulo: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Versão *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    value={editalForm.versao}
                    onChange={(e) => setEditalForm({ ...editalForm, versao: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Tipo *
                  </label>
                  <select
                    className="form-control"
                    style={{ width: '100%', background: '#0f172a', color: '#f8fafc' }}
                    value={editalForm.tipo}
                    onChange={(e) => setEditalForm({ ...editalForm, tipo: e.target.value })}
                  >
                    <option value="PRE_EDITAL_ANTERIOR">📌 Pré-Edital (Edital Anterior)</option>
                    <option value="EDITAL_OFICIAL_POS_EDITAL">📄 Edital Oficial (Pós-Edital)</option>
                    <option value="RETIFICACAO">📝 Retificação de Edital</option>
                    <option value="ORIGINAL">📋 Original / Vigente</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Nome do Arquivo Fonte (PDF)
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  value={editalForm.filename}
                  onChange={(e) => setEditalForm({ ...editalForm, filename: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}
                  onClick={() => handleDeleteEdital(editingEdital.id)}
                >
                  🗑️ Excluir Este Edital
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditEditalModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn">
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Renomear Disciplina em Lote */}
      {isRenameDisciplineModalOpen && createPortal(
        <div className="edital-modal-backdrop" onClick={() => setIsRenameDisciplineModalOpen(false)}>
          <div className="edital-modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="edital-modal-header">
              <div>
                <h3>✏️ Renomear Disciplina em Lote</h3>
                <p>
                  Esta alteração atualizará automaticamente todos os tópicos vinculados a <strong>"{disciplineToRename}"</strong>.
                </p>
              </div>
              <button
                type="button"
                className="edital-modal-close-btn"
                onClick={() => setIsRenameDisciplineModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRenameDiscipline}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Novo Nome da Disciplina *
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  value={newDisciplineName}
                  onChange={(e) => setNewDisciplineName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRenameDisciplineModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Confirmar e Atualizar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: Edição / Criação de Tópico */}
      {isTopicModalOpen && createPortal(
        <div className="edital-modal-backdrop" onClick={() => setIsTopicModalOpen(false)}>
          <div className="edital-modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="edital-modal-header">
              <div>
                <h3>{editingTopicId ? '✏️ Editar Tópico do Edital' : '➕ Adicionar Tópico ao Edital Verticalizado'}</h3>
                <p>Defina a disciplina, assunto, peso e rastreabilidade documental.</p>
              </div>
              <button
                type="button"
                className="edital-modal-close-btn"
                onClick={() => setIsTopicModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTopic}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Disciplina *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    value={topicForm.disciplina}
                    onChange={(e) => setTopicForm({ ...topicForm, disciplina: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Assunto Principal *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: Impostos Municipais"
                    value={topicForm.assunto}
                    onChange={(e) => setTopicForm({ ...topicForm, assunto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Subassunto / Detalhamento
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  placeholder="Ex: IPTU, ISSQN e ITBI: Fato Gerador e Alíquotas"
                  value={topicForm.subassunto}
                  onChange={(e) => setTopicForm({ ...topicForm, subassunto: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Peso da Disciplina / Assunto
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.1"
                    style={{ width: '100%' }}
                    value={topicForm.peso}
                    onChange={(e) => setTopicForm({ ...topicForm, peso: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Questões Previstas no Edital
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="Ex: 10"
                    style={{ width: '100%' }}
                    value={topicForm.questoesPrevistas}
                    onChange={(e) => setTopicForm({ ...topicForm, questoesPrevistas: e.target.value })}
                  />
                </div>
              </div>

              <h4 style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', marginTop: '1.25rem' }}>
                Rastreabilidade e Proveniência (Documento Fonte)
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Documento de Origem
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    value={topicForm.docOrigem}
                    onChange={(e) => setTopicForm({ ...topicForm, docOrigem: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Página do Edital
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="Ex: 42"
                    style={{ width: '100%' }}
                    value={topicForm.paginaOrigem}
                    onChange={(e) => setTopicForm({ ...topicForm, paginaOrigem: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Trecho ou Citação Exata do Documento
                </label>
                <textarea
                  className="form-control"
                  style={{ width: '100%', minHeight: '60px' }}
                  placeholder="Ex: Item 1.4 da Parte Específica — Impostos de Competência Municipal"
                  value={topicForm.trechoOrigem}
                  onChange={(e) => setTopicForm({ ...topicForm, trechoOrigem: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsTopicModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Salvar Tópico
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 5: Vincular Material Manualmente */}
      {isLinkModalOpen && linkingTopic && createPortal(
        <div className="edital-modal-backdrop" onClick={() => setIsLinkModalOpen(false)}>
          <div className="edital-modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="edital-modal-header">
              <div>
                <h3>📚 Vincular Material ao Tópico</h3>
                <p>
                  Tópico: <strong style={{ color: '#38bdf8' }}>{linkingTopic.assunto}</strong> ({linkingTopic.disciplina})
                </p>
              </div>
              <button
                type="button"
                className="edital-modal-close-btn"
                onClick={() => setIsLinkModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${linkModalTab === 'EXISTING' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: linkModalTab === 'EXISTING' ? '#0284c7' : '#1e293b',
                  color: linkModalTab === 'EXISTING' ? '#ffffff' : '#94a3b8',
                  border: '1px solid #334155',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
                onClick={() => setLinkModalTab('EXISTING')}
              >
                📂 Da Minha Biblioteca ({availableMaterials.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${linkModalTab === 'NEW' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: linkModalTab === 'NEW' ? '#0284c7' : '#1e293b',
                  color: linkModalTab === 'NEW' ? '#ffffff' : '#94a3b8',
                  border: '1px solid #334155',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
                onClick={() => setLinkModalTab('NEW')}
              >
                ➕ Cadastrar e Vincular Novo Material
              </button>
            </div>

            {linkModalTab === 'EXISTING' ? (
              availableMaterials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', background: '#0f172a', borderRadius: '8px', border: '1px dashed #334155' }}>
                  <p style={{ color: '#cbd5e1', margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>
                    Nenhum material na biblioteca ainda
                  </p>
                  <p style={{ color: '#94a3b8', margin: '0 0 1.25rem 0', fontSize: '0.82rem' }}>
                    Você pode cadastrar e associar seu PDF ou livro diretamente aqui sem sair desta tela.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: '#0284c7', color: '#fff', padding: '0.5rem 1rem' }}
                      onClick={() => setLinkModalTab('NEW')}
                    >
                      ➕ Cadastrar Material Agora
                    </button>
                    {onNavigateToTab && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => {
                          setIsLinkModalOpen(false);
                          onNavigateToTab('materiais');
                        }}
                      >
                        📂 Ver Biblioteca
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveMaterialLink}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Selecione o Material Didático *
                    </label>
                    <select
                      className="form-control"
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}
                      value={linkForm.materialId}
                      onChange={(e) => setLinkForm({ ...linkForm, materialId: e.target.value })}
                      required
                    >
                      <option value="">Selecione um arquivo / livro...</option>
                      {availableMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.formato}] {m.titulo} ({m.disciplina}) • {m.totalPaginas} págs
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Página Inicial *
                      </label>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        style={{ width: '100%' }}
                        value={linkForm.paginaInicio}
                        onChange={(e) => setLinkForm({ ...linkForm, paginaInicio: parseInt(e.target.value, 10) || 1 })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Página Final *
                      </label>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        style={{ width: '100%' }}
                        value={linkForm.paginaFim}
                        onChange={(e) => setLinkForm({ ...linkForm, paginaFim: parseInt(e.target.value, 10) || 1 })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Anotações / Trecho / Capítulo
                    </label>
                    <input
                      className="form-control"
                      style={{ width: '100%' }}
                      placeholder="Ex: Capítulo 4 — Art. 121 ao 125 do CTN"
                      value={linkForm.anotacoes}
                      onChange={(e) => setLinkForm({ ...linkForm, anotacoes: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsLinkModalOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn" style={{ background: '#0284c7', color: '#fff' }}>
                      Confirmar Vínculo
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleCreateMaterialAndLink}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Título do Livro / Apostila / PDF *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: Direito Tributário Esquematizado - Ricardo Alexandre"
                    value={newMaterialForm.titulo}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, titulo: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Formato
                    </label>
                    <select
                      className="form-control"
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}
                      value={newMaterialForm.formato}
                      onChange={(e) => setNewMaterialForm({ ...newMaterialForm, formato: e.target.value })}
                    >
                      <option value="PDF">PDF</option>
                      <option value="LIVRO_FISICO">Livro Físico</option>
                      <option value="APOSTILA">Apostila</option>
                      <option value="VIDEO_AULA">Vídeo Aula</option>
                      <option value="AUDIO">Áudio / Podcast</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Total de Páginas da Obra
                    </label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      style={{ width: '100%' }}
                      value={newMaterialForm.totalPaginas}
                      onChange={(e) => setNewMaterialForm({ ...newMaterialForm, totalPaginas: parseInt(e.target.value, 10) || 50 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Página Início do Tópico
                    </label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      style={{ width: '100%' }}
                      value={linkForm.paginaInicio}
                      onChange={(e) => setLinkForm({ ...linkForm, paginaInicio: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Página Fim do Tópico
                    </label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      style={{ width: '100%' }}
                      value={linkForm.paginaFim}
                      onChange={(e) => setLinkForm({ ...linkForm, paginaFim: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Capítulo / Detalhe
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: Aula 03 ou Cap. 2 - Fato Gerador e Obrigação"
                    value={linkForm.anotacoes}
                    onChange={(e) => setLinkForm({ ...linkForm, anotacoes: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsLinkModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn" style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 600 }}>
                    💾 Cadastrar e Vincular Agora
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
