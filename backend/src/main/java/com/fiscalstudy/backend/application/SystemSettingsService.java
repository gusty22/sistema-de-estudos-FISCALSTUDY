package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.util.*;

@Service
public class SystemSettingsService {

    private static final Logger logger = LoggerFactory.getLogger(SystemSettingsService.class);
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    private final String MAIN_DB_PATH;
    private final String STAGING_DB_PATH;
    private final String BACKUP_DIR_PATH;
    private final com.fiscalstudy.backend.infrastructure.config.DatabasePaths databasePaths;

    @org.springframework.beans.factory.annotation.Autowired
    public SystemSettingsService(JdbcTemplate jdbcTemplate, com.fiscalstudy.backend.infrastructure.config.DatabasePaths paths) {
        this.databasePaths = paths;
        this.MAIN_DB_PATH = paths.mainDatabase().toString();
        this.STAGING_DB_PATH = paths.stagingDatabase().toString();
        this.BACKUP_DIR_PATH = paths.backupDirectory().toString();
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = new ObjectMapper();
        ensureBackupDir();
    }


    private void ensureBackupDir() {
        try { Files.createDirectories(databasePaths.backupDirectory()); }
        catch(IOException e){throw new IllegalStateException("Diretório de backup indisponível",e);}
    }

    // =========================================================================
    // T36 — CONFIGURAÇÕES E PREFERÊNCIAS DO ESTUDANTE
    // =========================================================================

    public Map<String, Object> getSettings() {
        Map<String, Object> defaults = getDefaultSettings();
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT setting_key, setting_value FROM system_settings");
            for (Map<String, Object> row : rows) {
                String key = (String) row.get("setting_key");
                String valJson = (String) row.get("setting_value");
                if (key != null && valJson != null) {
                    try {
                        Object parsed = objectMapper.readValue(valJson, Object.class);
                        if(defaults.get(key) instanceof Map<?,?> existing && parsed instanceof Map<?,?> saved){
                            Map<String,Object> merged=new LinkedHashMap<>();existing.forEach((k,v)->merged.put(String.valueOf(k),v));saved.forEach((k,v)->merged.put(String.valueOf(k),v));defaults.put(key,merged);
                        }else defaults.put(key, parsed);
                    } catch (Exception parseEx) {
                        throw new IllegalStateException("Configuração persistida inválida: "+key,parseEx);
                    }
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao carregar configurações persistidas",e);
        }
        return defaults;
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> updateSettings(Map<String, Object> newSettings) {
        if (newSettings == null) return getSettings();
        String now = Instant.now().toString();

        for (Map.Entry<String, Object> entry : newSettings.entrySet()) {
            try {
                String key = entry.getKey();
                String valJson = objectMapper.writeValueAsString(entry.getValue());
                jdbcTemplate.update("""
                    INSERT INTO system_settings (setting_key, setting_value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(setting_key) DO UPDATE SET
                        setting_value = excluded.setting_value,
                        updated_at = excluded.updated_at
                """, key, valJson, now);
            } catch (Exception e) {
                throw new IllegalStateException("Falha ao persistir configuração " + entry.getKey(), e);
            }
        }
        return getSettings();
    }

    private Map<String, Object> getDefaultSettings() {
        Map<String, Object> settings = new LinkedHashMap<>();

        Map<String, Object> perfil = new LinkedHashMap<>();
        perfil.put("duracaoSessaoMinutos", 50);
        perfil.put("pausaCurtaMinutos", 10);
        perfil.put("pausaLongaMinutos", 25);
        perfil.put("estiloPausa", "POMODORO"); // POMODORO, FLOW, FLEXIVEL
        perfil.put("tamanhoFonte", "CONFORTAVEL"); // PADRAO, CONFORTAVEL, GRANDE
        perfil.put("tema", "CALMA_NOTURNA"); // CALMA_NOTURNA, PAPEL_CLARO, SUAVE
        perfil.put("idioma", "pt-BR");
        perfil.put("somNotificacao", true);
        settings.put("perfilEstudos", perfil);

        Map<String, Object> objetivos = new LinkedHashMap<>();
        objetivos.put("objetivoPadraoId", "iss_araguari");
        objetivos.put("priorizarDificuldades", true);
        objetivos.put("alertaDatasLimite", true);
        objetivos.put("metaQuestoesDiarias", 35);
        settings.put("objetivos", objetivos);

        Map<String, Object> rotina = new LinkedHashMap<>();
        rotina.put("disponibilidadeDiasUteisHoras", 3.5);
        rotina.put("disponibilidadeFimSemanaHoras", 6.0);
        rotina.put("toleranciaImprevistos", "ALTA");
        rotina.put("descansoObrigatorioDomingo", false);
        settings.put("rotina", rotina);

        Map<String, Object> revisoes = new LinkedHashMap<>();
        revisoes.put("limiteCardsDia", 40);
        revisoes.put("limiteQuestoesRevisaoDia", 25);
        revisoes.put("notificarPendenciasAcumuladas", true);
        revisoes.put("protegerJanelaSono", true);
        revisoes.put("autoAvancarEstagioAcima80", true);
        settings.put("revisoes", revisoes);

        Map<String, Object> privacidade = new LinkedHashMap<>();
        privacidade.put("armazenamentoLocalEstrito", true);
        privacidade.put("telemetriaExterna", false);
        privacidade.put("anonimizarExportacao", false);
        privacidade.put("retencaoEventos", "PERMANENTE_LOCAL");
        settings.put("privacidade", privacidade);

        Map<String, Object> avancado = new LinkedHashMap<>();
        avancado.put("fatorEspacamentoMin", 1.3);
        avancado.put("fatorEspacamentoMax", 2.6);
        avancado.put("limiarIncertezaBrier", 0.25);
        avancado.put("modoConservadorAtivo", true);
        settings.put("parametrosAvancados", avancado);

        return settings;
    }

    // =========================================================================
    // T37 — DADOS, BACKUPS CONSISTENTES E RECUPERAÇÃO (SQLITE WAL-COMPLIANT)
    // =========================================================================

    public Map<String, Object> getBackupOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();

        File mainDb = new File(MAIN_DB_PATH);
        File stagingDb = new File(STAGING_DB_PATH);
        File backupDir = new File(BACKUP_DIR_PATH);

        overview.put("databaseLocation", mainDb.getAbsolutePath());
        overview.put("stagingLocation", stagingDb.getAbsolutePath());
        overview.put("mainDatabaseSizeBytes", mainDb.exists() ? mainDb.length() : 0);
        overview.put("mainDatabaseSizeFormatted", mainDb.exists() ? String.format("%.2f MB", mainDb.length() / (1024.0 * 1024.0)) : "0 MB");

        overview.put("stagingDatabaseSizeBytes", stagingDb.exists() ? stagingDb.length() : 0);
        overview.put("stagingDatabaseSizeFormatted", stagingDb.exists() ? String.format("%.2f MB", stagingDb.length() / (1024.0 * 1024.0)) : "0 MB");

        // Backups existentes
        File[] backups = backupDir.listFiles((dir, name) -> name.endsWith(".db") || name.endsWith(".bak"));
        int totalBackups = (backups != null) ? backups.length : 0;
        overview.put("totalBackups", totalBackups);

        if (backups != null && backups.length > 0) {
            Arrays.sort(backups, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            File latest = backups[0];
            overview.put("lastBackupFilename", latest.getName());
            overview.put("lastBackupDate", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date(latest.lastModified())));
            overview.put("lastBackupSizeBytes", latest.length());
            overview.put("lastBackupSizeFormatted", String.format("%.2f MB", latest.length() / (1024.0 * 1024.0)));
        } else {
            overview.put("lastBackupFilename", "Nenhum backup gerado");
            overview.put("lastBackupDate", "—");
            overview.put("lastBackupSizeFormatted", "0 MB");
        }

        // Integridade rápida verificada
        Map<String, Object> integrity = verifyIntegrity();
        overview.put("integrityStatus", integrity.get("status"));
        overview.put("integrityCheckMessage", integrity.get("message"));
        overview.put("retentionPolicy", "Histórico preservado localmente com rotação de segurança");

        return overview;
    }

    public Map<String, Object> createConsistentBackup(String label) {
        ensureBackupDir();
        String suffix = label == null ? "" : label.replaceAll("[^a-zA-Z0-9_]", "");
        String filename = "fiscalstudy_backup_" + java.time.Instant.now().toEpochMilli() + "_" + UUID.randomUUID().toString().substring(0,8) + "_" + suffix + ".db";
        Path destination = databasePaths.backupDirectory().resolve(filename);
        try {
            jdbcTemplate.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
                org.sqlite.SQLiteConnection sqlite = connection.unwrap(org.sqlite.SQLiteConnection.class);
                int code = sqlite.getDatabase().backup("main", destination.toString(), null);
                if (code != 0) throw new java.sql.SQLException("SQLite backup failed: " + code);
                return null;
            });
            com.fiscalstudy.backend.infrastructure.config.SqliteRecovery.verify(destination);
            appendBackupEvent("BACKUP_CREATED", filename, Map.of("filename", filename, "sizeBytes", Files.size(destination)));
            return Map.of("success", true, "filename", filename, "path", destination.toString(), "sizeBytes", Files.size(destination), "message", "Backup SQLite consistente criado e verificado.");
        } catch (Exception e) {
            throw new IllegalStateException("Backup não concluído; não use o arquivo parcial", e);
        }
    }

    private void appendBackupEvent(String type, String aggregateId, Map<String,Object> details) throws IOException {
        String now = Instant.now().toString();
        String payload = objectMapper.writeValueAsString(details);
        jdbcTemplate.update("INSERT INTO event_store(event_id,event_type,aggregate_type,aggregate_id,session_id,occurred_at,recorded_at,event_version,schema_version,payload_json) VALUES(?,?,'SYSTEM_BACKUP',?,'maintenance',?,?,1,'v1',?)", UUID.randomUUID().toString(), type, aggregateId, now, now, payload);
    }

    public Map<String, Object> verifyIntegrity() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            List<String> integrityRows = jdbcTemplate.queryForList("PRAGMA integrity_check;", String.class);
            List<Map<String, Object>> fkRows = jdbcTemplate.queryForList("PRAGMA foreign_key_check;");

            boolean isIntegrityOk = integrityRows.size() == 1 && "ok".equalsIgnoreCase(integrityRows.get(0));
            boolean isFkOk = fkRows.isEmpty();

            if (isIntegrityOk && isFkOk) {
                result.put("status", "INTEGRO");
                result.put("healthy", true);
                result.put("message", "Banco de dados operacional 100% íntegro. Nenhuma corrupção física ou violação de chave encontrada.");
            } else {
                result.put("status", "ATENCAO");
                result.put("healthy", false);
                result.put("message", "Anomalia detectada: Integrity: " + integrityRows + " | FK: " + fkRows);
            }
        } catch (Exception e) {
            result.put("status", "ERRO");
            result.put("healthy", false);
            result.put("message", "Falha ao executar verificação: " + e.getMessage());
        }
        return result;
    }

    public List<Map<String, Object>> listBackups() {
        List<Map<String, Object>> list = new ArrayList<>();
        File backupDir = new File(BACKUP_DIR_PATH);
        if (!backupDir.exists()) return list;

        File[] files = backupDir.listFiles((dir, name) -> name.endsWith(".db") || name.endsWith(".bak"));
        if (files != null) {
            Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            for (File f : files) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("filename", f.getName());
                item.put("sizeBytes", f.length());
                item.put("sizeFormatted", String.format("%.2f MB", f.length() / (1024.0 * 1024.0)));
                item.put("date", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date(f.lastModified())));
                item.put("isSafetySnapshot", f.getName().contains("safety"));
                list.add(item);
            }
        }
        return list;
    }

    public Map<String, Object> restoreBackup(String backupFilename) {
        try {
            Path source = com.fiscalstudy.backend.infrastructure.config.SqliteRecovery.confinedBackup(databasePaths.backupDirectory(), backupFilename);
            Path prepared = databasePaths.dataDirectory().resolve("restored_" + Instant.now().toEpochMilli() + "_" + UUID.randomUUID().toString().substring(0,8) + ".db");
            com.fiscalstudy.backend.infrastructure.config.SqliteRecovery.restoreToNewFile(source, prepared);
            appendBackupEvent("RESTORE_PREPARED", backupFilename, Map.of("source", backupFilename, "preparedDatabase", prepared.toString()));
            return Map.of("success", true, "status", "RESTORE_PREPARED", "requiresRestart", true, "mainDatabaseUnchanged", true,
                    "preparedDatabase", prepared.toString(), "message", "Cópia restaurada e verificada. Banco ativo preservado; pare a aplicação e configure o datasource para a cópia antes de reiniciar.");
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("Preparação da restauração falhou; banco ativo preservado", e); }
    }

    public Map<String,Object> getIntegrationsStatus() {
        Map<String,Object> status=new LinkedHashMap<>();
        String r=System.getenv().getOrDefault("FISCALSTUDY_RSCRIPT","Rscript");
        String python=System.getenv().getOrDefault("FISCALSTUDY_PYTHON","python");
        boolean rInstalled=checkCommandAvailable(r);
        Path engine=databasePaths.projectRoot().resolve("analytics-engine");
        Path manifest=databasePaths.dataDirectory().resolve("analytics/current-run.json");
        Map<String,Object> rStatus=new LinkedHashMap<>();
        rStatus.put("status",rInstalled && Files.isRegularFile(engine.resolve("run_analytics.R"))?"DISPONIVEL":"INDISPONIVEL");
        rStatus.put("engineInstalled",rInstalled);rStatus.put("lastAnalysisCompleted","NENHUMA_EXECUCAO_CONFIRMADA");
        if(Files.isRegularFile(manifest))try{rStatus.put("currentRun",objectMapper.readValue(Files.readString(manifest),Map.class));}catch(Exception e){rStatus.put("manifestError",e.getMessage());}
        status.put("motorAnaliticoR",rStatus);
        boolean py=checkCommandAvailable(python);
        status.put("extratorPdf",Map.of("status",py?"PYTHON_DISPONIVEL_DEPENDENCIAS_NAO_VERIFICADAS":"INDISPONIVEL","pythonAvailable",py,"service","Python UniversalExtractor","isolationArea",databasePaths.stagingDatabase().toString()));
        status.put("ocrService",Map.of("status","NAO_VERIFICADO","engine","OCR não foi sondado"));
        Map<String,Object> settings=getSettings();Object raw=settings.get("ankiIntegration");
        boolean enabled=raw instanceof Map<?,?> consent && Boolean.TRUE.equals(consent.get("enabled"));
        status.put("ankiConnect",Map.of("status",enabled?"HABILITADO_CONEXAO_NAO_SONDADA":"DESATIVADO_POR_PREFERENCIA","host","127.0.0.1","port",8765));
        return status;
    }
    private boolean checkCommandAvailable(String executable) {
        try {
            return com.fiscalstudy.backend.infrastructure.process.BoundedProcess.run(List.of(executable,"--version"),databasePaths.projectRoot(),java.time.Duration.ofSeconds(3),Map.of()).exitCode()==0;
        }catch(Exception e){if(e instanceof InterruptedException)Thread.currentThread().interrupt();return false;}
    }

    private boolean checkHttpPort(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(250);
            conn.setReadTimeout(250);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            return code >= 200 && code < 500;
        } catch (Exception e) {
            return false;
        }
    }

    // =========================================================================
    // T39 — DIAGNÓSTICO TÉCNICO E AUDITORIA
    // =========================================================================

    public Map<String, Object> getTechnicalAuditReport() {
        Map<String, Object> report = new LinkedHashMap<>();

        report.put("appVersion", "3.21 (Calm Technology & Local-First)");
        report.put("sqliteVersion", getSqliteVersion());
        report.put("architecture", "APPEND-ONLY EVENT LOG + MATERIALIZED PROJECTIONS");

        // Contagens das tabelas centrais
        Map<String, Integer> tables = new LinkedHashMap<>();
        tables.put("questions", safeCount("SELECT count(*) FROM study_questions"));
        tables.put("event_store", safeCount("SELECT count(*) FROM event_store"));
        tables.put("materials", safeCount("SELECT count(*) FROM study_materials"));
        tables.put("concursos", safeCount("SELECT count(*) FROM concursos"));
        tables.put("study_notebooks", safeCount("SELECT count(*) FROM study_notebooks"));
        tables.put("favorite_questions", safeCount("SELECT count(*) FROM favorite_questions"));
        tables.put("question_reports", safeCount("SELECT count(*) FROM question_reports"));
        report.put("tableCounts", tables);

        // Verificação de eventos duplicados
        int duplicateEvents = safeCount("SELECT count(*) - count(distinct event_id) FROM event_store");
        report.put("duplicateEventsCount", duplicateEvents);
        report.put("eventsIntegrity", "Identidade de eventos protegida por PK; isso não comprova integridade semântica ou elegibilidade");
        report.put("invalidEventJson",safeCount("SELECT count(*) FROM event_store WHERE NOT json_valid(payload_json)"));
        report.put("realStudyAttempts",safeCount("SELECT count(*) FROM event_store WHERE event_type='ANSWER_SUBMITTED' AND json_valid(payload_json) AND json_extract(payload_json,'$.origin')='REAL_STUDY'"));
        report.put("quickCheck",jdbcTemplate.queryForList("PRAGMA quick_check"));
        report.put("foreignKeyViolations",jdbcTemplate.queryForList("PRAGMA foreign_key_check"));

        // Sanitização de logs
        report.put("logSanitization", "NAO_AUDITADO_AUTOMATICAMENTE");
        report.put("serverTime", Instant.now().toString());

        return report;
    }

    private String getSqliteVersion() {
        try {
            return jdbcTemplate.queryForObject("SELECT sqlite_version();", String.class);
        } catch (Exception e) {
            return "SQLite 3.x";
        }
    }

    private int safeCount(String sql) {
        try {
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            return (count != null) ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    // =========================================================================
    // T40 — BUSCA GLOBAL FEDERADA POR CATEGORIA
    // =========================================================================

    public Map<String, List<Map<String, Object>>> globalSearch(String query) {
        Map<String, List<Map<String, Object>>> results = new LinkedHashMap<>();
        results.put("CONTEUDOS", new ArrayList<>());
        results.put("QUESTOES", new ArrayList<>());
        results.put("MATERIAIS", new ArrayList<>());
        results.put("ATIVIDADES", new ArrayList<>());

        if (query == null || query.trim().length() < 2) {
            return results;
        }

        String searchPattern = "%" + query.trim().toLowerCase() + "%";

        // 1. CONTEÚDOS (Edital tópicos e disciplinas)
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT disciplina, assunto, subassunto
                FROM edital_topicos
                WHERE lower(disciplina) LIKE ? OR lower(assunto) LIKE ? OR lower(subassunto) LIKE ?
                LIMIT 8
            """, searchPattern, searchPattern, searchPattern);

            for (Map<String, Object> r : rows) {
                Map<String, Object> item = new LinkedHashMap<>();
                String disc = (String) r.get("disciplina");
                String ass = (String) r.get("assunto");
                String sub = (String) r.get("subassunto");
                item.put("titulo", disc + " > " + ass + (sub != null && !sub.isBlank() ? " > " + sub : ""));
                item.put("tipo", "CONTEUDO");
                item.put("disciplina", disc);
                item.put("assunto", ass);
                item.put("targetTab", "edital");
                results.get("CONTEUDOS").add(item);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Busca de conteúdos indisponível", e);
        }

        // 2. QUESTÕES
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, numero_original, enunciado, disciplina, assunto
                FROM study_questions
                WHERE lower(enunciado) LIKE ? OR lower(disciplina) LIKE ? OR lower(assunto) LIKE ?
                LIMIT 6
            """, searchPattern, searchPattern, searchPattern);

            for (Map<String, Object> r : rows) {
                Map<String, Object> item = new LinkedHashMap<>();
                String stmt = (String) r.get("enunciado");
                String resumo = stmt != null ? (stmt.length() > 90 ? stmt.substring(0, 90) + "..." : stmt) : "Questão sem enunciado";
                item.put("id", r.get("id"));
                item.put("numeroOriginal", r.get("numero_original"));
                item.put("titulo", "Q" + r.get("numero_original") + " • " + resumo);
                item.put("disciplina", r.get("disciplina"));
                item.put("assunto", r.get("assunto"));
                item.put("tipo", "QUESTAO");
                item.put("targetTab", "banco");
                results.get("QUESTOES").add(item);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Busca de questões indisponível", e);
        }

        // 3. MATERIAIS
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, titulo AS title, disciplina AS discipline, formato AS file_format, total_paginas AS total_pages
                FROM study_materials
                WHERE lower(titulo) LIKE ? OR lower(disciplina) LIKE ?
                LIMIT 6
            """, searchPattern, searchPattern);

            for (Map<String, Object> r : rows) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", r.get("id"));
                item.put("titulo", r.get("title") + " (" + r.get("discipline") + ")");
                item.put("formato", r.get("file_format"));
                item.put("paginas", r.get("total_pages"));
                item.put("tipo", "MATERIAL");
                item.put("targetTab", "materiais");
                results.get("MATERIAIS").add(item);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Busca de materiais indisponível", e);
        }

        // 4. ATIVIDADES (Cadernos e Simulados)
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, nome AS title, modo_resolucao AS mode, quantidade AS question_count
                FROM study_notebooks
                WHERE lower(nome) LIKE ?
                LIMIT 5
            """, searchPattern);

            for (Map<String, Object> r : rows) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", r.get("id"));
                item.put("titulo", "Caderno: " + r.get("title") + " (" + r.get("question_count") + " questões)");
                item.put("modo", r.get("mode"));
                item.put("tipo", "ATIVIDADE");
                item.put("targetTab", "simulados");
                results.get("ATIVIDADES").add(item);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Busca de atividades indisponível", e);
        }

        return results;
    }
}
