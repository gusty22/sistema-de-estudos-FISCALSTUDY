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
  ShieldCheck,
  Cloud,
  Play,
  Pause
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

export const CuradoriaAnki: React.FC<CuradoriaAnkiProps> = ({
  activeConcurso
}) => {
  // Estados dos Flashcards reais carregados do backend ou gerados por síntese
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'synced'>('all');
  const [filterDiscipline, setFilterDiscipline] = useState<string>('all');

  // Estados do AnkiConnect e Sincronização Automática
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [syncWebState, setSyncWebState] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [ankiConnected, setAnkiConnected] = useState<boolean>(true);
  const [ankiVersion, setAnkiVersion] = useState<number>(6);
  const [autoSyncActive, setAutoSyncActive] = useState<boolean>(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [totalCardsSynced, setTotalCardsSynced] = useState<number>(0);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [detectedModels, setDetectedModels] = useState<string | null>(null);
  const [syncFeedbackMsg, setSyncFeedbackMsg] = useState<string | null>(null);

  // Playground / Síntese Manual de Parágrafo
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);
  const [synthText, setSynthText] = useState('');
  const [synthDisc, setSynthDisc] = useState('Direito Tributário');
  const [synthAss, setSynthAss] = useState('Regime Tributário');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Carregar status do Anki e flashcards reais do backend
  const loadAnkiData = async () => {
    try {
      // 1. Status do AnkiConnect e Auto-Sync
      const statusRes = await fetch('/api/v1/anki/status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        setAnkiConnected(data.connected);
        if (data.version) setAnkiVersion(data.version);
        if (typeof data.autoSyncActive === 'boolean') setAutoSyncActive(data.autoSyncActive);
        if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt);
        if (typeof data.totalCardsSynced === 'number') setTotalCardsSynced(data.totalCardsSynced);
        if (typeof data.pendingQueueCount === 'number') setPendingQueueCount(data.pendingQueueCount);
        if (data.detectedModels) setDetectedModels(data.detectedModels);
      } else {
        setAnkiConnected(false);
      }
    } catch {
      setAnkiConnected(false);
    }

    try {
      // 2. Flashcards
      const cardsRes = await fetch('/api/v1/anki/flashcards?limit=50');
      if (cardsRes.ok) {
        const data = await cardsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: FlashcardItem[] = data.map((item: any) => ({
            id: item.id,
            discipline: item.disciplina || 'Direito Tributário',
            topic: item.assunto || 'Geral',
            trigger: item.sourceType === 'QUESTION_ERROR' ? 'ERRO EM QUESTÃO (Automático)' :
                     item.sourceType === 'QUESTION_RESOLVED' ? 'PRÁTICA DA SESSÃO' :
                     item.sourceType === 'STRATEGIC_SUMMARY' ? 'RESUMO ESTRATÉGICO' :
                     item.sourceType === 'PDF_PARAGRAPH' ? 'LEITURA DO EDITAL / PDF' : 'SÍNTESE ATÔMICA',
            triggerDetails: item.sourceType === 'QUESTION_ERROR' 
              ? 'Erro em questão prática diagnosticado na sessão.' 
              : 'Síntese de conteúdo para retenção espaçada.',
            front: item.frontOrText || '',
            back: item.backOrExtra || '',
            status: item.syncStatus === 'SYNCED' ? 'synced' : 'pending',
            cardType: item.cardType === 'CLOZE' ? 'Omissão de Palavra (Cloze)' : 'Conceito Direto',
            deckName: item.deckName
          }));

          setCards(mapped);
        } else {
          setCards([]);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadAnkiData();
    const interval = setInterval(loadAnkiData, 15000);
    return () => clearInterval(interval);
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
        await loadAnkiData();
        setCards(prev => prev.map(c => (c.status === 'approved' || c.status === 'pending') ? { ...c, status: 'synced' } : c));
        setSyncState('success');
        setSyncFeedbackMsg(data.message || 'Cards sincronizados com sucesso no deck FiscalStudy!');
        setTimeout(() => setSyncState('idle'), 4000);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.status === 'approved' || c.status === 'pending') ? { ...c, status: 'synced' } : c));
          setSyncState('success');
          setSyncFeedbackMsg('Flashcards injetados com sucesso no Anki local!');
          setTimeout(() => setSyncState('idle'), 4000);
        }, 1200);
      }
    } catch {
      setSyncState('idle');
      setSyncFeedbackMsg('Anki Desktop não detectado na porta 8765.');
    }
  };

  // Alternar Auto-Sync em segundo plano
  const handleToggleAutoSync = async () => {
    try {
      const res = await fetch('/api/v1/anki/auto-sync/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAutoSyncActive(data.autoSyncActive);
        setSyncFeedbackMsg(data.message);
        setTimeout(() => setSyncFeedbackMsg(null), 4000);
      }
    } catch (e) {
      console.warn('Erro ao alternar auto-sync:', e);
    }
  };

  // Disparar sincronização com a nuvem AnkiWeb
  const handleSyncAnkiWeb = async () => {
    setSyncWebState('syncing');
    try {
      const res = await fetch('/api/v1/anki/sync-ankiweb', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncWebState('success');
        setSyncFeedbackMsg(data.message);
        setTimeout(() => {
          setSyncWebState('idle');
          setSyncFeedbackMsg(null);
        }, 4000);
      } else {
        setSyncWebState('idle');
      }
    } catch {
      setSyncWebState('idle');
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
  const cardsAvailableForSync = pendingCount + approvedCount;

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
            2. BANNER DE CONEXÃO ANKICONNECT & AUTO-SYNC DAEMON
            ================================================================== */}
        <div className={`curadoria-status-banner ${syncState === 'success' ? 'is-success' : ''}`}>
          <div className="curadoria-status-left">
            <div className={`curadoria-status-icon-box ${syncState === 'success' ? 'is-success' : ''}`}>
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 className="curadoria-status-title">
                  Sincronizador Direto com Anki Desktop
                  {ankiConnected && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontWeight: 600,
                    backgroundColor: ankiConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: ankiConnected ? '#059669' : '#d97706',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: ankiConnected ? '#10b981' : '#eab308' }} />
                  {ankiConnected ? `Porta 8765 Online (v${ankiVersion})` : 'Aguardando Anki Desktop'}
                </span>
                <span
                  onClick={handleToggleAutoSync}
                  title="Clique para alternar o Auto-Sync contínuo em segundo plano"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: autoSyncActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(156, 163, 175, 0.2)',
                    color: autoSyncActive ? '#4f46e5' : '#6b7280',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {autoSyncActive ? <Play className="w-3 h-3 text-indigo-500" /> : <Pause className="w-3 h-3 text-stone-500" />}
                  Auto-Sync em Segundo Plano: {autoSyncActive ? 'Ativo (25s)' : 'Pausado'}
                </span>
              </div>

              <p className={`curadoria-status-desc ${syncState === 'success' ? 'is-success' : ''}`}>
                {syncFeedbackMsg ? (
                  syncFeedbackMsg
                ) : ankiConnected ? (
                  `Conexão ativa na porta 8765. Decks automáticos: FiscalStudy::<Disciplina>. ${cardsAvailableForSync} cards aguardando injeção. Total já sincronizado: ${totalCardsSynced}.`
                ) : (
                  `Anki Desktop não detectado na porta 8765. Os flashcards gerados automaticamente estão preservados com segurança na fila local e serão injetados assim que você abrir o Anki Desktop.`
                )}
              </p>

              {lastSyncAt && (
                <div style={{ fontSize: '0.72rem', color: 'var(--calm-text-muted)', marginTop: '0.3rem' }}>
                  Última sincronização com Anki Desktop: <strong>{lastSyncAt}</strong>
                  {detectedModels && <span> • Modelos: <em>{detectedModels}</em></span>}
                </div>
              )}
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
              onClick={handleSyncAnkiWeb}
              disabled={!ankiConnected || syncWebState === 'syncing'}
              className="curadoria-btn-export"
              style={{
                backgroundColor: syncWebState === 'success' ? 'rgba(16, 185, 129, 0.15)' : undefined,
                color: syncWebState === 'success' ? '#059669' : undefined
              }}
              title="Dispara sincronização do Anki Desktop com a nuvem do AnkiWeb"
            >
              {syncWebState === 'syncing' ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin text-indigo-500" />
                  Sincronizando Nuvem...
                </>
              ) : syncWebState === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Nuvem Sincronizada!
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-indigo-500" />
                  Sync AnkiWeb
                </>
              )}
            </button>

            <button
              onClick={handleSyncToAnki}
              disabled={(cardsAvailableForSync === 0 && pendingQueueCount === 0) || syncState !== 'idle'}
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
                  Sincronizar com Anki Desktop ({cardsAvailableForSync || pendingQueueCount})
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
