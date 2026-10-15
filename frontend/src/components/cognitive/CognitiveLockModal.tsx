import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CognitiveLockModal.css';

interface Message {
  sender: 'assistant' | 'user';
  text: string;
}

interface CognitiveLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  assunto: string;
  disciplina: string;
  sessionId: string;
  concursoId?: string;
  consecutiveErrors?: number;
  onUnlock?: () => void;
}

export const CognitiveLockModal: React.FC<CognitiveLockModalProps> = ({
  isOpen,
  onClose,
  assunto,
  disciplina,
  sessionId,
  concursoId,
  consecutiveErrors = 3,
  onUnlock,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [persona, setPersona] = useState<string>('DONO_SUPERMERCADO');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    '🛒 Explicar como se eu fosse um dono de supermercado',
    '📦 O que acontece se o produto estragar na gôndola?',
    '⚖️ Qual a pegadinha clássica da banca para me derrubar?',
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carregar explicação inicial quando o modal abre
  useEffect(() => {
    if (isOpen && assunto) {
      setMessages([
        {
          sender: 'assistant',
          text: `⚠️ **Intervenção Pedagógica Imediata (Bloqueio Cognitivo)**\n\nNotei que você errou ${consecutiveErrors} questões seguidas sobre **'${assunto}'**. Continuar resolvendo no piloto automático agora só vai consolidar o erro e gerar frustração.\n\nFale comigo agora! Peça para eu explicar como se você fosse um dono de supermercado.`,
        },
      ]);

      // Busca a primeira explicação da IA
      fetchInitialExplanation(persona);
    }
  }, [isOpen, assunto]);

  const fetchInitialExplanation = async (chosenPersona: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/cognitive/media-routing/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          concursoId,
          disciplina,
          assunto,
          userMessage: 'Explique este conceito para um dono de supermercado.',
          persona: chosenPersona,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.responseMessage,
          },
        ]);
        if (data.sugestoesPerguntas && data.sugestoesPerguntas.length > 0) {
          setSuggestions(data.sugestoesPerguntas);
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar explicação da IA:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg = textToSend.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/cognitive/media-routing/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          concursoId,
          disciplina,
          assunto,
          userMessage: userMsg,
          persona,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.responseMessage,
          },
        ]);
        if (data.sugestoesPerguntas) {
          setSuggestions(data.sugestoesPerguntas);
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Não consegui processar agora. Mas a regra central é: foque em quem paga antecipadamente e quem fica desonerado na saída.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    try {
      await fetch('/api/v1/cognitive/media-routing/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          concursoId,
          disciplina,
          assunto,
          notes: 'Conceito destravado com sucesso no chat de analogia com a IA.',
        }),
      });
    } catch (e) {
      console.warn('Falha ao registrar desbloqueio no backend:', e);
    }

    if (onUnlock) onUnlock();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="cognitive-lock-backdrop animate-fade-in" onClick={onClose}>
      <div className="cognitive-lock-card" onClick={(e) => e.stopPropagation()}>
        {/* Header do Travamento */}
        <div className="cognitive-lock-header">
          <div>
            <div className="cognitive-lock-title-row">
              <span className="cognitive-lock-badge">🛑 TRAVAMENTO COGNITIVO</span>
              <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>
                {consecutiveErrors} Erros Consecutivos em '{assunto}'
              </span>
            </div>
            <h3>O Bloqueio Cognitivo: Roteamento de Mídia para IA</h3>
            <p className="cognitive-lock-desc">
              Notei que você não entendeu esse conceito. Fale com a IA agora. Peça para ela explicar como se você fosse um dono de supermercado.
            </p>
          </div>
          <button className="cognitive-lock-close" onClick={onClose}>✕</button>
        </div>

        {/* Seletor de Persona / Ângulo Didático */}
        <div className="cognitive-persona-bar">
          <span className="persona-label">Abordagem Didática:</span>
          <button
            type="button"
            className={`persona-btn ${persona === 'DONO_SUPERMERCADO' ? 'active' : ''}`}
            onClick={() => {
              setPersona('DONO_SUPERMERCADO');
              fetchInitialExplanation('DONO_SUPERMERCADO');
            }}
          >
            🛒 Dono de Supermercado (Recomendado)
          </button>
          <button
            type="button"
            className={`persona-btn ${persona === 'CRIANCA_10_ANOS' ? 'active' : ''}`}
            onClick={() => {
              setPersona('CRIANCA_10_ANOS');
              fetchInitialExplanation('CRIANCA_10_ANOS');
            }}
          >
            🧒 Criança de 10 Anos (Simplicidade Extrema)
          </button>
          <button
            type="button"
            className={`persona-btn ${persona === 'AUDITOR_PRATICO' ? 'active' : ''}`}
            onClick={() => {
              setPersona('AUDITOR_PRATICO');
              fetchInitialExplanation('AUDITOR_PRATICO');
            }}
          >
            ⚖️ Auditor de Campo (Prática Fiscal)
          </button>
        </div>

        {/* Mensagens do Chat */}
        <div className="cognitive-chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.sender}`}>
              <div className="chat-avatar">{m.sender === 'assistant' ? '🤖' : '👤'}</div>
              <div className="chat-content">
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                {m.sender === 'assistant' && idx === messages.length - 1 && suggestions.length > 0 && (
                  <div className="chat-suggestions-row">
                    {suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendMessage(sug)}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-bubble assistant">
              <div className="chat-avatar">🤖</div>
              <div className="chat-content" style={{ color: '#94a3b8' }}>
                Traduzindo a mecânica do conceito para a gôndola do supermercado...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Ação de Desbloqueio */}
        <div className="cognitive-chat-footer">
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
          >
            <input
              type="text"
              className="chat-input"
              placeholder={`Tire sua dúvida sobre ${assunto} ou peça outra analogia...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="chat-send-btn" disabled={isLoading || !inputText.trim()}>
              Enviar
            </button>
          </form>

          <div className="chat-actions-bottom">
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              💡 Assim que a mecânica do conceito fizer sentido, destrave a sessão para continuar.
            </span>
            <button
              type="button"
              className="btn-unlock-session"
              onClick={handleUnlock}
            >
              ✓ Entendi a Mecânica! Destravar e Continuar ➔
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
