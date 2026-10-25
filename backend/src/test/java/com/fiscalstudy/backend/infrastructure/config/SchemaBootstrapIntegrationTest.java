package com.fiscalstudy.backend.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.nio.file.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"spring.sql.init.mode=never","fiscalstudy.anki.network-allowed=false"})
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class SchemaBootstrapIntegrationTest {
    private static final Path DATA=Path.of("target","schema-bootstrap-"+UUID.randomUUID()).toAbsolutePath();
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",()->"jdbc:sqlite:"+DATA.resolve("main.db"));
        registry.add("fiscalstudy.data-dir",DATA::toString);
        registry.add("fiscalstudy.staging-db",()->DATA.resolve("staging.db").toString());
        registry.add("fiscalstudy.acervo-root",()->DATA.resolve("materials").toString());
        registry.add("fiscalstudy.analytics-dir",()->DATA.resolve("analytics").toString());
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired DatabasePaths paths;
    @Test void emptyInstallationIsMigratedBeforeApplicationUsesJdbc() throws Exception {
        assertEquals(DATA.resolve("main.db"),paths.mainDatabase());
        assertTrue(Files.isRegularFile(paths.stagingDatabase()));
        assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM schema_migrations",Integer.class));
        assertEquals("ok",jdbc.queryForObject("PRAGMA quick_check",String.class));
        try(var backups=Files.list(paths.backupDirectory())) {
            assertEquals(0,backups.filter(p->p.getFileName().toString().startsWith("before_migration_")).count(),"A new database must not look like a pre-initialized legacy database");
        }
    }
}
