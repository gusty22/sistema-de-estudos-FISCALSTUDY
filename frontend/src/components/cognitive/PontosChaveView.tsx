import React, { useState, useEffect } from 'react';
import './PontosChaveView.css';

interface PontoChaveCard {
  id: string;
  disciplina: string;
  topico: string;
  criterioCritico: string; // MAIS_CAI, MAIS_DIFICIL, MAIS_ERRA, MAIS_ESQUECE, PEGADINHAS
  textoComOmissao: string;
  explicacao: string;
  revisoesCount: number;
  proximaRevisao: string;
  createdAt: string;
}

const CRITERIOS_CRITICOS = [
  { code: 'TODOS', label: 'Todos os Critérios' },
  { code: 'MAIS_CAI', label: '🔥 O que Mais Cai' },
  { code: 'MAIS_DIFICIL', label: '⚡ O Mais Difícil' },
  { code: 'MAIS_ERRA', label: '❌ O que Mais Erra' },
  { code: 'MAIS_ESQUECE', label: '🧠 O que Mais Esquece' },
  { code: 'PEGADINHAS', label: '🪤 Pegadinhas da Banca' },
];

export const PontosChaveView: React.FC = () => {
  const [cards, setCards] = useState<PontoChaveCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCriterio, setSelectedCriterio] = useState('TODOS');
  const [activeTab, setActiveTab] = useState<'CARDS' | 'FORMULARIO_EXATAS'>('CARDS');

  // Interactive review state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [disciplina, setDisciplina] = useState('');
  const [topico, setTopico] = useState('');
  const [criterio, setCriterio] = useState('MAIS_CAI');
  const [textoComOmissao, setTextoComOmissao] = useState('');
  const [explicacao, setExplicacao] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/cognitive/pontos-chave');
      if (res.ok) {
        setCards(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCards = cards.filter(c => {
    if (selectedCriterio === 'TODOS') return true;
    return c.criterioCritico === selectedCriterio;
  });

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textoComOmissao.trim()) return;

    let preparedText = textoComOmissao.trim();
    if (!preparedText.includes('{{c') && preparedText.includes('[') && preparedText.includes(']')) {
      preparedText = preparedText.replace(/\[(.*?)\]/g, '{{c1::$1}}');
    }

    try {
      const res = await fetch('/api/v1/cognitive/pontos-chave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplina: disciplina.trim() || 'Geral',
          topico: topico.trim() || 'Geral',
          criterioCritico: criterio,
          textoComOmissao: preparedText,
          explicacao: explicacao.trim()
        })
      });

      if (res.ok) {
        setFeedbackMsg('✓ Ponto-Chave registrado com sucesso no acervo SRS.');
        setTextoComOmissao('');
        setExplicacao('');
        setShowAddForm(false);
        loadData();
        setTimeout(() => setFeedbackMsg(null), 3500);
      } else {
        setFeedbackMsg('Erro ao salvar ponto-chave.');
      }
    } catch (e) {
      console.error(e);
      setFeedbackMsg('Erro de conexão ao salvar.');
    }
  };

  const handleReview = async (quality: number) => {
    const card = filteredCards[currentIndex];
    if (!card) return;

    try {
      await fetch(`/api/v1/cognitive/pontos-chave/${card.id}/review?quality=${quality}`, {
        method: 'POST'
      });
    } catch (e) {
      console.error(e);
    }

    setIsRevealed(false);
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
      loadData();
    }
  };

  const renderClozeText = (text: string, revealed: boolean) => {
    // Normaliza colchetes simples [termo] ou {{c1::termo}} para renderização limpa
    const normalized = text.replace(/\[(.*?)\]/g, '{{c1::$1}}');
    const regex = /\{\{c\d+::(.*?)(?:::.*?)?\}\}/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(normalized)) !== null) {
      if (match.index > lastIndex) {
        parts.push(normalized.substring(lastIndex, match.index));
      }
      const hiddenWord = match[1];
      if (revealed) {
        parts.push(
          <span key={match.index} className="cloze-revealed-badge">
            {hiddenWord}
          </span>
        );
      } else {
        parts.push(
          <span
            key={match.index}
            className="cloze-hidden-badge"
            onClick={() => setIsRevealed(true)}
            title="Clique para revelar a omissão"
          >
            [ ... ]
          </span>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < normalized.length) {
      parts.push(normalized.substring(lastIndex));
    }

    return parts;
  };

  const currentCard = filteredCards[currentIndex];

  return (
    <div className="pontos-chave-container animate-fade-in">
      {/* Hero Pontos-Chave */}
      <div className="pontos-chave-hero">
        <h2>🎯 Material de Pontos-Chave (Cloze Deletion / SRS)</h2>
        <p>
          Rejeitamos o resumo passivo e a releitura frágil. O Material de Pontos-Chave utiliza <strong>recuperação ativa com omissão de termos essenciais (lacunas)</strong> cobrindo estritamente os <strong>5 critérios críticos</strong> do concurso: (1) o que mais cai, (2) o mais difícil, (3) o que mais erra, (4) o que mais esquece e (5) pegadinhas clássicas da banca examinadora.
        </p>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: feedbackMsg.startsWith('✓') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: feedbackMsg.startsWith('✓') ? '#34d399' : '#fca5a5',
          border: `1px solid ${feedbackMsg.startsWith('✓') ? '#10b981' : '#ef4444'}`
        }}>
          {feedbackMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          className={`btn ${activeTab === 'CARDS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('CARDS')}
        >
          🗂️ Cards de Pontos-Chave (Cloze)
        </button>
        <button
          className={`btn ${activeTab === 'FORMULARIO_EXATAS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('FORMULARIO_EXATAS')}
          title="Fórmulas com termos ocultos para preenchimento de cabeça"
        >
          📐 Formulário de Exatas Oculto
        </button>
        <button
          className="btn btn-secondary"
          style={{ marginLeft: 'auto', borderColor: '#f59e0b', color: '#fcd34d' }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Fechar Cadastro' : '➕ Novo Ponto-Chave'}
        </button>
      </div>

      {/* Formulário de Adicionar Ponto Chave */}
      {showAddForm && (
        <form onSubmit={handleCreateCard} className="glass" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#f8fafc', fontSize: '1.15rem' }}>
            Cadastrar Novo Ponto-Chave com Omissão (Cloze Deletion)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Disciplina</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex.: Direito Tributário"
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Tópico</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex.: Imunidades"
                value={topico}
                onChange={(e) => setTopico(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Critério Crítico</label>
              <select
                className="form-control"
                value={criterio}
                onChange={(e) => setCriterio(e.target.value)}
                style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
              >
                {CRITERIOS_CRITICOS.filter(c => c.code !== 'TODOS').map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
              Texto com Termo Oculto (coloque entre colchetes a palavra-chave a memorizar, ex: <strong>[prazo de 5 anos]</strong>):
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Ex.: A revogação do ato administrativo incide exclusivamente sobre atos [válidos e discricionários], com base em conveniência e oportunidade."
              value={textoComOmissao}
              onChange={(e) => setTextoComOmissao(e.target.value)}
              required
              style={{ width: '100%', fontSize: '0.88rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
              Explicação / Justificativa / Fundamento Legal:
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex.: Art. 174 do CTN. Pegadinha comum: trocar 5 anos por 10 anos ou confundir com decadência."
              value={explicacao}
              onChange={(e) => setExplicacao(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
            Salvar Card no Acervo SRS
          </button>
        </form>
      )}

      {/* Barra de Filtros pelos 5 Critérios Críticos */}
      <div className="criterios-filter-bar">
        {CRITERIOS_CRITICOS.map(crit => (
          <button
            key={crit.code}
            className={`criterio-pill-btn ${selectedCriterio === crit.code ? 'active' : ''}`}
            onClick={() => {
              setSelectedCriterio(crit.code);
              setCurrentIndex(0);
              setIsRevealed(false);
            }}
          >
            {crit.label}
          </button>
        ))}
      </div>

      {/* ÁREA DE PRÁTICA INTERATIVA */}
      {loading ? (
        <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
          Carregando pontos-chave...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            Nenhum ponto-chave cadastrado neste critério. Clique em <strong>"➕ Novo Ponto-Chave"</strong> para alimentar seu material de retenção acelerada.
          </p>
        </div>
      ) : activeTab === 'CARDS' ? (
        <div className="cloze-study-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="tag" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                {currentCard.disciplina} • {currentCard.topico}
              </span>
              <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                Critério: {CRITERIOS_CRITICOS.find(c => c.code === currentCard.criterioCritico)?.label}
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Card {currentIndex + 1} de {filteredCards.length}
            </span>
          </div>

          <div className="cloze-text-display">
            {renderClozeText(currentCard.textoComOmissao, isRevealed)}
          </div>

          {isRevealed && currentCard.explicacao && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              color: '#cbd5e1',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              💡 <strong>Fundamento:</strong> {currentCard.explicacao}
            </div>
          )}

          <div className="cloze-review-actions">
            {!isRevealed ? (
              <button
                className="btn btn-primary"
                onClick={() => setIsRevealed(true)}
                style={{ padding: '10px 28px', fontSize: '1rem' }}
              >
                👁️ Revelar Omissão (Espaço)
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn-review-again"
                  onClick={() => handleReview(1)}
                  title="Esqueci ou chutei errado"
                >
                  ❌ Errei (Repetir Hoje)
                </button>
                <button
                  className="btn-review-good"
                  onClick={() => handleReview(3)}
                  title="Lembrei com esforço desejável"
                >
                  👍 Bom (Intervalo Padrão)
                </button>
                <button
                  className="btn-review-easy"
                  onClick={() => handleReview(5)}
                  title="Consolidado e imediato"
                >
                  ⭐ Fácil (Espaçamento Longo)
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ABA FORMULÁRIO DE EXATAS OCULTO */
        <div className="glass" style={{ padding: '1.75rem', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#38bdf8', fontSize: '1.2rem' }}>
            📐 Formulário de Exatas Oculto (Treino Deliberado de Fórmulas)
          </h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: '#94a3b8' }}>
            As fórmulas ficam tampadas para que você preencha e verbalize de cabeça antes de revelar a resposta.
            Garante que você não sofra com a 'ilusão de reconhecimento' no dia do exame.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredCards.filter(c => c.disciplina.toLowerCase().includes('exatas') || c.disciplina.toLowerCase().includes('mat') || c.disciplina.toLowerCase().includes('contab') || c.textoComOmissao.includes('=')).map(c => (
              <div key={c.id} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#38bdf8' }}>{c.topico}</strong>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{c.disciplina}</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontFamily: 'monospace', color: '#f8fafc' }}>
                  {renderClozeText(c.textoComOmissao, isRevealed)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
