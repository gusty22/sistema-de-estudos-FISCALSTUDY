import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  ChevronDown,
  AlertTriangle,
  Upload
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './AssistenteObjetivoWizard.css';

// ============================================================================
// TIPOS E MODELOS DO MÓDULO A
// ============================================================================
export type ObjetivoTipo = 'CONCURSO' | 'VESTIBULAR' | 'CERTIFICACAO' | 'CURSO' | 'LIVRE';
export type DataAvaliacaoTipo = 'OFICIAL' | 'ESTIMADA' | 'DESCONHECIDA';
export type PrioridadeObjetivo = 'ALTA' | 'NORMAL' | 'BAIXA';
export type CurriculumStatus = 'IMPORTADO' | 'ESTRUTURALMENTE_VALIDO' | 'REVISADO_PELO_USUARIO' | 'CONFERIDO_CONTRA_FONTE';

export interface CurriculumNode {
  id: string;
  parentId?: string;
  title: string;
  level: 'DISCIPLINA' | 'UNIDADE' | 'TOPICO' | 'SUBTOPICO';
  description?: string;
  sourceText?: string;
  weight: number;
  prerequisites: string[];
  active: boolean;
  children?: CurriculumNode[];
}

export type FamiliarityLevel =
  | 'NUNCA_ESTUDEI'
  | 'JA_CONTATO'
  | 'RESOLVO_ALGUMAS'
  | 'BOM_DOMINIO'
  | 'NAO_INFORMAR';

export interface AssistenteObjetivoWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onObjectiveCreated?: (concurso: ConcursoItem) => void;
  onConcursoCreated?: (concurso: ConcursoItem) => void;
  initialData?: ConcursoItem | null;
}

const WIZARD_STEPS = [
  { id: 'T02', label: '1. Objetivo' },
  { id: 'T03', label: '2. Currículo' },
  { id: 'T04', label: '3. Diagnóstico' },
  { id: 'T05', label: '4. Rotina' },
  { id: 'T06', label: '5. Confirmação' }
];

const DEFAULT_CURRICULUM_TEMPLATE: CurriculumNode[] = [
  {
    id: 'node_d1',
    title: 'Direito Tributário',
    level: 'DISCIPLINA',
    weight: 3,
    prerequisites: [],
    active: true,
    children: [
      {
        id: 'node_t1',
        parentId: 'node_d1',
        title: 'Sistema Tributário Nacional',
        level: 'TOPICO',
        weight: 3,
        prerequisites: [],
        active: true,
        children: [
          {
            id: 'node_st1',
            parentId: 'node_t1',
            title: 'Competência Tributária',
            level: 'SUBTOPICO',
            weight: 3,
            prerequisites: [],
            active: true
          },
          {
            id: 'node_st2',
            parentId: 'node_t1',
            title: 'Limitações Constitucionais ao Poder de Tributar',
            level: 'SUBTOPICO',
            weight: 3,
            prerequisites: ['node_st1'],
            active: true
          }
        ]
      },
      {
        id: 'node_t2',
        parentId: 'node_d1',
        title: 'Crédito Tributário',
        level: 'TOPICO',
        weight: 3,
        prerequisites: [],
        active: true,
        children: [
          {
            id: 'node_st3',
            parentId: 'node_t2',
            title: 'Lançamento e Modalidades',
            level: 'SUBTOPICO',
            weight: 3,
            prerequisites: [],
            active: true
          },
          {
            id: 'node_st4',
            parentId: 'node_t2',
            title: 'Suspensão e Extinção do Crédito',
            level: 'SUBTOPICO',
            weight: 3,
            prerequisites: ['node_st3'],
            active: true
          }
        ]
      }
    ]
  },
  {
    id: 'node_d2',
    title: 'Língua Portuguesa',
    level: 'DISCIPLINA',
    weight: 2,
    prerequisites: [],
    active: true,
    children: [
      {
        id: 'node_t3',
        parentId: 'node_d2',
        title: 'Morfossintaxe',
        level: 'TOPICO',
        weight: 2,
        prerequisites: [],
        active: true,
        children: [
          {
            id: 'node_st5',
            parentId: 'node_t3',
            title: 'Classes de Palavras e Concordância',
            level: 'SUBTOPICO',
            weight: 2,
            prerequisites: [],
            active: true
          }
        ]
      }
    ]
  }
];

export default function AssistenteObjetivoWizard({
  isOpen,
  onClose,
  onObjectiveCreated,
  onConcursoCreated,
  initialData
}: AssistenteObjetivoWizardProps) {
  // 1. Tema Paper / Night
  const [theme] = useState<'paper' | 'night'>(() => {
    return (localStorage.getItem('fiscalstudy_theme') as 'paper' | 'night') || 'paper';
  });

  // 2. Passo Atual (T02 a T06)
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = WIZARD_STEPS[currentStepIndex];

  // 3. T02: Estado do Objetivo
  const [objectiveForm, setObjectiveForm] = useState({
    nome: initialData?.nome || '',
    tipo: 'CONCURSO' as ObjetivoTipo,
    instituicao: initialData?.orgao || '',
    cargo: initialData?.cargo || '',
    banca: initialData?.banca || '',
    dataAvaliacao: initialData?.dataProva || '',
    dataTipo: 'ESTIMADA' as DataAvaliacaoTipo,
    fonteOficial: initialData?.linkEdital || '',
    prioridade: 'ALTA' as PrioridadeObjetivo,
    descricao: initialData?.descricao || ''
  });

  // 4. T03: Árvore Curricular e Edição
  const [curriculumTree, setCurriculumTree] = useState<CurriculumNode[]>(DEFAULT_CURRICULUM_TEMPLATE);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node_st1');
  const [curriculumStatus, setCurriculumStatus] = useState<CurriculumStatus>('ESTRUTURALMENTE_VALIDO');

  // 5. T04: Diagnóstico Inicial Autodeclarado (SELF_REPORTED)
  const [diagnosticMap, setDiagnosticMap] = useState<Record<string, FamiliarityLevel>>({
    'Direito Tributário': 'RESOLVO_ALGUMAS',
    'Língua Portuguesa': 'BOM_DOMINIO'
  });

  // 6. T05: Rotina e Disponibilidade Semanal
  const [routineDays, setRoutineDays] = useState([
    { id: 'SEG', label: 'Seg', hours: 3, shifts: ['NOITE'] },
    { id: 'TER', label: 'Ter', hours: 3, shifts: ['NOITE'] },
    { id: 'QUA', label: 'Qua', hours: 3, shifts: ['NOITE'] },
    { id: 'QUI', label: 'Qui', hours: 3, shifts: ['NOITE'] },
    { id: 'SEX', label: 'Sex', hours: 2, shifts: ['NOITE'] },
    { id: 'SAB', label: 'Sáb', hours: 5, shifts: ['MANHA', 'TARDE'] },
    { id: 'DOM', label: 'Dom', hours: 0, shifts: [] } // Folga
  ]);
  const [sessionFocusDuration, setSessionFocusDuration] = useState<number>(50); // 50 min

  // Loading de submissão
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);


  // Helpers de Árvore Curricular
  const findNode = (nodes: CurriculumNode[], id: string): CurriculumNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = useMemo(() => {
    return findNode(curriculumTree, selectedNodeId);
  }, [curriculumTree, selectedNodeId]);

  // Lista linear de disciplinas cadastradas
  const disciplinesList = useMemo(() => {
    return curriculumTree.map((d) => d.title);
  }, [curriculumTree]);

  // Contagem de tópicos totais
  const totalTopicsCount = useMemo(() => {
    let count = 0;
    const countNodes = (nodes: CurriculumNode[]) => {
      nodes.forEach((n) => {
        if (n.level === 'TOPICO' || n.level === 'SUBTOPICO') count++;
        if (n.children) countNodes(n.children);
      });
    };
    countNodes(curriculumTree);
    return count;
  }, [curriculumTree]);

  // Total de horas semanais da rotina
  const weeklyHoursTotal = useMemo(() => {
    return routineDays.reduce((acc, d) => acc + d.hours, 0);
  }, [routineDays]);

  // Handlers de Navegação
  const canGoNext = () => {
    if (currentStepIndex === 0) {
      return objectiveForm.nome.trim().length >= 3;
    }
    if (currentStepIndex === 1) {
      return curriculumTree.length > 0;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleFinalizePlan();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Submissão Final do Planejamento
  const handleFinalizePlan = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      nome: objectiveForm.nome,
      orgao: objectiveForm.instituicao || 'Planejamento Geral',
      cargo: objectiveForm.cargo || objectiveForm.tipo,
      banca: objectiveForm.banca || 'Própria',
      ano: new Date().getFullYear(),
      situacao: objectiveForm.dataTipo === 'OFICIAL' ? 'EDITAL_PUBLICADO' : 'PREVISTO',
      dataProva: objectiveForm.dataAvaliacao || null,
      dataProvaTipo: objectiveForm.dataTipo,
      linkEdital: objectiveForm.fonteOficial || null,
      descricao: objectiveForm.descricao || `Objetivo do tipo ${objectiveForm.tipo} com ${totalTopicsCount} tópicos.`
    };

    try {
      const res = await fetch('/api/v1/concursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Falha ao cadastrar o objetivo no servidor.');
      }

      const createdConcurso: ConcursoItem = await res.json();
      if (onObjectiveCreated) onObjectiveCreated(createdConcurso);
      if (onConcursoCreated) onConcursoCreated(createdConcurso);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Erro inesperado ao salvar objetivo.');
      setIsSubmitting(false);
    }
  };

  // Handlers do Editor de Currículo
  const handleAddChildNode = (parentId: string) => {
    const parent = findNode(curriculumTree, parentId);
    if (!parent) return;

    const newId = `node_${Date.now()}`;
    const newLevel: 'TOPICO' | 'SUBTOPICO' = parent.level === 'DISCIPLINA' ? 'TOPICO' : 'SUBTOPICO';
    const newNode: CurriculumNode = {
      id: newId,
      parentId,
      title: `Novo ${newLevel === 'TOPICO' ? 'Tópico' : 'Subtópico'}`,
      level: newLevel,
      weight: parent.weight || 2,
      prerequisites: [],
      active: true
    };

    const updateTree = (nodes: CurriculumNode[]): CurriculumNode[] => {
      return nodes.map((n) => {
        if (n.id === parentId) {
          return {
            ...n,
            children: [...(n.children || []), newNode]
          };
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) };
        }
        return n;
      });
    };

    setCurriculumTree(updateTree(curriculumTree));
    setSelectedNodeId(newId);
    setCurriculumStatus('REVISADO_PELO_USUARIO');
  };

  const handleUpdateSelectedNode = (field: keyof CurriculumNode, value: any) => {
    if (!selectedNodeId) return;

    const updateTree = (nodes: CurriculumNode[]): CurriculumNode[] => {
      return nodes.map((n) => {
        if (n.id === selectedNodeId) {
          return { ...n, [field]: value };
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) };
        }
        return n;
      });
    };

    setCurriculumTree(updateTree(curriculumTree));
    setCurriculumStatus('REVISADO_PELO_USUARIO');
  };

  // Render da Árvore Recursiva
  const renderTreeNodes = (nodes: CurriculumNode[], depth = 0) => {
    return nodes.map((node) => {
      const isSelected = selectedNodeId === node.id;

      return (
        <div key={node.id} className="w-full">
          <div
            onClick={() => setSelectedNodeId(node.id)}
            className={`curriculum-tree-node ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          >
            {node.children && node.children.length > 0 ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 shrink-0" />
            )}

            <span className="truncate flex-1">{node.title}</span>

            <span className="text-[10px] font-medium opacity-60 uppercase">
              {node.level}
            </span>
          </div>

          {node.children && node.children.length > 0 && (
            <div>{renderTreeNodes(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const handleImportJsonFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            setCurriculumTree(parsed);
            setCurriculumStatus('IMPORTADO');
          } else {
            alert('O JSON deve ser uma lista de nós no formato CurriculumNode[].');
          }
        } catch {
          alert('JSON inválido ou corrompido.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (!isOpen) return null;

  return (
    <div className="wizard-calm-backdrop animate-fadeIn">
      <div className={`wizard-calm-modal theme-${theme}`}>
        {/* HEADER & STEPPER */}
        <header className="wizard-calm-header">
          <div className="wizard-stepper">
            {WIZARD_STEPS.map((s, idx) => (
              <div
                key={s.id}
                className={`wizard-step-pill ${
                  idx === currentStepIndex
                    ? 'active'
                    : idx < currentStepIndex
                    ? 'completed'
                    : ''
                }`}
              >
                {idx < currentStepIndex ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span>{idx + 1}.</span>
                )}
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="wizard-close-btn"
            title="Fechar assistente"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* CORPO DO PASSO ATUAL */}
        <div className="wizard-calm-body">
          {submitError && (
            <div className="p-4 mb-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* ================================================================
              T02 — CADASTRO DE OBJETIVO
              ================================================================ */}
          {currentStep.id === 'T02' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="wizard-section-heading">
                <span className="wizard-section-tag">Passo 1 de 5</span>
                <h2 className="wizard-section-title">Defina seu Objetivo</h2>
                <p className="wizard-section-desc">
                  Uma unidade de planejamento independente. Pode ser um concurso fiscal,
                  certificação, vestibular ou disciplina livre.
                </p>
              </div>

              <div className="wizard-form-grid two-cols">
                <div className="wizard-form-group">
                  <label className="wizard-label">Nome do Objetivo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Auditor Fiscal Municipal, Certificação AWS..."
                    value={objectiveForm.nome}
                    onChange={(e) =>
                      setObjectiveForm({ ...objectiveForm, nome: e.target.value })
                    }
                    className="wizard-input"
                  />
                </div>

                <div className="wizard-form-group">
                  <label className="wizard-label">Tipo de Objetivo *</label>
                  <select
                    value={objectiveForm.tipo}
                    onChange={(e) =>
                      setObjectiveForm({
                        ...objectiveForm,
                        tipo: e.target.value as ObjetivoTipo
                      })
                    }
                    className="wizard-select"
                  >
                    <option value="CONCURSO">Concurso Público</option>
                    <option value="CERTIFICACAO">Certificação Profissional</option>
                    <option value="VESTIBULAR">Vestibular / ENEM</option>
                    <option value="CURSO">Curso ou Especialização</option>
                    <option value="LIVRE">Estudo Livre / Universitário</option>
                  </select>
                </div>
              </div>

              <div className="wizard-form-grid two-cols">
                <div className="wizard-form-group">
                  <label className="wizard-label">Instituição ou Organizador</label>
                  <input
                    type="text"
                    placeholder="Ex: Prefeitura Municipal, SEFAZ, Amazon, USP..."
                    value={objectiveForm.instituicao}
                    onChange={(e) =>
                      setObjectiveForm({
                        ...objectiveForm,
                        instituicao: e.target.value
                      })
                    }
                    className="wizard-input"
                  />
                </div>

                {objectiveForm.tipo === 'CONCURSO' ? (
                  <div className="wizard-form-group">
                    <label className="wizard-label">Cargo ou Área</label>
                    <input
                      type="text"
                      placeholder="Ex: Auditor Tributário, Analista de TI..."
                      value={objectiveForm.cargo}
                      onChange={(e) =>
                        setObjectiveForm({ ...objectiveForm, cargo: e.target.value })
                      }
                      className="wizard-input"
                    />
                  </div>
                ) : (
                  <div className="wizard-form-group">
                    <label className="wizard-label">Banca / Examinadora</label>
                    <input
                      type="text"
                      placeholder="Ex: FGV, Cebraspe, FCC ou Própria..."
                      value={objectiveForm.banca}
                      onChange={(e) =>
                        setObjectiveForm({ ...objectiveForm, banca: e.target.value })
                      }
                      className="wizard-input"
                    />
                  </div>
                )}
              </div>

              <div className="wizard-form-grid two-cols">
                <div className="wizard-form-group">
                  <label className="wizard-label">Data da Avaliação (Opcional)</label>
                  <input
                    type="date"
                    value={objectiveForm.dataAvaliacao}
                    onChange={(e) =>
                      setObjectiveForm({
                        ...objectiveForm,
                        dataAvaliacao: e.target.value
                      })
                    }
                    className="wizard-input"
                  />
                </div>

                <div className="wizard-form-group">
                  <label className="wizard-label">Classificação da Data</label>
                  <select
                    value={objectiveForm.dataTipo}
                    onChange={(e) =>
                      setObjectiveForm({
                        ...objectiveForm,
                        dataTipo: e.target.value as DataAvaliacaoTipo
                      })
                    }
                    className="wizard-select"
                  >
                    <option value="OFICIAL">Data Oficial (Edital publicado)</option>
                    <option value="ESTIMADA">Data Estimada (Previsão)</option>
                    <option value="DESCONHECIDA">Sem data definida (Horizonte flexível)</option>
                  </select>
                </div>
              </div>

              <div className="wizard-form-group">
                <label className="wizard-label">Fonte Oficial ou Link do Edital (Opcional)</label>
                <input
                  type="text"
                  placeholder="https://... ou Diário Oficial"
                  value={objectiveForm.fonteOficial}
                  onChange={(e) =>
                    setObjectiveForm({ ...objectiveForm, fonteOficial: e.target.value })
                  }
                  className="wizard-input"
                />
              </div>
            </div>
          )}

          {/* ================================================================
              T03 — IMPORTAÇÃO E EDIÇÃO DO CURRÍCULO
              ================================================================ */}
          {currentStep.id === 'T03' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="wizard-section-heading">
                <span className="wizard-section-tag">Passo 2 de 5</span>
                <h2 className="wizard-section-title">Estrutura Curricular</h2>
                <p className="wizard-section-desc">
                  Transforme o programa de estudos em uma árvore navegável com
                  identificadores estáveis e pesos pedagógicos.
                </p>
              </div>

              {/* Barra de Ações Rápidas de Currículo */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 dark:border-[#26282B] bg-stone-50 dark:bg-[#111214]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-stone-500">
                    Status:
                  </span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {curriculumStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurriculumTree(DEFAULT_CURRICULUM_TEMPLATE)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 transition"
                  >
                    Usar Modelo Padrão
                  </button>
                  <button
                    type="button"
                    onClick={handleImportJsonFile}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:opacity-85 transition flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Importar JSON
                  </button>
                </div>
              </div>

              {/* Editor Dividido (Árvore à Esquerda + Detalhes à Direita) */}
              <div className="curriculum-editor-split">
                {/* Lado Esquerdo: Árvore */}
                <div className="curriculum-tree-pane">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-200 dark:border-[#26282B]">
                    <span className="text-xs font-bold uppercase text-stone-500">
                      Árvore de Conteúdos
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newDiscId = `node_d_${Date.now()}`;
                        setCurriculumTree([
                          ...curriculumTree,
                          {
                            id: newDiscId,
                            title: 'Nova Disciplina',
                            level: 'DISCIPLINA',
                            weight: 2,
                            prerequisites: [],
                            active: true,
                            children: []
                          }
                        ]);
                        setSelectedNodeId(newDiscId);
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Matéria
                    </button>
                  </div>

                  <div className="space-y-1">
                    {curriculumTree.length > 0 ? (
                      renderTreeNodes(curriculumTree)
                    ) : (
                      <div className="p-8 text-center text-xs text-stone-400">
                        Ainda não há conteúdos cadastrados. Importe uma estrutura ou
                        adicione a primeira disciplina.
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Detalhes do Item Selecionado */}
                <div className="curriculum-details-pane">
                  {selectedNode ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-[#26282B]">
                        <span className="text-xs font-bold uppercase text-stone-500">
                          Detalhes do Item
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 uppercase">
                          {selectedNode.level}
                        </span>
                      </div>

                      <div className="wizard-form-group">
                        <label className="wizard-label">Nome do Tópico</label>
                        <input
                          type="text"
                          value={selectedNode.title}
                          onChange={(e) =>
                            handleUpdateSelectedNode('title', e.target.value)
                          }
                          className="wizard-input"
                        />
                      </div>

                      <div className="wizard-form-group">
                        <label className="wizard-label">Peso Pedagógico</label>
                        <select
                          value={selectedNode.weight}
                          onChange={(e) =>
                            handleUpdateSelectedNode('weight', Number(e.target.value))
                          }
                          className="wizard-select"
                        >
                          <option value={1}>Peso 1 (Básico)</option>
                          <option value={2}>Peso 2 (Intermediário)</option>
                          <option value={3}>Peso 3 (Alta Importância)</option>
                        </select>
                      </div>

                      <div className="wizard-form-group">
                        <label className="wizard-label">Fonte / Trecho do Edital</label>
                        <textarea
                          placeholder="Referência oficial do edital para este tópico..."
                          value={selectedNode.sourceText || ''}
                          onChange={(e) =>
                            handleUpdateSelectedNode('sourceText', e.target.value)
                          }
                          className="wizard-textarea h-20"
                        />
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddChildNode(selectedNode.id)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Filho
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-stone-400 text-center p-6">
                      Selecione um item da árvore para editar peso, fonte e pré-requisitos.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              T04 — DIAGNÓSTICO INICIAL (SELF_REPORTED)
              ================================================================ */}
          {currentStep.id === 'T04' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="wizard-section-heading">
                <span className="wizard-section-tag">Passo 3 de 5</span>
                <h2 className="wizard-section-title">Diagnóstico Inicial de Domínio</h2>
                <p className="wizard-section-desc">
                  Informação provisória autodeclarada (<strong>SELF_REPORTED</strong>)
                  para calibrar a primeira rota, sem inventar falsas certezas.
                </p>
              </div>

              <div className="space-y-4">
                {disciplinesList.map((disc) => (
                  <div key={disc} className="diag-subject-card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{disc}</span>
                      <span className="text-[10px] font-medium text-stone-500 uppercase">
                        Autodeclaração
                      </span>
                    </div>

                    <div className="diag-options-row">
                      {[
                        { id: 'NUNCA_ESTUDEI', label: 'Nunca estudei' },
                        { id: 'JA_CONTATO', label: 'Já tive contato' },
                        { id: 'RESOLVO_ALGUMAS', label: 'Consigo resolver algumas questões' },
                        { id: 'BOM_DOMINIO', label: 'Tenho bom domínio aparente' },
                        { id: 'NAO_INFORMAR', label: 'Prefiro não informar' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setDiagnosticMap({
                              ...diagnosticMap,
                              [disc]: opt.id as FamiliarityLevel
                            })
                          }
                          className={`diag-option-pill ${
                            diagnosticMap[disc] === opt.id ? 'active' : ''
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-stone-200 dark:border-[#26282B] bg-stone-50 dark:bg-[#111214] flex items-center justify-between">
                <span className="text-xs text-stone-500">
                  Deseja testar seu nível diretamente com questões reais?
                </span>
                <button
                  type="button"
                  onClick={() => alert('Diagnóstico por questões será ativado após o primeiro plano.')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Fazer diagnóstico por questões ➔
                </button>
              </div>
            </div>
          )}

          {/* ================================================================
              T05 — ROTINA E DISPONIBILIDADE
              ================================================================ */}
          {currentStep.id === 'T05' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="wizard-section-heading">
                <span className="wizard-section-tag">Passo 4 de 5</span>
                <h2 className="wizard-section-title">Capacidade Real de Estudo</h2>
                <p className="wizard-section-desc">
                  Informe sua rotina semanal. O sistema utilizará sua disponibilidade
                  real como restrição para não gerar acúmulos impossíveis.
                </p>
              </div>

              {/* Calendário Semanal Visual */}
              <div className="routine-mini-grid">
                {routineDays.map((d, idx) => (
                  <div
                    key={d.id}
                    className={`routine-mini-day ${d.hours === 0 ? 'is-rest' : ''}`}
                  >
                    <span className="text-xs font-bold uppercase block mb-1">
                      {d.label}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={d.hours}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(12, Number(e.target.value) || 0));
                        const next = [...routineDays];
                        next[idx].hours = val;
                        setRoutineDays(next);
                      }}
                      className="w-12 text-center text-sm font-bold border rounded p-1 mx-auto block bg-stone-50 dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                    />
                    <span className="text-[10px] text-stone-500 block mt-1">
                      {d.hours === 0 ? 'Folga' : `${d.hours}h`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="wizard-form-grid two-cols">
                <div className="wizard-form-group">
                  <label className="wizard-label">Duração Máxima de Foco por Bloco</label>
                  <select
                    value={sessionFocusDuration}
                    onChange={(e) => setSessionFocusDuration(Number(e.target.value))}
                    className="wizard-select"
                  >
                    <option value={30}>30 minutos (Blocos Curtos)</option>
                    <option value={50}>50 minutos (Ideal Pomodoro)</option>
                    <option value={90}>90 minutos (Foco Estendido)</option>
                  </select>
                </div>

                <div className="wizard-form-group">
                  <label className="wizard-label">Total Disponível Calculado</label>
                  <div className="p-3 rounded-xl border border-stone-200 dark:border-[#26282B] bg-stone-50 dark:bg-[#111214] font-semibold text-sm flex items-center justify-between">
                    <span>Horas semanais estimadas:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {weeklyHoursTotal}h / semana
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              T06 — CONFIRMAÇÃO DO PLANEJAMENTO INICIAL
              ================================================================ */}
          {currentStep.id === 'T06' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="wizard-section-heading">
                <span className="wizard-section-tag">Passo 5 de 5</span>
                <h2 className="wizard-section-title">Confirmação do Planejamento</h2>
                <p className="wizard-section-desc">
                  Revise a compreensão do sistema antes de gerar seu primeiro roteiro
                  adaptativo.
                </p>
              </div>

              {/* Resumo do Objetivo */}
              <div className="p-5 rounded-2xl border border-stone-200 dark:border-[#26282B] bg-stone-50 dark:bg-[#111214] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">{objectiveForm.nome}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold uppercase">
                    {objectiveForm.tipo}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs text-stone-500">
                  <div>
                    <span className="block font-medium">Horizonte:</span>
                    <strong className="text-stone-800 dark:text-stone-200">
                      {objectiveForm.dataAvaliacao || 'Flexível / Contínuo'}
                    </strong>
                  </div>
                  <div>
                    <span className="block font-medium">Disciplinas:</span>
                    <strong className="text-stone-800 dark:text-stone-200">
                      {disciplinesList.length} cadastradas
                    </strong>
                  </div>
                  <div>
                    <span className="block font-medium">Tópicos:</span>
                    <strong className="text-stone-800 dark:text-stone-200">
                      {totalTopicsCount} itens
                    </strong>
                  </div>
                  <div>
                    <span className="block font-medium">Disponibilidade:</span>
                    <strong className="text-stone-800 dark:text-stone-200">
                      {weeklyHoursTotal}h semanais
                    </strong>
                  </div>
                </div>
              </div>

              {/* Auditoria de Qualidade da Configuração */}
              <div className="confirm-audit-grid">
                <div className="confirm-audit-card">
                  <span className="text-xs font-semibold text-stone-500">
                    Currículo
                  </span>
                  <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-4 h-4" /> Estrutura Conferida
                  </span>
                </div>

                <div className="confirm-audit-card">
                  <span className="text-xs font-semibold text-stone-500">
                    Diagnóstico
                  </span>
                  <span className="text-sm font-bold text-indigo-600 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-4 h-4" /> Informado (Self-Reported)
                  </span>
                </div>

                <div className="confirm-audit-card">
                  <span className="text-xs font-semibold text-stone-500">
                    Materiais de Estudo
                  </span>
                  <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="w-4 h-4" /> Pendente de vínculo
                  </span>
                </div>
              </div>

              {/* Alerta Inteligente */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="m-0 leading-relaxed">
                  Você ainda não vinculou materiais de estudo. O sistema organizará os
                  conteúdos e gerará a fila de atividades normalmente, mas você poderá
                  adicionar PDFs e apostilas diretamente na Biblioteca quando desejar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER COM AÇÕES */}
        <footer className="wizard-calm-footer">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || isSubmitting}
            className={`wizard-nav-btn secondary ${
              currentStepIndex === 0 ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext() || isSubmitting}
            className="wizard-nav-btn primary"
          >
            {isSubmitting ? (
              <span>Salvando objetivo...</span>
            ) : currentStepIndex === WIZARD_STEPS.length - 1 ? (
              <>
                Gerar meu planejamento <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Avançar <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
