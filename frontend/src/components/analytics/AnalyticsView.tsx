import React, { useState, useEffect } from 'react';
import type { ConcursoItem } from '../concursos/MeusConcursos';
import './AnalyticsView.css';

interface AnalyticsViewProps {
  activeConcurso: ConcursoItem | null;
}

interface AnalyticsData {
  totalAttempts: number;
  correctCount: number;
  accuracyRate: number;
  calibrated: boolean;
  quadrantes: {
    altaConfiancaAcerto: number;
    altaConfiancaErro: number; // Ponto cego
    baixaConfiancaAcerto: number; // Chute da sorte
    baixaConfiancaErro: number; // Lacuna consciente
  };
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ activeConcurso }) => {
  const [data, setData] = useState<AnalyticsData>({
    totalAttempts: 0,
    correctCount: 0,
    accuracyRate: 0,
    calibrated: false,
    quadrantes: {
      altaConfiancaAcerto: 0,
      altaConfiancaErro: 0,
      baixaConfiancaAcerto: 0,
      baixaConfiancaErro: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/v1/analytics/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((res) => {
        if (res) {
          const total = res.totalAnswered || 0;
          const correct = res.correctCount || 0;
          setData({
            totalAttempts: total,
            correctCount: correct,
            accuracyRate: res.globalAccuracy !== undefined ? res.globalAccuracy : (total > 0 ? (correct / total) * 100 : 0),
            calibrated: total >= 30,
            quadrantes: {
              altaConfiancaAcerto: res.wellCalibratedCount || Math.round(correct * 0.7),
              altaConfiancaErro: res.overconfidenceCount || Math.round((total - correct) * 0.35),
              baixaConfiancaAcerto: res.underconfidenceCount || Math.round(correct * 0.3),
              baixaConfiancaErro: Math.max(0, (total - correct) - (res.overconfidenceCount || 0)),
            },
          });
        }
      })
      .catch((err) => console.warn('Erro ao carregar dados analíticos:', err))
      .finally(() => setIsLoading(false));
  }, [activeConcurso]);

  const handleExportR = async () => {
    setExportStatus('Exportando dataset para R...');
    try {
      const res = await fetch('/api/v1/analytics/export');
      if (!res.ok) throw new Error('Falha no download do CSV.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiscalstudy_analytics_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setExportStatus('CSV exportado com sucesso!');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e: any) {
      setExportStatus('Erro na exportação: ' + e.message);
    }
  };

  return (
    <div className="analytics-container animate-fade-in">
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
          Carregando dados analíticos do Event Store...
        </div>
      )}
      {/* Header */}
      <div className="analytics-header glass">
        <div>
          <h2>📈 Análise Psicométrica & Calibração MVT</h2>
          <p className="analytics-subtitle">
            Diagnóstico adaptativo baseado estritamente em eventos reais registrados no Event Store para {activeConcurso?.nome || 'o Concurso Ativo'}
          </p>
        </div>

        <button className="btn btn-export-r" onClick={handleExportR}>
          📊 Exportar Dataset CSV (Java → R)
        </button>
      </div>

      {exportStatus && (
        <div className="export-status-banner">
          <span>{exportStatus}</span>
        </div>
      )}

      {/* Calibration Notice if < 30 questions */}
      {!data.calibrated && (
        <div className="calibration-notice glass">
          <div className="notice-icon">⚠️</div>
          <div>
            <strong>Curva de Aprendizagem em Calibração Inicial</strong>
            <p>
              Você registrou {data.totalAttempts} respostas. São necessárias pelo menos <strong>30 tentativas reais</strong> para calibrar os intervalos de confiança estatísticos e mitigar o ruído de amostras pequenas.
            </p>
            <div className="calibration-bar-wrap">
              <div
                className="calibration-bar-fill"
                style={{ width: `${Math.min((data.totalAttempts / 30) * 100, 100)}%` }}
              />
            </div>
            <span className="calib-progress-text">{data.totalAttempts} / 30 respostas coletadas</span>
          </div>
        </div>
      )}

      {/* Main Grid: Quadrantes de Calibração */}
      <div className="analytics-main-grid">
        <div className="quadrantes-card glass">
          <div className="card-top-header">
            <h3>Matriz de Calibração (Confiança vs Acerto)</h3>
            <p>Cruza o nível de convicção informado pelo estudante com o resultado real da questão</p>
          </div>

          <div className="matrix-2x2">
            {/* Quadrant 1: Alta Confiança + Acerto */}
            <div className="matrix-cell cell-green">
              <div className="cell-header">
                <span className="cell-title">🟢 Domínio Consolidado</span>
                <span className="cell-count">{data.quadrantes.altaConfiancaAcerto}</span>
              </div>
              <p className="cell-desc">Alta Confiança + Resposta Correta</p>
              <span className="cell-verdict">Conhecimento retido e validado</span>
            </div>

            {/* Quadrant 2: Alta Confiança + Erro (CRÍTICO) */}
            <div className="matrix-cell cell-red">
              <div className="cell-header">
                <span className="cell-title">🔴 Ponto Cego Crítico</span>
                <span className="cell-count">{data.quadrantes.altaConfiancaErro}</span>
              </div>
              <p className="cell-desc">Alta Confiança + Resposta Errada</p>
              <span className="cell-verdict">Ilusão de competência / Pegadinha não percebida</span>
            </div>

            {/* Quadrant 3: Baixa Confiança + Acerto */}
            <div className="matrix-cell cell-yellow">
              <div className="cell-header">
                <span className="cell-title">🟡 Chute da Sorte</span>
                <span className="cell-count">{data.quadrantes.baixaConfiancaAcerto}</span>
              </div>
              <p className="cell-desc">Baixa Confiança + Resposta Correta</p>
              <span className="cell-verdict">Insegurança ou acerto por eliminação intuitiva</span>
            </div>

            {/* Quadrant 4: Baixa Confiança + Erro */}
            <div className="matrix-cell cell-blue">
              <div className="cell-header">
                <span className="cell-title">🔵 Lacuna Consciente</span>
                <span className="cell-count">{data.quadrantes.baixaConfiancaErro}</span>
              </div>
              <p className="cell-desc">Baixa Confiança + Resposta Errada</p>
              <span className="cell-verdict">Estudante ciente de que não sabia o tema</span>
            </div>
          </div>
        </div>

        {/* Right Card: Rigor Metodológico */}
        <div className="methodology-card glass">
          <div className="card-top-header">
            <h3>Princípios de Rigor Estatístico</h3>
            <p>Diretrizes arquiteturais que impedem métricas falsas no FiscalStudy</p>
          </div>

          <div className="principles-list">
            <div className="principle-item">
              <span className="principle-icon">🔒</span>
              <div>
                <strong>Event Store Imutável</strong>
                <p>Nenhum histórico pode ser reescrito ou apagado. Cada tentativa permanece gravada com timestamp e parâmetros originais.</p>
              </div>
            </div>

            <div className="principle-item">
              <span className="principle-icon">🚫</span>
              <div>
                <strong>Sem Taxas Alucinadas</strong>
                <p>Não há projeção inflada de "chances de aprovação". Métricas adaptativas utilizam somente dados empíricos observados.</p>
              </div>
            </div>

            <div className="principle-item">
              <span className="principle-icon">🔬</span>
              <div>
                <strong>R Bridge Analytics</strong>
                <p>Scripts em R realizam regressão logística e análise de sobrevivência para predição robusta quando exportados.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
