import { useState, useEffect } from 'react';
import QuestionViewer from './components/QuestionViewer';
import ImportStudio from './components/ingestion/ImportStudio';
import MeusConcursos, { type ConcursoItem } from './components/concursos/MeusConcursos';
import EditalVerticalizado from './components/edital/EditalVerticalizado';

function App() {
  const [activeTab, setActiveTab] = useState<'concursos' | 'study' | 'edital' | 'import'>('concursos');
  const [activeConcurso, setActiveConcurso] = useState<ConcursoItem | null>(null);

  // Carrega concurso ativo salvo no storage
  useEffect(() => {
    const savedId = localStorage.getItem('fiscalstudy_active_concurso_id');
    fetch('/api/v1/concursos')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: ConcursoItem[]) => {
        if (list.length > 0) {
          const matched = savedId ? list.find((c) => c.id === savedId) : list[0];
          const chosen = matched || list[0];
          setActiveConcurso(chosen);
          localStorage.setItem('fiscalstudy_active_concurso_id', chosen.id);
        }
      })
      .catch((err) => console.error('Erro ao carregar concurso ativo:', err));
  }, []);

  const handleSelectConcurso = (concurso: ConcursoItem) => {
    setActiveConcurso(concurso);
    localStorage.setItem('fiscalstudy_active_concurso_id', concurso.id);
  };

  return (
    <div className="App">
      <header style={{ padding: '1.25rem 1rem 0.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.025em', background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', color: 'transparent', margin: 0 }}>
          FiscalStudy
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '0.2rem', fontSize: '0.9rem' }}>
          Sistema Pessoal de Preparação Adaptativa para Carreiras Fiscais
        </p>

        {/* Active Concurso Banner Chip */}
        {activeConcurso && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '9999px', padding: '4px 14px', marginTop: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Concurso Ativo:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>{activeConcurso.nome}</span>
            <button
              onClick={() => setActiveTab('concursos')}
              style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '0.75rem', cursor: 'pointer', padding: '0 4px', textDecoration: 'underline' }}
            >
              (Trocar)
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'concursos' ? '' : 'btn-secondary'}`}
            style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            onClick={() => setActiveTab('concursos')}
          >
            🏛️ Meus Concursos
          </button>
          <button
            className={`btn ${activeTab === 'study' ? '' : 'btn-secondary'}`}
            style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            onClick={() => setActiveTab('study')}
          >
            📚 Sessão de Estudo
          </button>
          <button
            className={`btn ${activeTab === 'edital' ? '' : 'btn-secondary'}`}
            style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            onClick={() => setActiveTab('edital')}
          >
            📋 Edital Verticalizado
          </button>
          <button
            className={`btn ${activeTab === 'import' ? '' : 'btn-secondary'}`}
            style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            onClick={() => setActiveTab('import')}
          >
            📥 Importar Provas & Revisão
          </button>
        </div>
      </header>

      <main style={{ paddingBottom: '3rem' }}>
        {activeTab === 'concursos' && (
          <MeusConcursos
            activeConcursoId={activeConcurso?.id || null}
            onSelectConcurso={handleSelectConcurso}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'study' && <QuestionViewer />}
        {activeTab === 'edital' && (
          <EditalVerticalizado
            concursoId={activeConcurso?.id || 'iss-araguari-auditor-2023'}
            concursoNome={activeConcurso?.nome || 'ISS Araguari'}
          />
        )}
        {activeTab === 'import' && <ImportStudio />}
      </main>
    </div>
  );
}

export default App;
