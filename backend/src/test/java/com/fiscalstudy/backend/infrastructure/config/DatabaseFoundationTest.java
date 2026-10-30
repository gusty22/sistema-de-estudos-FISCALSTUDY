package com.fiscalstudy.backend.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

class DatabaseFoundationTest {
 @TempDir Path temp;
 Connection open(Path p) throws SQLException { return DriverManager.getConnection("jdbc:sqlite:"+p); }
 DatabasePaths paths(Path db) { return new DatabasePaths(new MockEnvironment().withProperty("fiscalstudy.project-root",temp.toString()).withProperty("spring.datasource.url","jdbc:sqlite:"+db).withProperty("fiscalstudy.staging-db",temp.resolve("staging.db").toString())); }
 @Test void newDatabaseHasVersionedSchemaAndRepeatMigrationIsIdempotent() throws Exception {
  var db=temp.resolve("new.db");
  try(var c=open(db)){SchemaMigration.migrate(c);SchemaMigration.migrate(c);try(var s=c.createStatement();var r=s.executeQuery("SELECT count(*) FROM schema_migrations")){assertTrue(r.next());assertEquals(SchemaMigration.CURRENT_VERSION,r.getInt(1));}}
  SqliteRecovery.verify(db);
 }
 @Test void legacyNotebookIsUpgradedWithoutLosingDataAndSnapshotIsVerified() throws Exception {
  var db=temp.resolve("legacy.db");
  try(var c=open(db);var s=c.createStatement()) {s.execute("CREATE TABLE study_notebooks(id TEXT PRIMARY KEY,concurso_id TEXT,created_at TEXT)");s.execute("INSERT INTO study_notebooks VALUES('legacy','c','2026-01-01')");}
  new SchemaMigration(new DriverManagerDataSource("jdbc:sqlite:"+db),paths(db));
  try(var c=open(db);var s=c.createStatement();var r=s.executeQuery("SELECT id,tempo_minutos,questoes_ids_json FROM study_notebooks")){assertTrue(r.next());assertEquals("legacy",r.getString(1));assertEquals(90,r.getInt(2));assertFalse(r.next());}
  try(var snapshots=Files.list(paths(db).backupDirectory())) {var snapshot=snapshots.filter(p->p.getFileName().toString().startsWith("before_migration_")).findFirst().orElseThrow();SqliteRecovery.verify(snapshot);}
 }
 @Test void onlineBackupIncludesWalWritesAndRestoresOnlyToNewFile() throws Exception {
  var db=temp.resolve("live.db");var snapshot=temp.resolve("backup.db");var restored=temp.resolve("restored.db");
  try(var c=open(db);var s=c.createStatement()) {s.execute("PRAGMA journal_mode=WAL");s.execute("CREATE TABLE evidence(value TEXT)");s.execute("INSERT INTO evidence VALUES('persisted')");assertEquals(0,c.unwrap(org.sqlite.SQLiteConnection.class).getDatabase().backup("main",snapshot.toString(),null));SqliteRecovery.verify(snapshot);SqliteRecovery.restoreToNewFile(snapshot,restored);assertThrows(FileAlreadyExistsException.class,()->SqliteRecovery.restoreToNewFile(snapshot,restored));}
  try(var c=open(restored);var s=c.createStatement();var r=s.executeQuery("SELECT value FROM evidence")){assertTrue(r.next());assertEquals("persisted",r.getString(1));}
 }
 @Test void backupSelectionRejectsTraversalAndMissingFiles() throws Exception {
  var dir=Files.createDirectory(temp.resolve("backups"));
  assertThrows(IllegalArgumentException.class,()->SqliteRecovery.confinedBackup(dir,"../outside.db"));assertThrows(IllegalArgumentException.class,()->SqliteRecovery.confinedBackup(dir,"..\\outside.db"));assertThrows(IllegalArgumentException.class,()->SqliteRecovery.confinedBackup(dir,"missing.db"));
 }
 @Test void stagingSchemaRequiresDocumentParentAndPreservesExistingRows() throws Exception {
  var db=temp.resolve("staging.db");StagingSchemaMigration.migrate(db);
  try(var c=open(db);var s=c.createStatement()){s.execute("PRAGMA foreign_keys=ON");assertThrows(SQLException.class,()->s.execute("INSERT INTO staging_documents(id,file_id,doc_role,page_start,page_end) VALUES('orphan','missing','PROVA',1,1)"));s.execute("INSERT INTO staging_files(id,rel_path,filename,file_size_bytes,sha256,total_pages) VALUES('f','exam.pdf','exam.pdf',10,'hash',1)");}
  StagingSchemaMigration.migrate(db);
  try(var c=open(db);var s=c.createStatement();var r=s.executeQuery("SELECT id FROM staging_files")){assertTrue(r.next());assertEquals("f",r.getString(1));assertFalse(r.next());}SqliteRecovery.verify(db);
 }
}
