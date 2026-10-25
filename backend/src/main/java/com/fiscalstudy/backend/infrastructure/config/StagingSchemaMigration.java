package com.fiscalstudy.backend.infrastructure.config;

import java.nio.file.Path;
import java.sql.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/** Additive staging bootstrap, shared with the ingestion contract. No orphan is discarded. */
public final class StagingSchemaMigration {
    private StagingSchemaMigration() {}
    public static void migrate(Path database) {
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:"+database)) {
            try(Statement s=c.createStatement()){s.execute("PRAGMA foreign_keys=ON");s.execute("PRAGMA busy_timeout=10000");}
            boolean existing=false,current=false;
            try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name='staging_files'")){existing=r.next();}
            try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT 1 FROM staging_schema_migrations WHERE version=1")){current=r.next();}catch(SQLException legacy){/* before versioning */}
            if(existing&&!current){
                Path backups=database.toAbsolutePath().getParent().resolve("backups");java.nio.file.Files.createDirectories(backups);
                Path snapshot=backups.resolve("before_staging_migration_"+java.util.UUID.randomUUID()+".db");
                int code=c.unwrap(org.sqlite.SQLiteConnection.class).getDatabase().backup("main",snapshot.toString(),null);
                if(code!=0)throw new SQLException("Staging pre-migration snapshot failed: "+code);
                SqliteRecovery.verifyPhysical(snapshot);
                org.slf4j.LoggerFactory.getLogger(StagingSchemaMigration.class).info("Verified physical staging recovery snapshot {}; pre-existing FK violations, if any, remain preserved",snapshot);
            }
            c.setAutoCommit(false);
            try {
                ScriptUtils.executeSqlScript(c,new ClassPathResource("staging-schema.sql"));
                SchemaMigration.ensureColumn(c,"staging_questions","justificativa","TEXT");
                SchemaMigration.ensureColumn(c,"staging_questions","texto_apoio","TEXT");
                SchemaMigration.ensureColumn(c,"staging_questions","texto_apoio_titulo","TEXT");
                try(Statement s=c.createStatement()){
                    s.execute("CREATE TABLE IF NOT EXISTS staging_schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)");
                    s.execute("INSERT OR IGNORE INTO staging_schema_migrations VALUES(1,datetime('now'))");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_staging_documents_file ON staging_documents(file_id)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_staging_questions_document ON staging_questions(document_id)");
                    s.execute("CREATE INDEX IF NOT EXISTS idx_staging_support_document ON staging_support_materials(document_id)");
                }
                c.commit();
            }catch(Exception e){c.rollback();throw e;}
            try(Statement s=c.createStatement();ResultSet r=s.executeQuery("PRAGMA foreign_key_check")){
                int violations=0;while(r.next())violations++;
                if(violations>0)org.slf4j.LoggerFactory.getLogger(StagingSchemaMigration.class).warn("Staging has {} pre-existing foreign-key violations; rows preserved for recovery, no automatic deletion",violations);
            }
        }catch(Exception e){throw new IllegalStateException("Staging migration failed; startup stopped",e);}
    }
}
