package com.fiscalstudy.backend.infrastructure.config;

import org.springframework.context.annotation.*;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import javax.sql.DataSource;

@Configuration(proxyBeanMethods=false)
public class SqlitePersistenceConfiguration {
    @Bean
    public static BeanFactoryPostProcessor databaseDirectoryBootstrap(Environment environment) {
        new DatabasePaths(environment).createDirectories();
        return beanFactory -> {};
    }
    @Bean public DatabasePaths databasePaths(Environment environment){return new DatabasePaths(environment);}
    @Bean public SchemaMigration schemaMigration(DataSource dataSource, DatabasePaths paths){return new SchemaMigration(dataSource, paths);}
    @Bean @DependsOn("schemaMigration")
    public JdbcTemplate jdbcTemplate(DataSource dataSource){return new JdbcTemplate(dataSource);}
}
