import { useState, useEffect } from 'react';
import CadastroConcursoWizard from './CadastroConcursoWizard';
import './MeusConcursos.css';

export interface ConcursoItem {
  id: string;
  nome: string;
  orgao: string;
  banca: string;
  ano: number | null;
  cargo: string;
  cargoCodigo: string;
  status: string; // ACTIVE, ARCHIVED
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

export default function MeusConcursos({ activeConcursoId, onSelectConcurso, onNavigateToTab }: MeusConcursosProps) {
  const [concursos, setConcursos] = useState<ConcursoItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingConcurso, setEditingConcurso] = useState<ConcursoItem | null>(null);

  const loadConcursos = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/concursos?status=${filterStatus}`);
      if (!res.ok) throw new Error(`Erro ao carregar concursos (HTTP ${res.status})`);
      const data: ConcursoItem[] = await res.json();
      setConcursos(data);

      // Se nenhum concurso ativo selecionado, selecionar o primeiro ativo
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
  }, [filterStatus]);

  const handleOpenCreate = () => {
    setEditingConcurso(null);
    setIsWizardOpen(true);
  };

  const handleOpenEdit = (c: ConcursoItem) => {
    setEditingConcurso(c);
    setIsWizardOpen(true);
  };

  const handleConcursoSaved = (saved: ConcursoItem) => {
    loadConcursos();
    onSelectConcurso(saved);
  };

  const handleToggleArchive = async (c: ConcursoItem) => {
    const isArchived = c.status === 'ARCHIVED';
    const action = isArchived ? 'activate' : 'archive';
    try {
      const res = await fetch(`/api/v1/concursos/${c.id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao atualizar status.');
      loadConcursos();
    } catch (e: any) {
      alert('Erro ao alterar status: ' + e.message);
    }
  };

  const getDaysRemaining = (dataProva?: string): number | null => {
    if (!dataProva) return null;
    const examDate = new Date(dataProva);
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="meus-concursos animate-fade-in">
      <div className="concursos-header">
        <div className="concursos-header-title">
          <h2>🏛️ Meus Concursos</h2>
          <p>Gerencie seus concursos-alvo, editais verticalizados e histórico com isolamento contextual</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="concursos-filter-tabs">
            <button
              className={`filter-tab ${filterStatus === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ACTIVE')}
            >
              Ativos
            </button>
            <button
              className={`filter-tab ${filterStatus === 'ARCHIVED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ARCHIVED')}
            >
              Arquivados
            </button>
            <button
              className={`filter-tab ${filterStatus === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ALL')}
            >
              Todos
            </button>
          </div>

          <button className="btn" onClick={handleOpenCreate} style={{ padding: '8px 18px', fontSize: '0.9rem' }}>
            + Novo Concurso (5 Etapas)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="glass" style={{ borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ color: '#ef4444', margin: 0 }}>⚠️ {errorMsg}</p>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Carregando concursos cadastrados...
        </div>
      )}

      {!isLoading && concursos.length === 0 && (
        <div className="glass" style={{ textAlign: 'center', padding: '3rem 1.5rem', borderRadius: '12px' }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Nenhum concurso encontrado</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Cadastre seu primeiro concurso-alvo para iniciar.</p>
          <button className="btn" onClick={handleOpenCreate}>
            + Cadastrar Primeiro Concurso
          </button>
        </div>
      )}

      <div className="concursos-grid">
        {concursos.map((c) => {
          const isActive = c.id === activeConcursoId;
          const daysLeft = getDaysRemaining(c.dataProva);

          return (
            <div key={c.id} className={`concurso-card ${isActive ? 'is-active-card' : ''}`}>
              {isActive && <div className="active-ribbon">ATIVO</div>}

              <div>
                <div className="concurso-card-header">
                  <span className={`concurso-status-pill status-${c.status.toLowerCase()}`}>
                    {c.status === 'ACTIVE' ? (c.situacao || 'Em Preparação') : 'Arquivado'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Ano {c.ano || '—'}</span>
                </div>

                <h3 className="concurso-title">{c.nome}</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem' }}>
                  {c.descricao || 'Sem descrição cadastrada.'}
                </p>

                {/* Days countdown banner if date is set */}
                {daysLeft !== null && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: daysLeft > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${daysLeft > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '6px',
                    padding: '6px 10px',
                    marginBottom: '0.85rem',
                    fontSize: '0.8rem',
                    color: daysLeft > 0 ? '#60a5fa' : '#f87171'
                  }}>
                    <span>⏱️ Prova em: <strong>{daysLeft > 0 ? `${daysLeft} dias` : 'Data transcorrida'}</strong> ({new Date(c.dataProva!).toLocaleDateString('pt-BR')})</span>
                  </div>
                )}

                <div className="concurso-meta-grid">
                  <div className="meta-chip">
                    <span className="meta-chip-label">Órgão</span>
                    <span className="meta-chip-value" title={c.orgao}>{c.orgao}</span>
                  </div>
                  <div className="meta-chip">
                    <span className="meta-chip-label">Banca</span>
                    <span className="meta-chip-value">{c.banca || 'A definir'}</span>
                  </div>
                  <div className="meta-chip">
                    <span className="meta-chip-label">Cargo</span>
                    <span className="meta-chip-value" title={c.cargo}>{c.cargo || 'Geral'}</span>
                  </div>
                  <div className="meta-chip">
                    <span className="meta-chip-label">Questões no Banco</span>
                    <span className="meta-chip-value" style={{ color: '#60a5fa' }}>
                      {c.availableQuestionsCount !== undefined ? `${c.availableQuestionsCount} questões` : '0 questões'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {!isActive ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => onSelectConcurso(c)}
                      style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem', borderColor: '#3b82f6', color: '#60a5fa' }}
                    >
                      ★ Selecionar como Ativo
                    </button>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => onNavigateToTab('study')}
                      style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem' }}
                    >
                      🎯 Praticar Sessão
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      onSelectConcurso(c);
                      onNavigateToTab('edital');
                    }}
                    style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                    title="Ver edital verticalizado"
                  >
                    📋 Edital
                  </button>
                </div>

                <div className="concurso-card-actions">
                  <button
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                    onClick={() => handleOpenEdit(c)}
                  >
                    ✏️ Editar Detalhes
                  </button>
                  <button
                    style={{ background: 'transparent', border: 'none', color: c.status === 'ARCHIVED' ? '#34d399' : '#f59e0b', cursor: 'pointer', fontSize: '0.8rem', marginLeft: 'auto' }}
                    onClick={() => handleToggleArchive(c)}
                  >
                    {c.status === 'ARCHIVED' ? '♻️ Reativar' : '📦 Arquivar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5-Step Progressive Wizard */}
      <CadastroConcursoWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onConcursoCreated={handleConcursoSaved}
        initialData={editingConcurso}
      />
    </div>
  );
}
