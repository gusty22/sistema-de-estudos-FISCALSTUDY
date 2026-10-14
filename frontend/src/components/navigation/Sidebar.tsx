import React from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './Sidebar.css';

export type NavTab = 
  | 'dashboard' 
  | 'concursos' 
  | 'cronograma' 
  | 'materiais'
  | 'edital' 
  | 'study' 
  | 'simulados' 
  | 'revisoes' 
  | 'digitaltwin'
  | 'import' 
  | 'analytics'
  | 'feynman'
  | 'metodoera'
  | 'pontoschave'
  | 'premortem';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeConcurso: ConcursoItem | null;
  concursosList: ConcursoItem[];
  onSelectConcurso: (c: ConcursoItem) => void;
  onOpenNewConcurso: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeConcurso,
  concursosList,
  onSelectConcurso,
  onOpenNewConcurso,
}) => {
  return (
    <aside className="sidebar">
      {/* Brand & Logo */}
      <div className="sidebar-brand">
        <div className="brand-icon">⚡</div>
        <div className="brand-text">
          <span className="brand-title">FiscalStudy</span>
          <span className="brand-subtitle">Adaptive Prep Platform</span>
        </div>
      </div>

      {/* Active Concurso Switcher Card */}
      <div className="sidebar-concurso-card">
        <div className="concurso-badge-label">
          <span>CONCURSO ATIVO</span>
          <button 
            className="concurso-switch-btn"
            onClick={() => onSelectTab('concursos')}
            title="Gerenciar Concursos"
          >
            Trocar
          </button>
        </div>
        
        {activeConcurso ? (
          <div className="active-concurso-info">
            <div className="active-concurso-name" title={activeConcurso.nome}>
              {activeConcurso.nome}
            </div>
            <div className="active-concurso-meta">
              <span className="concurso-tag">{activeConcurso.banca || 'Banca N/D'}</span>
              <span className="concurso-tag">{activeConcurso.situacao || 'EM_ANDAMENTO'}</span>
            </div>
            {activeConcurso.dataProva && (
              <div className="active-concurso-date">
                📅 Prova: {new Date(activeConcurso.dataProva).toLocaleDateString('pt-BR')}
              </div>
            )}
            <button
              className={`concurso-edital-btn ${activeTab === 'edital' ? 'active' : ''}`}
              onClick={() => onSelectTab('edital')}
              title="Acessar o Edital Verticalizado deste concurso"
            >
              📋 Ver Edital Verticalizado
            </button>
          </div>
        ) : (
          <div className="no-active-concurso">
            <p>Nenhum concurso selecionado</p>
            <button className="btn-select-concurso" onClick={onOpenNewConcurso}>
              + Cadastrar Concurso
            </button>
          </div>
        )}

        {concursosList.length > 1 && (
          <select 
            className="concurso-quick-select"
            value={activeConcurso?.id || ''}
            onChange={(e) => {
              const selected = concursosList.find(c => c.id === e.target.value);
              if (selected) onSelectConcurso(selected);
            }}
          >
            {concursosList.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome.length > 25 ? c.nome.substring(0, 25) + '...' : c.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">PRINCIPAL</div>
        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-text">Dashboard</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'cronograma' ? 'active' : ''}`}
          onClick={() => {
            sessionStorage.setItem('fiscalstudy_crono_mode', 'MAESTRO');
            onSelectTab('cronograma');
          }}
        >
          <span className="nav-icon">⚡</span>
          <span className="nav-text">Maestro (Modo Batalha)</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'materiais' ? 'active' : ''}`}
          onClick={() => onSelectTab('materiais')}
        >
          <span className="nav-icon">📚</span>
          <span className="nav-text">Biblioteca & Teoria</span>
        </button>

        <div className="nav-section-title">PRÁTICA & RESOLUÇÃO</div>
        <button
          className={`nav-btn ${activeTab === 'study' ? 'active' : ''}`}
          onClick={() => onSelectTab('study')}
        >
          <span className="nav-icon">📝</span>
          <span className="nav-text">Banco de Questões</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'simulados' ? 'active' : ''}`}
          onClick={() => onSelectTab('simulados')}
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-text">Cadernos & Simulados</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'revisoes' ? 'active' : ''}`}
          onClick={() => onSelectTab('revisoes')}
        >
          <span className="nav-icon">🔄</span>
          <span className="nav-text">Ciclo de Revisões & Erros</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'digitaltwin' ? 'active' : ''}`}
          onClick={() => onSelectTab('digitaltwin')}
        >
          <span className="nav-icon">🧠</span>
          <span className="nav-text">Gêmeo Digital (Lucas)</span>
        </button>

        <div className="nav-section-title">CIÊNCIA COGNITIVA & MÉTODOS</div>
        <button
          className={`nav-btn ${activeTab === 'metodoera' ? 'active' : ''}`}
          onClick={() => onSelectTab('metodoera')}
        >
          <span className="nav-icon">⚡</span>
          <span className="nav-text">Método ERA</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'feynman' ? 'active' : ''}`}
          onClick={() => onSelectTab('feynman')}
        >
          <span className="nav-icon">🔬</span>
          <span className="nav-text">Sessão Feynman</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'pontoschave' ? 'active' : ''}`}
          onClick={() => onSelectTab('pontoschave')}
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-text">Pontos-Chave (SRS)</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'premortem' ? 'active' : ''}`}
          onClick={() => onSelectTab('premortem')}
        >
          <span className="nav-icon">🔮</span>
          <span className="nav-text">Pré-Mortem (Gary Klein)</span>
        </button>

        <div className="nav-section-title">GESTÃO & INGESTÃO</div>
        <button
          className={`nav-btn ${activeTab === 'concursos' ? 'active' : ''}`}
          onClick={() => onSelectTab('concursos')}
        >
          <span className="nav-icon">🏛️</span>
          <span className="nav-text">Meus Concursos</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => onSelectTab('import')}
        >
          <span className="nav-icon">📥</span>
          <span className="nav-text">Ingestão & Studio</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
        >
          <span className="nav-icon">📈</span>
          <span className="nav-text">Estatísticas & MVT</span>
        </button>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="footer-status">
          <span className="status-dot"></span>
          <span>Local-First • SQLite</span>
        </div>
        <div className="footer-version">v2.1 Adaptive MVT</div>
      </div>
    </aside>
  );
};

export default Sidebar;
