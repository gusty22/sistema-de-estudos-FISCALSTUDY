import React from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './Sidebar.css';

export type NavTab = 
  | 'dashboard' 
  | 'maestro'
  | 'concursos' 
  | 'cronograma' 
  | 'rotina'
  | 'materiais' 
  | 'resumos'
  | 'anki'
  | 'edital' 
  | 'banco'
  | 'study' 
  | 'session'
  | 'historico'
  | 'simulados' 
  | 'revisoes' 
  | 'digitaltwin'
  | 'import' 
  | 'analytics'
  | 'feynman'
  | 'metodoera'
  | 'pontoschave'
  | 'premortem'
  | 'configuracoes';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeConcurso: ConcursoItem | null;
  concursosList: ConcursoItem[];
  onSelectConcurso: (c: ConcursoItem) => void;
  onOpenNewConcurso: () => void;
  onOpenBuscaGlobal?: () => void;
  theme?: 'paper' | 'night';
  onToggleTheme?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeConcurso,
  concursosList,
  onSelectConcurso,
  onOpenNewConcurso,
  onOpenBuscaGlobal,
  theme = 'paper',
  onToggleTheme,
}) => {
  return (
    <aside className="sidebar">
      {/* Brand & Logo */}
      <div className="sidebar-brand">
        <div className="brand-logo-group">
          <div className="brand-icon">⚡</div>
          <div className="brand-text">
            <span className="brand-title">FiscalStudy</span>
            <span className="brand-subtitle">Adaptive Prep Platform</span>
          </div>
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
        {onOpenBuscaGlobal && (
          <button
            type="button"
            className="nav-btn busca-global-trigger-btn"
            onClick={onOpenBuscaGlobal}
            title="Busca Global Unificada (Ctrl+K)"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              marginBottom: '1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="nav-icon" style={{ fontSize: '0.95rem' }}>🔍</span>
              <span className="nav-text" style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>Busca Global...</span>
            </div>
            <kbd style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              padding: '2px 5px',
              fontSize: '0.68rem',
              color: '#94a3b8'
            }}>Ctrl K</kbd>
          </button>
        )}

        <div className="nav-section-title">ROTINA & EXECUÇÃO</div>
        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-text">Início / Meu Plano</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'banco' ? 'active' : ''}`}
          onClick={() => onSelectTab('banco')}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-text">Banco de Questões</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'study' ? 'active' : ''}`}
          onClick={() => onSelectTab('study')}
        >
          <span className="nav-icon">⚡</span>
          <span className="nav-text" style={{ fontWeight: 700 }}>Estudo Ativo & Questões</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'session' ? 'active' : ''}`}
          onClick={() => onSelectTab('session')}
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-text">Sessão Focada (Timer)</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'historico' ? 'active' : ''}`}
          onClick={() => onSelectTab('historico')}
        >
          <span className="nav-icon">📜</span>
          <span className="nav-text">Histórico de Sessões</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'cronograma' ? 'active' : ''}`}
          onClick={() => onSelectTab('cronograma')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-text">Planejamento Adaptativo</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'rotina' ? 'active' : ''}`}
          onClick={() => onSelectTab('rotina')}
        >
          <span className="nav-icon">🗓️</span>
          <span className="nav-text">Rotina & Disponibilidade</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'revisoes' ? 'active' : ''}`}
          onClick={() => onSelectTab('revisoes')}
        >
          <span className="nav-icon">🔄</span>
          <span className="nav-text">Revisões & Caderno de Erros</span>
        </button>

        <div className="nav-section-title">CONTEÚDO & MATERIAIS</div>
        <button
          className={`nav-btn ${activeTab === 'materiais' ? 'active' : ''}`}
          onClick={() => onSelectTab('materiais')}
        >
          <span className="nav-icon">📚</span>
          <span className="nav-text">Biblioteca & Teoria</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'resumos' ? 'active' : ''}`}
          onClick={() => onSelectTab('resumos')}
        >
          <span className="nav-icon">📑</span>
          <span className="nav-text">Resumos Estratégicos</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'anki' ? 'active' : ''}`}
          onClick={() => onSelectTab('anki')}
        >
          <span className="nav-icon">🧠</span>
          <span className="nav-text">Curadoria para o Anki</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'simulados' ? 'active' : ''}`}
          onClick={() => onSelectTab('simulados')}
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-text">Cadernos & Simulados</span>
        </button>

        <div className="nav-section-title">GESTÃO & EDITAL</div>
        <button
          className={`nav-btn ${activeTab === 'concursos' ? 'active' : ''}`}
          onClick={() => onSelectTab('concursos')}
        >
          <span className="nav-icon">🏛️</span>
          <span className="nav-text">Meus Concursos / Metas</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'edital' ? 'active' : ''}`}
          onClick={() => onSelectTab('edital')}
        >
          <span className="nav-icon">🗺️</span>
          <span className="nav-text">Mapa de Conteúdos</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => onSelectTab('import')}
        >
          <span className="nav-icon">📥</span>
          <span className="nav-text">Ingestão & Provas</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
        >
          <span className="nav-icon">📈</span>
          <span className="nav-text">Desempenho & Diagnósticos</span>
        </button>

        <div className="nav-section-title">SISTEMA & ADMINISTRAÇÃO</div>
        <button
          className={`nav-btn ${activeTab === 'configuracoes' ? 'active' : ''}`}
          onClick={() => onSelectTab('configuracoes')}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-text">Configurações & Dados</span>
        </button>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {onToggleTheme && (
          <button
            type="button"
            className="sidebar-theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'night' ? 'Mudar para Modo Claro (Paper)' : 'Mudar para Modo Escuro (Night)'}
          >
            <div className="theme-toggle-content">
              <span className="theme-toggle-icon">
                {theme === 'night' ? '🌙' : '☀️'}
              </span>
              <span className="theme-toggle-text">
                {theme === 'night' ? 'Modo Escuro' : 'Modo Claro'}
              </span>
            </div>
            <div className={`theme-toggle-pill ${theme === 'night' ? 'active-night' : 'active-paper'}`}>
              <div className="theme-toggle-thumb" />
            </div>
          </button>
        )}

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
