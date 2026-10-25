package com.fiscalstudy.backend.infrastructure.config;

import java.io.IOException;
import java.nio.file.*;
import java.sql.*;

/** Offline recovery prepares a new verified file; the live datasource is never replaced. */
public final class SqliteRecovery {
    private SqliteRecovery() {}
    public static void verifyPhysical(Path database) throws SQLException, IOException {
        if(!Files.isRegularFile(database) || Files.size(database)==0) throw new IOException("SQLite file missing or empty");
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:file:"+database.toAbsolutePath().toString().replace('\\','/')+"?mode=ro"); Statement s=c.createStatement()) {
            try(ResultSet r=s.executeQuery("PRAGMA quick_check")) { if(!r.next() || !"ok".equalsIgnoreCase(r.getString(1)) || r.next()) throw new SQLException("SQLite quick_check failed"); }

        }
    }
    public static void verify(Path database) throws SQLException,IOException {
        verifyPhysical(database);
        try(Connection c=DriverManager.getConnection("jdbc:sqlite:file:"+database.toAbsolutePath().toString().replace('\\','/')+"?mode=ro");Statement s=c.createStatement();ResultSet r=s.executeQuery("PRAGMA foreign_key_check")) {
            if(r.next())throw new SQLException("SQLite foreign key violations detected");
        }
    }
    public static Path confinedBackup(Path directory,String filename) throws IOException {
        if(filename==null || filename.isBlank() || filename.contains("/") || filename.contains("\\") || filename.equals(".") || filename.equals("..")) throw new IllegalArgumentException("Invalid backup filename");
        Path realDirectory=directory.toRealPath(); Path candidate=realDirectory.resolve(filename).normalize();
        if(!candidate.getParent().equals(realDirectory) || !Files.isRegularFile(candidate,LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(candidate)) throw new IllegalArgumentException("Backup must be a regular file inside backup directory");
        Path resolved=candidate.toRealPath(); if(!resolved.getParent().equals(realDirectory))throw new IllegalArgumentException("Backup escapes directory");
        return resolved;
    }
    public static void restoreToNewFile(Path source,Path destination) throws IOException,SQLException {
        verify(source);
        if(Files.exists(destination))throw new FileAlreadyExistsException(destination.toString());
        Files.createDirectories(destination.toAbsolutePath().getParent());
        Files.copy(source,destination);
        try { verify(destination); } catch(IOException|SQLException e) { throw new IOException("Prepared restoration failed verification; live database untouched",e); }
    }
}
