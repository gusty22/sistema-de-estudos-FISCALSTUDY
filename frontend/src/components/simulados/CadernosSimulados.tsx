import React, { useState } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './CadernosSimulados.css';

interface CadernosSimuladosProps {
  activeConcurso: ConcursoItem | null;
  onStartSession: (config: SimuladoConfig) => void;
}

export interface SimuladoConfig {
  titulo: string;
  modo: 'TREINO' | 'SIMULADO';
  disciplinas: string[];
  banca: string;
  quantidade: number;
  filtroResolucao: 'TODAS' | 'APENAS_ERRADAS' | 'NAO_RESOLVIDAS';
  tempoMinutos?: number;
}

export const CadernosSimulados: React.FC<CadernosSimuladosProps> = ({
  activeConcurso,
  onStartSession,
}) => {
  const [modo, setModo] = useState<'TREINO' | 'SIMULADO'>('SIMULADO');
  const [titulo, setTitulo] = useState('Simulado Geral Focado — Prova Objetiva');
  const [banca, setBanca] = useState(activeConcurso?.banca || 'IBGP');
  const [quantidade, setQuantidade] = useState(30);
  const [filtroResolucao, setFiltroResolucao] = useState<'TODAS' | 'APENAS_ERRADAS' | 'NAO_RESOLVIDAS'>('TODAS');
  const [selectedDisciplinas, setSelectedDisciplinas] = useState<string[]>([
    'Legislação Tributária',
    'Direito Tributário',
    'Contabilidade Geral',
    'Língua Portuguesa',
  ]);
  const [tempoMinutos, setTempoMinutos] = useState(90);

  const disciplinasDisponiveis = [
    'Legislação Tributária',
    'Direito Tributário',
    'Contabilidade Geral e Avançada',
    'Auditoria Fiscal',
    'Direito Administrativo',
    'Direito Constitucional',
    'Língua Portuguesa',
    'Raciocínio Lógico & Matemática',
    'Tecnologia da Informação & Banco de Dados',
  ];

  const toggleDisciplina = (disc: string) => {
    if (selectedDisciplinas.includes(disc)) {
      setSelectedDisciplinas(selectedDisciplinas.filter((d) => d !== disc));
    } else {
      setSelectedDisciplinas([...selectedDisciplinas, disc]);
    }
  };

  const handleStart = () => {
    if (selectedDisciplinas.length === 0) {
      alert('Selecione pelo menos uma disciplina para o caderno.');
      return;
    }

    onStartSession({
      titulo,
      modo,
      disciplinas: selectedDisciplinas,
      banca,
      quantidade,
      filtroResolucao,
      tempoMinutos: modo === 'SIMULADO' ? tempoMinutos : undefined,
    });
  };

  return (
    <div className="cadernos-container animate-fade-in">
      {/* Header */}
      <div className="cadernos-header glass">
        <div>
          <h2>🎯 Cadernos Customizados & Modo Simulado</h2>
          <p className="cadernos-subtitle">
            Configure provas cronometradas ou cadernos de treino direcionados para {activeConcurso?.nome || 'o Concurso Ativo'}
          </p>
        </div>
      </div>

      <div className="cadernos-layout-grid">
        {/* Left Column: Config Panel */}
        <div className="cadernos-config-card glass">
          <h3 className="section-heading">1. Modalidade de Execução</h3>
          <div className="modo-selector">
            <button
              className={`modo-btn ${modo === 'SIMULADO' ? 'active' : ''}`}
              onClick={() => {
                setModo('SIMULADO');
                setTitulo('Simulado Geral Focado — Prova Objetiva');
              }}
            >
              <span className="modo-icon">⏱️</span>
              <div>
                <strong>Modo Simulado Real</strong>
                <span>Cronômetro regressivo, gabarito ao final, nota líquida</span>
              </div>
            </button>

            <button
              className={`modo-btn ${modo === 'TREINO' ? 'active' : ''}`}
              onClick={() => {
                setModo('TREINO');
                setTitulo('Caderno de Treino & Fixação');
              }}
            >
              <span className="modo-icon">📚</span>
              <div>
                <strong>Modo Treino / Aprendizado</strong>
                <span>Gabarito e justificativa imediatos a cada questão</span>
              </div>
            </button>
          </div>

          <h3 className="section-heading" style={{ marginTop: '1.5rem' }}>
            2. Filtros e Abrangência
          </h3>

          <div className="form-group-custom">
            <label>Título do Caderno / Simulado</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="custom-input"
            />
          </div>

          <div className="form-row-2">
            <div className="form-group-custom">
              <label>Banca Examinadora</label>
              <select
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                className="custom-select"
              >
                <option value="IBGP">IBGP (Oficial Araguari)</option>
                <option value="FGV">FGV (Fundação Getulio Vargas)</option>
                <option value="Cebraspe">Cebraspe / CESPE</option>
                <option value="FCC">FCC (Carlos Chagas)</option>
                <option value="TODAS">Todas as Bancas</option>
              </select>
            </div>

            <div className="form-group-custom">
              <label>Quantidade de Questões</label>
              <select
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="custom-select"
              >
                <option value={10}>10 Questões (Rápido)</option>
                <option value={20}>20 Questões (Bloco)</option>
                <option value={30}>30 Questões (Padrão)</option>
                <option value={50}>50 Questões (Meia Prova)</option>
                <option value={80}>80 Questões (Prova Completa)</option>
              </select>
            </div>
          </div>

          <div className="form-group-custom">
            <label>Filtro de Histórico de Resolução</label>
            <div className="filtro-resolucao-tabs">
              {[
                { id: 'TODAS', label: 'Todas as Questões' },
                { id: 'NAO_RESOLVIDAS', label: 'Apenas Não Resolvidas' },
                { id: 'APENAS_ERRADAS', label: 'Apenas Questões com Erro' },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`filtro-pill ${filtroResolucao === f.id ? 'active' : ''}`}
                  onClick={() => setFiltroResolucao(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {modo === 'SIMULADO' && (
            <div className="form-group-custom highlight-timer">
              <label>⏱️ Tempo Limite do Simulado (Minutos)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="number"
                  min="15"
                  max="360"
                  step="15"
                  value={tempoMinutos}
                  onChange={(e) => setTempoMinutos(Number(e.target.value))}
                  className="custom-input"
                  style={{ width: '90px', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  minutos (~{(tempoMinutos / quantidade).toFixed(1)} min por questão)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Disciplines Selection & Summary */}
        <div className="cadernos-disciplines-card glass">
          <h3 className="section-heading">3. Disciplinas Selecionadas</h3>
          <p className="section-sub">
            Selecione as matérias que farão parte do caderno ({selectedDisciplinas.length} selecionadas):
          </p>

          <div className="disciplines-chips-grid">
            {disciplinasDisponiveis.map((disc) => {
              const isSelected = selectedDisciplinas.includes(disc);
              return (
                <button
                  key={disc}
                  className={`disc-selector-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleDisciplina(disc)}
                >
                  <span className="check-box">{isSelected ? '✓' : '+'}</span>
                  <span>{disc}</span>
                </button>
              );
            })}
          </div>

          <div className="caderno-preview-box">
            <h4>Resumo da Configuração</h4>
            <div className="preview-row">
              <span>Modalidade:</span>
              <strong>{modo === 'SIMULADO' ? 'Simulado Cronometrado' : 'Treino com Feedback'}</strong>
            </div>
            <div className="preview-row">
              <span>Volume:</span>
              <strong>{quantidade} questões</strong>
            </div>
            <div className="preview-row">
              <span>Banca:</span>
              <strong>{banca}</strong>
            </div>
            {modo === 'SIMULADO' && (
              <div className="preview-row">
                <span>Duração:</span>
                <strong className="text-orange">{tempoMinutos} minutos</strong>
              </div>
            )}

            <button className="btn btn-launch-simulado" onClick={handleStart}>
              🚀 Iniciar Agora ({quantidade} Questões)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadernosSimulados;
