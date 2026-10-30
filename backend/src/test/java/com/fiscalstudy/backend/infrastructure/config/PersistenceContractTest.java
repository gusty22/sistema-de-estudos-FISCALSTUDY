package com.fiscalstudy.backend.infrastructure.config;

import com.fiscalstudy.backend.application.*;
import com.fiscalstudy.backend.infrastructure.out.persistence.StudyMaterialRepositoryImpl;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PersistenceContractTest {
    @TempDir Path dir;
    JdbcTemplate jdbc;
    DatabasePaths paths;
    DriverManagerDataSource source;
    @BeforeEach void setup() throws Exception {
        paths=new DatabasePaths(new MockEnvironment().withProperty("spring.datasource.url","jdbc:sqlite:"+dir.resolve("main.db")).withProperty("fiscalstudy.staging-db",dir.resolve("staging.db").toString()));
        paths.createDirectories();
        source=new DriverManagerDataSource("jdbc:sqlite:"+paths.mainDatabase());
        try(Connection c=source.getConnection()){SchemaMigration.migrate(c);}
        jdbc=new JdbcTemplate(source);
    }
    @Test void freshAndLegacySchemasConvergeWithoutLosingRows() throws Exception {
        jdbc.update("INSERT INTO study_notebooks(id,nome,tipo) VALUES('old','Preserved','FIXO')");
        try(Connection c=source.getConnection()){SchemaMigration.migrate(c);SchemaMigration.migrate(c);}
        assertEquals("Preserved",jdbc.queryForObject("SELECT nome FROM study_notebooks WHERE id='old'",String.class));
        assertEquals(90,jdbc.queryForObject("SELECT tempo_minutos FROM study_notebooks WHERE id='old'",Integer.class));
        assertEquals(SchemaMigration.CURRENT_VERSION,jdbc.queryForObject("SELECT count(*) FROM schema_migrations",Integer.class));
        Path legacy=dir.resolve("legacy.db");
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:"+legacy);Statement s=c.createStatement()){
            s.execute("CREATE TABLE study_notebooks(id TEXT PRIMARY KEY,nome TEXT NOT NULL,concurso_id TEXT,tipo TEXT,modo_resolucao TEXT,filtros_json TEXT,quantidade INTEGER,created_at TEXT,last_executed_at TEXT)");
            s.execute("INSERT INTO study_notebooks(id,nome,tipo) VALUES('legacy','Legacy notebook','FIXO')");
            SchemaMigration.migrate(c);
            try(ResultSet r=s.executeQuery("SELECT nome,tempo_minutos,questoes_ids_json FROM study_notebooks")){assertTrue(r.next());assertEquals("Legacy notebook",r.getString(1));assertEquals(90,r.getInt(2));}
        }
    }
    @Test void migratesARecoveryCopyWithoutChangingLearningHistory() throws Exception {
        // A reproducible pre-receipt (v7) recovery image; never discover or read a personal database.
        Path snapshot=dir.resolve("synthetic-v7.db");
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:"+snapshot);Statement statement=c.createStatement()) {
            SchemaMigration.migrate(c);
            statement.execute("DROP TABLE study_session_recordings");
            statement.execute("DELETE FROM schema_migrations WHERE version=8");
            statement.execute("INSERT INTO questions(id,enunciado,disciplina) VALUES('historical-q','Synthetic history','Math')");
            statement.execute("INSERT INTO event_store VALUES('historical-event','ANSWER_SUBMITTED','QUESTION','historical-q','historical-session','2026-10-01T10:00:00Z','2026-10-01T10:00:00Z',1,'v1','{\"origin\":\"AUTOMATED_TEST\",\"isCorrect\":true}')");
        }
        Path copy=dir.resolve("existing-copy.db");Files.copy(snapshot,copy);
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:"+copy);Statement s=c.createStatement()){
            long beforeQuestions,beforeEvents;
            try(ResultSet r=s.executeQuery("SELECT count(*) FROM questions")){r.next();beforeQuestions=r.getLong(1);}
            try(ResultSet r=s.executeQuery("SELECT count(*) FROM event_store")){r.next();beforeEvents=r.getLong(1);}
            String payload;
            try(ResultSet r=s.executeQuery("SELECT payload_json FROM event_store WHERE event_id='historical-event'")){assertTrue(r.next());payload=r.getString(1);}
            SchemaMigration.migrate(c);
            try(ResultSet r=s.executeQuery("SELECT payload_json FROM event_store WHERE event_id='historical-event'")){assertTrue(r.next());assertEquals(payload,r.getString(1));}
            try(ResultSet r=s.executeQuery("SELECT count(*) FROM questions")){r.next();assertEquals(beforeQuestions,r.getLong(1));}
            try(ResultSet r=s.executeQuery("SELECT count(*) FROM event_store")){r.next();assertEquals(beforeEvents,r.getLong(1));}
        }
        SqliteRecovery.verify(copy);
    }
    @Test void searchReadsAllCanonicalCategoriesAndFailsExplicitly() {
        jdbc.update("INSERT INTO concursos(id,nome,orgao) VALUES('c','Teste','Teste')");
        jdbc.update("INSERT INTO editais(id,concurso_id,titulo) VALUES('e','c','Teste')");
        jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto) VALUES('t','e','c','Fiscal','Tributo')");
        jdbc.update("INSERT INTO questions(id,enunciado,disciplina,assunto) VALUES('q','Tributo devido','Fiscal','Tributo')");
        jdbc.update("INSERT INTO study_materials(id,titulo,disciplina) VALUES('m','Tributo material','Fiscal')");
        jdbc.update("INSERT INTO study_notebooks(id,nome,tipo) VALUES('n','Tributo caderno','FIXO')");
        var service=new SystemSettingsService(jdbc,paths);
        var found=service.globalSearch("Tributo");
        for(String category:List.of("CONTEUDOS","QUESTOES","MATERIAIS","ATIVIDADES"))assertFalse(found.get(category).isEmpty(),category);
        jdbc.execute("DROP TABLE study_materials");
        assertThrows(IllegalStateException.class,()->service.globalSearch("Tributo"));
    }
    @Test void partialMaterialProgressPreservesLinkIdentityAndMetadata() {
        jdbc.update("INSERT INTO concursos(id,nome,orgao) VALUES('c','Teste','Teste')");
        jdbc.update("INSERT INTO editais(id,concurso_id,titulo) VALUES('e','c','Teste')");
        jdbc.update("INSERT INTO edital_topicos(id,edital_id,concurso_id,disciplina,assunto) VALUES('t','e','c','Fiscal','Tributo')");
        jdbc.update("INSERT INTO study_materials(id,titulo,disciplina,total_paginas) VALUES('m','Livro','Fiscal',100)");
        jdbc.update("INSERT INTO topic_material_links(id,topico_id,material_id,pagina_inicio,pagina_fim,anotacoes) VALUES('l','t','m',10,20,'Fonte verificada')");
        var service=new StudyMaterialService(new StudyMaterialRepositoryImpl(jdbc),jdbc);
        var result=service.updateProgress("l",5,null);
        assertEquals("t",result.getTopicoId());assertEquals("m",result.getMaterialId());assertEquals("Fonte verificada",result.getAnotacoes());assertEquals(5,result.getPaginasLidas());
        assertThrows(IllegalArgumentException.class,()->service.updateProgress("missing",1,null));
    }
    @Test void walBackupAndPreparedRecoveryDoNotReplaceLiveDatabase() throws Exception {
        jdbc.execute("PRAGMA journal_mode=WAL");
        jdbc.update("INSERT INTO study_notebooks(id,nome,tipo) VALUES('wal','Recover me','FIXO')");
        var service=new SystemSettingsService(jdbc,paths);
        var backup=service.createConsistentBackup("regression");
        assertTrue((Boolean)backup.get("success"));
        String filename=(String)backup.get("filename");
        var restored=service.restoreBackup(filename);
        assertEquals("RESTORE_PREPARED",restored.get("status"));assertEquals(true,restored.get("requiresRestart"));assertEquals(true,restored.get("mainDatabaseUnchanged"));
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:"+restored.get("preparedDatabase"));Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT nome FROM study_notebooks WHERE id='wal'")){assertTrue(r.next());assertEquals("Recover me",r.getString(1));}
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM study_notebooks WHERE id='wal'",Integer.class));
        assertThrows(IllegalArgumentException.class,()->service.restoreBackup("../main.db"));
        assertThrows(IllegalArgumentException.class,()->service.restoreBackup(paths.mainDatabase().toString()));
        assertThrows(FileAlreadyExistsException.class,()->SqliteRecovery.restoreToNewFile(paths.backupDirectory().resolve(filename),paths.mainDatabase()));
    }
    @Test void failuresDoNotMasqueradeAsPersistedSettingsOrValidBackups() throws Exception {
        var service=new SystemSettingsService(jdbc,paths);
        assertEquals(true,((Map<?,?>)service.getSettings().get("privacidade")).get("armazenamentoLocalEstrito"));
        service.updateSettings(Map.of("perfilEstudos",Map.of("tema","PAPEL_CLARO")));
        assertEquals("PAPEL_CLARO",((Map<?,?>)service.getSettings().get("perfilEstudos")).get("tema"));
        Path corrupt=paths.backupDirectory().resolve("corrupt.db");Files.writeString(corrupt,"not a database");
        assertThrows(IllegalStateException.class,()->service.restoreBackup("corrupt.db"));
        jdbc.execute("DROP TABLE system_settings");
        assertThrows(IllegalStateException.class,service::getSettings);
        assertThrows(IllegalStateException.class,()->service.updateSettings(Map.of("perfilEstudos",Map.of("tema","PAPEL_CLARO"))));
    }
    @Test void simulatedExamWritesRealNotebookAndExecution() {
        var service=new StrategicSimuladoService(jdbc);
        var result=service.generateStrategicSimulado(new HashMap<>(Map.of("titulo","Teste","quantidade",2)));
        String id=(String)result.get("notebookId");
        assertNotNull(id);assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM study_notebooks WHERE id=?",Integer.class,id));
        var completed=service.recordSimuladoCompletion(new HashMap<>(Map.of("notebookId",id,"totalQuestoes",2,"acertos",1,"erros",1)));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM simulado_executions WHERE id=?",Integer.class,completed.get("executionId")));
    }
}
