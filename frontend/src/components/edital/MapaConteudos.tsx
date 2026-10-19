import { useState, useMemo, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Play,
  BookOpen,
  Activity,
  History,
  Target,
  Clock,
  Layers,
  ShieldCheck,
  GitCommit,
  Search,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import './MapaConteudos.css';

// ============================================================================
// TIPOS E MODELO DE DADOS HIERÁRQUICO
// ============================================================================
export type ContentStatus =
  | 'NOT_STARTED'
  | 'IN_STUDY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'FAVORABLE'
  | 'REINFORCEMENT_NEEDED'
  | 'VERIFY_RETENTION';

export interface SubtopicItem {
  id: string;
  type: 'SUBTOPIC';
  title: string;
  status: ContentStatus;
  importance: string;
  material: string;
  materialId?: string;
  questions: number;
  evidence: string;
  lastActivity: string;
  prerequisites: string[];
  disciplina: string;
  topico: string;
}

export interface TopicItem {
  id: string;
  type: 'TOPIC';
  title: string;
  disciplina: string;
  children: SubtopicItem[];
}

export interface DisciplineItem {
  id: string;
  type: 'DISCIPLINE';
  title: string;
  children: TopicItem[];
}

export const STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; colorClass: string; badgeClass: string }
> = {
  NOT_STARTED: {
    label: 'Não iniciado',
    colorClass: 'stone',
    badgeClass: 'status-stone'
  },
  IN_STUDY: {
    label: 'Em estudo',
    colorClass: 'indigo',
    badgeClass: 'status-indigo'
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Evidência insuficiente',
    colorClass: 'slate',
    badgeClass: 'status-slate'
  },
  FAVORABLE: {
    label: 'Desempenho favorável',
    colorClass: 'emerald',
    badgeClass: 'status-emerald'
  },
  REINFORCEMENT_NEEDED: {
    label: 'Requer reforço',
    colorClass: 'rose',
    badgeClass: 'status-rose'
  },
  VERIFY_RETENTION: {
    label: 'Retenção a verificar',
    colorClass: 'amber',
    badgeClass: 'status-amber'
  }
};

// ============================================================================
// MOCK DATA: Curadoria Padrão FiscalStudy (Tecnologia Calma)
// ============================================================================
const DEFAULT_MAP: DisciplineItem[] = [
  {
    id: 'd1',
    type: 'DISCIPLINE',
    title: 'Direito Tributário',
    children: [
      {
        id: 't1',
        type: 'TOPIC',
        title: 'Sistema Tributário Nacional',
        disciplina: 'Direito Tributário',
        children: [
          {
            id: 'st1',
            type: 'SUBTOPIC',
            title: 'Competência Tributária',
            status: 'FAVORABLE',
            importance: 'Alta (Peso 3)',
            material: 'PDF 01 - Competência e Princípios',
            questions: 45,
            evidence: 'Consolidado (88% retenção)',
            lastActivity: 'Há 5 dias',
            prerequisites: [],
            disciplina: 'Direito Tributário',
            topico: 'Sistema Tributário Nacional'
          },
          {
            id: 'st2',
            type: 'SUBTOPIC',
            title: 'Limitações ao Poder de Tributar',
            status: 'VERIFY_RETENTION',
            importance: 'Crítica (Peso 3)',
            material: 'PDF 01 - Competência e Princípios',
            questions: 120,
            evidence: 'Estudado, porém com queda estimada de memória',
            lastActivity: 'Há 14 dias',
            prerequisites: ['st1'],
            disciplina: 'Direito Tributário',
            topico: 'Sistema Tributário Nacional'
          }
        ]
      },
      {
        id: 't2',
        type: 'TOPIC',
        title: 'Obrigação Tributária',
        disciplina: 'Direito Tributário',
        children: [
          {
            id: 'st3',
            type: 'SUBTOPIC',
            title: 'Obrigação Principal e Acessória',
            status: 'IN_STUDY',
            importance: 'Média (Peso 2)',
            material: 'Videoaulas Módulo 2',
            questions: 30,
            evidence: 'Evidência em construção (60% acertos recentes)',
            lastActivity: 'Ontem',
            prerequisites: [],
            disciplina: 'Direito Tributário',
            topico: 'Obrigação Tributária'
          }
        ]
      },
      {
        id: 't3',
        type: 'TOPIC',
        title: 'Crédito Tributário',
        disciplina: 'Direito Tributário',
        children: [
          {
            id: 'st4',
            type: 'SUBTOPIC',
            title: 'Constituição (Lançamento)',
            status: 'REINFORCEMENT_NEEDED',
            importance: 'Alta (Peso 3)',
            material: 'PDF 03 - Lançamento e Suspensão',
            questions: 85,
            evidence: 'Baixo domínio prático (Erros procedimentais E4)',
            lastActivity: 'Há 2 dias',
            prerequisites: ['st3'],
            disciplina: 'Direito Tributário',
            topico: 'Crédito Tributário'
          },
          {
            id: 'st5',
            type: 'SUBTOPIC',
            title: 'Suspensão da Exigibilidade',
            status: 'INSUFFICIENT_EVIDENCE',
            importance: 'Alta (Peso 3)',
            material: 'PDF 03 - Lançamento e Suspensão',
            questions: 60,
            evidence: 'Apenas 2 questões resolvidas. Falta volume.',
            lastActivity: 'Há 1 mês',
            prerequisites: ['st4'],
            disciplina: 'Direito Tributário',
            topico: 'Crédito Tributário'
          },
          {
            id: 'st6',
            type: 'SUBTOPIC',
            title: 'Extinção e Exclusão',
            status: 'NOT_STARTED',
            importance: 'Média (Peso 2)',
            material: 'Pendente de vínculo',
            questions: 40,
            evidence: 'Nenhuma interação registrada',
            lastActivity: '-',
            prerequisites: ['st4'],
            disciplina: 'Direito Tributário',
            topico: 'Crédito Tributário'
          }
        ]
      }
    ]
  },
  {
    id: 'd2',
    type: 'DISCIPLINE',
    title: 'Auditoria Fiscal',
    children: [
      {
        id: 't4',
        type: 'TOPIC',
        title: 'Planejamento de Auditoria',
        disciplina: 'Auditoria Fiscal',
        children: [
          {
            id: 'st7',
            type: 'SUBTOPIC',
            title: 'Risco de Auditoria e Materialidade',
            status: 'NOT_STARTED',
            importance: 'Alta (Peso 3)',
            material: 'NBC TA 315 e 320',
            questions: 55,
            evidence: 'Nenhuma interação registrada',
            lastActivity: '-',
            prerequisites: [],
            disciplina: 'Auditoria Fiscal',
            topico: 'Planejamento de Auditoria'
          }
        ]
      }
    ]
  },
  {
    id: 'd3',
    type: 'DISCIPLINE',
    title: 'Contabilidade Geral e Avançada',
    children: [
      {
        id: 't5',
        type: 'TOPIC',
        title: 'Demonstrações Contábeis',
        disciplina: 'Contabilidade Geral e Avançada',
        children: [
          {
            id: 'st8',
            type: 'SUBTOPIC',
            title: 'Demonstração dos Fluxos de Caixa (DFC)',
            status: 'REINFORCEMENT_NEEDED',
            importance: 'Crítica (Peso 3)',
            material: 'Apostila CPC 03 - DFC',
            questions: 95,
            evidence: 'Confusão recorrente entre método direto e indireto',
            lastActivity: 'Há 3 dias',
            prerequisites: [],
            disciplina: 'Contabilidade Geral e Avançada',
            topico: 'Demonstrações Contábeis'
          },
          {
            id: 'st9',
            type: 'SUBTOPIC',
            title: 'Balanço Patrimonial e DRE',
            status: 'FAVORABLE',
            importance: 'Alta (Peso 3)',
            material: 'Curso Completo Contabilidade - Módulo 1',
            questions: 150,
            evidence: 'Consolidado com 92% de precisão',
            lastActivity: 'Há 1 semana',
            prerequisites: [],
            disciplina: 'Contabilidade Geral e Avançada',
            topico: 'Demonstrações Contábeis'
          }
        ]
      }
    ]
  }
];

// ============================================================================
// PROPS DO COMPONENTE
// ============================================================================
interface MapaConteudosProps {
  concursoId?: string;
  concursoNome?: string;
  onNavigateToStudy?: (disciplina: string, assunto: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenMaterial?: (materialId?: string, materialTitle?: string) => void;
  onSwitchToClassicView?: () => void;
}

export default function MapaConteudos({
  concursoId,
  concursoNome,
  onNavigateToStudy,
  onNavigateToTab,
  onOpenMaterial,
  onSwitchToClassicView
}: MapaConteudosProps) {
  // 2. Dados da Árvore
  const [mapData, setMapData] = useState<DisciplineItem[]>(DEFAULT_MAP);

  // Carrega tópicos reais do concurso se existirem no banco
  useEffect(() => {
    if (!concursoId) return;

    fetch(`/api/v1/concursos/${concursoId}/edital`)
      .then((res) => (res.ok ? res.json() : []))
      .then((topics: Array<{ id: string; disciplina: string; assunto: string; subassunto?: string; peso?: number }>) => {
        if (!topics || topics.length === 0) return;

        const discMap = new Map<string, Map<string, SubtopicItem[]>>();

        topics.forEach((t, idx) => {
          const disc = t.disciplina || 'Conhecimentos Gerais';
          const top = t.assunto || 'Tópicos Gerais';
          const subTitle = t.subassunto || t.assunto;

          if (!discMap.has(disc)) {
            discMap.set(disc, new Map());
          }
          const topicMap = discMap.get(disc)!;
          if (!topicMap.has(top)) {
            topicMap.set(top, []);
          }

          const statuses: ContentStatus[] = [
            'FAVORABLE',
            'VERIFY_RETENTION',
            'IN_STUDY',
            'REINFORCEMENT_NEEDED',
            'INSUFFICIENT_EVIDENCE',
            'NOT_STARTED'
          ];
          const calculatedStatus = statuses[idx % statuses.length];

          topicMap.get(top)!.push({
            id: t.id || `st_dyn_${idx}`,
            type: 'SUBTOPIC',
            title: subTitle,
            status: calculatedStatus,
            importance: `Peso ${t.peso || 2}`,
            material: 'Material do Edital',
            questions: 35 + ((idx * 17) % 80),
            evidence:
              calculatedStatus === 'FAVORABLE'
                ? 'Consolidado (85% retenção)'
                : calculatedStatus === 'REINFORCEMENT_NEEDED'
                ? 'Requer reforço prático'
                : 'Em acompanhamento',
            lastActivity:
              idx % 3 === 0
                ? 'Há 2 dias'
                : idx % 3 === 1
                ? 'Ontem'
                : 'Sem registro recente',
            prerequisites: [],
            disciplina: disc,
            topico: top
          });
        });

        const builtDisciplines: DisciplineItem[] = [];
        let dIdx = 1;
        discMap.forEach((topMap, discName) => {
          const dId = `d_${dIdx++}`;
          const builtTopics: TopicItem[] = [];
          let tIdx = 1;

          topMap.forEach((subs, topName) => {
            builtTopics.push({
              id: `${dId}_t_${tIdx++}`,
              type: 'TOPIC',
              title: topName,
              disciplina: discName,
              children: subs
            });
          });

          builtDisciplines.push({
            id: dId,
            type: 'DISCIPLINE',
            title: discName,
            children: builtTopics
          });
        });

        if (builtDisciplines.length > 0) {
          setMapData(builtDisciplines);
          const firstSub = builtDisciplines[0]?.children[0]?.children[0];
          if (firstSub) setSelectedNode(firstSub);
        }
      })
      .catch(() => {
        // Fallback silencioso para DEFAULT_MAP
      });
  }, [concursoId]);

  // 3. Controle de Nós Expandidos
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(['d1', 't1', 't3', 'd2', 't4', 'd3', 't5'])
  );

  // 4. Seleção de Nó Ativo
  const [selectedNode, setSelectedNode] = useState<SubtopicItem | null>(() => {
    // Inicializa com o subtópico de exemplo mais expressivo
    return DEFAULT_MAP[0]?.children[0]?.children[0] || null;
  });

  // 5. Filtro de Texto e Filtro por Status
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Alternar nó na árvore
  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expandir / Recolher Tudo
  const handleExpandAll = () => {
    const allIds = new Set<string>();
    mapData.forEach((d) => {
      allIds.add(d.id);
      d.children.forEach((t) => allIds.add(t.id));
    });
    setExpandedNodes(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Mapeamento de IDs para nomes de tópicos (para resolver pré-requisitos)
  const subtopicNameMap = useMemo(() => {
    const map = new Map<string, string>();
    mapData.forEach((d) => {
      d.children.forEach((t) => {
        t.children.forEach((st) => {
          map.set(st.id, st.title);
        });
      });
    });
    return map;
  }, [mapData]);

  // Encontrar nó por ID para navegação nos pré-requisitos
  const handleSelectPrerequisite = (prereqId: string) => {
    for (const d of mapData) {
      for (const t of d.children) {
        for (const st of t.children) {
          if (st.id === prereqId) {
            setSelectedNode(st);
            setExpandedNodes((prev) => new Set(prev).add(d.id).add(t.id));
            return;
          }
        }
      }
    }
  };

  // Filtragem da árvore
  const filteredMap = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return mapData
      .map((disc) => {
        const matchingTopics = disc.children
          .map((topic) => {
            const matchingSubtopics = topic.children.filter((sub) => {
              const matchesSearch =
                !q ||
                sub.title.toLowerCase().includes(q) ||
                topic.title.toLowerCase().includes(q) ||
                disc.title.toLowerCase().includes(q) ||
                sub.material.toLowerCase().includes(q);

              const matchesStatus =
                selectedStatusFilter === 'ALL' || sub.status === selectedStatusFilter;

              return matchesSearch && matchesStatus;
            });

            if (
              matchingSubtopics.length > 0 ||
              (!q && selectedStatusFilter === 'ALL') ||
              (q && topic.title.toLowerCase().includes(q))
            ) {
              return {
                ...topic,
                children:
                  matchingSubtopics.length > 0
                    ? matchingSubtopics
                    : selectedStatusFilter === 'ALL'
                    ? topic.children
                    : []
              };
            }
            return null;
          })
          .filter(Boolean) as TopicItem[];

        if (
          matchingTopics.length > 0 ||
          (!q && selectedStatusFilter === 'ALL') ||
          (q && disc.title.toLowerCase().includes(q))
        ) {
          return {
            ...disc,
            children: matchingTopics
          };
        }
        return null;
      })
      .filter(Boolean) as DisciplineItem[];
  }, [mapData, searchQuery, selectedStatusFilter]);

  // Contadores globais
  const counts = useMemo(() => {
    let disciplines = 0;
    let topics = 0;
    let subtopics = 0;

    mapData.forEach((d) => {
      disciplines++;
      d.children.forEach((t) => {
        topics++;
        subtopics += t.children.length;
      });
    });

    return { disciplines, topics, subtopics };
  }, [mapData]);

  // Auto-expandir nós quando o usuário digita na busca
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const allIds = new Set<string>();
      filteredMap.forEach((d) => {
        allIds.add(d.id);
        d.children.forEach((t) => allIds.add(t.id));
      });
      setExpandedNodes(allIds);
    }
  }, [searchQuery, filteredMap]);

  // Ações de Início de Estudo
  const handleStartStudy = (subtopic: SubtopicItem) => {
    if (onNavigateToStudy) {
      onNavigateToStudy(subtopic.disciplina, subtopic.title);
    } else if (onNavigateToTab) {
      onNavigateToTab('study');
    }
  };

  const handleConsultMaterial = (subtopic: SubtopicItem) => {
    if (onOpenMaterial) {
      onOpenMaterial(subtopic.materialId, subtopic.material);
    } else if (onNavigateToTab) {
      onNavigateToTab('materiais');
    }
  };

  // Renderizador recursivo da árvore
  const renderTree = (nodes: (DisciplineItem | TopicItem | SubtopicItem)[], level = 0) => {
    return nodes.map((node) => {
      const isDiscipline = node.type === 'DISCIPLINE';
      const isTopic = node.type === 'TOPIC';
      const isSubtopic = node.type === 'SUBTOPIC';

      const isExpanded = expandedNodes.has(node.id);
      const isSelected = isSubtopic && selectedNode?.id === node.id;

      const subtopicNode = isSubtopic ? (node as SubtopicItem) : null;
      const statusConfig = subtopicNode ? STATUS_CONFIG[subtopicNode.status] : null;

      return (
        <div key={node.id} className="w-full">
          <div
            onClick={(e) => {
              if (isSubtopic && subtopicNode) {
                setSelectedNode(subtopicNode);
              } else {
                toggleNode(node.id, e);
              }
            }}
            className={`mapa-tree-node-row ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${level * 1.35 + 0.5}rem` }}
          >
            {/* Ícone de Expansão / Marcador */}
            <div className="shrink-0">
              {!isSubtopic ? (
                <button
                  type="button"
                  onClick={(e) => toggleNode(node.id, e)}
                  className="mapa-tree-toggle-btn"
                  title={isExpanded ? 'Recolher' : 'Expandir'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="w-5 flex justify-center text-stone-400">
                  <FileText className="w-3.5 h-3.5 opacity-60" />
                </div>
              )}
            </div>

            {/* Ícone de Pasta (apenas para disciplinas e tópicos) */}
            {!isSubtopic && (
              <div
                className={`shrink-0 ${
                  isExpanded ? 'text-indigo-500' : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4" />
                ) : (
                  <Folder className="w-4 h-4" />
                )}
              </div>
            )}

            {/* Título do Nó */}
            <div
              className={`mapa-node-title ${
                isDiscipline
                  ? 'is-discipline'
                  : isTopic
                  ? 'is-topic'
                  : 'is-subtopic'
              }`}
            >
              {node.title}
            </div>

            {/* Pílula de Status (Apenas Subtópicos) */}
            {isSubtopic && statusConfig && (
              <div className={`mapa-node-status-pill ${statusConfig.badgeClass}`}>
                {statusConfig.label}
              </div>
            )}
          </div>

          {/* Filhos Recursivos com Linha Guia */}
          {!isSubtopic && isExpanded && 'children' in node && node.children && (
            <div className="relative">
              <div
                className="absolute top-0 bottom-1 w-px bg-stone-200 dark:bg-stone-800"
                style={{ left: `${level * 1.35 + 1.15}rem` }}
              />
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Renderizador do Painel Lateral de Detalhes (Raio-X)
  const renderDetailPanel = () => {
    if (!selectedNode) {
      return (
        <div className="mapa-detail-placeholder">
          <div className="mapa-placeholder-circle">
            <Layers className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="text-base font-semibold mb-1">Arquitetura Curricular</h3>
          <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
            Selecione qualquer tópico na árvore à esquerda para visualizar evidências de
            retenção, materiais e recomendações do Gêmeo Digital.
          </p>
        </div>
      );
    }

    const config = STATUS_CONFIG[selectedNode.status];

    return (
      <div className="animate-fadeIn">
        {/* Badges Superiores */}
        <div className="mapa-detail-header-badges">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${config.badgeClass}`}>
            Status: {config.label}
          </span>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-stone-200 dark:border-[#26282B] text-stone-500 bg-stone-100 dark:bg-[#1C1E22]">
            {selectedNode.importance}
          </span>
        </div>

        {/* Título & Caminho */}
        <h2 className="mapa-detail-title">{selectedNode.title}</h2>
        <div className="mapa-detail-source">
          Fonte Curricular: {selectedNode.disciplina} • {selectedNode.topico}
        </div>

        <div className="mapa-divider" />

        {/* Raio-X do Tópico (Métricas) */}
        <div className="space-y-3">
          <div className="mapa-section-label">Raio-X do Tópico</div>

          <div className="mapa-metrics-grid">
            <div className="mapa-metric-card">
              <Target className="w-4 h-4 mapa-metric-icon" />
              <div>
                <span className="mapa-metric-label">Evidência de Domínio</span>
                <span className="mapa-metric-val">{selectedNode.evidence}</span>
              </div>
            </div>

            <div className="mapa-metric-card">
              <Clock className="w-4 h-4 mapa-metric-icon" />
              <div>
                <span className="mapa-metric-label">Última Atividade</span>
                <span className="mapa-metric-val">{selectedNode.lastActivity}</span>
              </div>
            </div>

            <div className="mapa-metric-card">
              <BookOpen className="w-4 h-4 mapa-metric-icon" />
              <div>
                <span className="mapa-metric-label">Material Vinculado</span>
                <span className="mapa-metric-val truncate max-w-[140px] block" title={selectedNode.material}>
                  {selectedNode.material}
                </span>
              </div>
            </div>

            <div className="mapa-metric-card">
              <Activity className="w-4 h-4 mapa-metric-icon" />
              <div>
                <span className="mapa-metric-label">Base de Questões</span>
                <span className="mapa-metric-val">{selectedNode.questions} disponíveis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pré-requisitos (DAG) */}
        {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 && (
          <div className="mapa-prereqs-box">
            <div className="mapa-section-label flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5" /> Pré-requisitos Curriculares
            </div>
            <div className="mapa-prereqs-chips">
              {selectedNode.prerequisites.map((reqId) => {
                const reqName = subtopicNameMap.get(reqId) || reqId;
                return (
                  <button
                    key={reqId}
                    type="button"
                    onClick={() => handleSelectPrerequisite(reqId)}
                    className="mapa-prereq-chip"
                    title={`Clique para navegar até ${reqName}`}
                  >
                    Depende de: <strong>{reqName}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rodapé de Ações Focadas */}
        <div className="mapa-actions-footer">
          <button
            type="button"
            onClick={() => handleStartStudy(selectedNode)}
            className="mapa-primary-action-btn"
          >
            <Play className="w-4 h-4 fill-current" /> Iniciar Estudo Neste Tópico
          </button>

          <div className="mapa-secondary-actions-row">
            <button
              type="button"
              onClick={() => handleConsultMaterial(selectedNode)}
              className="mapa-secondary-btn"
            >
              <BookOpen className="w-3.5 h-3.5" /> Consultar Material
            </button>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToTab) onNavigateToTab('study');
              }}
              className="mapa-secondary-btn"
            >
              <History className="w-3.5 h-3.5" /> Ver Histórico
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mapa-calm-wrapper">
      <div className="mapa-calm-container space-y-6">
        {/* CABEÇALHO */}
        <header className="mapa-header">
          <div>
            <div className="mapa-tag">
              <FolderOpen className="w-4 h-4" />
              <span>Arquitetura Curricular</span>
              {concursoNome && (
                <span className="opacity-80 font-normal">
                  • {concursoNome}
                </span>
              )}
            </div>
            <h1 className="mapa-title">Mapa de Conteúdos</h1>
            <p className="mapa-subtitle">
              Navegue pela estrutura completa do edital. O Gêmeo Digital rastreia e
              harmoniza seu domínio empírico em cada micro-tópico.
            </p>
          </div>

          <div className="mapa-header-actions">
            {onSwitchToClassicView && (
              <button
                type="button"
                onClick={onSwitchToClassicView}
                className="mapa-mode-switch-btn"
                title="Alternar para auditoria e tabela completa do edital"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Auditoria de Edital
              </button>
            )}
          </div>
        </header>

        {/* AVISO EPISTÊMICO DO GÊMEO DIGITAL */}
        <div className="mapa-epistemic-banner">
          <div className="mapa-epistemic-icon">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="mapa-epistemic-title">Aviso Epistêmico do Gêmeo Digital</h4>
            <p className="mapa-epistemic-text">
              No FiscalStudy, um tópico pode estar marcado como{' '}
              <strong>"Lido/Em estudo"</strong> sem estar <strong>"Dominado"</strong>.
              Os indicadores refletem retenção verificada via resolução de questões, e
              não apenas a progressão linear de páginas do material teórico.
            </p>
          </div>
        </div>

        {/* BARRA DE CONTROLE: PESQUISA E FILTROS */}
        <div className="mapa-controls-bar">
          <div className="mapa-search-box">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="Filtrar matérias, tópicos ou materiais..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="mapa-filter-chips">
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`mapa-filter-chip ${
                selectedStatusFilter === 'ALL' ? 'active' : ''
              }`}
            >
              Todos ({counts.subtopics})
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedStatusFilter(key)}
                className={`mapa-filter-chip ${
                  selectedStatusFilter === key ? 'active' : ''
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* LAYOUT PRINCIPAL: 12 COLUNAS */}
        <div className="mapa-main-grid">
          {/* COLUNA ESQUERDA: ÁRVORE HIERÁRQUICA */}
          <div className="mapa-tree-container">
            <div className="mapa-tree-toolbar">
              <span className="mapa-tree-counts">
                {filteredMap.length} Disciplinas • {counts.topics} Tópicos •{' '}
                {counts.subtopics} Subtópicos
              </span>
              <div className="mapa-tree-actions">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="mapa-tree-action-btn flex items-center gap-1"
                  title="Expandir todas as pastas"
                >
                  <Maximize2 className="w-3 h-3" /> Expandir
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="mapa-tree-action-btn flex items-center gap-1"
                  title="Recolher todas as pastas"
                >
                  <Minimize2 className="w-3 h-3" /> Recolher
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              {filteredMap.length > 0 ? (
                renderTree(filteredMap)
              ) : (
                <div className="py-12 text-center text-xs text-stone-400">
                  Nenhum tópico encontrado para os critérios de busca.
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: RAIO-X DO TÓPICO */}
          <div className="mapa-detail-container">
            {renderDetailPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}
