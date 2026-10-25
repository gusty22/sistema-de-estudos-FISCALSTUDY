package com.fiscalstudy.backend.infrastructure.in.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String[] allowedOrigins;
    private final com.fiscalstudy.backend.infrastructure.config.DatabasePaths paths;
    public WebConfig(@org.springframework.beans.factory.annotation.Value("${fiscalstudy.security.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String origins, org.springframework.core.env.Environment environment) { this.allowedOrigins=origins.split(","); this.paths=new com.fiscalstudy.backend.infrastructure.config.DatabasePaths(environment); }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry registry) {
        java.nio.file.Path assetsDir = paths.dataDirectory().resolve("assets");
        String locationUri = assetsDir.toUri().toString();
        if (!locationUri.endsWith("/")) {
            locationUri += "/";
        }
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(locationUri);
    }
}
