import React, { useState, useEffect } from 'react';
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
}

interface MeusConcursosProps {
  activeConcursoId: string | null;
  onSelectConcurso: (concurso: ConcursoItem) => void;
  onNavigateToTab: (tab: 'study' | 'edital' | 'import') => void;
}

export default function MeusConcursos({ activeConcursoId, onSelectConcurso, onNavigateToTab }: MeusConcursosProps) {
  const [concursos, setConcursos] = useState<ConcursoItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de cadastro/edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    orgao: '',
    banca: '',
    ano: new Date().getFullYear().toString(),
    cargo: '',
    cargoCodigo: '',
    descricao: '',
  });

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
    setEditingId(null);
    setFormData({
      nome: '',
      orgao: '',
      banca: 'IBGP',
      ano: '2024',
      cargo: '',
      cargoCodigo: '',
      descricao: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: ConcursoItem) => {
    setEditingId(c.id);
    setFormData({
      nome: c.nome,
      orgao: c.orgao,
      banca: c.banca || '',
      ano: c.ano ? c.ano.toString() : '',
      cargo: c.cargo || '',
      cargoCodigo: c.cargoCodigo || '',
      descricao: c.descricao || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.orgao.trim()) {
      alert('Nome e Órgão são obrigatórios.');
      return;
    }

    try {
      const payload = {
        nome: formData.nome.trim(),
        orgao: formData.orgao.trim(),
        banca: formData.banca.trim(),
        ano: formData.ano ? parseInt(formData.ano, 10) : null,
        cargo: formData.cargo.trim(),
        cargoCodigo: formData.cargoCodigo.trim(),
        descricao: formData.descricao.trim(),
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/v1/concursos/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/v1/concursos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Falha ao salvar dados do concurso.');
      const saved: ConcursoItem = await res.json();
      setIsModalOpen(false);
      loadConcursos();

      if (!editingId || editingId === activeConcursoId) {
        onSelectConcurso(saved);
      }
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
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
            + Novo Concurso
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
          return (
            <div key={c.id} className={`concurso-card ${isActive ? 'is-active-card' : ''}`}>
              {isActive && <div className="active-ribbon">ATIVO</div>}

              <div>
                <div className="concurso-card-header">
                  <span className={`concurso-status-pill status-${c.status.toLowerCase()}`}>
                    {c.status === 'ACTIVE' ? 'Em Preparação' : 'Arquivado'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Ano {c.ano || '—'}</span>
                </div>

                <h3 className="concurso-title">{c.nome}</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem' }}>
                  {c.descricao || 'Sem descrição cadastrada.'}
                </p>

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
                      {c.availableQuestionsCount !== undefined ? `${c.availableQuestionsCount} questões` : '—'}
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
                    ✏️ Editar
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

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginTop: 0, marginBottom: '1.25rem' }}>
              {editingId ? 'Editar Concurso' : 'Cadastrar Novo Concurso'}
            </h3>

            <form onSubmit={handleSaveForm}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Nome Identificador *
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  placeholder="Ex: ISS Araguari 2023 — Auditor Fiscal"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Órgão *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: Prefeitura de Araguari"
                    value={formData.orgao}
                    onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Banca
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: IBGP, FGV, FCC"
                    value={formData.banca}
                    onChange={(e) => setFormData({ ...formData, banca: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Ano
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    type="number"
                    value={formData.ano}
                    onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Cargo
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: Auditor Fiscal"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Código
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: 503"
                    value={formData.cargoCodigo}
                    onChange={(e) => setFormData({ ...formData, cargoCodigo: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Descrição e Notas
                </label>
                <textarea
                  className="form-control"
                  style={{ width: '100%', minHeight: '70px' }}
                  placeholder="Informações sobre data da prova, plano de preparação ou requisitos."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Salvar Concurso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
