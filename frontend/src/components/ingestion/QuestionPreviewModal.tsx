import React, { useState } from 'react';
import type { StagingQuestion } from './AuditCockpit';
import './QuestionPreviewModal.css';

interface QuestionPreviewModalProps {
  question: StagingQuestion;
  banca?: string;
  ano?: number | null;
  orgao?: string;
  cargo?: string;
  editalTopicos: { id: string; disciplina: string; assunto: string; subassunto?: string }[];
  onUpdateQuestionField: (field: string, value: any) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({
  question,
  banca,
  ano,
  orgao,
  cargo,
  editalTopicos,
  onUpdateQuestionField,
  onSave,
  onClose,
}) => {
  // Estado local para simular resolução pelo estudante
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [showSupport, setShowSupport] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [viewportMode, setViewportMode] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');

  const isCE =
    (question.options && question.options.length === 2) ||
    (question.statement || '').toUpperCase().includes('JULGUE O ITEM') ||
    (question.statement || '').toUpperCase().includes('CERTO OU ERRADO');

  // Identifica se a opção selecionada está correta
  const correctOptClean = (question.correctOption || '').toUpperCase().trim();
  const isSelectedCorrect =
    selectedOpt &&
    (isCE
      ? (selectedOpt === 'C' && (correctOptClean === 'C' || correctOptClean === 'A')) ||
        (selectedOpt === 'E' && (correctOptClean === 'E' || correctOptClean === 'B'))
      : selectedOpt === correctOptClean);

  const handleSimulateAnswer = (letter: string) => {
    if (isAnswered) return;
    setSelectedOpt(letter);
  };

  const handleConfirmAnswer = () => {
    if (!selectedOpt || confidence === 0) return;
    setIsAnswered(true);
  };

  const handleResetSimulation = () => {
    setSelectedOpt(null);
    setConfidence(0);
    setIsAnswered(false);
  };

  const handleSaveAndNotify = async () => {
    try {
      setIsSaving(true);
      await onSave();
      alert('Alterações salvas com sucesso no banco de staging!');
    } catch (e: any) {
      alert('Erro ao salvar alterações: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const supportText = question.supportMaterial?.conteudoTexto || question.textoApoio;
  const supportTitle = question.supportMaterial?.titulo || question.textoApoioTitulo || 'Material de Apoio / Texto-Base';

  return (
    <div className="preview-modal-backdrop" onClick={onClose}>
      <div className="preview-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="preview-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>👁️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--calm-text-main, #0f172a)', fontWeight: 700 }}>
                Pré-Visualização & Edição de Apresentação (Modo Estudante)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Questão Q{question.numeroOriginal} • Veja em tempo real exatamente como o aluno resolverá a questão
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Seletor de Simulação de Viewport (T33) */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px', marginRight: '0.5rem' }}>
              <button
                className={`opt-btn-mini ${viewportMode === 'DESKTOP' ? 'active' : ''}`}
                style={viewportMode === 'DESKTOP' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
                onClick={() => setViewportMode('DESKTOP')}
                title="Simular visualização em Desktop (100%)"
              >
                💻 Desktop
              </button>
              <button
                className={`opt-btn-mini ${viewportMode === 'TABLET' ? 'active' : ''}`}
                style={viewportMode === 'TABLET' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
                onClick={() => setViewportMode('TABLET')}
                title="Simular visualização em Tablet (largura ~768px)"
              >
                📱 Tablet
              </button>
              <button
                className={`opt-btn-mini ${viewportMode === 'MOBILE' ? 'active' : ''}`}
                style={viewportMode === 'MOBILE' ? { background: '#0284c7', color: '#fff', fontWeight: 600 } : {}}
                onClick={() => setViewportMode('MOBILE')}
                title="Simular visualização em Celular (largura ~380px)"
              >
                📲 Celular
              </button>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleResetSimulation}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              title="Reiniciar a resolução de teste"
            >
              🔄 Resetar Teste
            </button>
            <button
              className="btn"
              onClick={handleSaveAndNotify}
              disabled={isSaving}
              style={{ background: '#10b981', color: '#fff', fontSize: '0.82rem', padding: '5px 14px', fontWeight: 700 }}
            >
              {isSaving ? 'Salvando...' : '💾 Salvar Alterações'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={onClose}
              style={{ fontSize: '0.9rem', padding: '4px 10px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body com 2 Colunas: Esquerda (Experiência Real com Viewport) | Direita (Edição ao Vivo) */}
        <div className="preview-modal-body">
          {/* Coluna 1: Experiência do Estudante no QuestionViewer */}
          <div
            className="preview-half-pane interactive-pane"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: viewportMode === 'DESKTOP' ? 'stretch' : 'center',
              background: viewportMode === 'DESKTOP' ? '#080d1a' : '#030712',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: viewportMode === 'DESKTOP' ? '100%' : viewportMode === 'TABLET' ? '720px' : '380px',
                transition: 'all 0.25s ease',
                background: viewportMode === 'DESKTOP' ? 'transparent' : 'rgba(15, 23, 42, 0.95)',
                border: viewportMode === 'DESKTOP' ? 'none' : '2px solid rgba(56, 189, 248, 0.4)',
                borderRadius: viewportMode === 'DESKTOP' ? '0' : '16px',
                padding: viewportMode === 'DESKTOP' ? '0' : '1rem',
                boxShadow: viewportMode === 'DESKTOP' ? 'none' : '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                🎮 Visão Real de Prática ({viewportMode}):
              </span>
              <span className={`status-badge ${question.status === 'SOURCE_VERIFIED' ? 'verified' : 'review'}`} style={{ fontSize: '0.7rem' }}>
                {question.status}
              </span>
            </div>

            {/* Hierarchical Header Metadata (como no QuestionViewer) */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <span className="meta-pill board-pill">{banca || 'Banca'}</span>
                {ano && <span className="meta-pill year-pill">{ano}</span>}
                <span className="meta-pill discipline-pill">{question.disciplina || 'Disciplina Geral'}</span>
                <span className="meta-pill" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8' }}>
                  {orgao || 'Órgão'} • {cargo || 'Cargo'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {question.assunto && <strong>Assunto: </strong>}
                {question.assunto}
                {question.subassunto && ` ➔ ${question.subassunto}`}
              </div>
            </div>

            {/* Material de Apoio / Texto-Base Retrátil */}
            {supportText && (
              <div style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.82rem' }}>
                    📎 {supportTitle}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={() => setShowSupport((prev) => !prev)}
                  >
                    {showSupport ? 'Recolher' : 'Expandir'}
                  </button>
                </div>
                {showSupport && (
                  <div style={{ marginTop: '0.5rem', color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                    {supportText}
                  </div>
                )}
              </div>
            )}

            {/* Enunciado Formatado */}
            <div style={{ background: 'var(--calm-bg-subtle, #f8fafc)', border: '1px solid var(--calm-card-border, #cbd5e1)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', color: 'var(--calm-text-main, #0f172a)', fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {question.statement || <span style={{ color: '#ef4444' }}>⚠️ Enunciado não preenchido ou vazio.</span>}
            </div>

            {/* Alternativas Interativas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {isCE ? (
                ['C', 'E'].map((letter) => {
                  const label = letter === 'C' ? 'CERTO' : 'ERRADO';
                  const isSelected = selectedOpt === letter;
                  let cardStyle = {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    cursor: isAnswered ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                  };

                  if (isSelected && !isAnswered) {
                    cardStyle.background = 'rgba(56, 189, 248, 0.15)';
                    cardStyle.border = '1px solid #38bdf8';
                  } else if (isAnswered) {
                    if (isSelected && isSelectedCorrect) {
                      cardStyle.background = 'rgba(16, 185, 129, 0.2)';
                      cardStyle.border = '1px solid #10b981';
                    } else if (isSelected && !isSelectedCorrect) {
                      cardStyle.background = 'rgba(239, 68, 68, 0.2)';
                      cardStyle.border = '1px solid #ef4444';
                    } else if (letter === correctOptClean) {
                      cardStyle.border = '1px dashed #10b981';
                    }
                  }

                  return (
                    <div key={letter} style={cardStyle} onClick={() => handleSimulateAnswer(letter)}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: isSelected ? '#0284c7' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                        }}
                      >
                        {letter}
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--calm-text-main, #0f172a)' }}>
                        {label}
                      </span>
                    </div>
                  );
                })
              ) : (
                (question.options || []).map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = selectedOpt === letter;
                  const isThisCorrect = letter === correctOptClean;
                  let cardStyle: any = {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    cursor: isAnswered ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                  };

                  if (isSelected && !isAnswered) {
                    cardStyle.background = 'rgba(56, 189, 248, 0.15)';
                    cardStyle.border = '1px solid #38bdf8';
                  } else if (isAnswered) {
                    if (isSelected && isSelectedCorrect) {
                      cardStyle.background = 'rgba(16, 185, 129, 0.2)';
                      cardStyle.border = '1px solid #10b981';
                    } else if (isSelected && !isSelectedCorrect) {
                      cardStyle.background = 'rgba(239, 68, 68, 0.2)';
                      cardStyle.border = '1px solid #ef4444';
                    } else if (isThisCorrect) {
                      cardStyle.border = '1px dashed #10b981';
                    }
                  }

                  return (
                    <div key={idx} style={cardStyle} onClick={() => handleSimulateAnswer(letter)}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: isSelected ? '#0284c7' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {letter}
                      </div>
                      <span style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                        {opt.replace(/^([A-Ea-e])\)?\s*/, '')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Barra de Ação da Resolução */}
            {!isAnswered ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Confiança:</span>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`conf-btn ${confidence === lvl ? 'active' : ''}`}
                      onClick={() => setConfidence(lvl)}
                      style={{ padding: '2px 6px', fontSize: '0.75rem', ...(selectedOpt && confidence === 0 ? { borderColor: 'rgba(245, 158, 11, 0.5)' } : {}) }}
                    >
                      {lvl}
                    </button>
                  ))}
                  {selectedOpt && confidence === 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>⚠️ Marque de 1 a 5</span>
                  )}
                </div>
                <button
                  className="btn"
                  disabled={!selectedOpt || confidence === 0}
                  onClick={handleConfirmAnswer}
                  style={{ background: (selectedOpt && confidence > 0) ? '#0284c7' : '#334155', color: '#fff', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700 }}
                  title={!selectedOpt ? 'Selecione uma opção' : confidence === 0 ? 'Indique o nível de confiança (1 a 5) antes de confirmar' : 'Confirmar Resposta'}
                >
                  Confirmar Resposta
                </button>
              </div>
            ) : (
              <div style={{ background: isSelectedCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${isSelectedCorrect ? '#10b981' : '#ef4444'}`, borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ fontWeight: 800, color: isSelectedCorrect ? '#34d399' : '#f87171', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                  {isSelectedCorrect ? '✓ RESPOSTA CORRETA!' : '✗ RESPOSTA INCORRETA'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--calm-text-muted, #475569)' }}>
                  Gabarito Oficial: <strong>{question.correctOption}</strong> ({question.gabaritoStatus || 'PRELIMINAR'})
                </div>
                {question.justificativa && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', color: '#fde68a' }}>
                    <strong>Comentário / Justificativa Oficial:</strong>
                    <div style={{ marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{question.justificativa}</div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Coluna 2: Edição em Tempo Real com Atualização Imediata */}
          <div className="preview-half-pane editor-pane">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block' }}>
              ✏️ Edição Direta da Questão (Reflete Imediatamente ao Lado):
            </span>

            {/* Enunciado */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Enunciado da Questão</label>
              <textarea
                className="form-control"
                rows={5}
                value={question.statement || ''}
                onChange={(e) => onUpdateQuestionField('statement', e.target.value)}
                placeholder="Digite ou formate o enunciado da questão..."
                style={{ fontSize: '0.82rem', lineHeight: 1.4 }}
              />
            </div>

            {/* Material de Apoio */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>Texto de Apoio / Base</label>
                <input
                  className="form-control"
                  placeholder="Título (ex: Texto 01)"
                  value={question.supportMaterial?.titulo || question.textoApoioTitulo || ''}
                  onChange={(e) => {
                    const title = e.target.value;
                    onUpdateQuestionField('textoApoioTitulo', title);
                    onUpdateQuestionField('supportMaterial', {
                      ...(question.supportMaterial || {}),
                      tipo: 'TEXTO_BASE',
                      titulo: title,
                      conteudoTexto: question.supportMaterial?.conteudoTexto || question.textoApoio || '',
                    });
                  }}
                  style={{ width: '160px', padding: '2px 6px', fontSize: '0.72rem' }}
                />
              </div>
              <textarea
                className="form-control"
                rows={4}
                value={supportText || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateQuestionField('textoApoio', val);
                  onUpdateQuestionField('supportMaterial', {
                    ...(question.supportMaterial || {}),
                    tipo: 'TEXTO_BASE',
                    titulo: supportTitle,
                    conteudoTexto: val,
                  });
                }}
                placeholder="Cole ou edite o texto-base da questão aqui..."
                style={{ fontSize: '0.8rem', lineHeight: 1.4 }}
              />
            </div>

            {/* Alternativas */}
            {!isCE && (
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                    Alternativas ({question.options?.length || 0})
                  </label>
                  <button
                    type="button"
                    className="opt-btn-mini"
                    onClick={() => {
                      const nextL = String.fromCharCode(65 + (question.options?.length || 0));
                      const newOpts = [...(question.options || []), `${nextL}) Nova alternativa`];
                      onUpdateQuestionField('options', newOpts);
                    }}
                    style={{ fontSize: '0.72rem', color: '#38bdf8', borderColor: '#38bdf8' }}
                  >
                    + Alternativa
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {(question.options || []).map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    return (
                      <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span style={{ width: '22px', fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>{letter})</span>
                        <input
                          className="form-control"
                          value={opt.replace(/^([A-Ea-e])\)?\s*/, '')}
                          onChange={(e) => {
                            const newOpts = [...(question.options || [])];
                            newOpts[i] = `${letter}) ${e.target.value}`;
                            onUpdateQuestionField('options', newOpts);
                          }}
                          style={{ flex: 1, padding: '3px 7px', fontSize: '0.78rem' }}
                        />
                        <button
                          type="button"
                          className="opt-btn-mini"
                          style={{ color: '#ef4444' }}
                          onClick={() => {
                            const newOpts = (question.options || []).filter((_, idx) => idx !== i);
                            onUpdateQuestionField('options', newOpts);
                          }}
                          title="Remover alternativa"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gabarito e Justificativa */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>Gabarito Oficial</label>
                <select
                  className="form-control"
                  value={question.correctOption || ''}
                  onChange={(e) => onUpdateQuestionField('correctOption', e.target.value)}
                  style={{ padding: '3px 6px', fontSize: '0.8rem' }}
                >
                  <option value="">-- Não Definido --</option>
                  {isCE ? (
                    <>
                      <option value="C">C (CERTO)</option>
                      <option value="E">E (ERRADO)</option>
                    </>
                  ) : (
                    ['A', 'B', 'C', 'D', 'E'].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))
                  )}
                  <option value="ANULADA">ANULADA</option>
                  <option value="DESCONSIDERADA">DESCONSIDERADA</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Status do Gabarito</label>
                <select
                  className="form-control"
                  value={question.gabaritoStatus || 'PRELIMINAR'}
                  onChange={(e) => onUpdateQuestionField('gabaritoStatus', e.target.value)}
                  style={{ padding: '3px 6px', fontSize: '0.8rem' }}
                >
                  <option value="PRELIMINAR">PRELIMINAR</option>
                  <option value="DEFINITIVO">DEFINITIVO</option>
                  <option value="ANULADA">ANULADA</option>
                  <option value="RETIFICADO">RETIFICADO</option>
                </select>
              </div>
            </div>

            {/* Justificativa / Comentário Oficial */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>Comentário / Justificativa Oficial</label>
              <textarea
                className="form-control"
                rows={3}
                value={question.justificativa || ''}
                onChange={(e) => onUpdateQuestionField('justificativa', e.target.value)}
                placeholder="Comentário da banca, fundamentação legal ou justificativa do gabarito..."
                style={{ fontSize: '0.78rem', lineHeight: 1.3 }}
              />
            </div>

            {/* Disciplina e Assunto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Disciplina</label>
                <input
                  className="form-control"
                  value={question.disciplina || ''}
                  onChange={(e) => onUpdateQuestionField('disciplina', e.target.value)}
                  style={{ padding: '3px 6px', fontSize: '0.78rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Assunto</label>
                <input
                  className="form-control"
                  value={question.assunto || ''}
                  onChange={(e) => onUpdateQuestionField('assunto', e.target.value)}
                  style={{ padding: '3px 6px', fontSize: '0.78rem' }}
                />
              </div>
            </div>

            {/* Edital Verticalizado */}
            {editalTopicos.length > 0 && (
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Vínculo ao Edital Verticalizado</label>
                <select
                  className="form-control"
                  value={question.editalTopicoId || ''}
                  onChange={(e) => {
                    const top = editalTopicos.find((t) => t.id === e.target.value);
                    if (top) {
                      onUpdateQuestionField('editalTopicoId', top.id);
                      onUpdateQuestionField('disciplina', top.disciplina);
                      onUpdateQuestionField('assunto', top.assunto);
                      if (top.subassunto) onUpdateQuestionField('subassunto', top.subassunto);
                    } else {
                      onUpdateQuestionField('editalTopicoId', '');
                    }
                  }}
                  style={{ padding: '3px 6px', fontSize: '0.78rem' }}
                >
                  <option value="">-- Selecione o tópico --</option>
                  {editalTopicos.map((top) => (
                    <option key={top.id} value={top.id}>
                      [{top.disciplina}] {top.assunto} {top.subassunto ? `- ${top.subassunto}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
