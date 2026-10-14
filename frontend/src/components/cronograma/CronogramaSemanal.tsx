import React, { useState } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './CronogramaSemanal.css';

interface CronogramaProps {
  activeConcurso: ConcursoItem | null;
  onNavigateToStudy: (disciplina: string) => void;
}

interface StudyBlock {
  id: string;
  dia: string;
  disciplina: string;
  assunto: string;
  tipo: 'TEORIA' | 'QUESTOES' | 'REVISAO';
  duracaoMinutos: number;
  concluido: boolean;
}

export const CronogramaSemanal: React.FC<CronogramaProps> = ({ activeConcurso, onNavigateToStudy }) => {
  const [selectedDia, setSelectedDia] = useState<string>('Segunda');

  // Initial distribution based on typical tax preparation cycle
  const [blocks, setBlocks] = useState<StudyBlock[]>([
    { id: '1', dia: 'Segunda', disciplina: 'Direito Tributário', assunto: 'Princípios e Limitações Constitucionais', tipo: 'TEORIA', duracaoMinutos: 60, concluido: true },
    { id: '2', dia: 'Segunda', disciplina: 'Legislação Tributária', assunto: 'ISSQN — Fato Gerador e Alíquotas', tipo: 'QUESTOES', duracaoMinutos: 90, concluido: true },
    { id: '3', dia: 'Segunda', disciplina: 'Língua Portuguesa', assunto: 'Interpretação e Concordância Verbal', tipo: 'REVISAO', duracaoMinutos: 30, concluido: false },

    { id: '4', dia: 'Terça', disciplina: 'Contabilidade Geral', assunto: 'Balanço Patrimonial e DRE', tipo: 'TEORIA', duracaoMinutos: 90, concluido: false },
    { id: '5', dia: 'Terça', disciplina: 'Direito Constitucional', assunto: 'Direitos e Garantias Fundamentais', tipo: 'QUESTOES', duracaoMinutos: 60, concluido: false },

    { id: '6', dia: 'Quarta', disciplina: 'Direito Administrativo', assunto: 'Atos Administrativos e Poderes', tipo: 'TEORIA', duracaoMinutos: 60, concluido: false },
    { id: '7', dia: 'Quarta', disciplina: 'Legislação Tributária', assunto: 'IPTU e ITBI — Regras Municipais', tipo: 'QUESTOES', duracaoMinutos: 90, concluido: false },

    { id: '8', dia: 'Quinta', disciplina: 'Auditoria Fiscal', assunto: 'Técnicas e Procedimentos de Auditoria', tipo: 'TEORIA', duracaoMinutos: 60, concluido: false },
    { id: '9', dia: 'Quinta', disciplina: 'Direito Tributário', assunto: 'Crédito Tributário e Lançamento', tipo: 'QUESTOES', duracaoMinutos: 90, concluido: false },

    { id: '10', dia: 'Sexta', disciplina: 'Contabilidade Avançada', assunto: 'Demonstração dos Fluxos de Caixa (DFC)', tipo: 'TEORIA', duracaoMinutos: 60, concluido: false },
    { id: '11', dia: 'Sexta', disciplina: 'Raciocínio Lógico & Matemática', assunto: 'Probabilidade e Equivalências', tipo: 'QUESTOES', duracaoMinutos: 60, concluido: false },

    { id: '12', dia: 'Sábado', disciplina: 'Simulado Semanal de Questões', assunto: 'Prova Completa de Conhecimentos Específicos', tipo: 'QUESTOES', duracaoMinutos: 180, concluido: false },
    { id: '13', dia: 'Sábado', disciplina: 'Caderno de Erros', assunto: 'Refazer questões erradas na semana', tipo: 'REVISAO', duracaoMinutos: 60, concluido: false },

    { id: '14', dia: 'Domingo', disciplina: 'Ciclo de Revisão Espaçada', assunto: 'Revisão dos resumos e flashcards da semana', tipo: 'REVISAO', duracaoMinutos: 120, concluido: false },
  ]);

  const toggleConcluido = (id: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, concluido: !b.concluido } : b));
  };

  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const blocksDoDia = blocks.filter(b => b.dia === selectedDia);

  const totalMinutosSemana = blocks.reduce((acc, b) => acc + b.duracaoMinutos, 0);
  const totalMinutosConcluidos = blocks.filter(b => b.concluido).reduce((acc, b) => acc + b.duracaoMinutos, 0);

  return (
    <div className="cronograma-container animate-fade-in">
      {/* Header */}
      <div className="cronograma-header glass">
        <div>
          <h2>📅 Cronograma Inteligente & Ciclos de Estudo</h2>
          <p className="cronograma-subtitle">
            Ciclo equilibrado de Teoria, Resolução de Questões e Revisão Espaçada para {activeConcurso?.nome || 'o Concurso Ativo'}
          </p>
        </div>

        <div className="cronograma-progress-card">
          <div className="prog-metric">
            <span className="prog-val">{(totalMinutosConcluidos / 60).toFixed(1)}h</span>
            <span className="prog-label">concluídas de {(totalMinutosSemana / 60).toFixed(1)}h</span>
          </div>
          <div className="cronograma-bar">
            <div 
              className="cronograma-fill" 
              style={{ width: `${(totalMinutosConcluidos / totalMinutosSemana) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Days Tabs */}
      <div className="dias-tabs-bar">
        {dias.map((dia) => {
          const diaBlocks = blocks.filter(b => b.dia === dia);
          const allDone = diaBlocks.length > 0 && diaBlocks.every(b => b.concluido);
          const diaMinutos = diaBlocks.reduce((acc, b) => acc + b.duracaoMinutos, 0);

          return (
            <button
              key={dia}
              className={`dia-tab ${selectedDia === dia ? 'active' : ''}`}
              onClick={() => setSelectedDia(dia)}
            >
              <span className="dia-tab-nome">{dia}</span>
              <span className="dia-tab-horas">{(diaMinutos / 60).toFixed(1)}h</span>
              {allDone && <span className="dia-tab-done">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Blocks for Selected Day */}
      <div className="dia-content-card glass">
        <div className="dia-header-row">
          <h3>Blocos Planejados para {selectedDia}-feira</h3>
          <span className="dia-total-badge">
            {blocksDoDia.length} blocos • {blocksDoDia.reduce((acc, b) => acc + b.duracaoMinutos, 0)} minutos
          </span>
        </div>

        <div className="blocks-list">
          {blocksDoDia.map((block) => (
            <div
              key={block.id}
              className={`study-block-card ${block.concluido ? 'is-completed' : ''}`}
            >
              <div className="block-status-col">
                <input
                  type="checkbox"
                  checked={block.concluido}
                  onChange={() => toggleConcluido(block.id)}
                  title="Marcar como concluído"
                />
              </div>

              <div className="block-info-col">
                <div className="block-top-meta">
                  <span className={`block-badge type-${block.tipo.toLowerCase()}`}>
                    {block.tipo}
                  </span>
                  <span className="block-duration">⏱️ {block.duracaoMinutos} min</span>
                </div>
                <h4 className="block-discipline">{block.disciplina}</h4>
                <p className="block-subject">{block.assunto}</p>
              </div>

              <div className="block-actions-col">
                <button
                  className="btn btn-block-study"
                  onClick={() => onNavigateToStudy(block.disciplina)}
                >
                  ▶ Praticar Questões
                </button>
              </div>
            </div>
          ))}

          {blocksDoDia.length === 0 && (
            <div className="empty-day-message">
              <span>Dia de descanso ou livre para revisões pontuais.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CronogramaSemanal;
