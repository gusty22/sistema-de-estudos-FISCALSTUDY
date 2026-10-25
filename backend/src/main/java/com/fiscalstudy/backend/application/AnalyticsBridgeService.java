package com.fiscalstudy.backend.application;
import com.fasterxml.jackson.databind.*;
import com.fiscalstudy.backend.infrastructure.config.AnalyticsPaths;
import com.fiscalstudy.backend.infrastructure.process.BoundedProcess;
import com.fiscalstudy.backend.infrastructure.in.web.dto.RobinHoodWeightsDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/** Each execution owns its input/output; only a successful manifest makes results consumable. */
@Service
public class AnalyticsBridgeService {
 private final AnalyticsProjectionService projection;
 private final RobinHoodCycleService cycle;
 private final ObjectMapper mapper;
 private final AnalyticsPaths paths;
 @Value("${fiscalstudy.rscript-executable:Rscript}") private String executable="Rscript";
 @Value("${fiscalstudy.analytics.timeout-seconds:120}") private long timeoutSeconds=120;
 @Value("${fiscalstudy.r-libs:}") private String rLibs="";
 public AnalyticsBridgeService(AnalyticsProjectionService projection,RobinHoodCycleService cycle,ObjectMapper mapper,AnalyticsPaths paths){this.projection=projection;this.cycle=cycle;this.mapper=mapper;this.paths=paths;}
 public synchronized Path exportCanonicalCsv()throws Exception {
   Path file=paths.output().resolve("data/raw/operational_export_v1.csv");Files.createDirectories(file.getParent());
   Files.writeString(file,projection.exportCsv("REAL_STUDY"),StandardCharsets.UTF_8);return file;
 }
 @Async public CompletableFuture<AnalyticsExecutionResult> triggerAnalyticsAsync(){return CompletableFuture.completedFuture(executeAnalyticsPipeline());}
 public synchronized AnalyticsExecutionResult executeAnalyticsPipeline(){
   Instant start=Instant.now();String id=UUID.randomUUID().toString();String logs="";
   try {
     Path run=paths.output().resolve("runs").resolve(id);Files.createDirectories(run);
     writeManifest(id,"RUNNING",start,null);
     Path input=run.resolve("input.csv");Files.copy(exportCanonicalCsv(),input);
     Path script=paths.engine().resolve("run_analytics.R");if(!Files.isRegularFile(script))throw new IllegalStateException("Analytics engine script missing: "+script);
     Map<String,String> env=new HashMap<>();env.put("FISCALSTUDY_ANALYTICS_OUTPUT",run.toString());env.put("FISCALSTUDY_RUN_ID",id);
     if(!rLibs.isBlank())env.put("FISCALSTUDY_R_LIBS",rLibs);
     var result=BoundedProcess.run(List.of(executable,script.toString(),input.toString()),paths.engine(),Duration.ofSeconds(timeoutSeconds),env);
     logs=result.output();if(result.exitCode()!=0)throw new IllegalStateException("R failed with exit code "+result.exitCode()+": "+logs);
     for(String file:List.of("metrics/robin_hood_weights.json","metrics/analytical_signals_v1.json","metrics/metrics_summary_v1.json","metrics/learning_profile_v1.json")) {
       Path artifact=run.resolve(file);if(!Files.isRegularFile(artifact))throw new IllegalStateException("Required output missing: "+file);
       mapper.readTree(Files.readString(artifact));
     }
     if(!Files.isRegularFile(run.resolve("metrics/metrics_summary_v1.csv")))throw new IllegalStateException("Required CSV output missing");
     var weights=mapper.readValue(Files.readString(run.resolve("metrics/robin_hood_weights.json")),RobinHoodWeightsDTO.class);
     writeManifest(id,"SUCCEEDED",start,null);cycle.injectWeights(weights);
     return new AnalyticsExecutionResult(true,"Execução analítica concluída. runId="+id,weights,loadAnalyticalSignals(),logs,Duration.between(start,Instant.now()).toMillis());
   }catch(Exception e){
     if(e instanceof InterruptedException)Thread.currentThread().interrupt();
     try{writeManifest(id,"FAILED",start,e.getMessage());}catch(Exception ignored){}
     cycle.injectWeights(null);
     return new AnalyticsExecutionResult(false,"Execução incompleta. runId="+id+": "+e.getMessage(),null,List.of(),logs,Duration.between(start,Instant.now()).toMillis());
   }
 }
 private void writeManifest(String id,String status,Instant start,String error)throws Exception {
   Files.createDirectories(paths.output());Map<String,Object> data=new LinkedHashMap<>();
   data.put("runId",id);data.put("status",status);data.put("startedAt",start.toString());data.put("updatedAt",Instant.now().toString());data.put("engineVersion","analytics-v1");data.put("originFilter","REAL_STUDY");data.put("error",error);
   Path run=paths.output().resolve("runs").resolve(id);Files.createDirectories(run);
   Path input=run.resolve("input.csv");if(Files.isRegularFile(input))data.put("inputSha256",sha256(input));
   Path engine=paths.engine().resolve("run_analytics.R");if(Files.isRegularFile(engine))data.put("engineSha256",sha256(engine));
   mapper.writerWithDefaultPrettyPrinter().writeValue(run.resolve("run-manifest.json").toFile(),data);
   Path temporary=paths.output().resolve("current-run.tmp");mapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(),data);
   Files.move(temporary,paths.currentManifest(),StandardCopyOption.REPLACE_EXISTING);
 }
 private static String sha256(Path file)throws Exception{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file)));}
 private Path currentRun()throws Exception {
   if(!Files.isRegularFile(paths.currentManifest()))return null;
   var manifest=mapper.readTree(Files.readString(paths.currentManifest()));if(!"SUCCEEDED".equals(manifest.path("status").asText()))return null;
   String id=manifest.path("runId").asText();UUID.fromString(id);return paths.output().resolve("runs").resolve(id);
 }
 public RobinHoodWeightsDTO loadRobinHoodWeights(){try{Path run=currentRun();return run==null?null:mapper.readValue(Files.readString(run.resolve("metrics/robin_hood_weights.json")),RobinHoodWeightsDTO.class);}catch(Exception e){throw new IllegalStateException("Invalid current run weights",e);}}
 public List<Map<String,Object>> loadAnalyticalSignals(){try{Path run=currentRun();if(run==null)return List.of();JsonNode sig=mapper.readTree(Files.readString(run.resolve("metrics/analytical_signals_v1.json"))).path("signals");List<Map<String,Object>> out=new ArrayList<>();if(sig.isArray())for(JsonNode item:sig)out.add(mapper.convertValue(item,Map.class));return out;}catch(Exception e){throw new IllegalStateException("Invalid current run signals",e);}}
 public record AnalyticsExecutionResult(boolean success,String message,RobinHoodWeightsDTO weights,List<Map<String,Object>> signals,String logs,long executionTimeMs){}
}
