import React, { useState } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './CicloRevisoes.css';

interface CicloRevisoesProps {
  activeConcurso: ConcursoItem | null;
  onStartErrorNotebook: (errorType?: string) => void;
}

export const CicloRevisoes: React.FC<CicloRevisoesProps> = ({
  activeConcurso,
  onStartErrorNotebook,
}) => {
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<string | null>(null);

  // Taxonomy of Errors (E1 to E6)
  const errorTaxonomy = [
    {
      code: 'E1',
      title: 'Falta de Conteúdo Teórico',
      desc: 'Assunto não estudado previamente ou lacuna fundamental de teoria.',
      count: 14,
      color: '#ef4444',
      action: 'Estudar Teoria Base',
    },
    {
      code: 'E2',
      title: 'Interpretação & Pegadinha da Banca',
      desc: 'Leitura rápida, distrator sutil ou não observação do comando ("exceto", "incorreta").',
      count: 22,
      color: '#f97316',
      action: 'Treinar Atenção ao Enunciado',
    },
    {
      code: 'E3',
      title: 'Confusão Conceitual',
      desc: 'Troca de conceitos próximos (ex: imunidade x isenção, decadência x prescrição).',
      count: 9,
      color: '#eab308',
      action: 'Tabela Comparativa',
    },
    {
      code: 'E4',
      title: 'Erro de Cálculo / Procedimento',
      desc: 'Fórmula incorreta, erro aritmético ou passo esquecido em contabilidade/matemática.',
      count: 6,
      color: '#8b5cf6',
      action: 'Refazer Passo a Passo',
    },
    {
      code: 'E5',
      title: 'Lapso de Memória / Prazos & Alíquotas',
      desc: 'Regra pontual ou prazo legal esquecido por falta de repetição programada.',
      count: 18,
      color: '#3b82f6',
      action: 'Repetição Espaçada / Flashcards',
    },
    {
      code: 'E6',
      title: 'Chute Incorreto / Decisão Arriscada',
      desc: 'Tentativa sem convicção em itens de dúvida moderada ou alta.',
      count: 8,
      color: '#64748b',
      action: 'Calibrar Critério de Chute',
    },
  ];

  const totalErrors = errorTaxonomy.reduce((acc, e) => acc + e.count, 0);

  // Spaced Repetition Queue
  const revisoesFila = [
    { id: '1', disciplina: 'Legislação Tributária', assunto: 'ISS — Local da Prestação (LC 116/03)', vencimento: 'Hoje', atrasada: false, questoesCount: 8 },
    { id: '2', disciplina: 'Direito Tributário', assunto: 'Suspensão da Exigibilidade do Crédito', vencimento: 'Hoje', atrasada: true, questoesCount: 12 },
    { id: '3', disciplina: 'Contabilidade Geral', assunto: 'Depreciação, Amortização e Exaustão', vencimento: 'Amanhã', atrasada: false, questoesCount: 6 },
    { id: '4', disciplina: 'Direito Constitucional', assunto: 'Repartição das Receitas Tributárias', vencimento: 'Em 3 dias', atrasada: false, questoesCount: 10 },
  ];

  return (
    <div className="revisoes-container animate-fade-in">
      {/* Header */}
      <div className="revisoes-header glass">
        <div>
          <h2>🔄 Ciclo de Revisões & Diagnóstico de Erros (E1 a E6)</h2>
          <p className="revisoes-subtitle">
            Transforme cada erro registrado no Event Store em alavanca determinística de retenção para {activeConcurso?.nome || 'o Concurso Ativo'}
          </p>
        </div>

        <button
          className="btn btn-primary-refazer"
          onClick={() => onStartErrorNotebook()}
        >
          ⚡ Refazer Todos os Erros ({totalErrors} questões)
        </button>
      </div>

      {/* Top Summary Row */}
      <div className="revisoes-summary-grid">
        <div className="summary-box glass">
          <span className="summary-num text-red">{totalErrors}</span>
          <span className="summary-title">Questões com Erro Mapeado</span>
          <span className="summary-sub">Identificadas com taxonomia rigorosa</span>
        </div>

        <div className="summary-box glass">
          <span className="summary-num text-orange">20</span>
          <span className="summary-title">Revisões Espaçadas para Hoje</span>
          <span className="summary-sub">Curva de esquecimento calculada</span>
        </div>

        <div className="summary-box glass">
          <span className="summary-num text-green">82%</span>
          <span className="summary-title">Taxa de Acerto na 2ª Tentativa</span>
          <span className="summary-sub">Eficiência de fixação pós-diagnóstico</span>
        </div>
      </div>

      {/* Main Grid: Taxonomy E1-E6 vs Spaced Repetition */}
      <div className="revisoes-main-grid">
        {/* Left: Error Taxonomy Breakdown */}
        <div className="taxonomy-card glass">
          <div className="card-top-header">
            <div>
              <h3>Diagnóstico das Causas de Erro (E1 a E6)</h3>
              <p>Distribuição das causas raízes identificadas durante suas resoluções</p>
            </div>
          </div>

          <div className="taxonomy-list">
            {errorTaxonomy.map((item) => {
              const pct = ((item.count / totalErrors) * 100).toFixed(1);
              return (
                <div
                  key={item.code}
                  className={`taxonomy-row ${selectedTaxonomy === item.code ? 'selected' : ''}`}
                  onClick={() => setSelectedTaxonomy(item.code === selectedTaxonomy ? null : item.code)}
                >
                  <div className="tax-badge" style={{ backgroundColor: item.color }}>
                    {item.code}
                  </div>

                  <div className="tax-info">
                    <div className="tax-title-row">
                      <strong>{item.title}</strong>
                      <span className="tax-count">
                        {item.count} erros ({pct}%)
                      </span>
                    </div>
                    <p className="tax-desc">{item.desc}</p>
                    <div className="tax-bar-wrap">
                      <div
                        className="tax-bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>

                  <button
                    className="btn-filter-error"
                    title={`Praticar apenas erros de ${item.code}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartErrorNotebook(item.code);
                    }}
                  >
                    ▶ Praticar
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Spaced Repetition Queue */}
        <div className="queue-card glass">
          <div className="card-top-header">
            <div>
              <h3>Fila de Revisão Espaçada</h3>
              <p>Tópicos programados para revisão determinística</p>
            </div>
          </div>

          <div className="queue-list">
            {revisoesFila.map((rev) => (
              <div key={rev.id} className="queue-item">
                <div className="queue-meta">
                  <span className={`queue-badge ${rev.atrasada ? 'badge-atrasada' : ''}`}>
                    {rev.vencimento}
                  </span>
                  <span className="queue-q-count">{rev.questoesCount} questões</span>
                </div>
                <h4 className="queue-disc">{rev.disciplina}</h4>
                <p className="queue-subject">{rev.assunto}</p>

                <button
                  className="btn-review-now"
                  onClick={() => onStartErrorNotebook()}
                >
                  Revisar Bloco
                </button>
              </div>
            ))}
          </div>

          <div className="queue-tip">
            💡 <strong>Regra de ouro:</strong> Resolver questões erradas 24h após o primeiro erro aumenta a retenção de longo prazo em até 70%.
          </div>
        </div>
      </div>
    </div>
  );
};

export default CicloRevisoes;
