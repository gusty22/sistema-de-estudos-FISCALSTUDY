package com.fiscalstudy.backend.infrastructure.in.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry registry) {
        java.nio.file.Path assetsDir = java.nio.file.Paths.get("db", "assets").toAbsolutePath().normalize();
        if (!java.nio.file.Files.exists(assetsDir)) {
            assetsDir = java.nio.file.Paths.get("..", "db", "assets").toAbsolutePath().normalize();
        }
        String locationUri = assetsDir.toUri().toString();
        if (!locationUri.endsWith("/")) {
            locationUri += "/";
        }
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(locationUri);
    }
}
