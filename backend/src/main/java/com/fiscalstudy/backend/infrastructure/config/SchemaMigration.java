package com.fiscalstudy.backend.infrastructure.config;

import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.util.*;

/** Additive, transactional SQLite migrations; never rewrites historical events. */
public final class SchemaMigration {
    public static final int CURRENT_VERSION = 8;
    public SchemaMigration(DataSource source, DatabasePaths paths) {
        paths.createDirectories();
        try(Connection c=source.getConnection()) { snapshotBeforeMigration(c,paths); migrate(c); }
        catch(SQLException e){throw new IllegalStateException("SQLite migration failed; startup stopped",e);}
        StagingSchemaMigration.migrate(paths.stagingDatabase());
    }
    private static void snapshotBeforeMigration(Connection c,DatabasePaths paths) throws SQLException {
        boolean populated;
        try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")){populated=r.next()&&r.getInt(1)>0;}
        if(!populated)return;
        boolean current=false;
        try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT 1 FROM schema_migrations WHERE version="+CURRENT_VERSION)){current=r.next();}catch(SQLException missingVersionTable){/* legacy baseline */}
        if(current)return;
        java.nio.file.Path backup=paths.backupDirectory().resolve("before_migration_"+Instant.now().toEpochMilli()+"_"+UUID.randomUUID()+".db");
        int code=c.unwrap(org.sqlite.SQLiteConnection.class).getDatabase().backup("main",backup.toString(),null);
        if(code!=0)throw new SQLException("Pre-migration backup failed: "+code);
        try{SqliteRecovery.verify(backup);}catch(Exception e){throw new SQLException("Pre-migration backup verification failed; no migration applied",e);}
        org.slf4j.LoggerFactory.getLogger(SchemaMigration.class).info("Verified pre-migration backup: {}",backup);
    }
    public static void migrate(Connection c) throws SQLException {
        boolean auto=c.getAutoCommit();c.setAutoCommit(false);
        try {
            ScriptUtils.executeSqlScript(c,new ClassPathResource("schema.sql"));
            try(Statement s=c.createStatement()){
                s.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL)");
            }
            if(!applied(c,1)){
                ensureColumn(c,"study_notebooks","tempo_minutos","INTEGER DEFAULT 90");
                ensureColumn(c,"study_notebooks","questoes_ids_json","TEXT");
                ensureColumn(c,"revision_calendar","justificativa_pedagogica","TEXT");
                ensureColumn(c,"revision_calendar","estagio_intervencao","TEXT DEFAULT 'RECUPERACAO_ATIVA'");
                ensureColumn(c,"revision_calendar","prioridade_score","REAL DEFAULT 0.5");
                try(Statement s=c.createStatement()){
                    s.execute("CREATE INDEX IF NOT EXISTS idx_events_type_aggregate_session ON event_store(event_type,aggregate_id,session_id)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_events_type_occurred ON event_store(event_type,occurred_at)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON questions(disciplina,assunto)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_revisions_pending_due ON revision_calendar(status,data_agendada)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_routines_concurso ON student_routines(concurso_id)");
                }
                record(c,1,"Canonical notebooks and query indexes");
            }
            if(!applied(c,2)) record(c,2,"Classification, memory, settings and execution contracts");
            if(!applied(c,3)) {
                try(Statement s=c.createStatement()){
                    s.execute("CREATE INDEX IF NOT EXISTS idx_topic_material_topic ON topic_material_links(topico_id)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_topic_material_material ON topic_material_links(material_id)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_simulado_concurso_date ON simulado_executions(concurso_id,finalizado_em)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_notebooks_concurso_date ON study_notebooks(concurso_id,created_at)");
                }
                record(c,3,"Material, notebook and simulated-exam indexes");
            }
            if(!applied(c,4)) {
                ensureColumn(c,"topic_knowledge_projections","topic_name","TEXT");
                ensureColumn(c,"topic_knowledge_projections","error_attempts","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","accuracy_denominator_text","TEXT NOT NULL DEFAULT 'SEM_EVIDENCIAS'");
                ensureColumn(c,"topic_knowledge_projections","total_active_time_ms","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","average_active_time_ms","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","last_attempt_at","TEXT");
                ensureColumn(c,"topic_knowledge_projections","unique_questions_count","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","new_questions_attempts","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","repeated_questions_attempts","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","variant_questions_attempts","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","avg_confidence_ordinal","REAL");
                ensureColumn(c,"topic_knowledge_projections","low_confidence_successes","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","high_confidence_errors","INTEGER NOT NULL DEFAULT 0");
                ensureColumn(c,"topic_knowledge_projections","confidence_distribution_json","TEXT");
                ensureColumn(c,"topic_knowledge_projections","context_distribution_json","TEXT");
                ensureColumn(c,"topic_knowledge_projections","error_causes_distribution_json","TEXT");
                ensureColumn(c,"topic_knowledge_projections","fsrs_stability_days","REAL");
                ensureColumn(c,"topic_knowledge_projections","fsrs_retrieval_rate","REAL");
                ensureColumn(c,"topic_knowledge_projections","evidence_status","TEXT NOT NULL DEFAULT 'SEM_EVIDENCIAS'");
                ensureColumn(c,"topic_knowledge_projections","epistemic_limitations_json","TEXT");
                ensureColumn(c,"topic_knowledge_projections","pedagogical_hypotheses_json","TEXT");
                record(c,4,"Topic knowledge observable indicators and epistemic governance");
            }
            ScriptUtils.executeSqlScript(c,new org.springframework.core.io.support.EncodedResource(
                new ClassPathResource("diagnostic-quarantine-triggers.sql"),java.nio.charset.StandardCharsets.UTF_8),
                false,false,"--",";;","/*","*/");
            if(!applied(c,5)) record(c,5,"Diagnostic quarantine foundation; operational shared view");
            if(!applied(c,6)) record(c,6,"Auditable unmapped source exposure receipts");
            if(!applied(c,7)) record(c,7,"Persistent read barriers and captured item-source provenance");
            if(!applied(c,8)) record(c,8,"Atomic study session recording receipts");
            c.commit();
        } catch(Exception e){c.rollback();throw new SQLException("Migration rolled back",e);}
        finally{c.setAutoCommit(auto);}
    }
    public static void ensureColumn(Connection c,String table,String column,String definition)throws SQLException{
        try(Statement s=c.createStatement();ResultSet r=s.executeQuery("PRAGMA table_info("+table+")")){
            while(r.next())if(column.equals(r.getString("name")))return;
        }
        try(Statement s=c.createStatement()){s.execute("ALTER TABLE "+table+" ADD COLUMN "+column+" "+definition);}
    }
    private static boolean applied(Connection c,int version)throws SQLException{
        try(PreparedStatement p=c.prepareStatement("SELECT 1 FROM schema_migrations WHERE version=?")){p.setInt(1,version);try(ResultSet r=p.executeQuery()){return r.next();}}
    }
    private static void record(Connection c,int version,String description)throws SQLException{
        try(PreparedStatement p=c.prepareStatement("INSERT INTO schema_migrations VALUES(?,?,?)")){p.setInt(1,version);p.setString(2,description);p.setString(3,Instant.now().toString());p.executeUpdate();}
    }
}
