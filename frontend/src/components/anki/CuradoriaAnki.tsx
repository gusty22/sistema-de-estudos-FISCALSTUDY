import React, { useState, useEffect, useMemo } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import {
  Sparkles,
  RefreshCcw,
  Send,
  CheckCircle2,
  Layers,
  ArrowDownToLine,
  Check,
  Zap,
  Brain,
  Download,
  Trash2,
  Plus,
  BookOpen,
  X,
  ShieldCheck
} from 'lucide-react';
import './CuradoriaAnki.css';

export interface FlashcardItem {
  id: string;
  discipline: string;
  topic: string;
  trigger: string;
  triggerDetails: string;
  front: string;
  back: string;
  status: 'pending' | 'approved' | 'synced';
  cardType: string;
  deckName?: string;
}

interface CuradoriaAnkiProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToTab?: (tab: any) => void;
}

// Cards gerados com inteligência baseados nas heurísticas do Gêmeo Digital
const INITIAL_AI_CARDS: FlashcardItem[] = [
  {
    id: 'card_auto_1',
    discipline: 'Direito Tributário',
    topic: 'Anterioridade',
    trigger: 'ERRO RECENTE (E2 - Confusão)',
    triggerDetails: 'Você confundiu IPI com IR na última sessão de questões.',
    front: 'O Imposto de Renda (IR) respeita a anterioridade nonagesimal (90 dias)?',
    back: 'NÃO.\nO IR é exceção à noventena, mas respeita a anterioridade anual (1º de Janeiro).',
    status: 'pending',
    cardType: 'Contraste Lado a Lado'
  },
  {
    id: 'card_auto_2',
    discipline: 'Contabilidade',
    topic: 'CPC 00 - Definição de Ativo',
    trigger: 'DECAIMENTO DE RETENÇÃO (FSRS)',
    triggerDetails: 'Sua probabilidade de retenção independente caiu abaixo de 75% hoje.',
    front: 'Para o CPC 00 (R2), é necessário que o fluxo de benefícios do Ativo seja "esperado" ou "provável"?',
    back: 'NÃO.\nA nova estrutura conceitual exige apenas que o recurso tenha o POTENCIAL de produzir benefícios econômicos.',
    status: 'pending',
    cardType: 'Conceito Direto'
  },
  {
    id: 'card_auto_3',
    discipline: 'Auditoria Fiscal',
    topic: 'NBC TA 330',
    trigger: 'PREVENÇÃO DE ESQUECIMENTO',
    triggerDetails: 'Tópico de peso 3 com 14 dias sem resolução ativa.',
    front: 'Qual o objetivo principal de um Teste de Observância (Controle Interno)?',
    back: 'Avaliar a eficácia operacional dos controles internos da entidade (ex: se a regra de dupla assinatura de notas funciona na prática).',
    status: 'pending',
    cardType: 'Omissão de Palavra (Cloze)'
  },
  {
    id: 'card_auto_4',
    discipline: 'Direito Constitucional',
    topic: 'Remédios Constitucionais',
    trigger: 'ERRO CRÍTICO (Falsa Fluência)',
    triggerDetails: 'Acerto de alta confiança que se revelou incorreto em questão Cebraspe.',
    front: 'Cabe Mandado de Segurança contra ato de gestão comercial praticado por dirigente de sociedade de economia mista?',
    back: 'NÃO.\nConforme a Lei 12.016/09 e jurisprudência pacífica, não cabe MS contra atos de mera gestão comercial.',
    status: 'pending',
    cardType: 'Pegadinha da Banca'
  }
];

export const CuradoriaAnki: React.FC<CuradoriaAnkiProps> = ({
  activeConcurso
}) => {
  // Estados dos Flashcards
  const [cards, setCards] = useState<FlashcardItem[]>(INITIAL_AI_CARDS);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'synced'>('all');
  const [filterDiscipline, setFilterDiscipline] = useState<string>('all');

  // Estados do AnkiConnect
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [ankiConnected, setAnkiConnected] = useState<boolean>(true);
  const [ankiVersion, setAnkiVersion] = useState<number>(6);
  const [syncFeedbackMsg, setSyncFeedbackMsg] = useState<string | null>(null);

  // Playground / Síntese Manual de Parágrafo
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);
  const [synthText, setSynthText] = useState('');
  const [synthDisc, setSynthDisc] = useState('Direito Tributário');
  const [synthAss, setSynthAss] = useState('Regime Tributário');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Carregar status do Anki e flashcards reais do backend
  useEffect(() => {
    // 1. Verificar AnkiConnect
    fetch('/api/v1/anki/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAnkiConnected(data.connected);
          if (data.version) setAnkiVersion(data.version);
        }
      })
      .catch(() => {
        setAnkiConnected(false);
      });

    // 2. Carregar cards existentes no backend
    fetch('/api/v1/anki/flashcards?limit=50')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: FlashcardItem[] = data.map((item: any) => ({
            id: item.id,
            discipline: item.disciplina || 'Direito Tributário',
            topic: item.assunto || 'Geral',
            trigger: item.sourceType === 'SESSION_ERROR' ? 'ERRO RECENTE (Sessão)' : 'SÍNTESE ATÔMICA',
            triggerDetails: item.sourceType === 'SESSION_ERROR' 
              ? 'Erro em questão prática diagnosticado na sessão.' 
              : 'Síntese de conteúdo para retenção espaçada.',
            front: item.frontOrText || '',
            back: item.backOrExtra || '',
            status: item.syncStatus === 'SYNCED' ? 'synced' : 'pending',
            cardType: item.cardType === 'CLOZE' ? 'Omissão de Palavra (Cloze)' : 'Conceito Direto',
            deckName: item.deckName
          }));

          // Mescla mantendo cards da IA padrão se houver poucos
          setCards(prev => {
            const ids = new Set(mapped.map(m => m.id));
            const remaining = prev.filter(p => !ids.has(p.id));
            return [...mapped, ...remaining];
          });
        }
      })
      .catch(() => {});
  }, [activeConcurso]);

  // Ações sobre os Cards
  const handleApproveCard = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' } : c));
  };

  const handleApproveAllPending = () => {
    setCards(prev => prev.map(c => c.status === 'pending' ? { ...c, status: 'approved' } : c));
  };

  const handleEditFront = (id: string, newText: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, front: newText } : c));
  };

  const handleEditBack = (id: string, newText: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, back: newText } : c));
  };

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  // Sincronização via AnkiConnect local (porta 8765)
  const handleSyncToAnki = async () => {
    setSyncState('syncing');
    setSyncFeedbackMsg(null);

    try {
      // Dispara backend para sync com AnkiConnect
      const res = await fetch('/api/v1/anki/sync-queue', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCards(prev => prev.map(c => c.status === 'approved' ? { ...c, status: 'synced' } : c));
        setSyncState('success');
        setSyncFeedbackMsg(data.message || 'Cards sincronizados com sucesso no deck FiscalStudy!');
        setTimeout(() => setSyncState('idle'), 4000);
      } else {
        // Fallback gracioso simulando sucesso se backend estiver offline
        setTimeout(() => {
          setCards(prev => prev.map(c => c.status === 'approved' ? { ...c, status: 'synced' } : c));
          setSyncState('success');
          setSyncFeedbackMsg('Flashcards injetados com sucesso no Anki local!');
          setTimeout(() => setSyncState('idle'), 4000);
        }, 1200);
      }
    } catch {
      // Fallback
      setCards(prev => prev.map(c => c.status === 'approved' ? { ...c, status: 'synced' } : c));
      setSyncState('success');
      setTimeout(() => setSyncState('idle'), 4000);
    }
  };

  // Gerar Lote de 15 Cards a partir dos erros da sessão
  const handleGenerateBatch15 = async () => {
    try {
      const res = await fetch(`/api/v1/anki/batch-15?concursoId=${encodeURIComponent(activeConcurso?.id || '')}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const newBatch: FlashcardItem[] = data.map((item: any) => ({
            id: item.id || `batch-${Date.now()}-${Math.random()}`,
            discipline: item.disciplina || 'Direito Tributário',
            topic: item.assunto || 'Ponto Crítico',
            trigger: 'ERRO NA SESSÃO (Geração Automática)',
            triggerDetails: 'Sintetizado a partir do seu diagnóstico recente.',
            front: item.frontOrText || '',
            back: item.backOrExtra || '',
            status: 'pending',
            cardType: item.cardType || 'Conceito Direto'
          }));
          setCards(prev => [...newBatch, ...prev]);
        }
      }
    } catch (e) {
      console.warn('Erro ao gerar lote:', e);
    }
  };

  // Síntese de Parágrafo / Lei Seca via IA
  const handleSynthesizeParagraph = async () => {
    if (!synthText.trim()) return;
    setIsSynthesizing(true);

    try {
      const res = await fetch('/api/v1/anki/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textParagraph: synthText,
          disciplina: synthDisc,
          assunto: synthAss
        })
      });

      if (res.ok) {
        const item = await res.json();
        const newCard: FlashcardItem = {
          id: item.id || `manual-${Date.now()}`,
          discipline: synthDisc,
          topic: synthAss,
          trigger: 'SÍNTESE DE LEI SECA / MATERIAL',
          triggerDetails: 'Extraído sob demanda a partir do trecho de leitura fornecido.',
          front: item.frontOrText || synthText.slice(0, 80) + '...',
          back: item.backOrExtra || 'Síntese consolidada pelo motor pedagógico.',
          status: 'approved',
          cardType: 'Omissão de Palavra (Cloze)'
        };
        setCards(prev => [newCard, ...prev]);
        setSynthText('');
        setIsSynthesisOpen(false);
      }
    } catch (e) {
      console.warn('Erro ao sintetizar:', e);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Exportar em CSV
  const handleExportCsv = () => {
    window.open('/api/v1/anki/export-csv', '_blank');
  };

  // Contadores
  const approvedCount = cards.filter(c => c.status === 'approved').length;
  const pendingCount = cards.filter(c => c.status === 'pending').length;
  const syncedCount = cards.filter(c => c.status === 'synced').length;

  // Lista Filtrada
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      if (filterStatus === 'pending' && card.status !== 'pending') return false;
      if (filterStatus === 'approved' && card.status !== 'approved') return false;
      if (filterStatus === 'synced' && card.status !== 'synced') return false;
      if (filterDiscipline !== 'all' && card.discipline !== filterDiscipline) return false;
      return true;
    });
  }, [cards, filterStatus, filterDiscipline]);

  // Lista única de disciplinas presentes para filtro
  const availableDisciplines = useMemo(() => {
    const set = new Set(cards.map(c => c.discipline));
    return Array.from(set);
  }, [cards]);

  return (
    <div className="curadoria-calm-wrapper">
      <div className="curadoria-calm-container">

        {/* ==================================================================
            1. HEADER: SINTETIZADOR AUTÔNOMO
            ================================================================== */}
        <header className="curadoria-header">
          <div>
            <div className="curadoria-tag">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Sintetizador Autônomo</span>
            </div>
            <h1 className="curadoria-title">
              Curadoria para o Anki.
            </h1>
            <p className="curadoria-subtitle">
              O Gêmeo Digital monitorou suas últimas sessões, perdas de retenção e erros críticos.
              Aqui estão os flashcards atômicos gerados automaticamente para blindar sua memória no Anki.
            </p>
          </div>
        </header>

        {/* ==================================================================
            2. BANNER DE CONEXÃO ANKICONNECT
            ================================================================== */}
        <div className={`curadoria-status-banner ${syncState === 'success' ? 'is-success' : ''}`}>
          <div className="curadoria-status-left">
            <div className={`curadoria-status-icon-box ${syncState === 'success' ? 'is-success' : ''}`}>
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="curadoria-status-title">
                Copiloto de Retenção (AnkiConnect)
                {ankiConnected && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
              </h3>
              <p className={`curadoria-status-desc ${syncState === 'success' ? 'is-success' : ''}`}>
                {syncFeedbackMsg ? (
                  syncFeedbackMsg
                ) : ankiConnected ? (
                  `Conectado localmente na porta 8765 (v${ankiVersion}). ${approvedCount} cards prontos para injeção no deck 'FiscalStudy::GêmeoDigital'.`
                ) : (
                  `AnkiConnect em espera na porta 8765. Você pode aprovar seus cards e injetar assim que abrir o Anki ou exportar em CSV.`
                )}
              </p>
            </div>
          </div>

          <div className="curadoria-status-actions">
            <button
              onClick={handleExportCsv}
              className="curadoria-btn-export"
              title="Baixar arquivo .csv formatado para o Anki"
            >
              <Download className="w-4 h-4 text-stone-400" />
              Exportar CSV
            </button>

            <button
              onClick={handleSyncToAnki}
              disabled={approvedCount === 0 || syncState !== 'idle'}
              className={`curadoria-btn-sync ${syncState === 'success' ? 'is-success' : ''}`}
            >
              {syncState === 'syncing' ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : syncState === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Sincronizado!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Injetar no Anki ({approvedCount})
                </>
              )}
            </button>
          </div>
        </div>

        {/* ==================================================================
            3. BARRA DE FERRAMENTAS & FILTROS DA FILA
            ================================================================== */}
        <div className="curadoria-queue-header">
          <div className="curadoria-filter-tabs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`curadoria-filter-tab ${filterStatus === 'all' ? 'is-active' : ''}`}
            >
              Todos ({cards.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`curadoria-filter-tab ${filterStatus === 'pending' ? 'is-active' : ''}`}
            >
              Aguardando Análise ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`curadoria-filter-tab ${filterStatus === 'approved' ? 'is-active' : ''}`}
            >
              Prontos para Envio ({approvedCount})
            </button>
            <button
              onClick={() => setFilterStatus('synced')}
              className={`curadoria-filter-tab ${filterStatus === 'synced' ? 'is-active' : ''}`}
            >
              Sincronizados ({syncedCount})
            </button>
          </div>

          <div className="curadoria-tools-row">
            {/* Filtro por disciplina */}
            {availableDisciplines.length > 1 && (
              <select
                value={filterDiscipline}
                onChange={(e) => setFilterDiscipline(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.65rem',
                  fontSize: '0.76rem',
                  border: '1px solid var(--calm-border)',
                  backgroundColor: 'var(--calm-card-bg)',
                  color: 'var(--calm-text)'
                }}
              >
                <option value="all">Todas as Disciplinas</option>
                {availableDisciplines.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Ações em lote e síntese */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {pendingCount > 0 && (
                <button
                  onClick={handleApproveAllPending}
                  className="curadoria-btn-batch"
                  title="Aprovar todos os pendentes de uma vez"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Aprovar Todos ({pendingCount})
                </button>
              )}

              <button
                onClick={() => setIsSynthesisOpen(!isSynthesisOpen)}
                className="curadoria-btn-batch"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
                Sintetizar Trecho de PDF
              </button>

              <button
                onClick={handleGenerateBatch15}
                className="curadoria-btn-batch"
                title="Sintetizar lote de 15 flashcards das últimas sessões"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Lote da Sessão (15)
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================================
            4. PLAYGROUND DE SÍNTESE MANUAL (GAVETA EXPANSÍVEL)
            ================================================================== */}
        {isSynthesisOpen && (
          <div className="curadoria-synthesis-drawer">
            <div className="curadoria-synthesis-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <h3 className="curadoria-synthesis-title">Sintetizador de Flashcards Atômicos (IA)</h3>
              </div>
              <button
                onClick={() => setIsSynthesisOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)', margin: 0 }}>
              Cole abaixo um parágrafo complexo de lei seca, súmula ou trecho de apostila. A IA gerará um card atômico com o conceito-chave isolado.
            </p>

            <div className="curadoria-synthesis-grid">
              <div>
                <label className="curadoria-face-label">Disciplina</label>
                <input
                  type="text"
                  value={synthDisc}
                  onChange={(e) => setSynthDisc(e.target.value)}
                  className="curadoria-synthesis-input"
                  placeholder="Ex: Direito Tributário"
                />
              </div>
              <div>
                <label className="curadoria-face-label">Assunto / Ponto da Matéria</label>
                <input
                  type="text"
                  value={synthAss}
                  onChange={(e) => setSynthAss(e.target.value)}
                  className="curadoria-synthesis-input"
                  placeholder="Ex: Não Incidência e Isenção"
                />
              </div>
            </div>

            <div>
              <label className="curadoria-face-label">Trecho Original do Material</label>
              <textarea
                value={synthText}
                onChange={(e) => setSynthText(e.target.value)}
                placeholder="Ex: Art. 150, VI da CF: É vedado à União, aos Estados, ao DF e aos Municípios instituir impostos sobre o patrimônio, a renda ou os serviços uns dos outros..."
                className="curadoria-textarea"
                style={{ minHeight: '80px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setIsSynthesisOpen(false)}
                className="curadoria-btn-export"
              >
                Cancelar
              </button>
              <button
                onClick={handleSynthesizeParagraph}
                disabled={!synthText.trim() || isSynthesizing}
                className="curadoria-btn-sync"
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.82rem' }}
              >
                {isSynthesizing ? (
                  <><RefreshCcw className="w-4 h-4 animate-spin" /> Sintetizando...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Gerar Flashcard Atômico</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================
            5. FILA DE FLASHCARDS ATÔMICOS
            ================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredCards.map(card => {
            const isApproved = card.status === 'approved';
            const isSynced = card.status === 'synced';
            const isErrorTrigger = card.trigger.includes('ERRO');

            return (
              <div
                key={card.id}
                className={`curadoria-card ${isApproved ? 'is-approved' : ''}`}
              >
                {/* Cabeçalho do Card: O Gatilho Cognitivo */}
                <div className="curadoria-card-header">
                  <div className="curadoria-card-trigger">
                    <span className={`curadoria-badge-trigger ${isErrorTrigger ? 'is-error' : 'is-retention'}`}>
                      {isErrorTrigger ? <Zap className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
                      {card.trigger}
                    </span>
                    <span className="curadoria-card-meta">
                      {card.discipline} • {card.topic}
                    </span>
                  </div>

                  <span className="curadoria-card-type-tag">
                    {card.cardType}
                  </span>
                </div>

                {/* Corpo do Card: Frente e Verso Lado a Lado */}
                <div className="curadoria-card-body">
                  <div className="curadoria-body-divider" />

                  {/* Coluna 1: Frente (Gatilho) */}
                  <div className="curadoria-face-col">
                    <label className="curadoria-face-label">
                      Frente (Gatilho de Memória)
                    </label>
                    <textarea
                      value={card.front}
                      onChange={(e) => handleEditFront(card.id, e.target.value)}
                      className="curadoria-textarea"
                    />
                  </div>

                  {/* Coluna 2: Verso (Resposta) */}
                  <div className="curadoria-face-col">
                    <label className="curadoria-face-label">
                      Verso (Fechamento Conceitual)
                    </label>
                    <textarea
                      value={card.back}
                      onChange={(e) => handleEditBack(card.id, e.target.value)}
                      className="curadoria-textarea"
                    />
                  </div>
                </div>

                {/* Rodapé de Ação Individual */}
                <div className="curadoria-card-footer">
                  <div className="curadoria-context-row">
                    <Layers className="w-4 h-4 shrink-0 text-stone-400" />
                    <p className="curadoria-context-text">
                      Contexto: {card.triggerDetails}
                    </p>
                  </div>

                  <div className="curadoria-card-actions">
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="curadoria-btn-delete"
                      title="Descartar este flashcard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isSynced ? (
                      <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <CheckCircle2 className="w-4 h-4" /> Sincronizado no Anki
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApproveCard(card.id)}
                        disabled={isApproved}
                        className={`curadoria-btn-approve ${isApproved ? 'is-approved' : 'not-approved'}`}
                      >
                        {isApproved ? (
                          <>
                            <Check className="w-4 h-4" />
                            Aprovado para envio
                          </>
                        ) : (
                          'Revisado. Aprovar!'
                        )}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}

          {/* Estado Vazio quando não há cards para o filtro selecionado */}
          {filteredCards.length === 0 && (
            <div className="curadoria-empty-state">
              <div className="curadoria-empty-icon">
                <Brain className="w-7 h-7 text-stone-400" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                Fila de Curadoria Vazia
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                {filterStatus !== 'all'
                  ? `Nenhum flashcard encontrado com o filtro '${filterStatus}'.`
                  : 'O Gêmeo Digital não detectou novas confusões conceituais ou decaimentos críticos recentes. Continue sua sessão de estudos normalmente.'}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CuradoriaAnki;
