import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './BibliotecaMateriais.css';

export interface StudyMaterialItem {
  id: string;
  concursoId?: string;
  disciplina: string;
  titulo: string;
  autor?: string;
  formato: 'PDF' | 'LIVRO' | 'VIDEO' | 'LEI_SECA' | 'LINK';
  totalPaginas: number;
  paginaAtual: number;
  urlOuCaminho?: string;
  notas?: string;
}

interface BibliotecaMateriaisProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy: (disciplina: string) => void;
}

export const BibliotecaMateriais: React.FC<BibliotecaMateriaisProps> = ({ activeConcurso, onNavigateToStudy }) => {
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('TODAS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [tempPageInput, setTempPageInput] = useState<number>(0);
  const [linkingMaterialId, setLinkingMaterialId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleAutoLinkMaterial = async (matId: string) => {
    setLinkingMaterialId(matId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/v1/materials/${matId}/auto-link`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFeedbackMsg(`✓ Vinculação concluída: ${data.totalLinksCreated || 0} associações criadas com tópicos do edital!`);
      } else {
        setFeedbackMsg('⚠️ Falha ao auto-vincular material ao edital.');
      }
    } catch {
      setFeedbackMsg('⚠️ Erro de conexão ao auto-vincular.');
    } finally {
      setLinkingMaterialId(null);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const handleAutoLinkAll = async () => {
    if (!activeConcurso?.id) return;
    setLinkingMaterialId('ALL');
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/v1/materials/auto-link-all?concursoId=${encodeURIComponent(activeConcurso.id)}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFeedbackMsg(`✓ Auto-vinculação em lote concluída: ${data.totalLinksCreated || 0} associações criadas!`);
      } else {
        setFeedbackMsg('⚠️ Falha ao processar auto-vinculação em lote.');
      }
    } catch {
      setFeedbackMsg('⚠️ Erro de conexão ao auto-vincular materiais.');
    } finally {
      setLinkingMaterialId(null);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formDisciplina, setFormDisciplina] = useState('');
  const [formAutor, setFormAutor] = useState('');
  const [formFormato, setFormFormato] = useState<'PDF' | 'LIVRO' | 'VIDEO' | 'LEI_SECA' | 'LINK'>('PDF');
  const [formTotalPaginas, setFormTotalPaginas] = useState<number>(100);
  const [formNotas, setFormNotas] = useState('');

  const loadMaterials = () => {
    const url = activeConcurso?.id
      ? `/api/v1/materials?concursoId=${encodeURIComponent(activeConcurso.id)}`
      : '/api/v1/materials';

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMaterials(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadMaterials();
  }, [activeConcurso?.id]);

  const uniqueDisciplinas = ['TODAS', ...Array.from(new Set(materials.map(m => m.disciplina))).filter(Boolean)];

  const filteredMaterials = selectedDisciplina === 'TODAS'
    ? materials
    : materials.filter(m => m.disciplina === selectedDisciplina);

  const handleSaveMaterial = async () => {
    if (!formTitulo.trim() || !formDisciplina.trim()) return;

    const newMaterial = {
      concursoId: activeConcurso?.id || null,
      disciplina: formDisciplina.trim(),
      titulo: formTitulo.trim(),
      autor: formAutor.trim() || null,
      formato: formFormato,
      totalPaginas: Number(formTotalPaginas) || 0,
      paginaAtual: 0,
      notas: formNotas.trim() || null
    };

    try {
      const res = await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaterial)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormTitulo('');
        setFormDisciplina('');
        setFormAutor('');
        setFormTotalPaginas(100);
        setFormNotas('');
        loadMaterials();
      }
    } catch {}
  };

  const handleQuickPageUpdate = async (material: StudyMaterialItem, newPage: number) => {
    const updated = {
      ...material,
      paginaAtual: Math.min(material.totalPaginas > 0 ? material.totalPaginas : 9999, Math.max(0, newPage))
    };

    try {
      await fetch('/api/v1/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setEditingPageId(null);
      loadMaterials();
    } catch {}
  };

  return (
    <div className="biblioteca-container animate-fade-in">
      {/* Header */}
      <div className="biblioteca-header glass">
        <div>
          <h2>📚 Biblioteca de Materiais & Teoria</h2>
          <p className="biblioteca-subtitle">
            Catálogo de livros, PDFs, legislação seca e apostilas associados ao edital de {activeConcurso?.nome || 'seu concurso'}
          </p>
        </div>
        <div className="biblioteca-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeConcurso?.id && (
            <button
              className="btn-add-material"
              style={{ background: '#1e293b', border: '1px solid #3b82f6', color: '#60a5fa' }}
              disabled={linkingMaterialId === 'ALL'}
              onClick={handleAutoLinkAll}
              title="Analisa o conteúdo dos materiais e associa aos tópicos do edital"
            >
              ⚡ {linkingMaterialId === 'ALL' ? 'Analisando...' : 'Auto-Vincular Todos ao Edital'}
            </button>
          )}
          <button className="btn-add-material" onClick={() => setIsModalOpen(true)}>
            + Cadastrar Material Didático
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="glass" style={{ borderLeft: '4px solid #3b82f6', padding: '12px 16px', marginBottom: '16px', background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd', fontSize: '13px' }}>
          {feedbackMsg}
        </div>
      )}

      {/* Filter Chips */}
      {uniqueDisciplinas.length > 1 && (
        <div className="materiais-filter-bar">
          {uniqueDisciplinas.map(disc => (
            <button
              key={disc}
              className={`filter-chip ${selectedDisciplina === disc ? 'active' : ''}`}
              onClick={() => setSelectedDisciplina(disc)}
            >
              {disc}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="materiais-grid">
        {filteredMaterials.map(mat => {
          const pct = mat.totalPaginas > 0
            ? Math.round((mat.paginaAtual / mat.totalPaginas) * 100)
            : 0;

          return (
            <div key={mat.id} className="material-card">
              <div>
                <div className="mat-top-meta">
                  <span className={`mat-format-badge format-${mat.formato.toLowerCase()}`}>
                    {mat.formato}
                  </span>
                  <span className="mat-disc-badge" title={mat.disciplina}>
                    {mat.disciplina}
                  </span>
                </div>

                <h3 className="mat-title">{mat.titulo}</h3>
                {mat.autor && <p className="mat-author">✍️ {mat.autor}</p>}
              </div>

              {/* Progress */}
              <div className="mat-progress-box">
                <div className="mat-progress-labels">
                  <span>Progresso de Leitura</span>
                  <strong>
                    {mat.paginaAtual} / {mat.totalPaginas > 0 ? mat.totalPaginas : '∞'} pág ({pct}%)
                  </strong>
                </div>
                <div className="mat-progress-track">
                  <div className="mat-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>

              {/* Actions */}
              <div className="mat-actions-row">
                {editingPageId === mat.id ? (
                  <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                    <input
                      type="number"
                      min="0"
                      max={mat.totalPaginas || 9999}
                      value={tempPageInput}
                      onChange={(e) => setTempPageInput(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '70px',
                        background: '#13161e',
                        border: '1px solid #4f8ef7',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      className="btn-update-page"
                      onClick={() => handleQuickPageUpdate(mat, tempPageInput)}
                    >
                      Salvar
                    </button>
                    <button
                      className="btn-update-page"
                      onClick={() => setEditingPageId(null)}
                      style={{ borderColor: '#2e3347', color: '#a1a6c2' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-update-page"
                    onClick={() => {
                      setEditingPageId(mat.id);
                      setTempPageInput(mat.paginaAtual);
                    }}
                  >
                    📖 Atualizar Pág.
                  </button>
                )}

                <button
                  className="btn-open-caderno"
                  style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: '#3b82f6', color: '#60a5fa' }}
                  disabled={linkingMaterialId === mat.id}
                  onClick={() => handleAutoLinkMaterial(mat.id)}
                  title="Analisar conteúdo e associar aos tópicos do edital"
                >
                  ⚡ {linkingMaterialId === mat.id ? '...' : 'Auto-Vincular'}
                </button>

                <button
                  className="btn-open-caderno"
                  onClick={() => onNavigateToStudy(mat.disciplina)}
                  title={`Praticar questões de ${mat.disciplina}`}
                >
                  📝 Questões
                </button>
              </div>
            </div>
          );
        })}

        {filteredMaterials.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: '#a1a6c2' }}>
            <p style={{ fontSize: '15px', marginBottom: '12px' }}>Nenhum material didático cadastrado ainda.</p>
            <button className="btn-add-material" onClick={() => setIsModalOpen(true)}>
              Cadastrar Primeiro Livro ou PDF
            </button>
          </div>
        )}
      </div>

      {/* Modal Add Material */}
      {isModalOpen && (
        <div className="mat-modal-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}>
          <div className="mat-modal-card">
            <div className="mat-modal-header">
              <h3>Adicionar Material de Estudo</h3>
              <button
                style={{ background: 'none', border: 'none', color: '#a1a6c2', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mat-modal-body">
              <div className="mat-input-group">
                <label>Título do Livro / Curso / PDF</label>
                <input
                  type="text"
                  placeholder="Ex: Direito Tributário Esquematizado"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                />
              </div>

              <div className="mat-form-row">
                <div className="mat-input-group">
                  <label>Disciplina</label>
                  <input
                    type="text"
                    placeholder="Ex: Direito Tributário"
                    value={formDisciplina}
                    onChange={(e) => setFormDisciplina(e.target.value)}
                  />
                </div>
                <div className="mat-input-group">
                  <label>Formato</label>
                  <select
                    value={formFormato}
                    onChange={(e) => setFormFormato(e.target.value as any)}
                  >
                    <option value="PDF">PDF / Apostila</option>
                    <option value="LIVRO">Livro Físico / Digital</option>
                    <option value="LEI_SECA">Legislação Seca</option>
                    <option value="VIDEO">Videoaula / Curso</option>
                    <option value="LINK">Link Externo</option>
                  </select>
                </div>
              </div>

              <div className="mat-form-row">
                <div className="mat-input-group">
                  <label>Autor / Instituição</label>
                  <input
                    type="text"
                    placeholder="Ex: Ricardo Alexandre / Estratégia"
                    value={formAutor}
                    onChange={(e) => setFormAutor(e.target.value)}
                  />
                </div>
                <div className="mat-input-group">
                  <label>Total de Páginas / Horas</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 850"
                    value={formTotalPaginas}
                    onChange={(e) => setFormTotalPaginas(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

              <div className="mat-input-group">
                <label>Notas e Informações Adicionais</label>
                <input
                  type="text"
                  placeholder="Ex: Edição 2026 com reforma tributária"
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                />
              </div>
            </div>

            <div className="mat-modal-footer">
              <button
                style={{
                  background: '#1a1e2a',
                  border: '1px solid #2e3347',
                  color: '#a1a6c2',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-add-material"
                onClick={handleSaveMaterial}
              >
                Salvar na Biblioteca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
