import React, { useState } from 'react';
import {
  Layers,
  X,
  CheckCircle2
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './MontagemCadernoModal.css';

export interface MontagemCadernoModalProps {
  activeConcurso: ConcursoItem | null;
  initialFilters?: {
    disciplina?: string;
    assunto?: string;
    banca?: string;
    ano?: number;
    situacao?: string;
  };
  totalElegiveis: number;
  onClose: () => void;
  onSaveCaderno: (caderno: {
    nome: string;
    concursoId?: string;
    tipo: 'FIXO' | 'DINAMICO';
    modoResolucao: 'PRATICA' | 'DIAGNOSTICO' | 'FIXACAO' | 'SIMULADO';
    quantidade: number;
    filtros: any;
  }) => void;
  onStartInstantResolucao?: (caderno: any) => void;
}

export const MontagemCadernoModal: React.FC<MontagemCadernoModalProps> = ({
  activeConcurso,
  initialFilters = {},
  totalElegiveis,
  onClose,
  onSaveCaderno,
  onStartInstantResolucao
}) => {
  const [nome, setNome] = useState(
    initialFilters.disciplina
      ? `Caderno de ${initialFilters.disciplina}${initialFilters.assunto ? ` — ${initialFilters.assunto}` : ''}`
      : 'Meu Caderno de Exercícios'
  );
  const [quantidade, setQuantidade] = useState<number>(Math.min(30, Math.max(5, totalElegiveis)));
  const [isCustomQty, setIsCustomQty] = useState(false);
  const [modoResolucao, setModoResolucao] = useState<'PRATICA' | 'DIAGNOSTICO' | 'FIXACAO' | 'SIMULADO'>('PRATICA');
  const [tipoCaderno, setTipoCaderno] = useState<'FIXO' | 'DINAMICO'>('DINAMICO');
  const [incluirRespondidas, setIncluirRespondidas] = useState(false);

  // Ajusta se o total for menor que a quantidade escolhida
  const qtdReal = Math.min(quantidade, totalElegiveis);

  const handleSubmit = (startNow = false) => {
    const caderno = {
      nome: nome.trim(),
      concursoId: activeConcurso?.id,
      tipo: tipoCaderno,
      modoResolucao,
      quantidade: qtdReal,
      filtros: {
        ...initialFilters,
        incluirRespondidas
      }
    };

    if (startNow && onStartInstantResolucao) {
      onStartInstantResolucao(caderno);
    } else {
      onSaveCaderno(caderno);
    }
  };

  return (
    <div className="montagem-caderno-backdrop" onClick={onClose}>
      <div className="montagem-caderno-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="montagem-caderno-header">
          <h3>
            <Layers className="w-5 h-5 text-indigo-400" />
            Montagem de Caderno de Questões
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Quantidade Real Elegível */}
        <div className="elegibilidade-banner">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Encontramos {totalElegiveis} questões compatíveis</strong> com os filtros selecionados.
          </span>
        </div>

        {/* Nome do Caderno */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
            Nome do Caderno
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--calm-card-border)',
              background: 'var(--calm-bg-subtle)',
              color: 'var(--calm-text)',
              fontSize: '0.86rem'
            }}
          />
        </div>

        {/* Quantidades Rápidas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
            Quantidade de Questões
          </label>
          <div className="montagem-quantidades-row">
            {[5, 10, 30, 50].map((qty) => (
              <button
                key={qty}
                type="button"
                className={`btn-qty-pill ${!isCustomQty && quantidade === qty ? 'active' : ''}`}
                onClick={() => {
                  setIsCustomQty(false);
                  setQuantidade(qty);
                }}
              >
                {qty} questões
              </button>
            ))}
            <button
              type="button"
              className={`btn-qty-pill ${isCustomQty ? 'active' : ''}`}
              onClick={() => setIsCustomQty(true)}
            >
              Personalizada
            </button>
          </div>

          {isCustomQty && (
            <input
              type="number"
              min="1"
              max={totalElegiveis || 100}
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
              style={{
                width: '120px',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid var(--calm-card-border)',
                background: 'var(--calm-bg-subtle)',
                color: 'var(--calm-text)',
                fontSize: '0.85rem',
                marginTop: '0.35rem'
              }}
            />
          )}

          {quantidade > totalElegiveis && (
            <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
              ⚠️ Há apenas {totalElegiveis} questões elegíveis. O caderno será montado com a quantidade máxima disponível sem inventar questões.
            </span>
          )}
        </div>

        {/* Modos de Resolução */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--calm-text-muted)' }}>
            Modo de Resolução
          </label>
          <div className="modos-grid">
            <button
              type="button"
              className={`btn-modo-card ${modoResolucao === 'PRATICA' ? 'active' : ''}`}
              onClick={() => setModoResolucao('PRATICA')}
            >
              <strong>Prática</strong>
              <span>Gabarito e feedback imediato após cada questão respondida.</span>
            </button>

            <button
              type="button"
              className={`btn-modo-card ${modoResolucao === 'DIAGNOSTICO' ? 'active' : ''}`}
              onClick={() => setModoResolucao('DIAGNOSTICO')}
            >
              <strong>Diagnóstico</strong>
              <span>Mapeamento prévio de conhecimentos antes de indicar teoria.</span>
            </button>

            <button
              type="button"
              className={`btn-modo-card ${modoResolucao === 'FIXACAO' ? 'active' : ''}`}
              onClick={() => setModoResolucao('FIXACAO')}
            >
              <strong>Fixação</strong>
              <span>Conjunto de treino com correção e relatório ao final.</span>
            </button>

            <button
              type="button"
              className={`btn-modo-card ${modoResolucao === 'SIMULADO' ? 'active' : ''}`}
              onClick={() => setModoResolucao('SIMULADO')}
            >
              <strong>Simulado</strong>
              <span>Cronômetro estrito de prova com navegação livre e entrega única.</span>
            </button>
          </div>
        </div>

        {/* Inclusão de Questões & Tipo de Caderno */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--calm-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={incluirRespondidas}
              onChange={(e) => setIncluirRespondidas(e.target.checked)}
            />
            <span>Incluir questões já respondidas anteriormente</span>
          </label>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem', color: 'var(--calm-text)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tipoCaderno"
                checked={tipoCaderno === 'DINAMICO'}
                onChange={() => setTipoCaderno('DINAMICO')}
              />
              <span><strong>Dinâmico:</strong> Recalcula os itens conforme os critérios</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tipoCaderno"
                checked={tipoCaderno === 'FIXO'}
                onChange={() => setTipoCaderno('FIXO')}
              />
              <span><strong>Fixo:</strong> Preserva uma seleção determinada</span>
            </label>
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--calm-card-border)',
              background: 'transparent',
              color: 'var(--calm-text)',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: '1px solid var(--calm-card-border)',
              background: 'var(--calm-bg-subtle)',
              color: 'var(--calm-text)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Salvar Caderno
          </button>

          {onStartInstantResolucao && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Iniciar Agora ({qtdReal} questões)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
