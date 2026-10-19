import React, { useState, useEffect, useMemo } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import {
  FileText,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  Table,
  Brain,
  AlertTriangle,
  RotateCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Play
} from 'lucide-react';
import './ResumosEstrategicos.css';

interface ResumosEstrategicosProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy?: (disciplina: string, topico?: string) => void;
  onNavigateToConcursos?: () => void;
}

type ModeTab = 'RESUMO' | 'FICHAS' | 'MAPA' | 'COMPARATIVO' | 'FLASHCARDS' | 'PEGADINHAS';

export const ResumosEstrategicos: React.FC<ResumosEstrategicosProps> = ({
  activeConcurso,
  onNavigateToStudy,
  onNavigateToConcursos,
}) => {
  // Lista de resumos disponíveis
  const [summariesList, setSummariesList] = useState<any[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMode, setActiveMode] = useState<ModeTab>('RESUMO');

  // Filtros de seleção
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado do Flashcard Interativo (Frente/Verso)
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Modal de Criação / Geração de Novo Resumo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDisciplina, setNewDisciplina] = useState('Direito Tributário');
  const [newTopico, setNewTopico] = useState('');
  const [newMaterialNome, setNewMaterialNome] = useState('');
  const [newMaterialPaginas, setNewMaterialPaginas] = useState('');
  const [newTextoOrigem, setNewTextoOrigem] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Feedback de Ações
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // 1. Carregar lista de resumos
  const fetchSummaries = async () => {
    setIsLoading(true);
    try {
      const url = activeConcurso?.id
        ? `/api/v1/summaries?concursoId=${encodeURIComponent(activeConcurso.id)}`
        : '/api/v1/summaries';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummariesList(data);
        if (data.length > 0 && !selectedSummaryId) {
          setSelectedSummaryId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar resumos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Carregar resumo selecionado
  const fetchSelectedSummary = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/summaries/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveSummary(data);
        setCurrentCardIndex(0);
        setIsFlipped(false);
      }
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, [activeConcurso]);

  useEffect(() => {
    if (selectedSummaryId) {
      fetchSelectedSummary(selectedSummaryId);
    }
  }, [selectedSummaryId]);

  // Lista de disciplinas únicas para filtro
  const disciplinasList = useMemo(() => {
    const set = new Set<string>();
    summariesList.forEach((s) => {
      if (s.disciplina) set.add(s.disciplina);
    });
    return Array.from(set);
  }, [summariesList]);

  // Resumos filtrados
  const filteredSummaries = useMemo(() => {
    return summariesList.filter((s) => {
      const matchDisc = selectedDisciplina === 'TODAS' || s.disciplina === selectedDisciplina;
      const matchSearch =
        searchQuery === '' ||
        s.topico?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.disciplina?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDisc && matchSearch;
    });
  }, [summariesList, selectedDisciplina, searchQuery]);

  // Gerar novo resumo
  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopico.trim()) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/v1/summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concursoId: activeConcurso?.id || 'GLOBAL',
          disciplina: newDisciplina,
          topico: newTopico.trim(),
          banca: activeConcurso?.banca || 'Outra',
          materialOrigemNome: newMaterialNome || 'Material do Estudante',
          materialPaginas: newMaterialPaginas,
          textoOrigem: newTextoOrigem,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setIsModalOpen(false);
        setNewTopico('');
        setNewMaterialNome('');
        setNewMaterialPaginas('');
        setNewTextoOrigem('');
        await fetchSummaries();
        setSelectedSummaryId(created.id);
        setActionSuccessMsg('Novo resumo estratégico gerado com sucesso!');
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao gerar resumo:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Enviar flashcards para o Anki
  const handleSendToAnki = async () => {
    if (!activeSummary) return;
    try {
      const res = await fetch(`/api/v1/summaries/${activeSummary.id}/send-to-anki`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setActionSuccessMsg(data.message || 'Flashcards enviados para o Anki com sucesso!');
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao enviar flashcards:', err);
    }
  };

  // Marcar como revisado
  const handleMarkReviewed = async () => {
    if (!activeSummary) return;
    try {
      const res = await fetch(`/api/v1/summaries/${activeSummary.id}/mark-reviewed`, {
        method: 'POST',
      });
      if (res.ok) {
        setActionSuccessMsg('✓ Conteúdo registrado como revisado no seu histórico de estudos.');
        fetchSelectedSummary(activeSummary.id);
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao marcar revisão:', err);
    }
  };

  // Rotação de flashcard
  const flashcards = activeSummary?.flashcards || [];
  const currentCard = flashcards[currentCardIndex] || null;

  return (
    <div className="resumos-container">
      {/* 1. Header Hero Informativo */}
      <div className="resumos-hero">
        <div className="resumos-hero-left">
          <div className="resumos-tag-group">
            <span className="resumo-concurso-pill">
              🏛️ {activeConcurso?.nome || 'Concurso Ativo Padrão'}
            </span>
            {onNavigateToConcursos && (
              <button
                type="button"
                className="btn-action-secondary"
                style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: '6px' }}
                onClick={onNavigateToConcursos}
              >
                Trocar Concurso ↗
              </button>
            )}
            <span className="resumo-concurso-pill" style={{ background: 'rgba(5, 150, 105, 0.08)', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.2)' }}>
              🎯 Banca: {activeConcurso?.banca || 'Não definida'}
            </span>
            {activeSummary?.nivel_relevancia && (
              <span className={`relevancia-badge ${activeSummary.nivel_relevancia.toLowerCase()}`}>
                {activeSummary.nivel_relevancia === 'ESSENCIAL' && '⚡ ESSENCIAL PARA A PROVA'}
                {activeSummary.nivel_relevancia === 'ALTA' && '🔥 ALTA RELEVÂNCIA'}
                {activeSummary.nivel_relevancia === 'MANUTENCAO' && '🛡️ MANUTENÇÃO'}
                {activeSummary.nivel_relevancia === 'COMPLEMENTAR' && '📖 COMPLEMENTAR'}
              </span>
            )}
          </div>
          <h1 className="resumos-hero-title">
            {activeSummary?.topico || 'Resumos Estratégicos & Síntese de Edital'}
          </h1>
          <p className="resumos-hero-desc">
            {activeSummary?.disciplina
              ? `Disciplina: ${activeSummary.disciplina} • Alta densidade informacional orientada a regras, exceções e questões.`
              : 'Transforme materiais extensos em sínteses direcionadas ao edital e ao perfil da banca examinadora.'}
          </p>
        </div>

        <div className="resumos-hero-actions">
          {activeSummary && (
            <button
              className="btn-action-primary"
              onClick={() => onNavigateToStudy?.(activeSummary.disciplina, activeSummary.topico)}
              title="Resolver bateria de questões deste assunto"
            >
              <Play className="w-4 h-4 fill-white" /> Praticar Questões do Tópico
            </button>
          )}

          <button
            className="btn-action-secondary"
            onClick={() => setIsModalOpen(true)}
            title="Criar novo resumo inteligente"
          >
            <Plus className="w-4 h-4" /> Novo Resumo Estratégico
          </button>
        </div>
      </div>

      {/* Banner de Feedback de Ações */}
      {actionSuccessMsg && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.25)', borderRadius: '10px', color: '#065f46', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 className="w-4 h-4" /> {actionSuccessMsg}
        </div>
      )}

      {/* Estado de Carregamento */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'var(--calm-card-bg)', border: '1px solid var(--calm-card-border)', borderRadius: '10px' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid #cbd5e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.84rem', color: 'var(--calm-text-muted)' }}>
            Carregando resumos estratégicos e cruzando com evidências do edital...
          </span>
        </div>
      )}

      {/* 2. Barra de Seleção de Resumo & Filtro */}
      <div className="resumos-selector-bar">
        <div className="selector-controls-left">
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
            Selecione o Tópico:
          </label>
          <select
            className="custom-select"
            value={selectedSummaryId || ''}
            onChange={(e) => setSelectedSummaryId(e.target.value)}
            style={{ minWidth: '280px' }}
          >
            {filteredSummaries.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.disciplina}] {s.topico} ({s.nivel_relevancia})
              </option>
            ))}
          </select>

          <select
            className="custom-select"
            value={selectedDisciplina}
            onChange={(e) => setSelectedDisciplina(e.target.value)}
          >
            <option value="TODAS">Todas as Disciplinas</option>
            {disciplinasList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="custom-select"
            placeholder="Buscar tópico ou palavra-chave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '220px' }}
          />
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
          {filteredSummaries.length} resumo(s) no acervo
        </div>
      </div>

      {/* 3. Abas das 6 Modalidades de Estudo */}
      <div className="resumos-modes-tabs">
        <button
          className={`resumo-mode-btn ${activeMode === 'RESUMO' ? 'active' : ''}`}
          onClick={() => setActiveMode('RESUMO')}
        >
          <FileText className="w-4 h-4" /> 1. Resumo Estruturado
        </button>
        <button
          className={`resumo-mode-btn ${activeMode === 'FICHAS' ? 'active' : ''}`}
          onClick={() => setActiveMode('FICHAS')}
        >
          <Layers className="w-4 h-4" /> 2. Fichas Rápidas ({activeSummary?.fichasRapidas?.length || 0})
        </button>
        <button
          className={`resumo-mode-btn ${activeMode === 'MAPA' ? 'active' : ''}`}
          onClick={() => setActiveMode('MAPA')}
        >
          <Brain className="w-4 h-4" /> 3. Mapa Mental
        </button>
        <button
          className={`resumo-mode-btn ${activeMode === 'COMPARATIVO' ? 'active' : ''}`}
          onClick={() => setActiveMode('COMPARATIVO')}
        >
          <Table className="w-4 h-4" /> 4. Quadros Comparativos ({activeSummary?.quadrosComparativos?.length || 0})
        </button>
        <button
          className={`resumo-mode-btn ${activeMode === 'FLASHCARDS' ? 'active' : ''}`}
          onClick={() => setActiveMode('FLASHCARDS')}
        >
          <Sparkles className="w-4 h-4" /> 5. Flashcards Inteligentes ({flashcards.length})
        </button>
        <button
          className={`resumo-mode-btn ${activeMode === 'PEGADINHAS' ? 'active' : ''}`}
          onClick={() => setActiveMode('PEGADINHAS')}
        >
          <AlertTriangle className="w-4 h-4" /> 6. Pegadinhas & Reta Final
        </button>
      </div>

      {/* 4. Layout Principal: Conteúdo + Painel de Rastreabilidade */}
      {activeSummary && (
        <div className="resumo-main-grid">
          {/* Painel Central de Conteúdo */}
          <div className="resumo-content-panel">
            {/* Justificativa Pedagógica e Relevância */}
            <div className="resumo-justificativa-box">
              <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <div>
                <strong>Por que este conteúdo merece seu tempo?</strong>
                <div>{activeSummary.justificativa_prioridade}</div>
              </div>
            </div>

            {/* MODALIDADE 1: RESUMO ESTRUTURADO */}
            {activeMode === 'RESUMO' && (
              <div className="resumo-markdown-body">
                <div
                  dangerouslySetInnerHTML={{
                    __html: activeSummary.resumo_markdown
                      ?.replace(/# (.*)/g, '<h1>$1</h1>')
                      ?.replace(/## (.*)/g, '<h2>$1</h2>')
                      ?.replace(/### (.*)/g, '<h3>$1</h3>')
                      ?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      ?.replace(/\*(.*?)\*/g, '<em>$1</em>')
                      ?.replace(/\n\n/g, '<br/><br/>')
                      ?.replace(/^\* (.*)/gm, '<li>$1</li>') || '<p>Sem conteúdo disponível.</p>',
                  }}
                />
              </div>
            )}

            {/* MODALIDADE 2: FICHAS RÁPIDAS */}
            {activeMode === 'FICHAS' && (
              <div className="fichas-grid">
                {(activeSummary.fichasRapidas || []).map((ficha: any, idx: number) => (
                  <div key={idx} className="ficha-card">
                    <div className="ficha-header">
                      <span className="ficha-title">{ficha.titulo}</span>
                      <span className="ficha-pill" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                        Ficha #{idx + 1}
                      </span>
                    </div>

                    <div className="ficha-section">
                      <span className="ficha-label">Conceito Essencial</span>
                      <span className="ficha-value">{ficha.conceito}</span>
                    </div>

                    <div className="ficha-section">
                      <span className="ficha-label">Regra Principal</span>
                      <span className="ficha-value" style={{ fontWeight: 600 }}>{ficha.regraGeral}</span>
                    </div>

                    {ficha.excecoes && ficha.excecoes.length > 0 && (
                      <div className="ficha-section">
                        <span className="ficha-label" style={{ color: '#d97706' }}>⚠️ Exceções Críticas</span>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--calm-text-main)' }}>
                          {ficha.excecoes.map((exc: string, i: number) => (
                            <li key={i}>{exc}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="ficha-section">
                      <span className="ficha-label">Palavras-Chave de Prova</span>
                      <div className="ficha-pills-row">
                        {(ficha.palavrasChave || []).map((p: string, i: number) => (
                          <span key={i} className="ficha-pill">{p}</span>
                        ))}
                      </div>
                    </div>

                    {ficha.erroComum && (
                      <div className="ficha-danger-box">
                        <strong>Erro Frequente:</strong> {ficha.erroComum}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* MODALIDADE 3: MAPA MENTAL & ESQUEMA */}
            {activeMode === 'MAPA' && (
              <div className="mindmap-container">
                <div className="mindmap-root-card">
                  🧠 {activeSummary.mapaMental?.raiz || activeSummary.topico}
                </div>

                <div className="mindmap-branches-grid">
                  {(activeSummary.mapaMental?.ramos || []).map((ramo: any, idx: number) => (
                    <div
                      key={idx}
                      className="mindmap-branch-card"
                      style={{ '--branch-color': ramo.cor } as React.CSSProperties}
                    >
                      <span className="mindmap-branch-title">{ramo.categoria}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                        {(ramo.subitens || []).map((item: string, i: number) => (
                          <div key={i} className="mindmap-branch-item">
                            <span style={{ color: ramo.cor }}>•</span> {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MODALIDADE 4: QUADROS COMPARATIVOS */}
            {activeMode === 'COMPARATIVO' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(activeSummary.quadrosComparativos || []).map((quadro: any, idx: number) => (
                  <div key={idx} className="comparativo-table-card">
                    <div>
                      <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1rem', color: 'var(--calm-text-main)' }}>
                        {quadro.titulo}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--calm-text-muted)' }}>
                        {quadro.descricao}
                      </p>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="comparativo-table">
                        <thead>
                          <tr>
                            {(quadro.colunas || []).map((col: string, i: number) => (
                              <th key={i}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(quadro.linhas || []).map((linha: any, i: number) => (
                            <tr key={i}>
                              {(quadro.colunas || []).map((col: string, j: number) => (
                                <td key={j} style={j === 0 ? { fontWeight: 700 } : {}}>
                                  {linha[col] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {quadro.pontoDeAtencaoBanca && (
                      <div className="comparativo-alert-footer">
                        <strong>📌 Ponto de Atenção da Banca:</strong> {quadro.pontoDeAtencaoBanca}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* MODALIDADE 5: FLASHCARDS INTELIGENTES */}
            {activeMode === 'FLASHCARDS' && (
              <div className="flashcards-interactive-box">
                {currentCard ? (
                  <>
                    <div style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)' }}>
                      Cartão {currentCardIndex + 1} de {flashcards.length} • Clique no cartão para virar
                    </div>

                    <div
                      className="flashcard-3d-wrapper"
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                        {/* Frente */}
                        <div className="flashcard-face front">
                          <span className="flashcard-tag">FRENTE • GATILHO DE RECUPERAÇÃO</span>
                          <div className="flashcard-question-text">{currentCard.frente}</div>
                          <span className="flashcard-flip-prompt">↺ Clique para ver a resposta</span>
                        </div>

                        {/* Verso */}
                        <div className="flashcard-face back">
                          <span className="flashcard-tag" style={{ color: '#059669' }}>
                            VERSO • FECHAMENTO CONCEITUAL
                          </span>
                          <div className="flashcard-question-text" style={{ fontSize: '0.98rem' }}>
                            {currentCard.verso}
                          </div>
                          {currentCard.referenciaOrigem && (
                            <span style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted)' }}>
                              Origem: {currentCard.referenciaOrigem}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Controles de Navegação */}
                    <div className="flashcard-controls-row">
                      <button
                        className="btn-action-secondary"
                        disabled={currentCardIndex === 0}
                        onClick={() => {
                          setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                          setIsFlipped(false);
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" /> Anterior
                      </button>

                      <button
                        className="btn-action-secondary"
                        onClick={() => setIsFlipped(!isFlipped)}
                      >
                        <RotateCw className="w-4 h-4" /> Virar Cartão
                      </button>

                      <button
                        className="btn-action-secondary"
                        disabled={currentCardIndex === flashcards.length - 1}
                        onClick={() => {
                          setCurrentCardIndex((prev) => Math.min(flashcards.length - 1, prev + 1));
                          setIsFlipped(false);
                        }}
                      >
                        Próximo <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                      <button className="btn-action-primary" onClick={handleSendToAnki}>
                        <Sparkles className="w-4 h-4 fill-white" /> Injetar Flashcards na Curadoria do Anki
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--calm-text-muted)' }}>Nenhum flashcard disponível para este tópico.</p>
                )}
              </div>
            )}

            {/* MODALIDADE 6: PEGADINHAS & RETA FINAL */}
            {activeMode === 'PEGADINHAS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="traps-list">
                  {(activeSummary.pegadinhasBanca || []).map((trap: any, idx: number) => (
                    <div key={idx} className="trap-card">
                      <div className="trap-header">
                        <span className="trap-title">{trap.pegadinhaAlerta || trap.padrao}</span>
                        <span className="ficha-pill" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          Armadilha #{idx + 1}
                        </span>
                      </div>
                      <div className="trap-desc">
                        <strong>Como a banca costuma induzir ao erro:</strong> {trap.comoBancaCobra}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)' }}>
                        <strong>Fundamento Correto:</strong> {trap.exemploQuestao}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumo de Reta Final (Véspera) */}
                {activeSummary.resumo_reta_final_markdown && (
                  <div className="reta-final-card">
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock className="w-4 h-4" /> Resumo de Última Revisão (Véspera de Prova)
                    </h3>
                    <div
                      className="resumo-markdown-body"
                      dangerouslySetInnerHTML={{
                        __html: activeSummary.resumo_reta_final_markdown
                          ?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          ?.replace(/^\* (.*)/gm, '<li>$1</li>')
                          ?.replace(/\n\n/g, '<br/>') || '',
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Painel Lateral: Rastreabilidade, Estatísticas & Ações */}
          <div className="resumo-sidebar-panel">
            {/* Card 1: Rastreabilidade e Fonte */}
            <div className="resumo-side-card">
              <span className="side-card-title">📌 Rastreabilidade & Origem</span>

              <div className="proveniencia-item">
                <span className="proveniencia-label">Material de Origem:</span>
                <span className="proveniencia-val">
                  {activeSummary.material_origem_nome || 'Apostila / Edital Base'}
                </span>
              </div>

              {activeSummary.material_paginas && (
                <div className="proveniencia-item">
                  <span className="proveniencia-label">Trecho / Páginas:</span>
                  <span className="proveniencia-val">{activeSummary.material_paginas}</span>
                </div>
              )}

              <div className="proveniencia-item">
                <span className="proveniencia-label">Tópico do Edital:</span>
                <span className="proveniencia-val">{activeSummary.topico}</span>
              </div>

              <div className="proveniencia-item">
                <span className="proveniencia-label">Banca Examinadora:</span>
                <span className="proveniencia-val">{activeSummary.banca || 'Padrão Oficial'}</span>
              </div>

              <div className="proveniencia-item">
                <span className="proveniencia-label">Última Revisão:</span>
                <span className="proveniencia-val">
                  {activeSummary.revisado_em ? new Date(activeSummary.revisado_em).toLocaleDateString('pt-BR') : 'Ainda não revisado'}
                </span>
              </div>
            </div>

            {/* Card 2: Evidências Estatísticas Reais */}
            <div className="resumo-side-card">
              <span className="side-card-title">📊 Evidências da Prova & Estudante</span>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span>Questões no Banco:</span>
                <strong>{activeSummary.estatisticasBase?.totalQuestoesNoBanco || 0}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span>Suas Resoluções:</span>
                <strong>{activeSummary.estatisticasBase?.questoesResolvidasPeloEstudante || 0}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span>Sua Taxa de Acerto:</span>
                <strong style={{ color: (activeSummary.estatisticasBase?.taxaAcertoEstudante || 0) < 60 ? '#dc2626' : '#059669' }}>
                  {activeSummary.estatisticasBase?.taxaAcertoEstudante || 0}%
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span>Peso no Edital:</span>
                <strong>Peso {activeSummary.estatisticasBase?.pesoEdital || 2}</strong>
              </div>

              {activeSummary.estatisticasBase?.limitacaoDadosExplicita && (
                <div style={{ background: 'rgba(217, 119, 6, 0.08)', padding: '0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#92400e', lineHeight: 1.4 }}>
                  ℹ️ {activeSummary.estatisticasBase.limitacaoDadosExplicita}
                </div>
              )}
            </div>

            {/* Card 3: Ações Rápidas */}
            <div className="resumo-side-card">
              <span className="side-card-title">⚡ Ações de Aprendizado</span>

              <button
                className="btn-action-primary"
                style={{ width: '100%' }}
                onClick={() => onNavigateToStudy?.(activeSummary.disciplina, activeSummary.topico)}
              >
                <Play className="w-4 h-4 fill-white" /> Praticar Questões do Tópico
              </button>

              <button
                className="btn-action-secondary"
                style={{ width: '100%' }}
                onClick={handleSendToAnki}
              >
                <Sparkles className="w-4 h-4" /> Enviar Flashcards ao Anki
              </button>

              <button
                className="btn-action-secondary"
                style={{ width: '100%' }}
                onClick={handleMarkReviewed}
              >
                <CheckCircle2 className="w-4 h-4" /> Marcar como Revisado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / GERAR NOVO RESUMO ESTRATÉGICO */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !isGenerating && setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--calm-text-main)' }}>
                📑 Gerar Novo Resumo Estratégico Orientado ao Edital
              </h2>
              <button
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--calm-text-muted)' }}
                onClick={() => setIsModalOpen(false)}
                disabled={isGenerating}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateSummary}>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--calm-text-main)' }}>
                    Disciplina:
                  </label>
                  <select
                    className="custom-select"
                    style={{ width: '100%', marginTop: '0.3rem' }}
                    value={newDisciplina}
                    onChange={(e) => setNewDisciplina(e.target.value)}
                  >
                    <option value="Direito Tributário">Direito Tributário</option>
                    <option value="Direito Constitucional">Direito Constitucional</option>
                    <option value="Direito Administrativo">Direito Administrativo</option>
                    <option value="Contabilidade Geral">Contabilidade Geral</option>
                    <option value="Auditoria">Auditoria</option>
                    <option value="Legislação Tributária Municipal">Legislação Tributária Municipal</option>
                    <option value="Língua Portuguesa">Língua Portuguesa</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--calm-text-main)' }}>
                    Tópico do Edital *:
                  </label>
                  <input
                    type="text"
                    className="custom-select"
                    style={{ width: '100%', marginTop: '0.3rem' }}
                    placeholder="Ex: Lançamento Tributário e Decadência"
                    value={newTopico}
                    onChange={(e) => setNewTopico(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--calm-text-main)' }}>
                      Material de Origem:
                    </label>
                    <input
                      type="text"
                      className="custom-select"
                      style={{ width: '100%', marginTop: '0.3rem' }}
                      placeholder="Ex: Apostila Aula 04"
                      value={newMaterialNome}
                      onChange={(e) => setNewMaterialNome(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--calm-text-main)' }}>
                      Páginas / Seção:
                    </label>
                    <input
                      type="text"
                      className="custom-select"
                      style={{ width: '100%', marginTop: '0.3rem' }}
                      placeholder="Ex: Páginas 15-32"
                      value={newMaterialPaginas}
                      onChange={(e) => setNewMaterialPaginas(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--calm-text-main)' }}>
                    Anotações Pessoais, Trecho de PDF ou Transcrição (Opcional):
                  </label>
                  <textarea
                    className="custom-select"
                    style={{ width: '100%', height: '110px', marginTop: '0.3rem', resize: 'vertical' }}
                    placeholder="Cole aqui transcrições de aula, anotações de lei seca ou trechos de PDF para enriquecer a extração inteligente..."
                    value={newTextoOrigem}
                    onChange={(e) => setNewTextoOrigem(e.target.value)}
                  />
                </div>

                <div style={{ background: 'var(--calm-bg-subtle, #f8fafc)', border: '1px solid var(--calm-card-border, #e2e8f0)', padding: '0.85rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--calm-text-muted)', lineHeight: 1.45 }}>
                  🎯 <strong>Garantia Epistêmica:</strong> A síntese cruzará os pesos do edital e as questões da banca com o material fornecido, preservando regras, exceções e rastreabilidade estrita sem alucinações.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-action-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isGenerating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-action-primary"
                  disabled={isGenerating || !newTopico.trim()}
                >
                  {isGenerating ? 'Processando Síntese...' : 'Gerar Resumo Estratégico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumosEstrategicos;
