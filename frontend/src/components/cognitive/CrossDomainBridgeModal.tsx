import React, { useState, useEffect } from 'react';
import './CrossDomainBridgeModal.css';

interface CrossDomainBridge {
  id: string;
  dominioADisciplina: string;
  dominioATopico: string;
  dominioBDisciplina: string;
  dominioBTopico: string;
  conceitoFronteira: string;
  desafioPrompt: string;
  maxCaracteres: number;
  totalRespostas: number;
  ultimaResposta?: string;
}

interface CrossDomainBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplinaFiltro?: string;
  sessionId?: string;
}

export const CrossDomainBridgeModal: React.FC<CrossDomainBridgeModalProps> = ({
  isOpen,
  onClose,
  disciplinaFiltro,
  sessionId = 'global'
}) => {
  const [bridges, setBridges] = useState<CrossDomainBridge[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<CrossDomainBridge | null>(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const url = disciplinaFiltro 
      ? `/api/v1/cross-domain/bridges?disciplina=${encodeURIComponent(disciplinaFiltro)}`
      : `/api/v1/cross-domain/bridges`;
    
    fetch(url)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setBridges(data);
        if (data && data.length > 0) {
          setSelectedBridge(data[0]);
          setResponseText(data[0].ultimaResposta || '');
          setStartTime(Date.now());
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, disciplinaFiltro]);

  if (!isOpen) return null;

  const handleSelectBridge = (b: CrossDomainBridge) => {
    setSelectedBridge(b);
    setResponseText(b.ultimaResposta || '');
    setSuccessMsg('');
    setStartTime(Date.now());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBridge || !responseText.trim()) return;

    const secondsSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    try {
      const res = await fetch('/api/v1/cross-domain/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bridgeId: selectedBridge.id,
          sessionId,
          activeOutputText: responseText.trim(),
          tempoRespostaSegundos: secondsSpent
        })
      });

      if (res.ok) {
        setSuccessMsg('✅ Ponte neural interdisciplinar consolidada com sucesso no Grafo!');
        setTimeout(() => {
          setSuccessMsg('');
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to submit cross-domain synthesis', err);
    }
  };

  const maxChars = selectedBridge?.maxCaracteres || 140;
  const remaining = maxChars - responseText.length;

  return (
    <div className="cross-domain-backdrop animate-fade-in" onClick={onClose}>
      <div className="cross-domain-modal glass" onClick={e => e.stopPropagation()}>
        <div className="modal-header-cd">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem' }}>
                Colisão de Domínios (Motor de Intercalação Profunda)
              </h3>
              <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                Construção de pontes sinápticas entre estruturas conceituais de matérias distintas
              </p>
            </div>
          </div>
          <button className="btn-close-cd" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Carregando pontes conceituais...
          </div>
        ) : bridges.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Nenhuma ponte de colisão encontrada para esta seleção.
          </div>
        ) : (
          <div className="cross-domain-body">
            {/* Left selector */}
            <div className="bridge-selector-list">
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pontes Mapeadas
              </span>
              {bridges.map(b => (
                <div
                  key={b.id}
                  className={`bridge-nav-item ${selectedBridge?.id === b.id ? 'active' : ''}`}
                  onClick={() => handleSelectBridge(b)}
                >
                  <div className="bridge-pair-label">
                    <span>{b.dominioADisciplina}</span>
                    <span style={{ color: '#38bdf8' }}> ⇄ </span>
                    <span>{b.dominioBDisciplina}</span>
                  </div>
                  <div className="bridge-topic-sub">{b.conceitoFronteira}</div>
                </div>
              ))}
            </div>

            {/* Right Challenge & Output Box */}
            {selectedBridge && (
              <div className="bridge-challenge-panel">
                <div className="bridge-domains-badge">
                  <div className="domain-pill">
                    <strong>{selectedBridge.dominioADisciplina}:</strong> {selectedBridge.dominioATopico}
                  </div>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>VS</span>
                  <div className="domain-pill">
                    <strong>{selectedBridge.dominioBDisciplina}:</strong> {selectedBridge.dominioBTopico}
                  </div>
                </div>

                <div className="frontier-card">
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Conceito de Fronteira
                  </span>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    {selectedBridge.conceitoFronteira}
                  </div>
                </div>

                <div className="prompt-box">
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                    🎯 Desafio de Síntese Ativa:
                  </span>
                  <p style={{ margin: '0.3rem 0 0', color: '#e2e8f0', fontSize: '0.88rem', lineHeight: '1.45' }}>
                    {selectedBridge.desafioPrompt}
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Output Ativo Constrangido (máx. {maxChars} caracteres):
                    </label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: remaining < 0 ? '#ef4444' : (remaining < 20 ? '#f59e0b' : '#38bdf8') }}>
                      {remaining} restantes
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    maxLength={maxChars}
                    className="cd-textarea"
                    placeholder="Escreva em suas próprias palavras a exata distinção jurídica/técnica..."
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                  />

                  {successMsg && (
                    <div className="success-banner-cd animate-fade-in">
                      {successMsg}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.6rem' }}>
                    <button
                      type="submit"
                      className="btn-cd-submit"
                      disabled={!responseText.trim() || remaining < 0}
                    >
                      🔗 Consolidar Ponte Sináptica
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
