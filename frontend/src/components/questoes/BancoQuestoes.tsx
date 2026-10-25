import React, { useState, useEffect, useCallback } from 'react';
import {
  Filter,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Flag,
  FileText,
  Play,
  Layers,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Database
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import { MontagemCadernoModal } from './MontagemCadernoModal';
import { ResolucaoQuestaoModal } from './ResolucaoQuestaoModal';
import { QuestionClassificationPanel } from './QuestionClassificationPanel';
import { useSimplifiedMode } from '../../context/SimplifiedModeContext';
import './BancoQuestoes.css';

export interface QuestionItem {
  questionId: string;
  concursoId?: string;
  statement: string;
  discipline: string;
  topic: string;
  board: string;
  year: number;
  orgao?: string;
  cargo?: string;
  gabaritoStatus: string;
  numeroOriginal?: any;
  arquivoOrigem?: string;
  isFavorite: boolean;
  tentativasTotal: number;
  acertosTotal: number;
  taxaAcertoPessoal: number | null;
  options: string[];
  tipoQuestao?: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
  supportMaterial?: any;
}

interface BancoQuestoesProps {
  activeConcurso: ConcursoItem | null;
  onResolveQuestion?: (questionId: string) => void;
  onStartCaderno?: (cadernoConfig: any) => void;
}

export const BancoQuestoes: React.FC<BancoQuestoesProps> = ({
  activeConcurso
}) => {
  const { isSimplifiedMode } = useSimplifiedMode();
  // Estado de resolução ativa focada (abre a questão diretamente sem redirecionar de tela)
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [resolvendoIndex, setResolvendoIndex] = useState<number | null>(null);
  // Modo de escopo: apenas disciplinas do edital ou acervo geral
  const [editalOnly, setEditalOnly] = useState<boolean>(true);

  // Filtros
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('TODAS');
  const [selectedBanca, setSelectedBanca] = useState<string>('TODAS');
  const [selectedAno, setSelectedAno] = useState<string>('TODOS');
  const [selectedCargo, setSelectedCargo] = useState<string>('TODOS');
  const [selectedOrgao, setSelectedOrgao] = useState<string>('TODOS');
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');
  const [selectedSituacao, setSelectedSituacao] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');

  // Metadados dinâmicos e estritamente reais retornados pelo backend
  const [filterMetadata, setFilterMetadata] = useState<{
    bancas: string[];
    anos: number[];
    orgaos: string[];
    cargos: string[];
    disciplinas: string[];
    tiposQuestao: string[];
    editalDisciplinas: Array<{ nome: string; questoesDisponiveis: number }>;
  }>({
    bancas: [],
    anos: [],
    orgaos: [],
    cargos: [],
    disciplinas: [],
    tiposQuestao: ['MULTIPLA_ESCOLHA'],
    editalDisciplinas: []
  });

  // Resultados
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modais
  const [isCadernoModalOpen, setIsCadernoModalOpen] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('ERRO_GABARITO');
  const [reportDesc, setReportDesc] = useState('');

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Carregar metadados dos filtros dinamicamente com base nas seleções ativas
  const fetchFilterMetadata = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeConcurso?.id) params.set('concursoId', activeConcurso.id);
      if (editalOnly) params.set('editalOnly', 'true');
      if (selectedDisciplina !== 'TODAS') params.set('disciplina', selectedDisciplina);
      if (selectedBanca !== 'TODAS') params.set('banca', selectedBanca);
      if (selectedAno !== 'TODOS') params.set('ano', selectedAno);
      if (selectedCargo !== 'TODOS') params.set('cargo', selectedCargo);
      if (selectedOrgao !== 'TODOS') params.set('orgao', selectedOrgao);
      if (selectedTipo !== 'TODOS') params.set('tipoQuestao', selectedTipo);
      if (selectedSituacao !== 'TODAS') params.set('situacao', selectedSituacao);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/v1/bank/filters-metadata?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFilterMetadata(prev => ({
          ...prev,
          bancas: data.bancas || [],
          anos: data.anos || [],
          orgaos: data.orgaos || [],
          cargos: data.cargos || [],
          disciplinas: data.disciplinas || [],
          tiposQuestao: data.tiposQuestao || ['MULTIPLA_ESCOLHA'],
          editalDisciplinas: data.editalDisciplinas || prev.editalDisciplinas
        }));

        // Se a seleção atual deixou de existir nos metadados válidos combinados, reseta para neutro
        if (selectedBanca !== 'TODAS' && data.bancas && !data.bancas.includes(selectedBanca)) {
          setSelectedBanca('TODAS');
        }
        if (selectedAno !== 'TODOS' && data.anos && !data.anos.map((a: number) => a.toString()).includes(selectedAno)) {
          setSelectedAno('TODOS');
        }
        if (selectedDisciplina !== 'TODAS' && data.disciplinas && !data.disciplinas.includes(selectedDisciplina)) {
          setSelectedDisciplina('TODAS');
        }
        if (selectedOrgao !== 'TODOS' && data.orgaos && !data.orgaos.includes(selectedOrgao)) {
          setSelectedOrgao('TODOS');
        }
        if (selectedCargo !== 'TODOS' && data.cargos && !data.cargos.includes(selectedCargo)) {
          setSelectedCargo('TODOS');
        }
      }
    } catch {
      // Falha silenciosa de metadados
    }
  }, [
    activeConcurso?.id,
    editalOnly,
    selectedDisciplina,
    selectedBanca,
    selectedAno,
    selectedCargo,
    selectedOrgao,
    selectedTipo,
    selectedSituacao,
    searchQuery
  ]);

  useEffect(() => {
    fetchFilterMetadata();
  }, [fetchFilterMetadata]);

  // Buscar questões
  const fetchQuestions = useCallback(async (targetPage = 0) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeConcurso?.id) params.set('concursoId', activeConcurso.id);
      if (editalOnly) params.set('editalOnly', 'true');
      if (selectedDisciplina !== 'TODAS') params.set('disciplina', selectedDisciplina);
      if (selectedBanca !== 'TODAS') params.set('banca', selectedBanca);
      if (selectedAno !== 'TODOS') params.set('ano', selectedAno);
      if (selectedCargo !== 'TODOS') params.set('cargo', selectedCargo);
      if (selectedOrgao !== 'TODOS') params.set('orgao', selectedOrgao);
      if (selectedTipo !== 'TODOS') params.set('tipoQuestao', selectedTipo);
      if (selectedSituacao !== 'TODAS') params.set('situacao', selectedSituacao);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      params.set('page', targetPage.toString());
      params.set('limit', '15');

      const res = await fetch(`/api/v1/bank/questions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setTotalElements(data.totalElements || 0);
        setPage(data.page || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      showFeedback('Erro ao carregar banco de questões.');
    } finally {
      setIsLoading(false);
    }
  }, [
    activeConcurso?.id,
    editalOnly,
    selectedDisciplina,
    selectedBanca,
    selectedAno,
    selectedCargo,
    selectedOrgao,
    selectedTipo,
    selectedSituacao,
    searchQuery
  ]);

  useEffect(() => {
    fetchQuestions(0);
  }, [fetchQuestions]);

  // Alternar favorito
  const handleToggleFavorite = async (questionId: string) => {
    try {
      const res = await fetch(`/api/v1/bank/questions/${questionId}/favorite`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setQuestions(prev => prev.map(q => q.questionId === questionId ? { ...q, isFavorite: data.isFavorite } : q));
        showFeedback(data.isFavorite ? 'Questão adicionada aos favoritos!' : 'Questão removida dos favoritos.');
      }
    } catch {
      showFeedback('Falha ao atualizar favorito.');
    }
  };

  // Enviar reporte
  const handleSendReport = async () => {
    if (!reportQuestionId) return;
    try {
      await fetch(`/api/v1/bank/questions/${reportQuestionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: reportReason, descricao: reportDesc })
      });
      showFeedback('Obrigado! O reporte foi registrado para auditoria.');
      setReportQuestionId(null);
      setReportDesc('');
    } catch {
      showFeedback('Falha ao registrar reporte.');
    }
  };

  const limparFiltros = () => {
    setSelectedDisciplina('TODAS');
    setSelectedBanca('TODAS');
    setSelectedAno('TODOS');
    setSelectedCargo('TODOS');
    setSelectedOrgao('TODOS');
    setSelectedTipo('TODOS');
    setSelectedSituacao('TODAS');
    setSearchQuery('');
  };

  return (
    <div className="banco-questoes-wrapper">
      {/* Header */}
      {classificationOpen && <QuestionClassificationPanel concursoId={activeConcurso?.id} onClose={() => setClassificationOpen(false)} />}
      <button type="button" className="btn btn-secondary" onClick={() => setClassificationOpen(true)}>Classificar questões por tópico</button>
      <div className="banco-header">
        <div className="banco-header-info">
          <h1>Banco de Questões</h1>
          <p>
            Pesquise e selecione questões de provas anteriores calibradas para seu objetivo. Sem gabarito prévio visível para preservar o objetivo pedagógico.
          </p>
        </div>

        <button
          className="btn-q-action primary"
          style={{ padding: '0.65rem 1.25rem', fontSize: '0.84rem' }}
          onClick={() => setIsCadernoModalOpen(true)}
        >
          <Layers className="w-4 h-4" /> Criar Caderno com Estes Filtros
        </button>
      </div>

      {feedback && (
        <div style={{
          padding: '0.65rem 1rem',
          borderRadius: '8px',
          background: 'rgba(79, 70, 229, 0.1)',
          border: '1px solid var(--calm-primary, #4f46e5)',
          color: 'var(--calm-primary, #4f46e5)',
          fontSize: '0.84rem',
          fontWeight: 600
        }}>
          {feedback}
        </div>
      )}

      {/* Seletor de Escopo: Edital do Concurso Ativo vs Acervo Geral */}
      {activeConcurso && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          background: 'var(--calm-card-bg, #ffffff)',
          border: '1px solid var(--calm-card-border, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <div style={{ fontSize: '0.85rem', color: 'var(--calm-text)' }}>
              Concurso Ativo: <strong>{activeConcurso.cargo || activeConcurso.nome}</strong> ({activeConcurso.orgao})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn-q-action ${editalOnly ? 'primary' : ''}`}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
              onClick={() => {
                setEditalOnly(true);
                setSelectedDisciplina('TODAS');
              }}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1 inline" /> Disciplinas do Edital
            </button>
            <button
              type="button"
              className={`btn-q-action ${!editalOnly ? 'primary' : ''}`}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
              onClick={() => {
                setEditalOnly(false);
                setSelectedDisciplina('TODAS');
              }}
            >
              <Database className="w-3.5 h-3.5 mr-1 inline" /> Todo o Acervo
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal: Filtros à esquerda e Resultados à direita */}
      <div className="banco-layout-grid">
        {/* ===================================================================
            PAINEL ESQUERDO: FILTROS (T18)
            =================================================================== */}
        <aside className="banco-filtros-aside">
          <div className="filtros-header-row">
            <h3>
              <Filter className="w-4 h-4 text-indigo-400" /> Filtros de Pesquisa
            </h3>
            <button className="btn-limpar-filtros" onClick={limparFiltros}>
              Limpar
            </button>
          </div>

          {/* Busca por texto */}
          <div className="filtro-group">
            <label className="filtro-label">Termo no Enunciado</label>
            <input
              type="text"
              className="filtro-input"
              placeholder="Digite palavra-chave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Situação da Questão */}
          <div className="filtro-group">
            <label className="filtro-label">Situação da Questão</label>
            <select
              className="filtro-select"
              value={selectedSituacao}
              onChange={(e) => setSelectedSituacao(e.target.value)}
            >
              <option value="TODAS">Todas as Questões</option>
              <option value="NUNCA_RESPONDIDA">Nunca Respondida</option>
              <option value="ERRADAS">Respondida Incorretamente</option>
              <option value="BAIXA_CONFIANCA">Acertada com Baixa Confiança</option>
              <option value="FAVORITAS">Favoritas ⭐</option>
              <option value="PENDENTE_REVISAO">Pendente de Revisão</option>
            </select>
          </div>

          {/* Disciplina */}
          <div className="filtro-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="filtro-label">Disciplina</label>
              {filterMetadata.disciplinas.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--calm-text-muted)' }}>
                  ({filterMetadata.disciplinas.length})
                </span>
              )}
            </div>
            <select
              className="filtro-select"
              value={selectedDisciplina}
              onChange={(e) => setSelectedDisciplina(e.target.value)}
            >
              <option value="TODAS">Todas as Disciplinas</option>
              {filterMetadata.disciplinas.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Banca */}
          <div className="filtro-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="filtro-label">Banca Examinadora</label>
              {filterMetadata.bancas.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--calm-text-muted)' }}>
                  ({filterMetadata.bancas.length})
                </span>
              )}
            </div>
            <select
              className="filtro-select"
              value={selectedBanca}
              onChange={(e) => setSelectedBanca(e.target.value)}
            >
              <option value="TODAS">Todas as Bancas</option>
              {filterMetadata.bancas.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Ano */}
          <div className="filtro-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="filtro-label">Ano</label>
              {filterMetadata.anos.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--calm-text-muted)' }}>
                  ({filterMetadata.anos.length})
                </span>
              )}
            </div>
            <select
              className="filtro-select"
              value={selectedAno}
              onChange={(e) => setSelectedAno(e.target.value)}
            >
              <option value="TODOS">Todos os Anos</option>
              {filterMetadata.anos.map(a => (
                <option key={a} value={a.toString()}>{a}</option>
              ))}
            </select>
          </div>

          {/* Órgão (Filtro Dinâmico Real) */}
          {filterMetadata.orgaos.length > 0 && (
            <div className="filtro-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="filtro-label">Órgão</label>
                <span style={{ fontSize: '0.7rem', color: 'var(--calm-text-muted)' }}>
                  ({filterMetadata.orgaos.length})
                </span>
              </div>
              <select
                className="filtro-select"
                value={selectedOrgao}
                onChange={(e) => setSelectedOrgao(e.target.value)}
              >
                <option value="TODOS">Todos os Órgãos</option>
                {filterMetadata.orgaos.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cargo (Filtro Dinâmico Real) */}
          {filterMetadata.cargos.length > 0 && (
            <div className="filtro-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="filtro-label">Cargo</label>
                <span style={{ fontSize: '0.7rem', color: 'var(--calm-text-muted)' }}>
                  ({filterMetadata.cargos.length})
                </span>
              </div>
              <select
                className="filtro-select"
                value={selectedCargo}
                onChange={(e) => setSelectedCargo(e.target.value)}
              >
                <option value="TODOS">Todos os Cargos</option>
                {filterMetadata.cargos.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tipo de Questão (Derivado estritamente dos dados reais) */}
          {filterMetadata.tiposQuestao.length > 1 && (
            <div className="filtro-group">
              <label className="filtro-label">Tipo de Questão</label>
              <select
                className="filtro-select"
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
              >
                <option value="TODOS">Todos os Tipos</option>
                {filterMetadata.tiposQuestao.includes('MULTIPLA_ESCOLHA') && (
                  <option value="MULTIPLA_ESCOLHA">Múltipla Escolha</option>
                )}
                {filterMetadata.tiposQuestao.includes('CERTO_ERRADO') && (
                  <option value="CERTO_ERRADO">Certo / Errado</option>
                )}
              </select>
            </div>
          )}

          {/* Resumo da Cobertura do Edital */}
          {editalOnly && filterMetadata.editalDisciplinas.length > 0 && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '8px',
              background: 'var(--calm-bg-subtle, #f8fafc)',
              border: '1px solid var(--calm-card-border, #e2e8f0)',
              fontSize: '0.74rem'
            }}>
              <div style={{ fontWeight: 600, color: 'var(--calm-text)', marginBottom: '0.4rem' }}>
                Disciplinas do Edital de Referência:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {filterMetadata.editalDisciplinas.map(ed => (
                  <div
                    key={ed.nome}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: ed.questoesDisponiveis > 0 ? 'var(--calm-text)' : 'var(--calm-text-muted)'
                    }}
                  >
                    <span>{ed.nome}</span>
                    <span style={{
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      background: ed.questoesDisponiveis > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: ed.questoesDisponiveis > 0 ? '#059669' : '#dc2626'
                    }}>
                      {ed.questoesDisponiveis > 0 ? `${ed.questoesDisponiveis} q.` : '0 q.'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ===================================================================
            PAINEL DIREITO: RESULTADOS (T18)
            =================================================================== */}
        <main className="banco-resultados-col">
          {/* Barra de Contagem e Paginação */}
          <div className="resultados-topo-bar">
            <span style={{ fontSize: '0.86rem', color: 'var(--calm-text)' }}>
              Encontradas <strong>{totalElements}</strong> questões elegíveis
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
                Página {page + 1} de {totalPages || 1}
              </span>
              <button
                className="btn-q-action"
                disabled={page <= 0 || isLoading}
                onClick={() => fetchQuestions(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="btn-q-action"
                disabled={page >= totalPages - 1 || isLoading}
                onClick={() => fetchQuestions(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de Questões */}
          {isLoading ? (
            <div role="status" aria-live="polite" style={{ padding: '3rem', textAlign: 'center', color: 'var(--calm-text-muted)' }}>
              Carregando questões do acervo...
            </div>
          ) : questions.length === 0 ? (
            <div role="status" aria-live="polite" style={{
              padding: '3rem',
              textAlign: 'center',
              borderRadius: '14px',
              border: '1px dashed var(--calm-card-border)',
              background: 'var(--calm-card-bg)',
              color: 'var(--calm-text-muted)'
            }}>
              Nenhuma questão encontrada com os filtros selecionados. Tente expandir sua busca.
            </div>
          ) : (
            questions.map((q, qIndex) => {
              const isAnulada = q.gabaritoStatus === 'ANULADA';
              return (
                <div key={q.questionId} className="question-card-item">
                  <div className="question-card-header">
                    <div className="question-tags-row">
                      <span className="badge-tag-q discipline">{q.discipline}</span>
                      <span className="badge-tag-q">{q.topic || 'Geral'}</span>
                      <span className="badge-tag-q">{q.board} • {q.year}</span>
                      {q.orgao && <span className="badge-tag-q">{q.orgao}</span>}
                      {q.tipoQuestao && (
                        <span className="badge-tag-q">
                          {q.tipoQuestao === 'CERTO_ERRADO' ? 'C/E' : 'Múltipla Escolha'}
                        </span>
                      )}
                      {isAnulada ? (
                        <span className="badge-tag-q anulada">
                          <AlertTriangle className="w-3 h-3 inline mr-1" /> Anulada
                        </span>
                      ) : (
                        <span className="badge-tag-q validada">
                          <CheckCircle2 className="w-3 h-3 inline mr-1" /> Validada
                        </span>
                      )}
                    </div>

                    {!isSimplifiedMode && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--calm-text-muted)', fontFamily: 'monospace' }}>
                        ID: {q.questionId}
                      </div>
                    )}
                  </div>

                  {/* Enunciado */}
                  <div className="question-statement-text">
                    {q.statement}
                  </div>

                  {/* Prévia de Alternativas (GABARITO OCULTO) - Clicável para abrir resolução */}
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div
                      className="question-options-preview"
                      role="button"
                      tabIndex={0}
                      onClick={() => setResolvendoIndex(qIndex)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setResolvendoIndex(qIndex);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      aria-label="Abrir e resolver esta questão"
                      title="Clique ou pressione Enter para resolver esta questão"
                    >
                      {q.options.map((opt: string, i: number) => {
                        const cleanOpt = opt
                          .replace(/\s*(?:TRIBUNAL DE CONTAS|FGV CONHECIMENTO|AUDITOR FISCAL|TIPO\s+\d+|PÁGINA\s+\d+|Raciocínio Lógico).*$/i, '')
                          .replace(/^[(\[]?[A-Ea-e][)\].\s\-:]+\s*(?:\([A-Ea-e]\)\s*)?/, '')
                          .trim();
                        return (
                          <div key={i} style={{ display: 'flex', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600 }}>{String.fromCharCode(65 + i)})</span>
                            <span>{cleanOpt || opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rodapé: Histórico Pessoal & Ações */}
                  <div className="question-card-footer">
                    <div className="question-history-stat">
                      {q.tentativasTotal > 0 ? (
                        <span>
                          Você respondeu {q.tentativasTotal}x • Taxa de acerto pessoal: <strong>{q.taxaAcertoPessoal}%</strong>
                        </span>
                      ) : (
                        <span style={{ color: '#34d399' }}>Nunca resolvida por você</span>
                      )}
                    </div>

                    <div className="question-actions-group">
                      <button
                        className={`btn-q-action favorite ${q.isFavorite ? 'active' : ''}`}
                        onClick={() => handleToggleFavorite(q.questionId)}
                        aria-label={q.isFavorite ? 'Remover dos favoritos' : 'Favoritar questão'}
                        title={q.isFavorite ? 'Remover dos favoritos' : 'Favoritar questão'}
                      >
                        <Bookmark className="w-3.5 h-3.5" fill={q.isFavorite ? 'currentColor' : 'none'} />
                      </button>

                      <button
                        className="btn-q-action"
                        onClick={() => setReportQuestionId(q.questionId)}
                        aria-label="Reportar problema de gabarito ou digitação"
                        title="Reportar problema de gabarito ou digitação"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      {q.arquivoOrigem && (
                        <button
                          className="btn-q-action"
                          onClick={() => showFeedback(`Fonte: ${q.arquivoOrigem}`)}
                          aria-label={`Abrir fonte: ${q.arquivoOrigem}`}
                          title="Abrir prova ou fonte original"
                        >
                          <FileText className="w-3.5 h-3.5" /> Fonte
                        </button>
                      )}

                      <button
                        className="btn-q-action"
                        onClick={() => setIsCadernoModalOpen(true)}
                        aria-label="Adicionar questão ao caderno de exercícios"
                        title="Adicionar ao caderno de exercícios"
                      >
                        <Layers className="w-3.5 h-3.5" /> + Caderno
                      </button>

                      <button
                        className="btn-q-action primary"
                        onClick={() => setResolvendoIndex(qIndex)}
                        aria-label={`Abrir e resolver questão ${q.questionId}`}
                        title="Abrir questão para resolução focada"
                      >
                        <Play className="w-3.5 h-3.5" /> Resolver
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>

      {/* Modal T19: Montagem de Cadernos */}
      {isCadernoModalOpen && (
        <MontagemCadernoModal
          activeConcurso={activeConcurso}
          initialFilters={{
            disciplina: selectedDisciplina !== 'TODAS' ? selectedDisciplina : undefined,
            banca: selectedBanca !== 'TODAS' ? selectedBanca : undefined,
            ano: selectedAno !== 'TODOS' ? parseInt(selectedAno) : undefined,
            situacao: selectedSituacao !== 'TODAS' ? selectedSituacao : undefined
          }}
          totalElegiveis={totalElements}
          onClose={() => setIsCadernoModalOpen(false)}
          onSaveCaderno={async (caderno) => {
            try {
              const res = await fetch('/api/v1/bank/notebooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(caderno)
              });
              if (res.ok) {
                showFeedback('✓ Caderno salvo com sucesso!');
                setIsCadernoModalOpen(false);
              }
            } catch {
              showFeedback('Erro ao salvar caderno.');
            }
          }}
          onStartInstantResolucao={(caderno) => {
            setIsCadernoModalOpen(false);
            if (caderno.filtros?.disciplina) setSelectedDisciplina(caderno.filtros.disciplina);
            if (caderno.filtros?.banca) setSelectedBanca(caderno.filtros.banca);
            if (caderno.filtros?.ano) setSelectedAno(caderno.filtros.ano.toString());
            showFeedback(`✓ Caderno "${caderno.nome}" ativado. Abrindo primeira questão para resolução...`);
            setResolvendoIndex(0);
          }}
        />
      )}

      {/* Modal Focado de Resolução de Questão do Banco */}
      {resolvendoIndex !== null && questions[resolvendoIndex] && (
        <ResolucaoQuestaoModal
          question={questions[resolvendoIndex]}
          currentIndex={resolvendoIndex}
          totalInBatch={questions.length}
          onClose={() => setResolvendoIndex(null)}
          onNext={resolvendoIndex < questions.length - 1 ? () => setResolvendoIndex(resolvendoIndex + 1) : undefined}
          onPrev={resolvendoIndex > 0 ? () => setResolvendoIndex(resolvendoIndex - 1) : undefined}
          onQuestionAnswered={(qId, isCorrect) => {
            setQuestions(prev => prev.map(item => {
              if (item.questionId === qId) {
                const novasTentativas = (item.tentativasTotal || 0) + 1;
                const novosAcertos = (item.acertosTotal || 0) + (isCorrect ? 1 : 0);
                return {
                  ...item,
                  tentativasTotal: novasTentativas,
                  acertosTotal: novosAcertos,
                  taxaAcertoPessoal: Math.round((novosAcertos / novasTentativas) * 100)
                };
              }
              return item;
            }));
          }}
          onToggleFavorite={handleToggleFavorite}
          onReportQuestion={(qId) => setReportQuestionId(qId)}
        />
      )}

      {/* Modal: Reportar Problema */}
      {reportQuestionId && (
        <div className="montagem-caderno-backdrop" onClick={() => setReportQuestionId(null)}>
          <div className="montagem-caderno-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--calm-text)' }}>Reportar Problema na Questão</h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--calm-text-muted)' }}>
              Identificou gabarito desatualizado, erro de digitação ou formatação? Informe abaixo para auditoria.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>Motivo</label>
              <select
                className="filtro-select"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="ERRO_GABARITO">Gabarito Incorreto / Anulado</option>
                <option value="ERRO_TEXTO">Erro de Digitação / Caracteres</option>
                <option value="IMAGEM_FALTANDO">Imagem ou Tabela Faltando</option>
                <option value="OUTRO">Outro Problema</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>Detalhes</label>
              <textarea
                className="filtro-input"
                rows={3}
                placeholder="Explique o que deve ser corrigido..."
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-q-action" onClick={() => setReportQuestionId(null)}>Cancelar</button>
              <button className="btn-q-action primary" onClick={handleSendReport}>Enviar Reporte</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
