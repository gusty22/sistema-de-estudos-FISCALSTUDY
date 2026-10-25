package com.fiscalstudy.backend.infrastructure.config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.file.*;
/** One engine source, isolated output per execution, no fallback searches in Downloads. */
@Component
public class AnalyticsPaths {
    private final Path engine,output;
    public AnalyticsPaths(DatabasePaths paths,@Value("${fiscalstudy.analytics-engine-dir:}")String engineDir,@Value("${fiscalstudy.analytics-dir:}")String outputDir) {
        engine=(engineDir.isBlank()?paths.projectRoot().resolve("analytics-engine"):Path.of(engineDir)).toAbsolutePath().normalize();
        output=(outputDir.isBlank()?paths.dataDirectory().resolve("analytics"):Path.of(outputDir)).toAbsolutePath().normalize();
    }
    public Path engine(){return engine;}
    public Path output(){return output;}
    public Path currentManifest(){return output.resolve("current-run.json");}
}
