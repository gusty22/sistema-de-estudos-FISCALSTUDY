import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './AnkiHubModal.css';

export interface AnkiFlashcardItem {
  id: string;
  sessionId?: string;
  concursoId?: string;
  disciplina: string;
  assunto: string;
  cardType: string;
  frontOrText: string;
  backOrExtra?: string;
  deckName: string;
  ankiNoteId?: number | null;
  syncStatus: string; // PENDING_ANKI, SYNCED, ERROR
  sourceType: string;
  createdAt: string;
  syncedAt?: string;
}

export interface AnkiConnectStatus {
  connected: boolean;
  version: number;
  endpoint: string;
  totalCardsSynced: number;
  pendingQueueCount: number;
  message: string;
}

interface AnkiHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConcursoId?: string;
}

export const AnkiHubModal: React.FC<AnkiHubModalProps> = ({ isOpen, onClose, activeConcursoId }) => {
  const [status, setStatus] = useState<AnkiConnectStatus | null>(null);
  const [cards, setCards] = useState<AnkiFlashcardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Playground de síntese de PDF/Texto
  const [manualText, setManualText] = useState('');
  const [manualDisc, setManualDisc] = useState('Direito Administrativo');
  const [manualAss, setManualAss] = useState('Atos Administrativos');
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);

  const loadStatusAndCards = async () => {
    setIsLoading(true);
    try {
      const [resStatus, resCards] = await Promise.all([
        fetch('/api/v1/anki/status'),
        fetch('/api/v1/anki/flashcards?limit=50'),
      ]);

      if (resStatus.ok) {
        const dataStatus: AnkiConnectStatus = await resStatus.json();
        setStatus(dataStatus);
      }

      if (resCards.ok) {
        const dataCards: AnkiFlashcardItem[] = await resCards.json();
        setCards(dataCards);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do Anki:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatusAndCards();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Listener para fechar no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSyncQueue = async () => {
    setIsSyncing(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/v1/anki/sync-queue', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActionMsg(data.message || 'Sincronização concluída com sucesso!');
        loadStatusAndCards();
      }
    } catch (err: any) {
      setActionMsg('Erro ao conectar ao AnkiConnect: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateBatch15 = async () => {
    setIsLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/anki/batch-15?concursoId=${encodeURIComponent(activeConcursoId || '')}`, {
        method: 'POST',
      });
      if (res.ok) {
        setActionMsg('✨ Lote de 15 flashcards essenciais da sessão gerado e enviado ao Anki!');
        loadStatusAndCards();
      }
    } catch (err: any) {
      setActionMsg('Erro ao gerar lote de 15 cards: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateFromText = async () => {
    if (!manualText.trim()) return;
    setIsGeneratingManual(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/v1/anki/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textParagraph: manualText,
          disciplina: manualDisc,
          assunto: manualAss,
        }),
      });

      if (res.ok) {
        setManualText('');
        setActionMsg('✓ Flashcard gerado e enviado silenciosamente para o Anki!');
        loadStatusAndCards();
      }
    } catch (err: any) {
      setActionMsg('Erro ao gerar flashcard: ' + err.message);
    } finally {
      setIsGeneratingManual(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="anki-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="anki-modal-card">
        {/* Header */}
        <div className="anki-modal-header">
          <div className="anki-header-left">
            <div className="anki-logo-badge">⚡</div>
            <div>
              <h3>Automação Extrema: Integração Silenciosa com o Anki</h3>
              <p>Plugin AnkiConnect (porta 8765) • Gera e envia flashcards sem você gastar tempo digitando</p>
            </div>
          </div>
          <button className="anki-modal-close-btn" onClick={onClose} title="Fechar modal (Esc)">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="anki-modal-body">
          {/* Status Banner */}
          <div className={`anki-status-banner ${status?.connected ? 'connected' : 'offline'}`}>
            <div className="anki-status-left">
              <span className={`status-dot ${status?.connected ? 'online' : 'offline'}`} />
              <div>
                <strong style={{ fontSize: '0.92rem', color: status?.connected ? '#34d399' : '#fbbf24' }}>
                  {status?.connected ? 'AnkiConnect Conectado' : 'AnkiConnect Não Detectado'}
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1' }}>
                  {status?.message || 'Verificando conexão na porta 8765...'}
                </p>
              </div>
            </div>

            <div className="anki-status-metrics">
              <span className="metric-pill">
                🟢 {status?.totalCardsSynced || 0} sincronizados no Anki
              </span>
              <span className="metric-pill" style={{ color: (status?.pendingQueueCount || 0) > 0 ? '#fbbf24' : '#94a3b8' }}>
                ⏳ {status?.pendingQueueCount || 0} na fila local
              </span>
            </div>
          </div>

          {actionMsg && (
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', borderLeft: '4px solid #38bdf8', padding: '10px 14px', borderRadius: '4px', fontSize: '0.85rem', color: '#f0f9ff' }}>
              {actionMsg}
            </div>
          )}

          {/* Sandbox de Síntese de Parágrafo / PDF */}
          <div className="anki-sandbox-card">
            <h4>📖 Motor de Geração: Sintetizar Parágrafo do PDF</h4>
            <textarea
              className="anki-textarea"
              placeholder="Cole aqui um trecho do PDF, lei seca ou parágrafo importante... O sistema sintetizará a pergunta com omissão de palavra (Cloze) ou Frente/Verso direto para o Anki."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />

            <div className="anki-sandbox-actions">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Disciplina"
                  value={manualDisc}
                  onChange={(e) => setManualDisc(e.target.value)}
                  style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
                />
                <input
                  type="text"
                  placeholder="Assunto"
                  value={manualAss}
                  onChange={(e) => setManualAss(e.target.value)}
                  style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
                />
              </div>

              <button
                type="button"
                className="btn-anki-primary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                onClick={handleGenerateFromText}
                disabled={isGeneratingManual || !manualText.trim()}
              >
                {isGeneratingManual ? 'Sintetizando...' : '⚡ Sintetizar Flashcard'}
              </button>
            </div>
          </div>

          {/* Lista de Flashcards Gerados */}
          <div>
            <div className="anki-list-header">
              <h4>Cards Gerados Automaticamente ({cards.length})</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-anki-secondary"
                  onClick={handleGenerateBatch15}
                  disabled={isLoading}
                  title="Gera os 15 flashcards essenciais das matérias estudadas"
                >
                  ⚡ Gerar Lote 15 da Sessão
                </button>
                <a
                  href="/api/v1/anki/export-csv"
                  download="fiscalstudy_deck.txt"
                  className="btn-anki-secondary"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📥 Exportar CSV
                </a>
              </div>
            </div>

            <div className="anki-cards-scroll">
              {cards.map((card) => (
                <div key={card.id} className="anki-card-item">
                  <div className="anki-card-meta">
                    <span className={`card-type-tag ${card.cardType.toLowerCase()}`}>
                      {card.cardType} • {card.deckName}
                    </span>
                    <span className={`card-sync-tag ${card.syncStatus === 'SYNCED' ? 'synced' : 'pending'}`}>
                      {card.syncStatus === 'SYNCED' ? '✓ Enviado ao Anki' : '⏳ Na Fila Local'}
                    </span>
                  </div>

                  <div
                    className="anki-card-front"
                    dangerouslySetInnerHTML={{ __html: card.frontOrText }}
                  />

                  {card.backOrExtra && (
                    <div
                      className="anki-card-back"
                      dangerouslySetInnerHTML={{ __html: card.backOrExtra }}
                    />
                  )}
                </div>
              ))}

              {cards.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  Nenhum flashcard gerado ainda. Conforme você resolve questões no banco ou conclui sessões, os flashcards aparecerão aqui e serão enviados diretamente para o Anki.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="anki-modal-footer">
          <button
            type="button"
            className="btn-anki-secondary"
            onClick={loadStatusAndCards}
            disabled={isLoading}
          >
            🔄 Atualizar Status
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-anki-primary"
              onClick={handleSyncQueue}
              disabled={isSyncing || (status?.pendingQueueCount || 0) === 0}
            >
              <span>{isSyncing ? 'Enviando...' : `⚡ Enviar Fila para o Anki (${status?.pendingQueueCount || 0})`}</span>
            </button>
            <button type="button" className="btn-anki-secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
