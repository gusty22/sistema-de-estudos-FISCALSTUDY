package com.fiscalstudy.backend.infrastructure.config;

import org.springframework.core.env.Environment;
import java.nio.file.*;
import java.io.IOException;

/** Canonical local file paths. The datasource is the authority for the main database. */
public final class DatabasePaths {
    private final Path projectRoot, main, staging, acervo;
    public DatabasePaths(Environment env) {
        projectRoot=absolute(env.getProperty("fiscalstudy.project-root", ".."));
        Path configuredData=absolute(env.getProperty("fiscalstudy.data-dir", projectRoot.resolve("db").toString()));
        String url=env.getProperty("spring.datasource.url", "jdbc:sqlite:"+configuredData.resolve("fiscalstudy.db"));
        if (!url.startsWith("jdbc:sqlite:") || url.equals("jdbc:sqlite::memory:") || url.contains("?"))
            throw new IllegalArgumentException("A file-backed SQLite datasource URL is required for application persistence");
        main=absolute(url.substring("jdbc:sqlite:".length()));
        staging=absolute(env.getProperty("fiscalstudy.staging-db", main.getParent().resolve("staging.db").toString()));
        acervo=absolute(env.getProperty("fiscalstudy.acervo-root", main.getParent().resolve("materials").toString()));
        if(main.equals(staging)) throw new IllegalArgumentException("Main and staging databases must be separate");
    }
    private static Path absolute(String p) { return Paths.get(p).toAbsolutePath().normalize(); }
    public Path mainDatabase(){return main;}
    public Path stagingDatabase(){return staging;}
    public Path dataDirectory(){return main.getParent();}
    public Path backupDirectory(){return dataDirectory().resolve("backups");}
    public Path projectRoot(){return projectRoot;}
    public Path acervoRoot(){return acervo;}
    public void createDirectories() {
        try { Files.createDirectories(main.getParent());Files.createDirectories(staging.getParent());Files.createDirectories(backupDirectory()); }
        catch(IOException e){throw new IllegalStateException("Unable to prepare configured data directories",e);}
    }
}
