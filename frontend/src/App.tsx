import { useState, useEffect } from 'react';
import Sidebar, { type NavTab } from './components/navigation/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import PlanejamentoAdaptativo from './components/cronograma/PlanejamentoAdaptativo';
import { RotinaDisponibilidade } from './components/cronograma/RotinaDisponibilidade';
import { MaestroBattleView } from './components/cronograma/MaestroBattleView';
import CadernosSimulados, { type SimuladoConfig } from './components/simulados/CadernosSimulados';
import CicloRevisoes from './components/revisoes/CicloRevisoes';
import AnalyticsView from './components/analytics/AnalyticsView';
import MeusConcursos, { type ConcursoItem } from './components/concursos/MeusConcursos';
import EditalVerticalizado from './components/edital/EditalVerticalizado';
import MapaConteudos from './components/edital/MapaConteudos';
import QuestionViewer from './components/QuestionViewer';
import ImportStudio from './components/ingestion/ImportStudio';
import AssistenteObjetivoWizard from './components/onboarding/AssistenteObjetivoWizard';
import BoasVindasT01 from './components/onboarding/BoasVindasT01';
import { BibliotecaMateriais } from './components/materiais/BibliotecaMateriais';
import { ResumosEstrategicos } from './components/resumos/ResumosEstrategicos';
import { StudyTimerFab } from './components/timer/StudyTimerFab';
import SessaoEstudoAtiva from './components/timer/SessaoEstudoAtiva';
import HistoricoSessoes from './components/timer/HistoricoSessoes';
import { PreMortemView } from './components/cognitive/PreMortemView';
import { SessaoFeynmanView } from './components/cognitive/SessaoFeynmanView';
import { MetodoEraView } from './components/cognitive/MetodoEraView';
import { PontosChaveView } from './components/cognitive/PontosChaveView';
import { DigitalTwinView } from './components/digitaltwin/DigitalTwinView';
import { CuradoriaAnki } from './components/anki/CuradoriaAnki';
import { BancoQuestoes } from './components/questoes/BancoQuestoes';
import ConfiguracoesAdminView from './components/configuracoes/ConfiguracoesAdminView';
import BuscaGlobalModal from './components/configuracoes/BuscaGlobalModal';

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeConcurso, setActiveConcurso] = useState<ConcursoItem | null>(null);
  const [concursosList, setConcursosList] = useState<ConcursoItem[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isBuscaGlobalOpen, setIsBuscaGlobalOpen] = useState(false);
  const [editalViewMode, setEditalViewMode] = useState<'mapa' | 'classic'>('mapa');
  const [isLoadingConcursos, setIsLoadingConcursos] = useState(true);
  const [backendError, setBackendError] = useState(false);

  // Tema Global Padronizado: Paper (Modo Claro Padrão) vs Night (Modo Escuro)
  const [theme, setTheme] = useState<'paper' | 'night'>(() => {
    const saved = localStorage.getItem('fiscalstudy_calm_theme');
    return (saved === 'night' || saved === 'paper') ? saved : 'paper';
  });

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'paper' ? 'night' : 'paper'));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('theme-paper', 'theme-night');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.remove('theme-paper', 'theme-night');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('fiscalstudy_calm_theme', theme);
  }, [theme]);

  // Carrega concursos e concurso ativo salvo no storage
  const loadConcursos = () => {
    setIsLoadingConcursos(true);
    setBackendError(false);
    const savedId = localStorage.getItem('fiscalstudy_active_concurso_id');
    fetch('/api/v1/concursos')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Servidor retornou status ' + res.status);
        }
        return res.json();
      })
      .then((list: ConcursoItem[]) => {
        setConcursosList(list);
        setBackendError(false);
        if (list.length > 0) {
          const matched = savedId ? list.find((c) => c.id === savedId) : list[0];
          const chosen = matched || list[0];
          setActiveConcurso(chosen);
          localStorage.setItem('fiscalstudy_active_concurso_id', chosen.id);
        } else {
          setActiveConcurso(null);
          localStorage.removeItem('fiscalstudy_active_concurso_id');
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar objetivos/concursos:', err);
        setBackendError(true);
      })
      .finally(() => {
        setIsLoadingConcursos(false);
      });
  };

  useEffect(() => {
    loadConcursos();
  }, []);

  // Atalho global de busca unificada (Ctrl+K ou Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsBuscaGlobalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigateFromSearch = (targetTab: string, payload?: any) => {
    setIsBuscaGlobalOpen(false);
    if (payload?.tipo === 'QUESTAO') {
      setActiveTab('study');
    } else if (payload?.tipo === 'CONTEUDO') {
      if (payload.disciplina) {
        handleNavigateToStudy(payload.disciplina, payload.assunto || payload.titulo);
      } else {
        setActiveTab('edital');
      }
    } else {
      setActiveTab(targetTab as NavTab);
    }
  };

  const handleSelectConcurso = (concurso: ConcursoItem) => {
    setActiveConcurso(concurso);
    localStorage.setItem('fiscalstudy_active_concurso_id', concurso.id);
  };

  const handleNavigateToStudy = (disciplina?: string, assunto?: string) => {
    if (disciplina) {
      sessionStorage.setItem('fiscalstudy_filter_discipline', disciplina);
    }
    if (assunto) {
      sessionStorage.setItem('fiscalstudy_filter_assunto', assunto);
    }
    setActiveTab('study');
  };

  const handleStartSimulado = (config: SimuladoConfig) => {
    sessionStorage.setItem('fiscalstudy_simulado_config', JSON.stringify(config));
    setActiveTab('study');
  };

  const handleStartErrorNotebook = (errorType?: string) => {
    if (errorType) {
      sessionStorage.setItem('fiscalstudy_filter_error_type', errorType);
    }
    setActiveTab('study');
  };

  if (backendError || (!isLoadingConcursos && concursosList.length === 0)) {
    return (
      <>
        <BoasVindasT01
          backendError={backendError}
          onRetry={loadConcursos}
          onStartWizard={() => setIsWizardOpen(true)}
        />
        <AssistenteObjetivoWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onConcursoCreated={(newC: ConcursoItem) => {
            loadConcursos();
            handleSelectConcurso(newC);
            setActiveTab('dashboard');
          }}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Global Vertical Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        activeConcurso={activeConcurso}
        concursosList={concursosList}
        onSelectConcurso={handleSelectConcurso}
        onOpenNewConcurso={() => setIsWizardOpen(true)}
        onOpenBuscaGlobal={() => setIsBuscaGlobalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content View Area */}
      <main className="main-content-area">
        {activeTab === 'dashboard' && (
          <Dashboard
            activeConcurso={activeConcurso}
            theme={theme}
            onToggleTheme={toggleTheme}
            onNavigateToTab={(tab, params) => {
              if (tab === 'mapa') {
                setEditalViewMode('mapa');
                setActiveTab('edital');
              } else if (tab === 'study' && params?.disciplina) {
                handleNavigateToStudy(params.disciplina, params.assunto);
              } else {
                setActiveTab(tab);
              }
            }}
          />
        )}

        {activeTab === 'maestro' && (
          <MaestroBattleView
            concursoId={activeConcurso?.id || ''}
            concursoNome={activeConcurso?.nome || 'Concurso Ativo'}
            onNavigateToStudy={handleNavigateToStudy}
            onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
            onSwitchToWeekly={() => setActiveTab('cronograma')}
          />
        )}

        {activeTab === 'cronograma' && (
          <PlanejamentoAdaptativo
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
            onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
            onSwitchToBattle={() => setActiveTab('maestro')}
          />
        )}

        {activeTab === 'rotina' && (
          <RotinaDisponibilidade
            activeConcurso={activeConcurso}
            onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'materiais' && (
          <BibliotecaMateriais
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
          />
        )}

        {activeTab === 'resumos' && (
          <ResumosEstrategicos
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
            onNavigateToConcursos={() => setActiveTab('concursos')}
          />
        )}

        {activeTab === 'anki' && (
          <CuradoriaAnki
            activeConcurso={activeConcurso}
            onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'edital' && (
          editalViewMode === 'mapa' ? (
            <MapaConteudos
              concursoId={activeConcurso?.id || ''}
              concursoNome={activeConcurso?.nome || 'Nenhum Concurso Selecionado'}
              onNavigateToStudy={(disc, ass) => handleNavigateToStudy(disc, ass)}
              onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
              onSwitchToClassicView={() => setEditalViewMode('classic')}
            />
          ) : (
            <div className="relative">
              <div style={{
                padding: '0.65rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  📋 Modo Clássico de Auditoria e Validação de Edital
                </span>
                <button
                  type="button"
                  onClick={() => setEditalViewMode('mapa')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🗺️ Ver no Mapa de Conteúdos
                </button>
              </div>
              <EditalVerticalizado
                concursoId={activeConcurso?.id || ''}
                concursoNome={activeConcurso?.nome || 'Nenhum Concurso Selecionado'}
                onNavigateToStudy={(disc, ass) => handleNavigateToStudy(disc, ass)}
                onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
              />
            </div>
          )
        )}

        {activeTab === 'study' && <QuestionViewer />}

        {activeTab === 'session' && (
          <SessaoEstudoAtiva
            activeConcurso={activeConcurso}
            onBack={() => setActiveTab('dashboard')}
            onFinishSession={() => setActiveTab('cronograma')}
            onOpenQuestions={(disc, ass) => handleNavigateToStudy(disc, ass)}
            onOpenMaterial={() => setActiveTab('materiais')}
          />
        )}

        {activeTab === 'historico' && (
          <HistoricoSessoes
            activeConcurso={activeConcurso}
            onNavigateToTab={(tab) => {
              if (tab === 'session') {
                setActiveTab('session');
              } else {
                setActiveTab(tab as NavTab);
              }
            }}
          />
        )}

        {activeTab === 'banco' && (
          <BancoQuestoes
            activeConcurso={activeConcurso}
            onResolveQuestion={(qId) => {
              sessionStorage.setItem('fiscalstudy_target_question_id', qId);
              setActiveTab('study');
            }}
            onStartCaderno={(cadernoConfig) => {
              sessionStorage.setItem('fiscalstudy_active_caderno', JSON.stringify(cadernoConfig));
              setActiveTab('study');
            }}
          />
        )}

        {activeTab === 'simulados' && (
          <CadernosSimulados
            activeConcurso={activeConcurso}
            onStartSession={handleStartSimulado}
            onNavigateToConcursos={() => setActiveTab('concursos')}
          />
        )}

        {activeTab === 'revisoes' && (
          <CicloRevisoes
            activeConcurso={activeConcurso}
            onStartErrorNotebook={handleStartErrorNotebook}
            onNavigateToStudy={(disc, ass) => handleNavigateToStudy(disc, ass)}
          />
        )}

        {activeTab === 'digitaltwin' && (
          <DigitalTwinView
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
          />
        )}

        {activeTab === 'concursos' && (
          <MeusConcursos
            activeConcursoId={activeConcurso?.id || null}
            onSelectConcurso={handleSelectConcurso}
            onNavigateToTab={(tab) => {
              if (tab === 'mapa') {
                setEditalViewMode('mapa');
                setActiveTab('edital');
              } else {
                setActiveTab(tab);
              }
            }}
          />
        )}

        {activeTab === 'import' && <ImportStudio />}

        {activeTab === 'analytics' && (
          <AnalyticsView
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
            onNavigateToRevision={() => setActiveTab('revisoes')}
          />
        )}

        {activeTab === 'metodoera' && <MetodoEraView />}
        {activeTab === 'feynman' && <SessaoFeynmanView />}
        {activeTab === 'pontoschave' && <PontosChaveView />}
        {activeTab === 'premortem' && <PreMortemView />}
        {activeTab === 'configuracoes' && <ConfiguracoesAdminView />}
      </main>

      {/* Global Floating Study Timer & Pomodoro FAB */}
      <StudyTimerFab
        activeConcurso={activeConcurso}
        onSessionSaved={() => loadConcursos()}
      />

      {/* Assistente de Configuração de Objetivos (T02 a T06) */}
      <AssistenteObjetivoWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onConcursoCreated={(newC: ConcursoItem) => {
          loadConcursos();
          handleSelectConcurso(newC);
        }}
      />

      {/* T40 — Busca Global Unificada Modal */}
      <BuscaGlobalModal
        isOpen={isBuscaGlobalOpen}
        onClose={() => setIsBuscaGlobalOpen(false)}
        onNavigate={handleNavigateFromSearch}
      />
    </div>
  );
}

export default App;
