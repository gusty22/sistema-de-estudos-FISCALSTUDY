import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Cpu,
  FileCheck2,
  ShieldCheck,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Info,
  Server,
  Layers
} from 'lucide-react';
import './ConfiguracoesAdminView.css';

export interface ConfiguracoesAdminViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ConfiguracoesAdminView: React.FC<ConfiguracoesAdminViewProps> = ({
  onNavigateToTab: _onNavigateToTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'PREFERENCIAS' | 'BACKUP' | 'INTEGRACOES' | 'AUDITORIA'>('PREFERENCIAS');

  // T36: Configurações
  const [settings, setSettings] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // T37: Backup & Restauração
  const [backupOverview, setBackupOverview] = useState<any>(null);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);
  const [backupActionMsg, setBackupActionMsg] = useState<string | null>(null);
  const [backupLabel, setBackupLabel] = useState('');
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // T38: Integrações
  const [integrationsStatus, setIntegrationsStatus] = useState<any>(null);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);

  // T39: Auditoria Técnica
  const [auditReport, setAuditReport] = useState<any>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Carrega configurações iniciais
  const loadSettings = () => {
    setIsLoadingSettings(true);
    fetch('/api/v1/system/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(err => console.warn('Erro ao carregar settings:', err))
      .finally(() => setIsLoadingSettings(false));
  };

  const loadBackupData = () => {
    fetch('/api/v1/system/backup/overview')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setBackupOverview(data);
      });

    fetch('/api/v1/system/backup/list')
      .then(res => res.ok ? res.json() : [])
      .then(list => setBackupsList(list));
  };

  const loadIntegrations = () => {
    setIsLoadingIntegrations(true);
    fetch('/api/v1/system/integrations/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setIntegrationsStatus(data);
      })
      .finally(() => setIsLoadingIntegrations(false));
  };

  const loadAuditReport = () => {
    setIsLoadingAudit(true);
    fetch('/api/v1/system/audit/report')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setAuditReport(data);
      })
      .finally(() => setIsLoadingAudit(false));
  };

  useEffect(() => {
    loadSettings();
    loadBackupData();
    loadIntegrations();
    loadAuditReport();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      const res = await fetch('/api/v1/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveSuccessMsg('✓ Preferências salvas com sucesso!');
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      }
    } catch {
      setSaveSuccessMsg('Erro ao salvar preferências.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupActionMsg(null);
    try {
      const res = await fetch('/api/v1/system/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: backupLabel.trim() || 'MANUAL' })
      });
      const data = await res.json();
      if (res.ok) {
        setBackupActionMsg(`✓ Backup consistente gerado com sucesso: ${data.filename} (${data.sizeFormatted})`);
        setBackupLabel('');
        loadBackupData();
      } else {
        setBackupActionMsg(`Erro: ${data.error || 'Falha ao gerar backup.'}`);
      }
    } catch (err: any) {
      setBackupActionMsg(`Falha de conexão: ${err.message}`);
    } finally {
      setIsCreatingBackup(false);
      setTimeout(() => setBackupActionMsg(null), 6000);
    }
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifyingIntegrity(true);
    setIntegrityResult(null);
    try {
      const res = await fetch('/api/v1/system/backup/verify', { method: 'POST' });
      const data = await res.json();
      setIntegrityResult(data);
    } catch (err: any) {
      setIntegrityResult({ status: 'ERRO', message: err.message, healthy: false });
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    try {
      const res = await fetch('/api/v1/system/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: restoreCandidate })
      });
      const data = await res.json();
      if (res.ok) {
        setBackupActionMsg(`✓ Restauração concluída com sucesso! Snapshot prévio de segurança preservado: ${data.safetySnapshotCreated}`);
        setRestoreCandidate(null);
        loadBackupData();
      } else {
        setBackupActionMsg(`Erro na restauração: ${data.error}`);
      }
    } catch (err: any) {
      setBackupActionMsg(`Erro ao conectar: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="config-admin-view animate-fade-in">
      {/* Top Header */}
      <div className="config-admin-header">
        <div>
          <span className="config-badge">MÓDULO I — CONFIGURAÇÕES E ADMINISTRAÇÃO</span>
          <h1 className="config-title">Configurações do Sistema & Integridade</h1>
          <p className="config-subtitle">
            Gerencie preferências pedagógicas, rotinas, segurança e backups consistentes (SQLite WAL-compliant).
          </p>
        </div>

        {/* Abas Superiores */}
        <div className="config-tabs-nav">
          <button
            className={`config-tab-btn ${activeSubTab === 'PREFERENCIAS' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('PREFERENCIAS')}
          >
            <Settings className="w-4 h-4 inline mr-1.5" /> Preferências
          </button>
          <button
            className={`config-tab-btn ${activeSubTab === 'BACKUP' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('BACKUP')}
          >
            <Database className="w-4 h-4 inline mr-1.5" /> Dados & Backup
          </button>
          <button
            className={`config-tab-btn ${activeSubTab === 'INTEGRACOES' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('INTEGRACOES')}
          >
            <Cpu className="w-4 h-4 inline mr-1.5" /> Motor & Integrações
          </button>
          <button
            className={`config-tab-btn ${activeSubTab === 'AUDITORIA' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('AUDITORIA')}
          >
            <FileCheck2 className="w-4 h-4 inline mr-1.5" /> Diagnóstico Técnico
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="status-banner success animate-fade-in">{saveSuccessMsg}</div>
      )}

      {/* =========================================================================
          T36: CONFIGURAÇÕES E PREFERÊNCIAS
          ========================================================================= */}
      {activeSubTab === 'PREFERENCIAS' && (
        <div className="config-content-section animate-fade-in">
          {isLoadingSettings && !settings ? (
            <div className="loading-state">Carregando preferências...</div>
          ) : settings ? (
            <div className="config-grid-layout">
              {/* Card 1: Perfil de Estudos */}
              <div className="config-card glass">
                <div className="config-card-header">
                  <Clock className="w-5 h-5 text-sky-400" />
                  <h3>Perfil de Estudos & Acessibilidade</h3>
                </div>
                <div className="config-form-body">
                  <div className="form-row">
                    <label>Duração da Sessão Principal</label>
                    <select
                      className="form-control"
                      value={settings.perfilEstudos?.duracaoSessaoMinutos || 50}
                      onChange={e => setSettings({
                        ...settings,
                        perfilEstudos: { ...settings.perfilEstudos, duracaoSessaoMinutos: Number(e.target.value) }
                      })}
                    >
                      <option value={25}>25 minutos (Pomodoro Express)</option>
                      <option value={50}>50 minutos (Padrão Calmo)</option>
                      <option value={75}>75 minutos (Bloco Extenso)</option>
                      <option value={90}>90 minutos (Foco Profundo)</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>Estilo de Pausas</label>
                    <select
                      className="form-control"
                      value={settings.perfilEstudos?.estiloPausa || 'POMODORO'}
                      onChange={e => setSettings({
                        ...settings,
                        perfilEstudos: { ...settings.perfilEstudos, estiloPausa: e.target.value }
                      })}
                    >
                      <option value="POMODORO">Intervalo Estruturado (10 min)</option>
                      <option value="FLOW">Estado de Fluxo Livre</option>
                      <option value="FLEXIVEL">Pausa Manual sob Demanda</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>Tamanho da Tipografia (Leitura de Questões)</label>
                    <select
                      className="form-control"
                      value={settings.perfilEstudos?.tamanhoFonte || 'CONFORTAVEL'}
                      onChange={e => setSettings({
                        ...settings,
                        perfilEstudos: { ...settings.perfilEstudos, tamanhoFonte: e.target.value }
                      })}
                    >
                      <option value="PADRAO">Padrão (1.00rem)</option>
                      <option value="CONFORTAVEL">Confortável (1.08rem - Recomendado)</option>
                      <option value="GRANDE">Aumentado (1.18rem - Alta legibilidade)</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>Paleta Visual</label>
                    <select
                      className="form-control"
                      value={settings.perfilEstudos?.tema || 'CALMA_NOTURNA'}
                      onChange={e => setSettings({
                        ...settings,
                        perfilEstudos: { ...settings.perfilEstudos, tema: e.target.value }
                      })}
                    >
                      <option value="CALMA_NOTURNA">Tecnologia Calma (Ardósia Suave)</option>
                      <option value="PAPEL_CLARO">Papel Creme Relaxante</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 2: Objetivos & Prioridades */}
              <div className="config-card glass">
                <div className="config-card-header">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3>Objetivos & Metas Diárias</h3>
                </div>
                <div className="config-form-body">
                  <div className="form-row">
                    <label>Meta Diária de Questões</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.objetivos?.metaQuestoesDiarias || 35}
                      onChange={e => setSettings({
                        ...settings,
                        objetivos: { ...settings.objetivos, metaQuestoesDiarias: Number(e.target.value) }
                      })}
                      min={5}
                      max={150}
                    />
                  </div>

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="chkPriorizarDificuldades"
                      checked={settings.objetivos?.priorizarDificuldades ?? true}
                      onChange={e => setSettings({
                        ...settings,
                        objetivos: { ...settings.objetivos, priorizarDificuldades: e.target.checked }
                      })}
                    />
                    <label htmlFor="chkPriorizarDificuldades">
                      Priorizar automaticamente conteúdos com maior incidência de erros (E1 a E5)
                    </label>
                  </div>

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="chkAlertaDatasLimite"
                      checked={settings.objetivos?.alertaDatasLimite ?? true}
                      onChange={e => setSettings({
                        ...settings,
                        objetivos: { ...settings.objetivos, alertaDatasLimite: e.target.checked }
                      })}
                    />
                    <label htmlFor="chkAlertaDatasLimite">
                      Alertar proximidade de datas de prova e simulações agendadas
                    </label>
                  </div>
                </div>
              </div>

              {/* Card 3: Rotina & Disponibilidade */}
              <div className="config-card glass">
                <div className="config-card-header">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <h3>Rotina & Disponibilidade</h3>
                </div>
                <div className="config-form-body">
                  <div className="form-row">
                    <label>Disponibilidade em Dias Úteis (Horas/Dia)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={settings.rotina?.disponibilidadeDiasUteisHoras || 3.5}
                      onChange={e => setSettings({
                        ...settings,
                        rotina: { ...settings.rotina, disponibilidadeDiasUteisHoras: Number(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="form-row">
                    <label>Disponibilidade nos Fins de Semana (Horas/Dia)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={settings.rotina?.disponibilidadeFimSemanaHoras || 6.0}
                      onChange={e => setSettings({
                        ...settings,
                        rotina: { ...settings.rotina, disponibilidadeFimSemanaHoras: Number(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="chkDescansoDomingo"
                      checked={settings.rotina?.descansoObrigatorioDomingo ?? false}
                      onChange={e => setSettings({
                        ...settings,
                        rotina: { ...settings.rotina, descansoObrigatorioDomingo: e.target.checked }
                      })}
                    />
                    <label htmlFor="chkDescansoDomingo">
                      Preservar domingo como dia de descanso ou revisão leve
                    </label>
                  </div>
                </div>
              </div>

              {/* Card 4: Revisões & Carga Cognitiva */}
              <div className="config-card glass">
                <div className="config-card-header">
                  <RotateCcw className="w-5 h-5 text-purple-400" />
                  <h3>Limites de Revisão & Sono</h3>
                </div>
                <div className="config-form-body">
                  <div className="form-row">
                    <label>Limite Máximo de Cards Anki / Dia</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.revisoes?.limiteCardsDia || 40}
                      onChange={e => setSettings({
                        ...settings,
                        revisoes: { ...settings.revisoes, limiteCardsDia: Number(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="form-row">
                    <label>Limite de Questões de Revisão / Dia</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.revisoes?.limiteQuestoesRevisaoDia || 25}
                      onChange={e => setSettings({
                        ...settings,
                        revisoes: { ...settings.revisoes, limiteQuestoesRevisaoDia: Number(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="chkProtegerSono"
                      checked={settings.revisoes?.protegerJanelaSono ?? true}
                      onChange={e => setSettings({
                        ...settings,
                        revisoes: { ...settings.revisoes, protegerJanelaSono: e.target.checked }
                      })}
                    />
                    <label htmlFor="chkProtegerSono">
                      Proteger janela de sono: suspender notificações e blocos intensos após as 22h
                    </label>
                  </div>
                </div>
              </div>

              {/* Card 5: Privacidade & Dados Locais */}
              <div className="config-card glass">
                <div className="config-card-header">
                  <Lock className="w-5 h-5 text-rose-400" />
                  <h3>Privacidade & Soberania dos Dados</h3>
                </div>
                <div className="config-form-body">
                  <div className="info-callout">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Seus dados ficam 100% no seu computador (Local-First). Nenhuma resposta, métrica ou nota de estudo é enviada a servidores externos.</span>
                  </div>

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="chkLocalEstrito"
                      checked={settings.privacidade?.armazenamentoLocalEstrito ?? true}
                      disabled
                    />
                    <label htmlFor="chkLocalEstrito">
                      Armazenamento local estrito ativo (SQLite local)
                    </label>
                  </div>

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="chkTelemetriaNuvem"
                      checked={settings.privacidade?.telemetriaExterna ?? false}
                      onChange={e => setSettings({
                        ...settings,
                        privacidade: { ...settings.privacidade, telemetriaExterna: e.target.checked }
                      })}
                    />
                    <label htmlFor="chkTelemetriaNuvem">
                      Permitir envio opcional de relatórios anônimos de erro
                    </label>
                  </div>
                </div>
              </div>

              {/* Card 6: Ajustes Avançados com Limites Seguros */}
              <div className="config-card glass">
                <div className="config-card-header">
                  <Info className="w-5 h-5 text-indigo-400" />
                  <h3>Ajustes Avançados (Parâmetros com Limites Seguros)</h3>
                </div>
                <div className="config-form-body">
                  <p className="hint-text">
                    Parâmetros matemáticos internos possuem explicações claras e travas seguras para não descalibrar seu plano.
                  </p>

                  <div className="form-row">
                    <label>Fator Mínimo de Espaçamento Cognitivo (1.1 a 1.6)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={1.1}
                      max={1.6}
                      className="form-control"
                      value={settings.parametrosAvancados?.fatorEspacamentoMin || 1.3}
                      onChange={e => setSettings({
                        ...settings,
                        parametrosAvancados: { ...settings.parametrosAvancados, fatorEspacamentoMin: Number(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="form-row">
                    <label>Fator Máximo de Espaçamento (2.0 a 3.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={2.0}
                      max={3.0}
                      className="form-control"
                      value={settings.parametrosAvancados?.fatorEspacamentoMax || 2.6}
                      onChange={e => setSettings({
                        ...settings,
                        parametrosAvancados: { ...settings.parametrosAvancados, fatorEspacamentoMax: Number(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Botão de Salvar Preferências */}
          <div className="config-actions-bar">
            <button className="btn-save-primary" onClick={handleSaveSettings}>
              💾 Salvar Todas as Preferências
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          T37: DADOS, BACKUPS CONSISTENTES E RECUPERAÇÃO
          ========================================================================= */}
      {activeSubTab === 'BACKUP' && (
        <div className="config-content-section animate-fade-in">
          {backupActionMsg && (
            <div className="status-banner info animate-fade-in">{backupActionMsg}</div>
          )}

          {/* Cards de Métricas do Banco */}
          <div className="backup-overview-grid">
            <div className="stat-card glass">
              <span className="stat-title">Banco Operacional Principal</span>
              <span className="stat-value">{backupOverview?.mainDatabaseSizeFormatted || '0 MB'}</span>
              <span className="stat-desc" title={backupOverview?.databaseLocation}>
                {backupOverview?.databaseLocation ? backupOverview.databaseLocation.split('\\').pop() : 'db/fiscalstudy.db'}
              </span>
            </div>

            <div className="stat-card glass">
              <span className="stat-title">Área de Preparação (Staging)</span>
              <span className="stat-value">{backupOverview?.stagingDatabaseSizeFormatted || '0 MB'}</span>
              <span className="stat-desc">Isolamento estrito de provas</span>
            </div>

            <div className="stat-card glass">
              <span className="stat-title">Integridade Física</span>
              <span className="stat-value" style={{ color: backupOverview?.integrityStatus === 'INTEGRO' ? '#34d399' : '#fbbf24' }}>
                {backupOverview?.integrityStatus || 'VERIFICANDO'}
              </span>
              <span className="stat-desc">PRAGMA integrity_check</span>
            </div>

            <div className="stat-card glass">
              <span className="stat-title">Último Backup Criado</span>
              <span className="stat-value" style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
                {backupOverview?.lastBackupDate || '—'}
              </span>
              <span className="stat-desc">{backupOverview?.totalBackups || 0} backups arquivados</span>
            </div>
          </div>

          {/* Ações Críticas T37 */}
          <div className="backup-actions-panel glass">
            <div className="panel-title-group">
              <Database className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="panel-h3">Geração de Backup Consistente (SQLite WAL-Compliant)</h3>
                <p className="panel-sub">
                  Executa checkpoint prévio no WAL (descarregando escritas pendentes) e gera snapshot consistente via SQLite VACUUM INTO.
                </p>
              </div>
            </div>

            <div className="backup-creation-row">
              <input
                type="text"
                placeholder="Rótulo opcional (ex: antes_de_importar_sefaz)"
                className="form-control backup-input"
                value={backupLabel}
                onChange={e => setBackupLabel(e.target.value)}
              />
              <button
                className="btn-create-backup"
                disabled={isCreatingBackup}
                onClick={handleCreateBackup}
              >
                {isCreatingBackup ? 'Gerando Backup Consistente...' : '📦 Criar Backup Consistente Agora'}
              </button>
              <button
                className="btn-verify-integrity"
                disabled={isVerifyingIntegrity}
                onClick={handleVerifyIntegrity}
              >
                {isVerifyingIntegrity ? 'Verificando...' : '🔍 Verificar Integridade'}
              </button>
            </div>

            {integrityResult && (
              <div className={`integrity-box animate-fade-in ${integrityResult.healthy ? 'healthy' : 'warning'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  {integrityResult.healthy ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  <span>Resultado da Auditoria Física: {integrityResult.status}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>{integrityResult.message}</p>
              </div>
            )}
          </div>

          {/* Tabela de Backups Arquivados */}
          <div className="backups-list-card glass">
            <div className="table-header-box">
              <h3>Histórico de Backups Disponíveis para Restauração</h3>
              <span className="table-sub-count">{backupsList.length} arquivo(s) localizados em db/backups</span>
            </div>

            {backupsList.length === 0 ? (
              <div className="empty-backups-hint">
                Nenhum backup arquivado até o momento. Clique no botão acima para gerar seu primeiro backup consistente.
              </div>
            ) : (
              <table className="backups-table">
                <thead>
                  <tr>
                    <th>Arquivo de Backup</th>
                    <th>Data & Hora</th>
                    <th>Tamanho</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Ação de Recuperação</th>
                  </tr>
                </thead>
                <tbody>
                  {backupsList.map((b, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {b.filename}
                      </td>
                      <td style={{ color: '#94a3b8' }}>{b.date}</td>
                      <td style={{ color: '#38bdf8' }}>{b.sizeFormatted}</td>
                      <td>
                        {b.isSafetySnapshot ? (
                          <span className="backup-type-pill safety">Snapshot de Segurança</span>
                        ) : (
                          <span className="backup-type-pill manual">Backup Consistente</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-restore-link"
                          onClick={() => setRestoreCandidate(b.filename)}
                          title="Restaurar banco com preservação prévia de snapshot"
                        >
                          <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal de Confirmação Crítica de Restauração T37 */}
          {restoreCandidate && (
            <div className="dialog-backdrop" onClick={() => !isRestoring && setRestoreCandidate(null)}>
              <div className="dialog-box glass-card" onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}>Confirmar Restauração de Backup</h3>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Proteção do patrimônio do estudante</span>
                  </div>
                </div>
                <div className="dialog-body">
                  <p style={{ margin: '0 0 1rem', lineHeight: 1.5, color: '#cbd5e1' }}>
                    Você selecionou o backup <strong>{restoreCandidate}</strong> para restaurar no banco operacional.
                  </p>
                  <div className="safety-callout">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Preservação Ativa:</strong> Antes de substituir os dados, o FiscalStudy criará automaticamente uma cópia de segurança do banco operacional atual para evitar qualquer risco de perda.</span>
                  </div>
                </div>
                <div className="dialog-footer">
                  <button
                    className="btn btn-secondary"
                    disabled={isRestoring}
                    onClick={() => setRestoreCandidate(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-danger-confirm"
                    disabled={isRestoring}
                    onClick={handleExecuteRestore}
                  >
                    {isRestoring ? 'Restaurando com Segurança...' : 'Sim, Restaurar Backup'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          T38: INTEGRAÇÕES E MOTOR ANALÍTICO
          ========================================================================= */}
      {activeSubTab === 'INTEGRACOES' && (
        <div className="config-content-section animate-fade-in">
          {isLoadingIntegrations && (
            <div className="status-banner info">Verificando estado das integrações em tempo real...</div>
          )}
          <div className="integrations-resilience-banner">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <strong>Regra de Resiliência:</strong> A indisponibilidade de serviços externos ou do motor em R <strong>NUNCA</strong> bloqueia abrir o sistema, estudar, resolver questões, consultar histórico ou executar revisões já programadas.
            </div>
          </div>

          <div className="integrations-grid">
            {/* 1. Motor em R */}
            <div className="integration-card glass">
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <h4>Motor Analítico Psicométrico (R Engine)</h4>
                </div>
                <span className={`status-chip ${integrationsStatus?.motorAnaliticoR?.status === 'DISPONIVEL' ? 'online' : 'resilient'}`}>
                  {integrationsStatus?.motorAnaliticoR?.status || 'OPERACIONAL'}
                </span>
              </div>
              <p className="integration-desc">
                Executa projeções de half-life cognitivo, análise de calibração Brier e modelo do estudante.
              </p>
              <div className="integration-meta-list">
                <div><span>Contrato Técnico:</span> <strong>{integrationsStatus?.motorAnaliticoR?.contractVersion || 'v1.0 (REST/JSON Protocol)'}</strong></div>
                <div><span>Última Análise:</span> <strong>{integrationsStatus?.motorAnaliticoR?.lastAnalysisCompleted || 'Recente'}</strong></div>
              </div>
            </div>

            {/* 2. Extrator de PDF */}
            <div className="integration-card glass">
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server className="w-5 h-5 text-emerald-400" />
                  <h4>Extrator de Provas em PDF (Python)</h4>
                </div>
                <span className="status-chip online">DISPONÍVEL</span>
              </div>
              <p className="integration-desc">
                Docling e PyMuPDF operando com isolamento estrito na área temporária (staging.db).
              </p>
              <div className="integration-meta-list">
                <div><span>Ambiente:</span> <strong>Python UniversalExtractor v3.0</strong></div>
                <div><span>Isolamento:</span> <strong>Área de Preparação Staging</strong></div>
              </div>
            </div>

            {/* 3. OCR Local */}
            <div className="integration-card glass">
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h4>Reconhecimento de Caracteres (OCR)</h4>
                </div>
                <span className="status-chip online">ATIVO</span>
              </div>
              <p className="integration-desc">
                Processamento local de digitalizações, fórmulas e tabelas sem envio para a nuvem.
              </p>
              <div className="integration-meta-list">
                <div><span>Mecanismo:</span> <strong>Tesseract OCR Local</strong></div>
                <div><span>Fallback:</span> <strong>Camada de Texto Vetorial Nativa</strong></div>
              </div>
            </div>

            {/* 4. AnkiConnect */}
            <div className="integration-card glass">
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCcw className="w-5 h-5 text-purple-400" />
                  <h4>Sincronização AnkiConnect</h4>
                </div>
                <span className={`status-chip ${integrationsStatus?.ankiConnect?.status === 'CONECTADO' ? 'online' : 'resilient'}`}>
                  {integrationsStatus?.ankiConnect?.status || 'AGUARDANDO'}
                </span>
              </div>
              <p className="integration-desc">
                Ponte local na porta 8765 para envio de flashcards gerados nos cadernos de erros.
              </p>
              <div className="integration-meta-list">
                <div><span>Porta Local:</span> <strong>127.0.0.1:8765</strong></div>
                <div><span>Exportação:</span> <strong>Manual e Sob Demanda</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          T39: DIAGNÓSTICO TÉCNICO E AUDITORIA
          ========================================================================= */}
      {activeSubTab === 'AUDITORIA' && (
        <div className="config-content-section animate-fade-in">
          {isLoadingAudit && (
            <div className="status-banner info">Gerando diagnóstico técnico e auditoria de integridade...</div>
          )}
          <div className="audit-summary-grid">
            <div className="audit-card glass">
              <h4>Versão & Infraestrutura</h4>
              <div className="audit-kv-list">
                <div><span>Aplicação:</span> <strong>{auditReport?.appVersion || '3.21'}</strong></div>
                <div><span>Motor SQLite:</span> <strong>{auditReport?.sqliteVersion || 'SQLite 3.x'}</strong></div>
                <div><span>Arquitetura:</span> <strong>APPEND-ONLY EVENT LOG</strong></div>
                <div><span>Sanitização de Logs:</span> <strong>{auditReport?.logSanitization || 'Ativo'}</strong></div>
              </div>
            </div>

            <div className="audit-card glass">
              <h4>Integridade do Log de Eventos (Event Store)</h4>
              <div className="audit-kv-list">
                <div><span>Total de Eventos Gravados:</span> <strong>{auditReport?.tableCounts?.event_store || 0}</strong></div>
                <div><span>Eventos Duplicados Detectados:</span> <strong>{auditReport?.duplicateEventsCount || 0}</strong></div>
                <div><span>Estado da Integridade:</span> <strong style={{ color: '#34d399' }}>{auditReport?.eventsIntegrity || 'Íntegro'}</strong></div>
              </div>
            </div>

            <div className="audit-card glass">
              <h4>Contagem de Entidades Oficiais</h4>
              <div className="audit-kv-list">
                <div><span>Questões Ativas:</span> <strong>{auditReport?.tableCounts?.questions || 0}</strong></div>
                <div><span>Materiais de Estudo:</span> <strong>{auditReport?.tableCounts?.materials || 0}</strong></div>
                <div><span>Concursos Cadastrados:</span> <strong>{auditReport?.tableCounts?.concursos || 0}</strong></div>
                <div><span>Cadernos de Simulado:</span> <strong>{auditReport?.tableCounts?.study_notebooks || 0}</strong></div>
              </div>
            </div>
          </div>

          <div className="audit-action-row">
            <button
              className="btn-export-audit"
              onClick={() => {
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditReport, null, 2));
                const a = document.createElement('a');
                a.setAttribute('href', dataStr);
                a.setAttribute('download', `fiscalstudy_relatorio_tecnico_${new Date().toISOString().slice(0, 10)}.json`);
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              <Download className="w-4 h-4 inline mr-1.5" /> Exportar Relatório Técnico Sanitizado
            </button>
            <button className="btn-refresh-audit" onClick={loadAuditReport}>
              <RotateCcw className="w-4 h-4 inline mr-1.5" /> Atualizar Diagnóstico
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfiguracoesAdminView;
