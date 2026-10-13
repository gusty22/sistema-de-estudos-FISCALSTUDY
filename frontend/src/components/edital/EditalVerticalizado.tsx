import React, { useState, useEffect } from 'react';
import './EditalVerticalizado.css';

export interface EditalDocument {
  id: string;
  concursoId: string;
  titulo: string;
  versao: string;
  tipo: string;
  filename: string;
  createdAt: string;
}

export interface EditalTopic {
  id: string;
  editalId: string;
  concursoId: string;
  disciplina: string;
  assunto: string;
  subassunto?: string;
  peso: number;
  questoesPrevistas?: number;
  docOrigem?: string;
  paginaOrigem?: number;
  trechoOrigem?: string;
  tipoClassificacao: string; // EXPLICITA, INFERIDA, CONFIRMADA
  confirmadoHumano: boolean;
}

interface EditalVerticalizadoProps {
  concursoId: string;
  concursoNome: string;
}

export default function EditalVerticalizado({ concursoId, concursoNome }: EditalVerticalizadoProps) {
  const [editais, setEditais] = useState<EditalDocument[]>([]);
  const [topicos, setTopicos] = useState<EditalTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de edição / adição
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState({
    disciplina: 'Direito Tributário',
    assunto: '',
    subassunto: '',
    peso: '1.0',
    questoesPrevistas: '',
    docOrigem: 'Edital 01/2023',
    paginaOrigem: '',
    trechoOrigem: '',
  });

  const loadEditalData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital`);
      if (!res.ok) throw new Error(`Falha ao carregar edital verticalizado (HTTP ${res.status})`);
      const data = await res.json();
      setEditais(data.editais || []);
      setTopicos(data.topicos || []);
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao carregar dados do edital.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (concursoId) {
      loadEditalData();
    }
  }, [concursoId]);

  const handleConfirmTopic = async (topicId: string) => {
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics/${topicId}/confirm`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Erro ao confirmar tópico.');
      const updated: EditalTopic = await res.json();
      setTopicos((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Deseja excluir este item do edital verticalizado?')) return;
    try {
      const res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics/${topicId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir tópico.');
      setTopicos((prev) => prev.filter((t) => t.id !== topicId));
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const handleOpenAddTopic = () => {
    setEditingTopicId(null);
    setTopicForm({
      disciplina: 'Direito Tributário',
      assunto: '',
      subassunto: '',
      peso: '1.0',
      questoesPrevistas: '',
      docOrigem: editais.length > 0 ? editais[0].titulo : 'Edital Normativo',
      paginaOrigem: '',
      trechoOrigem: '',
    });
    setIsTopicModalOpen(true);
  };

  const handleOpenEditTopic = (t: EditalTopic) => {
    setEditingTopicId(t.id);
    setTopicForm({
      disciplina: t.disciplina,
      assunto: t.assunto,
      subassunto: t.subassunto || '',
      peso: t.peso ? t.peso.toString() : '1.0',
      questoesPrevistas: t.questoesPrevistas ? t.questoesPrevistas.toString() : '',
      docOrigem: t.docOrigem || '',
      paginaOrigem: t.paginaOrigem ? t.paginaOrigem.toString() : '',
      trechoOrigem: t.trechoOrigem || '',
    });
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.disciplina.trim() || !topicForm.assunto.trim()) {
      alert('Disciplina e Assunto são obrigatórios.');
      return;
    }

    try {
      const payload = {
        disciplina: topicForm.disciplina.trim(),
        assunto: topicForm.assunto.trim(),
        subassunto: topicForm.subassunto.trim() || null,
        peso: topicForm.peso ? parseFloat(topicForm.peso) : 1.0,
        questoesPrevistas: topicForm.questoesPrevistas ? parseInt(topicForm.questoesPrevistas, 10) : null,
        docOrigem: topicForm.docOrigem.trim() || null,
        paginaOrigem: topicForm.paginaOrigem ? parseInt(topicForm.paginaOrigem, 10) : null,
        trechoOrigem: topicForm.trechoOrigem.trim() || null,
        tipoClassificacao: editingTopicId ? 'CONFIRMADA' : 'EXPLICITA',
        confirmadoHumano: true,
      };

      let res: Response;
      if (editingTopicId) {
        res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics/${editingTopicId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/v1/concursos/${concursoId}/edital/topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Falha ao salvar tópico.');
      setIsTopicModalOpen(false);
      loadEditalData();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  // Agrupamento por disciplina
  const groupedDisciplines: Record<string, EditalTopic[]> = {};
  topicos.forEach((t) => {
    if (!groupedDisciplines[t.disciplina]) {
      groupedDisciplines[t.disciplina] = [];
    }
    groupedDisciplines[t.disciplina].push(t);
  });

  const totalDisciplinas = Object.keys(groupedDisciplines).length;
  const totalConfirmados = topicos.filter((t) => t.confirmadoHumano).length;
  const percentConfirmado = topicos.length > 0 ? Math.round((totalConfirmados / topicos.length) * 100) : 0;

  return (
    <div className="edital-container animate-fade-in">
      <div className="edital-header">
        <div className="edital-title">
          <h2>📋 Edital Verticalizado Editável</h2>
          <p>
            Concurso: <strong style={{ color: '#60a5fa' }}>{concursoNome}</strong> • Rastreabilidade com página e trecho documental
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={handleOpenAddTopic} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            + Adicionar Tópico
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="glass" style={{ borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ color: '#ef4444', margin: 0 }}>⚠️ {errorMsg}</p>
        </div>
      )}

      {/* Estatísticas do Edital */}
      <div className="edital-stats-grid">
        <div className="edital-stat-card">
          <span className="edital-stat-label">Disciplinas Cadastradas</span>
          <span className="edital-stat-value">{totalDisciplinas}</span>
        </div>
        <div className="edital-stat-card">
          <span className="edital-stat-label">Total de Tópicos e Assuntos</span>
          <span className="edital-stat-value">{topicos.length}</span>
        </div>
        <div className="edital-stat-card">
          <span className="edital-stat-label">Verificação Humana</span>
          <span className="edital-stat-value" style={{ color: '#34d399' }}>
            {percentConfirmado}% ({totalConfirmados}/{topicos.length})
          </span>
        </div>
        <div className="edital-stat-card">
          <span className="edital-stat-label">Documentos Vinculados</span>
          <span className="edital-stat-value" style={{ color: '#60a5fa' }}>
            {editais.length}
          </span>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Carregando verticalização do edital...
        </div>
      )}

      {!isLoading && topicos.length === 0 && (
        <div className="glass" style={{ textAlign: 'center', padding: '3rem', borderRadius: '12px' }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Edital ainda não verticalizado</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            Adicione os tópicos programáticos manualmente ou importe o documento do edital.
          </p>
          <button className="btn" onClick={handleOpenAddTopic}>
            + Adicionar Primeiro Tópico
          </button>
        </div>
      )}

      {/* Árvore de Disciplinas e Tópicos */}
      {Object.entries(groupedDisciplines).map(([disciplina, items]) => (
        <div key={disciplina} className="discipline-card">
          <div className="discipline-header">
            <h3>{disciplina}</h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {items.length} {items.length === 1 ? 'tópico' : 'tópicos'}
            </span>
          </div>

          <table className="topics-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Assunto</th>
                <th style={{ width: '25%' }}>Subassunto</th>
                <th style={{ width: '10%' }}>Peso / Qtd</th>
                <th style={{ width: '20%' }}>Proveniência Documental</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{t.assunto}</div>
                    <div style={{ marginTop: '0.25rem' }}>
                      <span
                        className={`badge-classificacao badge-${t.tipoClassificacao.toLowerCase()}`}
                      >
                        {t.confirmadoHumano ? 'CONFIRMADO' : t.tipoClassificacao}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: t.subassunto ? '#cbd5e1' : '#64748b' }}>
                    {t.subassunto || '—'}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#60a5fa' }}>{t.peso}x</span>
                    {t.questoesPrevistas && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8' }}>
                        ~{t.questoesPrevistas} questões
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="provenance-info" title={t.trechoOrigem || ''}>
                      📄 {t.docOrigem || 'Edital Base'}
                      {t.paginaOrigem ? ` (pág. ${t.paginaOrigem})` : ''}
                    </div>
                    {t.trechoOrigem && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          fontStyle: 'italic',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        "{t.trechoOrigem}"
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {!t.confirmadoHumano && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#34d399', borderColor: '#34d399' }}
                          onClick={() => handleConfirmTopic(t.id)}
                          title="Confirmar verificação humana"
                        >
                          ✓ Confirmar
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => handleOpenEditTopic(t)}
                        title="Editar tópico"
                      >
                        ✏️
                      </button>
                      <button
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 6px' }}
                        onClick={() => handleDeleteTopic(t.id)}
                        title="Excluir tópico"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Modal de Tópico */}
      {isTopicModalOpen && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsTopicModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginTop: 0, marginBottom: '1.25rem' }}>
              {editingTopicId ? 'Editar Tópico do Edital' : 'Adicionar Tópico ao Edital Verticalizado'}
            </h3>

            <form onSubmit={handleSaveTopic}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Disciplina *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    value={topicForm.disciplina}
                    onChange={(e) => setTopicForm({ ...topicForm, disciplina: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Assunto Principal *
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    placeholder="Ex: Impostos Municipais"
                    value={topicForm.assunto}
                    onChange={(e) => setTopicForm({ ...topicForm, assunto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Subassunto / Detalhamento
                </label>
                <input
                  className="form-control"
                  style={{ width: '100%' }}
                  placeholder="Ex: IPTU, ISSQN e ITBI: Fato Gerador e Alíquotas"
                  value={topicForm.subassunto}
                  onChange={(e) => setTopicForm({ ...topicForm, subassunto: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Peso da Disciplina / Assunto
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.1"
                    style={{ width: '100%' }}
                    value={topicForm.peso}
                    onChange={(e) => setTopicForm({ ...topicForm, peso: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Questões Previstas no Edital
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="Ex: 10"
                    style={{ width: '100%' }}
                    value={topicForm.questoesPrevistas}
                    onChange={(e) => setTopicForm({ ...topicForm, questoesPrevistas: e.target.value })}
                  />
                </div>
              </div>

              <h4 style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', marginTop: '1.25rem' }}>
                Rastreabilidade e Proveniência (Documento Fonte)
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Documento de Origem
                  </label>
                  <input
                    className="form-control"
                    style={{ width: '100%' }}
                    value={topicForm.docOrigem}
                    onChange={(e) => setTopicForm({ ...topicForm, docOrigem: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Página do Edital
                  </label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="Ex: 42"
                    style={{ width: '100%' }}
                    value={topicForm.paginaOrigem}
                    onChange={(e) => setTopicForm({ ...topicForm, paginaOrigem: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Trecho ou Citação Exata do Documento
                </label>
                <textarea
                  className="form-control"
                  style={{ width: '100%', minHeight: '60px' }}
                  placeholder="Ex: Item 1.4 da Parte Específica — Impostos de Competência Municipal"
                  value={topicForm.trechoOrigem}
                  onChange={(e) => setTopicForm({ ...topicForm, trechoOrigem: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsTopicModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Salvar Tópico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
