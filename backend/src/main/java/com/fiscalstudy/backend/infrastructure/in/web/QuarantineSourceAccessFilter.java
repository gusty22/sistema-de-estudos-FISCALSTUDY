package com.fiscalstudy.backend.infrastructure.in.web;
import com.fiscalstudy.backend.application.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;
/** Coarse fail-closed barrier until source/copy provenance can support narrower access. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE+1)
public class QuarantineSourceAccessFilter extends OncePerRequestFilter {
 private final QuarantineSourceExposureService exposures;private final String adminToken;
 public QuarantineSourceAccessFilter(QuarantineSourceExposureService exposures,
   @Value("${fiscalstudy.security.admin-token:}") String adminToken){this.exposures=exposures;this.adminToken=adminToken;}
 static boolean isSourcePath(String path) {
  if(Set.of("/api/v1/anki/status","/api/v1/anki/preferences","/api/v1/ingestion/staging-files",
    "/api/v1/ingestion/quality-overview").contains(path))return false;
  return path.startsWith("/api/v1/materials")||path.startsWith("/api/v1/ingestion")||
   path.startsWith("/api/v1/anki")||path.equals("/api/v1/system/search")||
   path.startsWith("/api/v1/analytics/export");
 }
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
  String path=req.getServletPath();
  if(path==null||path.isBlank()) {
   try{path=java.net.URLDecoder.decode(req.getRequestURI(),StandardCharsets.UTF_8);}
   catch(IllegalArgumentException invalid){res.sendError(400);return;}
  }
  // Match effective servlet paths, including legacy matrix parameters.
  path=path.replaceAll(";[^/]*","").replaceAll("/{2,}","/");
  if(!isSourcePath(path)||"OPTIONS".equals(req.getMethod())){chain.doFilter(req,res);return;}
  res.setHeader("Cache-Control","no-store, private");res.setHeader("Pragma","no-cache");
  // No bypass is inferred from an Origin or an admin token alone.
  boolean active;
  try{active=exposures.hasActiveHolds();}catch(Exception unavailable){deny(res,503);return;}
  if(active) try {
   boolean intent="ACKNOWLEDGE_EXPOSURE".equals(req.getHeader("X-FiscalStudy-Maintenance-Intent"));
   if(!intent){deny(res,409);return;}
   String supplied=req.getHeader("X-FiscalStudy-Admin-Token");
   boolean local=InetAddress.getByName(req.getRemoteAddr()).isLoopbackAddress() &&
    Set.of("localhost","127.0.0.1","::1","[::1]").contains(req.getServerName());
   if(!local||adminToken.isBlank()||supplied==null||
    !MessageDigest.isEqual(adminToken.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8))){deny(res,403);return;}
   String scope=req.getMethod()+" "+path+(req.getQueryString()==null?"":"?"+req.getQueryString());
   // Persist only the validated local path, binding method to prevent identity reuse.
   exposures.commitMaintenanceExposure(req.getHeader("X-FiscalStudy-Exposure-Id"),path+"#"+scope);
  } catch(ResponseStatusException refused){deny(res,refused.getStatusCode().value());return;}
    catch(Exception unavailable){deny(res,503);return;}
  String lease;
  try{lease=exposures.beginRead(path+"#"+req.getMethod()+(req.getQueryString()==null?"":"?"+req.getQueryString()));}
  catch(ResponseStatusException conflict){deny(res,conflict.getStatusCode().value());return;}
  catch(RuntimeException failed){deny(res,503);return;}
  boolean completed=false;
  try {
   if(active) {
    try(AutoCloseable ignored=QuestionAccessPolicy.authorizedMaintenanceScope()){chain.doFilter(req,res);}
   }else chain.doFilter(req,res);
   completed=true;
  }catch(IOException|ServletException failed){throw failed;}
   catch(Exception failed){throw new ServletException(failed);}
  finally {
   if(req.isAsyncStarted()) {
    try {
     req.getAsyncContext().addListener(new AsyncListener(){
      public void onComplete(AsyncEvent e){exposures.finishReadConservatively(lease,"COMPLETED");}
      public void onTimeout(AsyncEvent e){exposures.finishReadConservatively(lease,"ABORTED");}
      public void onError(AsyncEvent e){exposures.finishReadConservatively(lease,"ABORTED");}
      public void onStartAsync(AsyncEvent e){e.getAsyncContext().addListener(this);}
     });
    }catch(IllegalStateException uncertain){/* leave OPEN; never infer that an asynchronous body was not exposed */}
   } else exposures.finishReadConservatively(lease,completed?"COMPLETED":"ABORTED");
  }
 }
 private static void deny(HttpServletResponse response,int status)throws IOException {
  response.setStatus(status);response.setContentType("application/json");
  response.getWriter().write("{\"error\":\"QUARANTINE_SOURCE_ACCESS_REFUSED\"}");
 }
}
