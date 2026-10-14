import { useState, useEffect } from 'react';
import Sidebar, { type NavTab } from './components/navigation/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import CronogramaSemanal from './components/cronograma/CronogramaSemanal';
import CadernosSimulados, { type SimuladoConfig } from './components/simulados/CadernosSimulados';
import CicloRevisoes from './components/revisoes/CicloRevisoes';
import AnalyticsView from './components/analytics/AnalyticsView';
import MeusConcursos, { type ConcursoItem } from './components/concursos/MeusConcursos';
import EditalVerticalizado from './components/edital/EditalVerticalizado';
import QuestionViewer from './components/QuestionViewer';
import ImportStudio from './components/ingestion/ImportStudio';
import CadastroConcursoWizard from './components/concursos/CadastroConcursoWizard';
import { BibliotecaMateriais } from './components/materiais/BibliotecaMateriais';
import { StudyTimerFab } from './components/timer/StudyTimerFab';
import { PreMortemView } from './components/cognitive/PreMortemView';
import { SessaoFeynmanView } from './components/cognitive/SessaoFeynmanView';
import { MetodoEraView } from './components/cognitive/MetodoEraView';
import { PontosChaveView } from './components/cognitive/PontosChaveView';
import { DigitalTwinView } from './components/digitaltwin/DigitalTwinView';

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeConcurso, setActiveConcurso] = useState<ConcursoItem | null>(null);
  const [concursosList, setConcursosList] = useState<ConcursoItem[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Carrega concursos e concurso ativo salvo no storage
  const loadConcursos = () => {
    const savedId = localStorage.getItem('fiscalstudy_active_concurso_id');
    fetch('/api/v1/concursos')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: ConcursoItem[]) => {
        setConcursosList(list);
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
      .catch((err) => console.error('Erro ao carregar concursos:', err));
  };

  useEffect(() => {
    loadConcursos();
  }, []);

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
      />

      {/* Main Content View Area */}
      <main className="main-content-area">
        {activeTab === 'dashboard' && (
          <Dashboard
            activeConcurso={activeConcurso}
            onNavigateToTab={(tab, params) => {
              if (tab === 'study' && params?.disciplina) {
                handleNavigateToStudy(params.disciplina);
              } else {
                setActiveTab(tab);
              }
            }}
          />
        )}

        {activeTab === 'cronograma' && (
          <CronogramaSemanal
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
          />
        )}

        {activeTab === 'materiais' && (
          <BibliotecaMateriais
            activeConcurso={activeConcurso}
            onNavigateToStudy={handleNavigateToStudy}
          />
        )}

        {activeTab === 'edital' && (
          <EditalVerticalizado
            concursoId={activeConcurso?.id || ''}
            concursoNome={activeConcurso?.nome || 'Nenhum Concurso Selecionado'}
            onNavigateToStudy={(disc, ass) => handleNavigateToStudy(disc, ass)}
            onNavigateToTab={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'study' && <QuestionViewer />}

        {activeTab === 'simulados' && (
          <CadernosSimulados
            activeConcurso={activeConcurso}
            onStartSession={handleStartSimulado}
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
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'import' && <ImportStudio />}

        {activeTab === 'analytics' && (
          <AnalyticsView activeConcurso={activeConcurso} />
        )}

        {activeTab === 'metodoera' && <MetodoEraView />}
        {activeTab === 'feynman' && <SessaoFeynmanView />}
        {activeTab === 'pontoschave' && <PontosChaveView />}
        {activeTab === 'premortem' && <PreMortemView />}
      </main>

      {/* Global Floating Study Timer & Pomodoro FAB */}
      <StudyTimerFab
        activeConcurso={activeConcurso}
        onSessionSaved={() => loadConcursos()}
      />

      {/* Progressive Registration Wizard Modal */}
      <CadastroConcursoWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onConcursoCreated={(newC: ConcursoItem) => {
          loadConcursos();
          handleSelectConcurso(newC);
        }}
      />
    </div>
  );
}

export default App;
