import React, { useState, useEffect } from 'react';
import {
  Play,
  Plus
} from 'lucide-react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './GerenciadorCadernos.css';

interface GerenciadorCadernosProps {
  activeConcurso: ConcursoItem | null;
  onStartCaderno: (cadernoConfig: any) => void;
  onOpenNovoCaderno: () => void;
}

export const GerenciadorCadernos: React.FC<GerenciadorCadernosProps> = ({
  activeConcurso,
  onStartCaderno,
  onOpenNovoCaderno
}) => {
  const [selectedCategoria, setSelectedCategoria] = useState<string>('TODOS');
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotebooks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/bank/notebooks?concursoId=${encodeURIComponent(activeConcurso?.id || '')}`);
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data || []);
      }
    } catch {
      console.error('Falha ao carregar cadernos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotebooks();
  }, [activeConcurso?.id]);

  const categorias = [
    { id: 'TODOS', label: 'Todos os Cadernos' },
    { id: 'PERSONALIZADOS', label: 'Cadernos Personalizados' },
    { id: 'NUNCA_RESPONDIDAS', label: 'Nunca Respondidas' },
    { id: 'ERRADAS', label: 'Questões Erradas' },
    { id: 'ERROS_RECORRENTES', label: 'Erros Recorrentes' },
    { id: 'ACERTOS_INSEGUROS', label: 'Acertos Inseguros' },
    { id: 'SIMULADOS', label: 'Simulados' }
  ];

  return (
    <div className="gerenciador-cadernos-wrapper">
      <div className="cadernos-hero">
        <div className="cadernos-title-box">
          <h1>Cadernos e Simulados</h1>
          <p>
            Organize conjuntos reutilizáveis de questões fixos ou dinâmicos sem duplicar dados físicos no banco local.
          </p>
        </div>

        <button
          onClick={onOpenNovoCaderno}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            background: '#6366f1',
            color: '#fff',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          <Plus className="w-4 h-4" /> Montar Novo Caderno
        </button>
      </div>

      {/* Categorias de Cadernos */}
      <div className="cadernos-categories-row">
        {categorias.map(cat => (
          <button
            key={cat.id}
            className={`caderno-cat-pill ${selectedCategoria === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategoria(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tabela de Cadernos */}
      <div className="cadernos-table-box">
        <table className="cadernos-table">
          <thead>
            <tr>
              <th>Nome do Caderno</th>
              <th>Origem</th>
              <th>Modo</th>
              <th>Questões</th>
              <th>Última Execução</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--calm-text-muted)' }}>
                  Carregando cadernos de questões...
                </td>
              </tr>
            ) : notebooks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--calm-text-muted)' }}>
                  Nenhum caderno cadastrado ainda. Clique em "Montar Novo Caderno" para criar.
                </td>
              </tr>
            ) : (
              notebooks.map(cad => (
                <tr key={cad.id}>
                  <td>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--calm-text)' }}>{cad.nome}</strong>
                  </td>
                  <td>
                    <span className={`badge-caderno-tipo ${cad.tipo === 'DINAMICO' ? 'dinamico' : 'fixo'}`}>
                      {cad.tipo === 'DINAMICO' ? 'Dinâmico' : 'Fixo'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
                      {cad.modoResolucao || 'Prática'}
                    </span>
                  </td>
                  <td>
                    <strong>{cad.quantidade}</strong> questões
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: 'var(--calm-text-muted)' }}>
                      {cad.lastExecutedAt || 'Nunca executado'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => onStartCaderno(cad)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#6366f1',
                        color: '#fff',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Play className="w-3.5 h-3.5" /> Resolver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
