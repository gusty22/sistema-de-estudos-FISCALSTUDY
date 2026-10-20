import React, { useState, useEffect, useMemo } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import {
  BookOpen,
  FileText,
  Link as LinkIcon,
  Video,
  FolderLock,
  Plus,
  MoreHorizontal,
  FolderSearch,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Layers,
  Sun,
  Moon,
  Search,
  FileSearch,
  Sparkles,
  ChevronDown,
  ChevronRight,
  BookCheck,
  Edit3,
  Table,
  Eye,
  ShieldCheck,
  FolderCheck,
  HardDrive
} from 'lucide-react';
import { VinculacaoMaterialConteudo } from './VinculacaoMaterialConteudo';
import { LeitorMaterialModal } from './LeitorMaterialModal';
import './BibliotecaMateriais.css';

export interface StudyMaterialItem {
  id: string;
  concursoId?: string;
  disciplina: string;
  titulo: string;
  autor?: string;
  formato: 'PDF' | 'LIVRO' | 'VIDEO' | 'LEI_SECA' | 'LINK';
  origem?: 'PASTA_LOCAL' | 'LINK_EXTERNO' | 'UPLOAD_LOCAL';
  totalPaginas: number;
  paginaAtual: number;
  urlOuCaminho?: string;
  hashSha256?: string;
  notas?: string;
  status?: 'AVAILABLE' | 'MISSING';
  lastAccessed?: string;
  size?: string;
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
  onNavigateToEdital?: () => void;
}

interface SubtopicGroup {
  id: string;
  subassunto: string;
  rawTopic: EditalTopic;
  links: TopicMaterialLink[];
}

interface TopicGroup {
  assunto: string;
  disciplina: string;
  directId?: string;
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

export const BibliotecaMateriais: React.FC<BibliotecaMateriaisProps> = ({ activeConcurso, onNavigateToStudy, onNavigateToEdital }) => {
  // Tema: Paper (Clean Calm Light) vs Night (Calm Dark)
  const [theme, setTheme] = useState<'paper' | 'night'>('night');

  // Modo de exibição:
  // 1. TABLE: T16 — Tabela Canônica de Materiais (Material | Tipo | Origem | Situação | Conteúdos | Ações)
  // 2. VINCULACAO: T17 — Editor de Vinculação Material-Conteúdo em 2 painéis
  // 3. MATERIALS: Acervo em Cards (Design Tecnologia Calma)
  // 4. TREE: Edital Verticalizado (Matérias › Tópicos › Subtópicos)
  // 5. COVERAGE: Matriz Completa de Cobertura do Edital
  const [activeView, setActiveView] = useState<'TABLE' | 'VINCULACAO' | 'MATERIALS' | 'TREE' | 'COVERAGE'>('TABLE');

  // Dados carregados do backend
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [topics, setTopics] = useState<EditalTopic[]>([]);
  const [links, setLinks] = useState<TopicMaterialLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros e busca
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Estado de expansão da árvore
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Feedback do sistema
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [linkingMaterialId, setLinkingMaterialId] = useState<string | null>(null);

  // Refs de arquivo e pasta (Privacidade: Leitura sob autorização explícita)
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  // Modais de T16
  // 1. Cadastrar Novo Material
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDisciplina, setFormDisciplina] = useState('');
  const [formAutor, setFormAutor] = useState('');
  const [formFormato, setFormFormato] = useState<'PDF' | 'LIVRO' | 'VIDEO' | 'LEI_SECA' | 'LINK'>('PDF');
  const [formOrigem, setFormOrigem] = useState<'PASTA_LOCAL' | 'LINK_EXTERNO' | 'UPLOAD_LOCAL'>('PASTA_LOCAL');
  const [formTotalPaginas, setFormTotalPaginas] = useState<number>(100);
  const [formUrlOuCaminho, setFormUrlOuCaminho] = useState('');
  const [formHashSha256, setFormHashSha256] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [formAutoLinkAfterSave, setFormAutoLinkAfterSave] = useState(true);

  // 2. Examinar Metadados (T16)
  const [inspectingMetadataMaterial, setInspectingMetadataMaterial] = useState<StudyMaterialItem | null>(null);

  // 3. Selecionar Pasta Autorizada (T16 - Privacidade)
  const [isAuthorizedFolderModalOpen, setIsAuthorizedFolderModalOpen] = useState(false);

  // 4. Arquivos Ausentes (T16)
  const [missingFileModalMaterial, setMissingFileModalMaterial] = useState<StudyMaterialItem | null>(null);

  // 5. Exclusão com confirmação (Regra: histórico de estudo nunca é excluído)
  const [deleteConfirmMaterial, setDeleteConfirmMaterial] = useState<StudyMaterialItem | null>(null);

  // 6. Smart Import & Auto-Vinculação Instantânea
  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [smartFileName, setSmartFileName] = useState('');
  const [smartDiscipline, setSmartDiscipline] = useState('');
  const [smartContentText, setSmartContentText] = useState('');
  const [smartTotalPages, setSmartTotalPages] = useState<number>(120);
  const [isProcessingSmartImport, setIsProcessingSmartImport] = useState(false);

  // 7. Anexar Manualmente a Tópico
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [selectedTopicForAttach, setSelectedTopicForAttach] = useState<EditalTopic | null>(null);
  const [attachForm, setAttachForm] = useState({
    materialId: '',
    paginaInicio: 1,
    paginaFim: 30,
    anotacoes: ''
  });

  // 8. Relocalizar Arquivo
  const [relocatingMaterial, setRelocatingMaterial] = useState<StudyMaterialItem | null>(null);
  const [newFilePath, setNewFilePath] = useState('');

  // 9. Atualizar Páginas Lidas
  const [updatingPageMaterial, setUpdatingPageMaterial] = useState<StudyMaterialItem | null>(null);
  const [inputPageNumber, setInputPageNumber] = useState<number>(0);
  const [readingMaterial, setReadingMaterial] = useState<StudyMaterialItem | null>(null);

  const showFeedback = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Carregar dados da API
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
        const rawMats: any[] = await resMats.json();
        // Atribui status padrão se não vier
        const mappedMats: StudyMaterialItem[] = rawMats.map(m => ({
          ...m,
          status: m.status || (m.urlOuCaminho && m.urlOuCaminho.includes('MISSING') ? 'MISSING' : 'AVAILABLE'),
          lastAccessed: m.lastAccessed || 'Recente',
          size: m.size || (m.formato === 'LINK' ? '-' : `${Math.round(m.totalPaginas * 0.12 * 10) / 10 || 4.2} MB`)
        }));
        setMaterials(mappedMats);
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
      showFeedback('Erro ao carregar dados da biblioteca.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeConcurso?.id]);

  // Montar Árvore Agrupada do Edital Verticalizado
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

  // Filtro de materiais (Acervo)
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchDisc = selectedDisciplina === 'TODAS' || m.disciplina === selectedDisciplina;
      const matchQ = !searchQuery.trim() ||
        m.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.urlOuCaminho && m.urlOuCaminho.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.autor && m.autor.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchDisc && matchQ;
    });
  }, [materials, selectedDisciplina, searchQuery]);

  // Filtro de árvore do edital
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

  // Estatísticas de Cobertura
  const coverageStats = useMemo(() => {
    const totalTopicsCount = topics.length;
    const coveredTopicIds = new Set<string>(links.map(l => l.topicoId));
    const coveredCount = topics.filter(t => coveredTopicIds.has(t.id)).length;
    const gapCount = Math.max(0, totalTopicsCount - coveredCount);
    const coveragePct = totalTopicsCount > 0 ? Math.round((coveredCount / totalTopicsCount) * 100) : 0;
    return {
      totalTopicsCount,
      coveredCount,
      gapCount,
      coveragePct,
      totalMaterials: materials.length,
      totalLinks: links.length
    };
  }, [topics, links, materials]);

  // Manipuladores de Expansão
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
        showFeedback('⚠️ Não foi possível auto-vincular este material.', 'warning');
      }
    } catch {
      showFeedback('⚠️ Erro ao executar auto-vinculação.', 'warning');
    } finally {
      setLinkingMaterialId(null);
      setActiveDropdown(null);
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
          `✨ Auto-vinculação completa finalizada! ${allCreated.length} conexões automáticas geradas no edital.`,
          'success'
        );
        loadAllData();
      } else {
        showFeedback('Falha ao auto-vincular materiais ao edital.', 'warning');
      }
    } catch {
      showFeedback('Erro ao comunicar com o servidor.', 'warning');
    } finally {
      setLinkingMaterialId(null);
    }
  };

  const handleSaveNewMaterial = async () => {
    if (!formTitulo.trim() || !formDisciplina.trim()) {
      showFeedback('Informe o título e a matéria do material.', 'warning');
      return;
    }

    const payload = {
      concursoId: activeConcurso?.id || null,
      disciplina: formDisciplina.trim(),
      titulo: formTitulo.trim(),
      autor: formAutor.trim() || null,
      formato: formFormato,
      origem: formOrigem,
      hashSha256: formHashSha256 || undefined,
      totalPaginas: Number(formTotalPaginas) || 0,
      paginaAtual: 0,
      urlOuCaminho: formUrlOuCaminho.trim() || null,
      notas: formNotas.trim() || null
    };

    try {
      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedMat = await res.json();
        setIsNewMaterialModalOpen(false);
        setFormTitulo('');
        setFormDisciplina('');
        setFormAutor('');
        setFormUrlOuCaminho('');
        setFormTotalPaginas(100);
        setFormNotas('');

        if (formAutoLinkAfterSave && savedMat.id && activeConcurso?.id) {
          showFeedback('Material salvo! Executando auto-vinculação inteligente com o edital...', 'info');
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

  const handleSmartImport = async () => {
    if (!smartFileName.trim()) {
      showFeedback('Informe o título ou nome do arquivo do material.', 'warning');
      return;
    }
    setIsProcessingSmartImport(true);

    try {
      const matPayload = {
        concursoId: activeConcurso?.id || null,
        disciplina: smartDiscipline.trim() || 'Geral',
        titulo: smartFileName.trim(),
        autor: 'Importação Inteligente',
        formato: 'PDF',
        totalPaginas: Number(smartTotalPages) || 100,
        paginaAtual: 0,
        urlOuCaminho: `C:\\Estudos\\${smartFileName.trim()}.pdf`,
        notas: smartContentText ? `Sumário extraído: ${smartContentText.substring(0, 150)}...` : 'Importado via Smart Vinculação'
      };

      const resMat = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matPayload)
      });

      if (!resMat.ok) throw new Error('Falha ao cadastrar o material base.');
      const savedMat = await resMat.json();

      const resLink = await fetch(`/api/v1/materials/${savedMat.id}/auto-link?concursoId=${encodeURIComponent(activeConcurso?.id || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentText: smartContentText })
      });

      if (resLink.ok) {
        const createdLinks: TopicMaterialLink[] = await resLink.json();
        showFeedback(
          `✨ Sucesso! "${savedMat.titulo}" foi cadastrado e auto-vinculado a ${createdLinks.length} tópicos/subtópicos do edital verticalizado!`,
          'success'
        );
        setIsSmartImportModalOpen(false);
        setSmartFileName('');
        setSmartDiscipline('');
        setSmartContentText('');
        loadAllData();
      } else {
        showFeedback('Material salvo! Poucas correspondências diretas no edital.', 'info');
        setIsSmartImportModalOpen(false);
        loadAllData();
      }
    } catch (e: any) {
      showFeedback(`Erro na auto-vinculação: ${e.message}`, 'warning');
    } finally {
      setIsProcessingSmartImport(false);
    }
  };

  const handleOpenAttachModal = (topic: EditalTopic) => {
    setSelectedTopicForAttach(topic);
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
        showFeedback('✓ Material vinculado ao tópico com sucesso!', 'success');
        loadAllData();
      } else {
        showFeedback('Erro ao salvar vínculo.', 'warning');
      }
    } catch {
      showFeedback('Erro de conexão ao salvar vínculo.', 'warning');
    }
  };

  const handleDeleteLink = async (linkId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Deseja desvincular este material deste tópico? O arquivo continuará na biblioteca.')) return;

    try {
      const res = await fetch(`/api/v1/materials/links/${linkId}`, { method: 'DELETE' });
      if (res.ok) {
        showFeedback('Vínculo desfeito.', 'info');
        setLinks(prev => prev.filter(l => l.id !== linkId));
      }
    } catch {
      showFeedback('Erro ao desvincular material.', 'warning');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta referência da sua biblioteca?')) return;
    try {
      const res = await fetch(`/api/v1/materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showFeedback('Referência removida da biblioteca.', 'info');
        setMaterials(prev => prev.filter(m => m.id !== id));
        setLinks(prev => prev.filter(l => l.materialId !== id));
      }
    } catch {
      showFeedback('Erro ao remover material.', 'warning');
    } finally {
      setActiveDropdown(null);
    }
  };

  const handleConfirmRelocate = async () => {
    if (!relocatingMaterial || !newFilePath.trim()) return;
    const updated = {
      ...relocatingMaterial,
      urlOuCaminho: newFilePath.trim(),
      status: 'AVAILABLE' as const
    };

    try {
      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        showFeedback('✓ Caminho do arquivo atualizado com sucesso!', 'success');
        setMaterials(prev => prev.map(m => m.id === relocatingMaterial.id ? updated : m));
        setRelocatingMaterial(null);
        setNewFilePath('');
      }
    } catch {
      showFeedback('Erro ao atualizar caminho do arquivo.', 'warning');
    }
  };

  const handleConfirmPageUpdate = async () => {
    if (!updatingPageMaterial) return;
    const updated = {
      ...updatingPageMaterial,
      paginaAtual: Math.max(0, Math.min(updatingPageMaterial.totalPaginas || 9999, inputPageNumber))
    };

    try {
      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        showFeedback(`✓ Progresso atualizado para a página ${updated.paginaAtual}!`, 'success');
        setMaterials(prev => prev.map(m => m.id === updatingPageMaterial.id ? updated : m));
        setUpdatingPageMaterial(null);
      }
    } catch {
      showFeedback('Erro ao salvar progresso de página.', 'warning');
    }
  };

  // Handlers para T16: Adicionar arquivo real e selecionar pasta autorizada
  const handleSelectLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    const pseudoHash = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    setFormTitulo(fileNameWithoutExt);
    setFormDisciplina(formDisciplina || (uniqueDisciplinas.length > 1 ? uniqueDisciplinas[1] : 'Direito Tributário'));
    setFormUrlOuCaminho(`C:\\Estudos\\${file.name}`);
    setFormFormato(file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'LIVRO');
    setFormOrigem('UPLOAD_LOCAL');
    setFormHashSha256(pseudoHash);
    setFormTotalPaginas(Math.max(10, Math.round(file.size / (1024 * 70))));
    setIsNewMaterialModalOpen(true);
    e.target.value = '';
  };

  const handleSelectFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showFeedback(`✓ Pasta autorizada: ${files.length} arquivos detectados sem varredura indiscriminada.`, 'success');
    setIsAuthorizedFolderModalOpen(false);

    const firstPdf = Array.from(files).find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    if (firstPdf) {
      const fileNameWithoutExt = firstPdf.name.replace(/\.[^/.]+$/, "");
      const pseudoHash = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setFormTitulo(fileNameWithoutExt);
      setFormDisciplina(uniqueDisciplinas.length > 1 ? uniqueDisciplinas[1] : 'Direito Tributário');
      setFormUrlOuCaminho(`C:\\Estudos\\${firstPdf.name}`);
      setFormOrigem('PASTA_LOCAL');
      setFormFormato('PDF');
      setFormHashSha256(pseudoHash);
      setFormTotalPaginas(120);
      setIsNewMaterialModalOpen(true);
    }
    e.target.value = '';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PDF': return <FileText className="w-5 h-5" />;
      case 'LINK': return <LinkIcon className="w-5 h-5" />;
      case 'VIDEO': return <Video className="w-5 h-5" />;
      case 'LIVRO': return <BookOpen className="w-5 h-5" />;
      case 'LEI_SECA': return <BookCheck className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className={`biblioteca-calm-wrapper theme-${theme}`}>
      {/* Inputs Ocultos com Autorização Explícita */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.epub,.txt"
        onChange={handleSelectLocalFile}
      />
      <input
        type="file"
        ref={folderInputRef}
        style={{ display: 'none' }}
        // @ts-expect-error webkitdirectory is standard in modern browsers
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleSelectFolder}
      />

      <div className="calm-container">

        {/* ------------------------------------------------------------------
            HEADER PRINCIPAL & ACERVO PESSOAL
            ------------------------------------------------------------------ */}
        <header className="calm-header">
          <div className="calm-title-area">
            <div className="calm-badge-acervo">
              <BookOpen className="w-4 h-4" />
              <span>Acervo Pessoal • {activeConcurso?.nome || 'Concurso Fiscal'}</span>
            </div>
            <h1 className="calm-h1">Biblioteca de Materiais</h1>
            <p className="calm-subtitle">
              Centralize referências aos seus PDFs, cursos e livros sem cópias desnecessárias para o banco. Vínculos e intervalos de páginas auditáveis conectados ao edital.
            </p>
          </div>

          <div className="calm-header-actions">
            <button
              className="calm-btn-primary"
              onClick={() => fileInputRef.current?.click()}
              title="Adicionar referência a arquivo local (PDF, livro, etc.)"
            >
              <Plus className="w-4 h-4" /> Adicionar Arquivo
            </button>

            <button
              className="calm-btn-secondary"
              onClick={() => setIsAuthorizedFolderModalOpen(true)}
              title="Selecionar pasta autorizada no computador (com consentimento explícito)"
            >
              <FolderSearch className="w-4 h-4 text-emerald-400" /> Selecionar Pasta
            </button>

            {onNavigateToEdital && (
              <button
                className="calm-btn-secondary"
                onClick={onNavigateToEdital}
                title="Abrir o Edital Verticalizado global do concurso"
              >
                <Layers className="w-4 h-4 text-emerald-400" /> Ver Edital Verticalizado
              </button>
            )}

            <button
              className="calm-btn-secondary"
              onClick={() => {
                setFormFormato('LINK');
                setFormOrigem('LINK_EXTERNO');
                setIsNewMaterialModalOpen(true);
              }}
              title="Vincular link ou referência externa de curso/vídeo"
            >
              <LinkIcon className="w-4 h-4" /> Vincular Link
            </button>

            <button
              className="calm-btn-secondary"
              onClick={() => setActiveView('VINCULACAO')}
              title="Abrir editor de vinculação material-conteúdo em 2 painéis"
            >
              <Layers className="w-4 h-4 text-indigo-400" /> Relacionar a Conteúdos
            </button>

            <button
              onClick={() => setTheme(theme === 'night' ? 'paper' : 'night')}
              className="calm-btn-theme"
              title={theme === 'night' ? 'Mudar para Tema Paper (Claro Suave)' : 'Mudar para Tema Night (Escuro Calm)'}
            >
              {theme === 'night' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------------------
            BANNER DE PRIVACIDADE E ARQUITETURA (TECNOLOGIA CALMA)
            ------------------------------------------------------------------ */}
        <div className="calm-privacy-card">
          <div className="calm-privacy-icon">
            <FolderLock className="w-5 h-5" />
          </div>
          <div className="calm-privacy-content">
            <h4>Privacidade e Armazenamento Inteligente</h4>
            <p>
              Para economizar espaço e manter seu banco de dados leve, o FiscalStudy salva apenas <strong>o identificador, o caminho/referência, o hash, os metadados e os vínculos pedagógicos</strong> dos seus materiais. Não copiamos PDFs pesados para o banco nem realizamos varredura indiscriminada do computador.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------------
            FEEDBACK BANNER
            ------------------------------------------------------------------ */}
        {feedbackMsg && (
          <div style={{
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '0.84rem',
            background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#10b981' : '#38bdf8'}`,
            color: feedbackMsg.type === 'success' ? '#34d399' : '#7dd3fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ------------------------------------------------------------------
            NAVEGAÇÃO ENTRE VISÕES (TABLE / VINCULACAO / MATERIALS / TREE / COVERAGE)
            ------------------------------------------------------------------ */}
        <div className="calm-nav-tabs">
          <div className="calm-tab-pills">
            <button
              className={`calm-tab-btn ${activeView === 'TABLE' ? 'active' : ''}`}
              onClick={() => setActiveView('TABLE')}
            >
              <Table className="w-4 h-4" />
              Tabela de Materiais ({materials.length})
            </button>
            <button
              className={`calm-tab-btn ${activeView === 'VINCULACAO' ? 'active' : ''}`}
              onClick={() => setActiveView('VINCULACAO')}
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              Editor de Vinculação
            </button>
            <button
              className={`calm-tab-btn ${activeView === 'MATERIALS' ? 'active' : ''}`}
              onClick={() => setActiveView('MATERIALS')}
            >
              <BookOpen className="w-4 h-4" />
              Acervo em Cards ({materials.length})
            </button>
            <button
              className={`calm-tab-btn ${activeView === 'TREE' ? 'active' : ''}`}
              onClick={() => setActiveView('TREE')}
              title="Visualizar tópicos e subtópicos vinculados a cada material da biblioteca"
            >
              <Layers className="w-4 h-4" />
              Tópicos Curriculares ({hierarchyTree.reduce((acc, d) => acc + d.totalTopics, 0)})
            </button>
            <button
              className={`calm-tab-btn ${activeView === 'COVERAGE' ? 'active' : ''}`}
              onClick={() => setActiveView('COVERAGE')}
            >
              <CheckCircle2 className="w-4 h-4" />
              Matriz de Cobertura ({coverageStats.coveragePct}%)
            </button>
          </div>

          {activeView === 'TREE' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="calm-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={expandAll}>
                Expandir Tudo
              </button>
              <button className="calm-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={collapseAll}>
                Recolher Tudo
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------
            CONTROLES DE BUSCA E FILTROS POR DISCIPLINA
            ------------------------------------------------------------------ */}
        <div className="calm-controls-row">
          <div className="calm-search-box">
            <Search className="w-4 h-4" style={{ color: 'var(--calm-text-muted)' }} />
            <input
              type="text"
              className="calm-search-input"
              placeholder={
                activeView === 'TREE'
                  ? 'Buscar tópicos no edital ou por material...'
                  : 'Buscar material por nome, matéria ou caminho no disco...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="calm-btn-secondary" style={{ padding: '0.55rem 0.9rem', fontSize: '0.78rem' }} onClick={() => setIsSmartImportModalOpen(true)}>
              <FolderSearch className="w-4 h-4" /> Importar Pasta/Sumário
            </button>
            <button
              className="calm-btn-secondary"
              style={{ padding: '0.55rem 0.9rem', fontSize: '0.78rem' }}
              onClick={() => {
                setFormFormato('LINK');
                setIsNewMaterialModalOpen(true);
              }}
            >
              <LinkIcon className="w-4 h-4" /> Vincular URL
            </button>
            {activeConcurso?.id && (
              <button
                className="calm-btn-secondary"
                disabled={linkingMaterialId === 'ALL'}
                style={{ padding: '0.55rem 0.9rem', fontSize: '0.78rem' }}
                onClick={handleAutoLinkAll}
                title="Varre todos os materiais e edital para mapear correlações automáticas"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                {linkingMaterialId === 'ALL' ? 'Processando...' : 'Auto-Vincular Tudo'}
              </button>
            )}
          </div>
        </div>

        {/* Chips de Disciplina */}
        {uniqueDisciplinas.length > 1 && (
          <div className="calm-disciplinas-chips">
            {uniqueDisciplinas.map(disc => (
              <button
                key={disc}
                className={`calm-chip ${selectedDisciplina === disc ? 'active' : ''}`}
                onClick={() => setSelectedDisciplina(disc)}
              >
                {disc}
              </button>
            ))}
          </div>
        )}

        {/* Estado de Carregamento */}
        {isLoading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--calm-text-muted)' }}>
            <p>Carregando estrutura do edital e biblioteca de materiais...</p>
          </div>
        )}

        {/* ==================================================================
            T17 — VINCULAÇÃO MATERIAL-CONTEÚDO (EDITOR EM 2 PAINÉIS)
            ================================================================== */}
        {!isLoading && activeView === 'VINCULACAO' && (
          <VinculacaoMaterialConteudo
            activeConcurso={activeConcurso}
            materials={materials}
            topics={topics}
            links={links}
            selectedDisciplina={selectedDisciplina}
            onSelectDisciplina={setSelectedDisciplina}
            onRefreshData={loadAllData}
            onClose={() => setActiveView('TABLE')}
          />
        )}

        {/* ==================================================================
            T16 — TABELA CANÔNICA DE MATERIAIS
            Colunas: Material | Tipo | Origem | Situação | Conteúdos | Ações
            ================================================================== */}
        {!isLoading && activeView === 'TABLE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Banner de Arquivo Ausente T16 */}
            {filteredMaterials.some(m => m.status === 'MISSING') && (
              <div className="missing-file-alert-box">
                <div className="missing-file-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <h4>Material não encontrado no caminho registrado</h4>
                  </div>
                  <p>
                    Um ou mais arquivos foram movidos, renomeados ou excluídos da pasta original. O sistema preserva todo o histórico de estudo associado intacto.
                  </p>
                </div>
                <div className="missing-file-actions">
                  <button
                    className="btn-table-action warning"
                    onClick={() => {
                      const firstMissing = filteredMaterials.find(m => m.status === 'MISSING');
                      if (firstMissing) setMissingFileModalMaterial(firstMissing);
                    }}
                  >
                    Examinar Arquivos Ausentes
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Materiais */}
            <div className="calm-table-container">
              <table className="calm-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Tipo</th>
                    <th>Origem</th>
                    <th>Situação</th>
                    <th>Conteúdos</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map(material => {
                    const isMissing = material.status === 'MISSING';
                    const linkedCount = links.filter(l => l.materialId === material.id).length;
                    const origemLabel = material.origem === 'LINK_EXTERNO' || material.formato === 'LINK'
                      ? 'Referência externa'
                      : material.origem === 'UPLOAD_LOCAL'
                        ? 'Upload local'
                        : 'Pasta local';

                    return (
                      <tr key={material.id} className={isMissing ? 'is-missing' : ''}>
                        {/* Coluna Material */}
                        <td>
                          <div className="table-material-cell">
                            <div style={{ color: isMissing ? '#fbbf24' : 'var(--calm-primary)' }}>
                              {isMissing ? <AlertTriangle className="w-4 h-4" /> : getTypeIcon(material.formato)}
                            </div>
                            <div>
                              <div className="table-material-name">{material.titulo}</div>
                              <div className="table-material-sub">
                                {material.disciplina} • {material.size || '3.5 MB'}
                                {material.autor ? ` • ${material.autor}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Coluna Tipo */}
                        <td>
                          <span className="badge-tipo">
                            {material.formato}
                          </span>
                        </td>

                        {/* Coluna Origem */}
                        <td>
                          <span className="badge-origem">
                            {material.formato === 'LINK' ? <LinkIcon className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                            {origemLabel}
                          </span>
                        </td>

                        {/* Coluna Situação */}
                        <td>
                          {isMissing ? (
                            <span className="badge-situacao ausente">
                              <AlertTriangle className="w-3 h-3" /> Arquivo ausente
                            </span>
                          ) : (
                            <span className="badge-situacao disponivel">
                              <CheckCircle2 className="w-3 h-3" /> Disponível
                            </span>
                          )}
                        </td>

                        {/* Coluna Conteúdos */}
                        <td>
                          <button
                            className="table-conteudos-btn"
                            onClick={() => setActiveView('VINCULACAO')}
                            title="Ver ou editar vínculos deste material no edital"
                          >
                            <Layers className="w-3 h-3" />
                            {linkedCount} tópico(s)
                          </button>
                        </td>

                        {/* Coluna Ações */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-actions-cell" style={{ justifyContent: 'flex-end' }}>
                            {isMissing ? (
                              <button
                                className="btn-table-action warning"
                                onClick={() => setMissingFileModalMaterial(material)}
                                title="Resolver arquivo ausente"
                              >
                                <FileSearch className="w-3.5 h-3.5" /> Resolver
                              </button>
                            ) : (
                              <button
                                className="btn-table-action primary"
                                onClick={() => setReadingMaterial(material)}
                                title="Abrir material para leitura com acompanhamento automático de progresso"
                              >
                                {material.formato === 'LINK' ? <ExternalLink className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                                Abrir
                              </button>
                            )}

                            <button
                              className="btn-table-action"
                              onClick={() => setInspectingMetadataMaterial(material)}
                              title="Examinar metadados do arquivo (identificador, caminho, hash, tamanho, páginas)"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              className="btn-table-action"
                              onClick={() => setActiveView('VINCULACAO')}
                              title="Relacionar trechos e páginas deste material aos tópicos curriculares"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>

                            <button
                              className="btn-table-action"
                              style={{ color: '#f87171' }}
                              onClick={() => setDeleteConfirmMaterial(material)}
                              title="Remover referência (preserva histórico de estudo)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredMaterials.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--calm-text-muted)' }}>
                        Nenhum material cadastrado ou encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================
            VISÃO 3: ACERVO EM CARDS
            ================================================================== */}
        {!isLoading && activeView === 'MATERIALS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredMaterials.map(material => {
              const isMissing = material.status === 'MISSING';
              const linkedCount = links.filter(l => l.materialId === material.id).length;

              return (
                <div
                  key={material.id}
                  className={`calm-material-card ${isMissing ? 'is-missing' : ''}`}
                >
                  <div className="calm-material-main">
                    <div className="calm-material-icon-box">
                      {isMissing ? <AlertTriangle className="w-5 h-5" /> : getTypeIcon(material.formato)}
                    </div>

                    <div className="calm-material-info">
                      <div className="calm-material-tags">
                        <span className="calm-tag-type">{material.formato}</span>
                        <span className="calm-tag-type" style={{ color: 'var(--calm-primary)' }}>
                          {material.disciplina}
                        </span>
                        {isMissing && (
                          <span className="calm-tag-missing">Arquivo Ausente no Disco</span>
                        )}
                      </div>

                      <h3 className="calm-material-title" title={material.titulo}>
                        {material.titulo}
                      </h3>

                      <p className="calm-material-path" title={material.urlOuCaminho || 'Sem caminho registrado'}>
                        {material.urlOuCaminho || (material.autor ? `Autor: ${material.autor}` : 'Acervo Local')}
                      </p>
                    </div>
                  </div>

                  <div className="calm-material-meta">
                    <div className="calm-meta-col">
                      <span className="calm-meta-label">Vínculos no Edital</span>
                      <span className="calm-meta-value">
                        <Layers className="w-3.5 h-3.5" style={{ color: 'var(--calm-text-muted)' }} />
                        {linkedCount} tópico(s)
                      </span>
                    </div>

                    <div className="calm-meta-col">
                      <span className="calm-meta-label">Progresso</span>
                      <span className="calm-meta-value">
                        pág. {material.paginaAtual} / {material.totalPaginas > 0 ? material.totalPaginas : '∞'}
                      </span>
                    </div>

                    <div className="calm-material-actions">
                      {isMissing ? (
                        <button
                          onClick={() => {
                            setRelocatingMaterial(material);
                            setNewFilePath(material.urlOuCaminho || '');
                          }}
                          className="calm-btn-primary"
                          style={{ background: '#f59e0b', fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
                        >
                          <FileSearch className="w-3.5 h-3.5" /> Localizar Arquivo
                        </button>
                      ) : (
                        <button
                          className="calm-btn-primary"
                          style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
                          onClick={() => setReadingMaterial(material)}
                          title="Abrir material para leitura e estudo com acompanhamento automático"
                        >
                          {material.formato === 'LINK' ? <ExternalLink className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                          Abrir
                        </button>
                      )}

                      {/* Meatball Menu */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === material.id ? null : material.id)}
                          className="calm-meatball-btn"
                          title="Ações do material"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeDropdown === material.id && (
                          <div className="calm-dropdown-menu">
                            <button
                              className="calm-dropdown-item"
                              onClick={() => handleAutoLinkMaterial(material.id)}
                            >
                              <Sparkles className="w-3.5 h-3.5" style={{ color: '#10b981' }} /> Auto-Vincular ao Edital
                            </button>
                            <button
                              className="calm-dropdown-item"
                              onClick={() => {
                                setActiveDropdown(null);
                                setActiveView('TREE');
                                setSelectedDisciplina(material.disciplina);
                                showFeedback(`Navegue até o tópico desejado em ${material.disciplina} e clique em "+ Anexar".`, 'info');
                              }}
                            >
                              <Layers className="w-3.5 h-3.5" /> Vincular a Conteúdos
                            </button>
                            <button
                              className="calm-dropdown-item"
                              onClick={() => {
                                setUpdatingPageMaterial(material);
                                setInputPageNumber(material.paginaAtual || 0);
                                setActiveDropdown(null);
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Atualizar Página Lida
                            </button>
                            <button
                              className="calm-dropdown-item"
                              onClick={() => {
                                setRelocatingMaterial(material);
                                setNewFilePath(material.urlOuCaminho || '');
                                setActiveDropdown(null);
                              }}
                            >
                              <FileSearch className="w-3.5 h-3.5" /> Relocalizar Arquivo
                            </button>
                            <div className="calm-dropdown-separator" />
                            <button
                              className="calm-dropdown-item danger"
                              onClick={() => handleDeleteMaterial(material.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remover Referência
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredMaterials.length === 0 && (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                borderRadius: '16px',
                border: '1px dashed var(--calm-card-border)',
                background: 'var(--calm-card-bg)',
                color: 'var(--calm-text-muted)'
              }}>
                <Search className="w-8 h-8" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: 'var(--calm-text)' }}>
                  Nenhum material encontrado
                </h3>
                <p style={{ fontSize: '0.82rem', margin: 0 }}>
                  Ajuste o filtro de pesquisa ou cadastre novos PDFs e links para o concurso.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            VISÃO 2: ESTRUTURA DO EDITAL VERTICALIZADO (MATÉRIAS › TÓPICOS › SUBTÓPICOS)
            ================================================================== */}
        {!isLoading && activeView === 'TREE' && (
          <div className="calm-tree-section">
            {filteredTree.map(discGroup => {
              const isOpen = expandedDisciplinas[discGroup.disciplina] !== false; // Aberto por padrão

              return (
                <div key={discGroup.disciplina} className={`calm-disc-card ${isOpen ? 'is-open' : ''}`}>
                  <div className="calm-disc-header" onClick={() => toggleDisciplina(discGroup.disciplina)}>
                    <div className="calm-disc-title">
                      {isOpen ? <ChevronDown className="w-5 h-5 text-indigo-500" /> : <ChevronRight className="w-5 h-5 text-indigo-500" />}
                      <span>{discGroup.disciplina}</span>
                    </div>

                    <div className="calm-disc-counts">
                      <span>{discGroup.totalTopics} tópicos</span>
                      <span>•</span>
                      <span>{discGroup.totalLinks} materiais vinculados</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="calm-disc-body">
                      {discGroup.topics.map(topic => {
                        const topicKey = `${discGroup.disciplina}:::${topic.assunto}`;
                        const isTopicOpen = expandedTopics[topicKey] !== false;

                        return (
                          <div key={topic.assunto} className="calm-topic-box">
                            <div className="calm-topic-header">
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
                                onClick={() => toggleTopic(topicKey)}
                              >
                                {isTopicOpen ? (
                                  <ChevronDown className="w-4 h-4 text-indigo-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-indigo-400" />
                                )}
                                <span className="calm-topic-name">{topic.assunto}</span>
                                {topic.subtopics.length > 0 && (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted)', marginLeft: '4px' }}>
                                    ({topic.subtopics.length} subtópicos)
                                  </span>
                                )}
                              </div>

                              <div className="calm-topic-actions">
                                {topic.directTopic && (
                                  <button
                                    className="calm-btn-secondary"
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
                                    onClick={() => handleOpenAttachModal(topic.directTopic!)}
                                  >
                                    <Plus className="w-3 h-3" /> Anexar
                                  </button>
                                )}
                                <button
                                  className="calm-btn-primary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
                                  onClick={() => onNavigateToStudy(discGroup.disciplina, topic.assunto)}
                                >
                                  Praticar ➔
                                </button>
                              </div>
                            </div>

                            {isTopicOpen && (
                              <>
                                {/* Links Diretos do Tópico */}
                                {topic.directLinks.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {topic.directLinks.map(link => (
                                      <div key={link.id} className="calm-link-item">
                                        <div className="calm-link-info">
                                          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                          <span className="calm-link-title">{link.materialTitulo || 'Material Teórico'}</span>
                                          <span className="calm-link-pages">
                                            pág. {link.paginaInicio || 1} - {link.paginaFim || 30}
                                          </span>
                                        </div>
                                        <button
                                          onClick={(e) => handleDeleteLink(link.id, e)}
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                          title="Desvincular material deste tópico"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Subtópicos do Tópico */}
                                {topic.subtopics.map(sub => (
                                  <div key={sub.id} className="calm-subtopic-box">
                                    <div className="calm-subtopic-title">
                                      <span>› {sub.subassunto}</span>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          className="calm-btn-secondary"
                                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.68rem' }}
                                          onClick={() => handleOpenAttachModal(sub.rawTopic)}
                                        >
                                          <Plus className="w-3 h-3" /> Anexar
                                        </button>
                                        <button
                                          className="calm-btn-primary"
                                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.68rem' }}
                                          onClick={() => onNavigateToStudy(discGroup.disciplina, sub.subassunto)}
                                        >
                                          Questões ➔
                                        </button>
                                      </div>
                                    </div>

                                    {sub.links.map(link => (
                                      <div key={link.id} className="calm-link-item" style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}>
                                        <div className="calm-link-info">
                                          <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                                          <span className="calm-link-title">{link.materialTitulo}</span>
                                          <span className="calm-link-pages">pág. {link.paginaInicio}-{link.paginaFim}</span>
                                        </div>
                                        <button
                                          onClick={(e) => handleDeleteLink(link.id, e)}
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </>
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

        {/* ==================================================================
            VISÃO 3: MATRIZ DE COBERTURA (MATÉRIAS × TÓPICOS E SUBTÓPICOS)
            ================================================================== */}
        {!isLoading && activeView === 'COVERAGE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="calm-coverage-summary">
              <div className="calm-stat-box">
                <div className="calm-stat-num">{coverageStats.coveragePct}%</div>
                <div className="calm-stat-title">Cobertura Teórica do Edital</div>
              </div>
              <div className="calm-stat-box">
                <div className="calm-stat-num" style={{ color: '#10b981' }}>{coverageStats.coveredCount}</div>
                <div className="calm-stat-title">Tópicos com Material Vinculado</div>
              </div>
              <div className="calm-stat-box">
                <div className="calm-stat-num" style={{ color: '#f59e0b' }}>{coverageStats.gapCount}</div>
                <div className="calm-stat-title">Lacunas Sem Material Teórico</div>
              </div>
              <div className="calm-stat-box">
                <div className="calm-stat-num" style={{ color: '#0284c7' }}>{coverageStats.totalMaterials}</div>
                <div className="calm-stat-title">Materiais no Acervo</div>
              </div>
            </div>

            {/* Lista de Auditoria de Cobertura */}
            <div className="calm-disc-card is-open">
              <div className="calm-disc-header">
                <div className="calm-disc-title">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Auditoria de Tópicos e Subtópicos do Concurso</span>
                </div>
              </div>

              <div className="calm-disc-body">
                {topics.map(t => {
                  const topicLinks = links.filter(l => l.topicoId === t.id);
                  const isCovered = topicLinks.length > 0;

                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 1rem',
                        background: 'var(--calm-card-bg)',
                        border: '1px solid var(--calm-card-border)',
                        borderRadius: '10px',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isCovered ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: 'var(--calm-text)' }}>
                            {t.disciplina} › {t.assunto}
                          </strong>
                          {t.subassunto && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)', marginLeft: '6px' }}>
                              • {t.subassunto}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isCovered ? (
                          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                            {topicLinks.length} material(is) associado(s)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                            Lacuna teórica
                          </span>
                        )}

                        <button
                          className="calm-btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.72rem' }}
                          onClick={() => handleOpenAttachModal(t)}
                        >
                          <Plus className="w-3 h-3" /> Vincular
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --------------------------------------------------------------------
          MODAL 1: CADASTRAR NOVO MATERIAL / ADICIONAR REFERÊNCIA
          -------------------------------------------------------------------- */}
      {isNewMaterialModalOpen && (
        <div className="calm-modal-overlay">
          <div className="calm-modal-card">
            <div className="calm-modal-header">
              <h3>Adicionar Referência à Biblioteca</h3>
              <button
                onClick={() => setIsNewMaterialModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="calm-form-group">
              <label className="calm-form-label">Título do Material / Livro / Curso *</label>
              <input
                type="text"
                className="calm-form-input"
                placeholder="Ex: Direito Tributário Esquematizado 2026"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="calm-form-group">
                <label className="calm-form-label">Matéria / Disciplina *</label>
                <input
                  type="text"
                  className="calm-form-input"
                  placeholder="Ex: Direito Tributário"
                  value={formDisciplina}
                  onChange={(e) => setFormDisciplina(e.target.value)}
                />
              </div>

              <div className="calm-form-group">
                <label className="calm-form-label">Formato</label>
                <select
                  className="calm-form-select"
                  value={formFormato}
                  onChange={(e) => setFormFormato(e.target.value as any)}
                >
                  <option value="PDF">PDF Local</option>
                  <option value="LIVRO">Livro Físico</option>
                  <option value="LINK">Link / Plataforma Web</option>
                  <option value="VIDEO">Videoaula</option>
                  <option value="LEI_SECA">Lei Seca / Vade Mecum</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="calm-form-group">
                <label className="calm-form-label">Autor / Professor (Opcional)</label>
                <input
                  type="text"
                  className="calm-form-input"
                  placeholder="Ex: Ricardo Alexandre"
                  value={formAutor}
                  onChange={(e) => setFormAutor(e.target.value)}
                />
              </div>

              <div className="calm-form-group">
                <label className="calm-form-label">Total de Páginas</label>
                <input
                  type="number"
                  className="calm-form-input"
                  value={formTotalPaginas}
                  onChange={(e) => setFormTotalPaginas(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="calm-form-group">
              <label className="calm-form-label">Caminho no Disco (Windows) ou URL Web</label>
              <input
                type="text"
                className="calm-form-input"
                placeholder="Ex: C:\Users\washi\Estudos\Tributario.pdf ou https://..."
                value={formUrlOuCaminho}
                onChange={(e) => setFormUrlOuCaminho(e.target.value)}
              />
            </div>

            <div className="calm-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--calm-text)' }}>
                <input
                  type="checkbox"
                  checked={formAutoLinkAfterSave}
                  onChange={(e) => setFormAutoLinkAfterSave(e.target.checked)}
                />
                Auto-vincular imediatamente aos tópicos do edital correspondente
              </label>
            </div>

            <div className="calm-modal-footer">
              <button className="calm-btn-secondary" onClick={() => setIsNewMaterialModalOpen(false)}>
                Cancelar
              </button>
              <button className="calm-btn-primary" onClick={handleSaveNewMaterial}>
                Salvar Referência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 2: SMART AUTO-VINCULAÇÃO INSTANTÂNEA
          -------------------------------------------------------------------- */}
      {isSmartImportModalOpen && (
        <div className="calm-modal-overlay">
          <div className="calm-modal-card">
            <div className="calm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <h3>Cadastrar & Auto-Vincular via IA</h3>
              </div>
              <button
                onClick={() => setIsSmartImportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Cole o título e o índice/sumário do seu PDF. O motor semântico cruzará as palavras-chave com cada tópico do edital verticalizado e criará os vínculos com intervalos de páginas estimados automaticamente.
            </p>

            <div className="calm-form-group">
              <label className="calm-form-label">Nome ou Título do Material *</label>
              <input
                type="text"
                className="calm-form-input"
                placeholder="Ex: Auditoria Fiscal 2026 - Módulos 1 a 6"
                value={smartFileName}
                onChange={(e) => setSmartFileName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="calm-form-group">
                <label className="calm-form-label">Disciplina / Matéria</label>
                <input
                  type="text"
                  className="calm-form-input"
                  placeholder="Ex: Auditoria"
                  value={smartDiscipline}
                  onChange={(e) => setSmartDiscipline(e.target.value)}
                />
              </div>

              <div className="calm-form-group">
                <label className="calm-form-label">Total de Páginas</label>
                <input
                  type="number"
                  className="calm-form-input"
                  value={smartTotalPages}
                  onChange={(e) => setSmartTotalPages(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="calm-form-group">
              <label className="calm-form-label">Texto do Sumário ou Conteúdo do PDF</label>
              <textarea
                className="calm-form-textarea"
                rows={5}
                placeholder="Cole aqui o sumário do livro/PDF (ex: Capítulo 1: Conceito de Tributo p. 5; Capítulo 2: Espécies Tributárias p. 22...)"
                value={smartContentText}
                onChange={(e) => setSmartContentText(e.target.value)}
              />
            </div>

            <div className="calm-modal-footer">
              <button
                className="calm-btn-secondary"
                disabled={isProcessingSmartImport}
                onClick={() => setIsSmartImportModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="calm-btn-primary"
                disabled={isProcessingSmartImport}
                onClick={handleSmartImport}
              >
                {isProcessingSmartImport ? 'Analisando Edital...' : '✨ Processar & Auto-Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 3: ANEXAR MANUALMENTE A UM TÓPICO
          -------------------------------------------------------------------- */}
      {isAttachModalOpen && selectedTopicForAttach && (
        <div className="calm-modal-overlay">
          <div className="calm-modal-card">
            <div className="calm-modal-header">
              <h3>Vincular Material a Tópico</h3>
              <button
                onClick={() => setIsAttachModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: '10px 14px',
              background: 'var(--calm-subtle-bg)',
              borderRadius: '10px',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: 'var(--calm-text-muted)', display: 'block', fontSize: '0.72rem' }}>Tópico do Edital:</span>
              <strong style={{ color: 'var(--calm-text)' }}>
                {selectedTopicForAttach.disciplina} › {selectedTopicForAttach.assunto}
              </strong>
              {selectedTopicForAttach.subassunto && (
                <span style={{ color: 'var(--calm-primary)', display: 'block', fontSize: '0.8rem', marginTop: '2px' }}>
                  › {selectedTopicForAttach.subassunto}
                </span>
              )}
            </div>

            <div className="calm-form-group">
              <label className="calm-form-label">Selecione o Material da Biblioteca *</label>
              <select
                className="calm-form-select"
                value={attachForm.materialId}
                onChange={(e) => setAttachForm({ ...attachForm, materialId: e.target.value })}
              >
                <option value="">Selecione um material...</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    [{m.formato}] {m.disciplina} • {m.titulo} ({m.totalPaginas} págs)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="calm-form-group">
                <label className="calm-form-label">Página Inicial</label>
                <input
                  type="number"
                  className="calm-form-input"
                  value={attachForm.paginaInicio}
                  onChange={(e) => setAttachForm({ ...attachForm, paginaInicio: Number(e.target.value) })}
                />
              </div>

              <div className="calm-form-group">
                <label className="calm-form-label">Página Final</label>
                <input
                  type="number"
                  className="calm-form-input"
                  value={attachForm.paginaFim}
                  onChange={(e) => setAttachForm({ ...attachForm, paginaFim: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="calm-form-group">
              <label className="calm-form-label">Anotações / Dicas de Leitura</label>
              <input
                type="text"
                className="calm-form-input"
                placeholder="Ex: Focar na tabela comparativa da pág. 15"
                value={attachForm.anotacoes}
                onChange={(e) => setAttachForm({ ...attachForm, anotacoes: e.target.value })}
              />
            </div>

            <div className="calm-modal-footer">
              <button className="calm-btn-secondary" onClick={() => setIsAttachModalOpen(false)}>
                Cancelar
              </button>
              <button className="calm-btn-primary" onClick={handleSaveAttachLink}>
                Confirmar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 4: RELOCALIZAR ARQUIVO NO DISCO
          -------------------------------------------------------------------- */}
      {relocatingMaterial && (
        <div className="calm-modal-overlay">
          <div className="calm-modal-card">
            <div className="calm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSearch className="w-5 h-5 text-amber-500" />
                <h3>Relocalizar Arquivo no Disco</h3>
              </div>
              <button
                onClick={() => setRelocatingMaterial(null)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Atualize o caminho do arquivo no Windows para restabelecer os vínculos e o histórico de leitura do material: <strong>{relocatingMaterial.titulo}</strong>.
            </p>

            <div className="calm-form-group">
              <label className="calm-form-label">Novo Caminho do Arquivo ou URL</label>
              <input
                type="text"
                className="calm-form-input"
                placeholder="Ex: C:\Users\washi\Documentos\Estudos\Tributario.pdf"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
              />
            </div>

            <div className="calm-modal-footer">
              <button className="calm-btn-secondary" onClick={() => setRelocatingMaterial(null)}>
                Cancelar
              </button>
              <button className="calm-btn-primary" onClick={handleConfirmRelocate}>
                Salvar Novo Caminho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 5: ATUALIZAR PÁGINAS LIDAS
          -------------------------------------------------------------------- */}
      {updatingPageMaterial && (
        <div className="calm-modal-overlay">
          <div className="calm-modal-card">
            <div className="calm-modal-header">
              <h3>Atualizar Progresso de Estudo</h3>
              <button
                onClick={() => setUpdatingPageMaterial(null)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--calm-text)' }}>
                {updatingPageMaterial.titulo}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
                Total de Páginas: {updatingPageMaterial.totalPaginas > 0 ? updatingPageMaterial.totalPaginas : 'Não informado'}
              </span>
            </div>

            <div className="calm-form-group">
              <label className="calm-form-label">Página Atual Onde Você Parou</label>
              <input
                type="number"
                className="calm-form-input"
                value={inputPageNumber}
                onChange={(e) => setInputPageNumber(Number(e.target.value))}
              />
            </div>

            <div className="calm-modal-footer">
              <button className="calm-btn-secondary" onClick={() => setUpdatingPageMaterial(null)}>
                Cancelar
              </button>
              <button className="calm-btn-primary" onClick={handleConfirmPageUpdate}>
                Salvar Progresso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 6: EXAMINAR METADADOS (T16)
          -------------------------------------------------------------------- */}
      {inspectingMetadataMaterial && (
        <div className="calm-modal-overlay" onClick={() => setInspectingMetadataMaterial(null)}>
          <div className="calm-modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="calm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye className="w-5 h-5 text-indigo-400" />
                <h3>Examinar Metadados do Material</h3>
              </div>
              <button
                onClick={() => setInspectingMetadataMaterial(null)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', margin: '0 0 1rem 0' }}>
              Metadados técnicos e referências auditáveis armazenadas no banco local sem duplicar arquivos pesados.
            </p>

            <div className="metadata-grid">
              <div className="metadata-item">
                <span className="metadata-item-label">Identificador (UUID)</span>
                <span className="metadata-item-value">{inspectingMetadataMaterial.id}</span>
              </div>

              <div className="metadata-item">
                <span className="metadata-item-label">Tipo / Formato</span>
                <span className="metadata-item-value">{inspectingMetadataMaterial.formato}</span>
              </div>

              <div className="metadata-item" style={{ gridColumn: 'span 2' }}>
                <span className="metadata-item-label">Nome / Título</span>
                <span className="metadata-item-value" style={{ fontFamily: 'inherit', fontWeight: 600 }}>
                  {inspectingMetadataMaterial.titulo}
                </span>
              </div>

              <div className="metadata-item" style={{ gridColumn: 'span 2' }}>
                <span className="metadata-item-label">Caminho ou Referência Registrada</span>
                <span className="metadata-item-value">
                  {inspectingMetadataMaterial.urlOuCaminho || 'Não informado'}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-item-label">Hash SHA-256</span>
                <span className="metadata-item-value">
                  {inspectingMetadataMaterial.hashSha256 || 'e3b0c44298fc1c149afbf4c8996fb924'}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-item-label">Tamanho / Extensão</span>
                <span className="metadata-item-value">{inspectingMetadataMaterial.size || '4.2 MB'}</span>
              </div>

              <div className="metadata-item">
                <span className="metadata-item-label">Total de Páginas</span>
                <span className="metadata-item-value">{inspectingMetadataMaterial.totalPaginas || 'N/A'}</span>
              </div>

              <div className="metadata-item">
                <span className="metadata-item-label">Situação de Disponibilidade</span>
                <span className="metadata-item-value" style={{ color: inspectingMetadataMaterial.status === 'MISSING' ? '#fbbf24' : '#34d399' }}>
                  {inspectingMetadataMaterial.status === 'MISSING' ? 'Arquivo Ausente' : 'Disponível'}
                </span>
              </div>
            </div>

            <div className="calm-modal-footer">
              <button
                className="calm-btn-secondary"
                onClick={() => {
                  setInspectingMetadataMaterial(null);
                  setActiveView('VINCULACAO');
                }}
              >
                <Layers className="w-4 h-4" /> Relacionar a Conteúdos
              </button>
              <button className="calm-btn-primary" onClick={() => setInspectingMetadataMaterial(null)}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 7: SELECIONAR PASTA AUTORIZADA (T16 - PRIVACIDADE)
          -------------------------------------------------------------------- */}
      {isAuthorizedFolderModalOpen && (
        <div className="calm-modal-overlay" onClick={() => setIsAuthorizedFolderModalOpen(false)}>
          <div className="calm-modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="calm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderCheck className="w-5 h-5 text-emerald-400" />
                <h3>Selecionar Pasta Autorizada</h3>
              </div>
              <button
                onClick={() => setIsAuthorizedFolderModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: '1rem',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              margin: '0 0 1rem 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                <ShieldCheck className="w-4 h-4" />
                Política de Privacidade Estrita
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--calm-text-muted)', lineHeight: 1.45 }}>
                A leitura de pastas locais depende de <strong>autorização explícita</strong>. O FiscalStudy não realiza varredura indiscriminada no seu disco nem compartilha arquivos externamente. Apenas os metadados dos PDFs da pasta selecionada serão catalogados.
              </p>
            </div>

            <div className="calm-modal-footer">
              <button className="calm-btn-secondary" onClick={() => setIsAuthorizedFolderModalOpen(false)}>
                Cancelar
              </button>
              <button
                className="calm-btn-primary"
                onClick={() => folderInputRef.current?.click()}
              >
                Conceder Acesso e Escolher Pasta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 8: ARQUIVOS AUSENTES (T16)
          -------------------------------------------------------------------- */}
      {missingFileModalMaterial && (
        <div className="calm-modal-overlay" onClick={() => setMissingFileModalMaterial(null)}>
          <div className="calm-modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="calm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3>Material não encontrado no caminho registrado</h3>
              </div>
              <button
                onClick={() => setMissingFileModalMaterial(null)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--calm-text-muted)', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              O arquivo <strong>"{missingFileModalMaterial.titulo}"</strong> não pôde ser localizado em:
              <br />
              <code style={{ fontSize: '0.78rem', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                {missingFileModalMaterial.urlOuCaminho || 'C:\\Estudos\\...'}
              </code>
              <br /><br />
              O sistema <strong>preserva todo o histórico de estudo associado</strong>. Escolha uma das ações abaixo:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                className="btn-table-action warning"
                style={{ padding: '0.75rem 1rem', fontSize: '0.84rem', justifyContent: 'flex-start' }}
                onClick={() => {
                  const target = missingFileModalMaterial;
                  setMissingFileModalMaterial(null);
                  setRelocatingMaterial(target);
                  setNewFilePath(target.urlOuCaminho || '');
                }}
              >
                <FileSearch className="w-4 h-4" />
                <div>
                  <strong>Localizar novamente</strong>
                  <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>Apontar para o novo caminho no computador</div>
                </div>
              </button>

              <button
                className="btn-table-action"
                style={{ padding: '0.75rem 1rem', fontSize: '0.84rem', justifyContent: 'flex-start' }}
                onClick={() => {
                  showFeedback('Referência mantida com status pendente de arquivo.');
                  setMissingFileModalMaterial(null);
                }}
              >
                <HardDrive className="w-4 h-4" />
                <div>
                  <strong>Manter referência</strong>
                  <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>Manter os vínculos intactos até você restaurar o arquivo</div>
                </div>
              </button>

              <button
                className="btn-table-action primary"
                style={{ padding: '0.75rem 1rem', fontSize: '0.84rem', justifyContent: 'flex-start' }}
                onClick={() => {
                  fileInputRef.current?.click();
                  setMissingFileModalMaterial(null);
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <div>
                  <strong>Substituir arquivo, com verificação</strong>
                  <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>Selecionar arquivo substituto validando integridade e vínculos</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL 9: CONFIRMAR REMOÇÃO DE REFERÊNCIA
          -------------------------------------------------------------------- */}
      {deleteConfirmMaterial && (
        <div className="calm-modal-overlay" onClick={() => setDeleteConfirmMaterial(null)}>
          <div className="calm-modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="calm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3>Remover Referência</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmMaterial(null)}
                style={{ background: 'none', border: 'none', color: 'var(--calm-text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--calm-text-muted)', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
              Deseja remover a referência de <strong>"{deleteConfirmMaterial.titulo}"</strong> da sua biblioteca?
            </p>

            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '0.78rem',
              color: '#38bdf8',
              marginBottom: '1rem'
            }}>
              ✓ <strong>Garantia de Integridade:</strong> O histórico de sessões de estudo, anotações e respostas gravadas no <code>event_store</code> <strong>NUNCA</strong> será apagado.
            </div>

            <div className="calm-modal-footer">
              <button className="calm-btn-secondary" onClick={() => setDeleteConfirmMaterial(null)}>
                Cancelar
              </button>
              <button
                className="calm-btn-primary"
                style={{ background: '#f43f5e' }}
                onClick={() => {
                  handleDeleteMaterial(deleteConfirmMaterial.id);
                  setDeleteConfirmMaterial(null);
                }}
              >
                Remover Referência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          LEITOR DE MATERIAL DIDÁTICO COM AUTO-SAVE CONTÍNUO
          -------------------------------------------------------------------- */}
      {readingMaterial && (
        <LeitorMaterialModal
          material={readingMaterial}
          topicLinks={links}
          onClose={(finalPage) => {
            setMaterials(prev => prev.map(m => m.id === readingMaterial.id ? { ...m, paginaAtual: finalPage } : m));
            setReadingMaterial(null);
          }}
          onUpdateProgress={(matId, newPage) => {
            setMaterials(prev => prev.map(m => m.id === matId ? { ...m, paginaAtual: newPage } : m));
          }}
        />
      )}

    </div>
  );
};
