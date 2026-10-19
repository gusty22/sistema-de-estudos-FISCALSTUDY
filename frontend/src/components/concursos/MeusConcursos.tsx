import { useState, useEffect } from 'react';
import AssistenteObjetivoWizard from '../onboarding/AssistenteObjetivoWizard';
import {
  Target,
  Calendar,
  Play,
  Pause,
  ArrowLeft,
  BookOpen,
  Settings,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  Layers,
  BarChart3,
  ShieldAlert,
  Brain,
  Edit3,
  Copy
} from 'lucide-react';
import './MeusConcursos.css';

export interface ConcursoItem {
  id: string;
  nome: string;
  orgao: string;
  banca: string;
  ano: number | null;
  cargo: string;
  cargoCodigo: string;
  status: string; // ACTIVE, ARCHIVED, PAUSED
  descricao?: string;
  availableQuestionsCount?: number;
  situacao?: string;
  localidade?: string;
  escolaridade?: string;
  vagas?: number | null;
  salario?: number | null;
  linkEdital?: string;
  dataProva?: string;
  dataProvaTipo?: string;
  datasImportantesJson?: string;
  disponibilidadeJson?: string;
}

interface MeusConcursosProps {
  activeConcursoId: string | null;
  onSelectConcurso: (concurso: ConcursoItem) => void;
  onNavigateToTab: (tab: any) => void;
}

export default function MeusConcursos({
  activeConcursoId,
  onSelectConcurso,
  onNavigateToTab
}: MeusConcursosProps) {
  // Visão: 'LIST' ou 'DETAIL'
  const [activeView, setActiveView] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedGoal, setSelectedGoal] = useState<ConcursoItem | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CURRICULUM' | 'MATERIALS' | 'PERFORMANCE' | 'SETTINGS'>('OVERVIEW');

  // Dados da API
  const [concursos, setConcursos] = useState<ConcursoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wizard de Cadastro / Edição
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingConcurso, setEditingConcurso] = useState<ConcursoItem | null>(null);

  // Carregar concursos do backend
  const loadConcursos = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/concursos?status=ALL');
      if (!res.ok) throw new Error(`Erro ao carregar concursos (HTTP ${res.status})`);
      const data: ConcursoItem[] = await res.json();
      setConcursos(data);

      if (!activeConcursoId && data.length > 0) {
        const firstActive = data.find((c) => c.status === 'ACTIVE') || data[0];
        onSelectConcurso(firstActive);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConcursos();
  }, []);

  const handleOpenGoal = (goal: ConcursoItem) => {
    setSelectedGoal(goal);
    setActiveTab('OVERVIEW');
    setActiveView('DETAIL');
  };

  const handleBackToList = () => {
    setActiveView('LIST');
    setTimeout(() => setSelectedGoal(null), 300);
  };

  const handleOpenCreate = () => {
    setEditingConcurso(null);
    setIsWizardOpen(true);
  };

  const handleOpenEdit = (c: ConcursoItem) => {
    setEditingConcurso(c);
    setIsWizardOpen(true);
  };

  const handleDuplicateGoal = (goal: ConcursoItem) => {
    setEditingConcurso({
      ...goal,
      id: '',
      nome: `Cópia de ${goal.nome}`
    });
    setIsWizardOpen(true);
  };

  const handleConcursoSaved = (saved: ConcursoItem) => {
    loadConcursos();
    onSelectConcurso(saved);
    if (selectedGoal && selectedGoal.id === saved.id) {
      setSelectedGoal(saved);
    }
  };

  const toggleGoalStatus = async (goalId: string) => {
    const target = concursos.find(g => g.id === goalId);
    if (!target) return;

    const isCurrentlyActive = target.status === 'ACTIVE';
    const action = isCurrentlyActive ? 'archive' : 'activate';

    // Otimismo na UI
    const nextStatus = isCurrentlyActive ? 'ARCHIVED' : 'ACTIVE';
    setConcursos(prev => prev.map(c => c.id === goalId ? { ...c, status: nextStatus } : c));
    if (selectedGoal && selectedGoal.id === goalId) {
      setSelectedGoal({ ...selectedGoal, status: nextStatus });
    }

    try {
      await fetch(`/api/v1/concursos/${goalId}/${action}`, { method: 'POST' });
    } catch {
      loadConcursos();
    }
  };

  const formatHorizonDate = (dateStr?: string) => {
    if (!dateStr) return 'Sem data oficial';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Renderização da Visão Geral em Lista (LIST VIEW)
  const renderListView = () => (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <header className="goals-header">
        <div>
          <div className="goals-tag">
            <Target className="w-4 h-4 text-indigo-500" />
            <span>Planejamento Estratégico</span>
          </div>
          <h1 className="goals-title">
            Meus Objetivos
          </h1>
          <p className="goals-subtitle">
            Gerencie múltiplos editais e metas. O Gêmeo Digital harmoniza seu progresso entre eles sem duplicar esforço.
          </p>
        </div>

        <div className="goals-header-actions">
          <button
            onClick={handleOpenCreate}
            className="goals-btn-create"
          >
            <Plus className="w-4 h-4" /> Novo Objetivo
          </button>
        </div>
      </header>

      {/* Regra de Integração Silenciosa */}
      <div className="goals-shared-banner">
        <div className="goals-shared-icon">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h4 className="goals-shared-title">Aprendizagem Compartilhada</h4>
          <p className="goals-shared-desc">
            Um mesmo conteúdo contribui para vários objetivos. O histórico de uma questão resolvida atualiza o Gêmeo Digital uma única vez, refletindo organicamente o progresso em todos os editais compatíveis.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          padding: '1rem',
          borderRadius: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          fontSize: '0.82rem'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {isLoading && concursos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--calm-text-muted)', fontSize: '0.9rem' }}>
          Carregando objetivos e editais cadastrados...
        </div>
      )}

      {/* Grid de Objetivos */}
      <div className="goals-grid">
        {concursos.map((goal, idx) => {
          const isActiveConcursoGlobal = goal.id === activeConcursoId;
          const isPaused = goal.status === 'ARCHIVED' || goal.status === 'PAUSED';
          const estimatedProgress = Math.min(85, Math.max(15, 20 + (idx * 22) % 65));

          return (
            <div
              key={goal.id}
              className={`goals-card ${isActiveConcursoGlobal ? 'is-active-concurso' : ''}`}
            >
              <div className="goals-card-body">
                <div className="goals-card-top">
                  <span className={`goals-status-badge ${!isPaused ? 'is-active' : 'is-paused'}`}>
                    {!isPaused ? (goal.situacao || 'Ativo') : 'Pausado'}
                  </span>

                  {isActiveConcursoGlobal && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--calm-primary)' }}>
                      ★ ATIVO GLOBAL
                    </span>
                  )}
                </div>

                <h3 className="goals-card-title">{goal.nome}</h3>

                <div className="goals-meta-list">
                  <div className="goals-meta-item">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>Horizonte: {formatHorizonDate(goal.dataProva)}</span>
                  </div>
                  <div className="goals-meta-item">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>Órgão / Banca: {goal.orgao} • {goal.banca || 'A definir'}</span>
                  </div>
                </div>

                <div className="goals-progress-section">
                  <div className="goals-progress-header">
                    <span style={{ color: 'var(--calm-text-muted)' }}>Cobertura do Edital</span>
                    <span>{estimatedProgress}%</span>
                  </div>
                  <div className="goals-progress-track">
                    <div
                      className="goals-progress-bar"
                      style={{ width: `${estimatedProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="goals-card-footer">
                <button
                  onClick={() => handleOpenGoal(goal)}
                  className="goals-btn-open"
                >
                  Abrir Painel
                </button>

                <button
                  onClick={() => handleDuplicateGoal(goal)}
                  title="Duplicar estrutura curricular para nova preparação"
                  className="goals-btn-icon"
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button
                  onClick={() => toggleGoalStatus(goal.id)}
                  title={!isPaused ? 'Pausar Objetivo' : 'Retomar Objetivo'}
                  className="goals-btn-icon"
                >
                  {!isPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Renderização do Painel de Detalhes (DETAIL VIEW)
  const renderDetailView = () => {
    if (!selectedGoal) return null;

    const TABS = [
      { id: 'OVERVIEW', label: 'Visão Geral', icon: Target },
      { id: 'CURRICULUM', label: 'Currículo', icon: FileText },
      { id: 'MATERIALS', label: 'Materiais', icon: BookOpen },
      { id: 'PERFORMANCE', label: 'Desempenho', icon: BarChart3 },
      { id: 'SETTINGS', label: 'Configurações', icon: Settings }
    ];

    const isPaused = selectedGoal.status === 'ARCHIVED' || selectedGoal.status === 'PAUSED';
    const isGlobalActive = selectedGoal.id === activeConcursoId;

    return (
      <div className="space-y-6 sm:space-y-8 animate-fadeIn">
        {/* Cabeçalho do Detalhe */}
        <header className="goals-detail-header">
          <button
            onClick={handleBackToList}
            className="goals-btn-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Meus Objetivos
          </button>

          <div className="goals-detail-title-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h1 className="goals-detail-title">
                  {selectedGoal.nome}
                </h1>
                <span className={`goals-status-badge ${!isPaused ? 'is-active' : 'is-paused'}`}>
                  {!isPaused ? 'Ativo' : 'Pausado'}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--calm-text-muted)', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
                <Calendar className="w-4 h-4" /> Data Alvo: {formatHorizonDate(selectedGoal.dataProva)}
                <span>•</span>
                <span>{selectedGoal.orgao} ({selectedGoal.cargo || 'Auditor'})</span>
              </p>
            </div>

            <div className="goals-detail-actions">
              {!isGlobalActive ? (
                <button
                  onClick={() => onSelectConcurso(selectedGoal)}
                  className="goals-btn-create"
                  style={{ padding: '0.65rem 1.15rem', fontSize: '0.82rem' }}
                >
                  ★ Definir como Ativo Global
                </button>
              ) : (
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--calm-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 className="w-4 h-4" /> Concurso em Foco
                </span>
              )}

              <button
                onClick={() => toggleGoalStatus(selectedGoal.id)}
                className="goals-btn-icon"
                title={!isPaused ? 'Pausar' : 'Retomar'}
              >
                {!isPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => handleOpenEdit(selectedGoal)}
                className="goals-btn-icon"
                title="Editar parâmetros do concurso"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="goals-detail-tabs">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`goals-detail-tab ${isActive ? 'is-active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Conteúdo das Abas */}
        <main className="min-h-[400px]">

          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="goals-detail-metrics-grid">
                <div className="goals-detail-metric-card">
                  <div className="goals-detail-metric-label">
                    <span>Disciplinas</span>
                    <Layers className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="goals-detail-metric-value">12</div>
                </div>

                <div className="goals-detail-metric-card">
                  <div className="goals-detail-metric-label">
                    <span>Materiais Vinculados</span>
                    <BookOpen className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="goals-detail-metric-value">24</div>
                </div>

                <div className="goals-detail-metric-card">
                  <div className="goals-detail-metric-label">
                    <span>Cobertura (Gêmeo Digital)</span>
                    <Brain className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="goals-detail-metric-value">42%</div>
                </div>

                <div className="goals-detail-metric-card">
                  <div className="goals-detail-metric-label">
                    <span>Status do Planejamento</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="goals-detail-metric-value" style={{ fontSize: '1.2rem', color: '#10b981' }}>Em Dia</div>
                </div>
              </div>

              {/* Pendências e Próximos Passos */}
              <div className="goals-tasks-card">
                <h3 style={{ fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>
                  Pendências e Próximos Passos
                </h3>

                <div className="goals-task-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#f59e0b' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>
                      Verificar cobertura de Direito Tributário no Edital Verticalizado
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onSelectConcurso(selectedGoal);
                      onNavigateToTab('edital');
                    }}
                    className="goals-task-btn-resolve"
                  >
                    Resolver ➔
                  </button>
                </div>

                <div className="goals-task-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>
                      Sincronizar rotina semanal com a data da prova
                    </span>
                  </div>
                  <button
                    onClick={() => onNavigateToTab('rotina')}
                    className="goals-task-btn-resolve"
                  >
                    Calibrar ➔
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CURRÍCULO */}
          {activeTab === 'CURRICULUM' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="goals-shared-banner">
                <div className="goals-shared-icon" style={{ color: '#f59e0b' }}>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="goals-shared-title">Preservação Histórica</h4>
                  <p className="goals-shared-desc">
                    Atualizar ou remover tópicos do currículo deste edital não apaga as evidências históricas do Gêmeo Digital. O conhecimento adquirido permanece referenciável para outros editais.
                  </p>
                </div>
              </div>

              <div style={{
                padding: '2.5rem',
                borderRadius: '1.5rem',
                border: '1px solid var(--calm-card-border)',
                backgroundColor: 'var(--calm-card-bg)',
                textAlign: 'center'
              }}>
                <Layers className="w-8 h-8 text-stone-400" style={{ margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                  Edital Verticalizado do Concurso
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
                  Explore a árvore completa de disciplinas, tópicos, pesos e materiais vinculados especificamente a este edital.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      onSelectConcurso(selectedGoal);
                      onNavigateToTab('mapa');
                    }}
                    className="goals-btn-create"
                  >
                    Abrir Mapa de Conteúdos (T10)
                  </button>
                  <button
                    onClick={() => {
                      onSelectConcurso(selectedGoal);
                      onNavigateToTab('edital');
                    }}
                    className="goals-btn-open"
                  >
                    Visualizar Lista Clássica
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MATERIAIS */}
          {activeTab === 'MATERIALS' && (
            <div style={{
              padding: '3rem 1.5rem',
              borderRadius: '1.5rem',
              border: '1px dashed var(--calm-border)',
              backgroundColor: 'var(--calm-card-bg)',
              textAlign: 'center'
            }}>
              <BookOpen className="w-8 h-8 text-stone-400" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                Biblioteca e Materiais Teóricos
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', maxWidth: '400px', margin: '0 auto 1.25rem auto' }}>
                Acesse PDFs, videoaulas e resumos vinculados aos tópicos deste concurso.
              </p>
              <button
                onClick={() => {
                  onSelectConcurso(selectedGoal);
                  onNavigateToTab('materiais');
                }}
                className="goals-btn-create"
              >
                Abrir Biblioteca de Materiais
              </button>
            </div>
          )}

          {/* TAB 4: DESEMPENHO */}
          {activeTab === 'PERFORMANCE' && (
            <div style={{
              padding: '3rem 1.5rem',
              borderRadius: '1.5rem',
              border: '1px dashed var(--calm-border)',
              backgroundColor: 'var(--calm-card-bg)',
              textAlign: 'center'
            }}>
              <BarChart3 className="w-8 h-8 text-stone-400" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                Diagnóstico de Retenção & Desempenho
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', maxWidth: '400px', margin: '0 auto 1.25rem auto' }}>
                Verifique taxas de acerto, análise de calibração e curvas de retenção para este concurso.
              </p>
              <button
                onClick={() => {
                  onSelectConcurso(selectedGoal);
                  onNavigateToTab('analytics');
                }}
                className="goals-btn-create"
              >
                Abrir Diagnóstico de Desempenho
              </button>
            </div>
          )}

          {/* TAB 5: CONFIGURAÇÕES */}
          {activeTab === 'SETTINGS' && (
            <div style={{
              padding: '2rem',
              borderRadius: '1.5rem',
              border: '1px solid var(--calm-card-border)',
              backgroundColor: 'var(--calm-card-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                  Parâmetros do Concurso
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', margin: 0 }}>
                  Ajuste banca examinadora, cargo, data oficial de prova e requisitos do edital.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem', borderRadius: '1rem', border: '1px solid var(--calm-border)', backgroundColor: 'var(--calm-subtle-bg)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--calm-text-muted)', display: 'block' }}>Órgão</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedGoal.orgao}</span>
                </div>
                <div style={{ padding: '1rem', borderRadius: '1rem', border: '1px solid var(--calm-border)', backgroundColor: 'var(--calm-subtle-bg)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--calm-text-muted)', display: 'block' }}>Banca</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedGoal.banca || 'A definir'}</span>
                </div>
                <div style={{ padding: '1rem', borderRadius: '1rem', border: '1px solid var(--calm-border)', backgroundColor: 'var(--calm-subtle-bg)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--calm-text-muted)', display: 'block' }}>Cargo</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedGoal.cargo || 'Geral'}</span>
                </div>
                <div style={{ padding: '1rem', borderRadius: '1rem', border: '1px solid var(--calm-border)', backgroundColor: 'var(--calm-subtle-bg)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--calm-text-muted)', display: 'block' }}>Data da Prova</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{formatHorizonDate(selectedGoal.dataProva)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--calm-border)' }}>
                <button
                  onClick={() => handleOpenEdit(selectedGoal)}
                  className="goals-btn-create"
                >
                  <Edit3 className="w-4 h-4" /> Editar no Wizard
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    );
  };

  return (
    <div className="goals-calm-wrapper">
      <div className="goals-calm-container">
        {activeView === 'LIST' ? renderListView() : renderDetailView()}
      </div>

      {/* Assistente de Configuração de Objetivos (T02 a T06) */}
      <AssistenteObjetivoWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onObjectiveCreated={handleConcursoSaved}
        initialData={editingConcurso}
      />
    </div>
  );
}
