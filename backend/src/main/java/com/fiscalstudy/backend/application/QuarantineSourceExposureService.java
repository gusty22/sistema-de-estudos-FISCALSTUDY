package com.fiscalstudy.backend.application;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.time.Instant;
/** Unknown source relations never establish clean novelty. Maintenance invalidates every active hold. */
@Service
public class QuarantineSourceExposureService {
 private final JdbcTemplate jdbc; private final TransactionTemplate tx; private final ObjectMapper json=new ObjectMapper();
 public QuarantineSourceExposureService(JdbcTemplate jdbc) {
  this.jdbc=jdbc;tx=new TransactionTemplate(new DataSourceTransactionManager(Objects.requireNonNull(jdbc.getDataSource())));
 }
 public boolean hasActiveHolds(){return jdbc.queryForObject("SELECT COUNT(*) FROM diagnostic_active_reservations",Integer.class)>0;}
 public void commitMaintenanceExposure(String exposureId,String resource) {
  try {if(!UUID.fromString(exposureId).toString().equals(exposureId))throw new IllegalArgumentException();}
  catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Canonical exposure UUID required");}
  if(resource==null||resource.length()>2048||!resource.startsWith("/api/v1/"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  tx.executeWithoutResult(status->{
   var active=jdbc.queryForList("SELECT * FROM diagnostic_active_reservations ORDER BY reservation_id");
   var existing=jdbc.queryForList("SELECT resource_path,reservation_ids_json FROM diagnostic_source_exposures WHERE exposure_id=?",exposureId);
   List<String> ids=active.stream().map(r->String.valueOf(r.get("reservation_id"))).toList();
   if(!existing.isEmpty()) {
    var prior=existing.get(0);
    try {
     var covered=json.readValue(String.valueOf(prior.get("reservation_ids_json")),List.class);
     if(!resource.equals(prior.get("resource_path"))||!covered.containsAll(ids))
      throw new ResponseStatusException(HttpStatus.CONFLICT,"Exposure identity/scope conflict");
    } catch(com.fasterxml.jackson.core.JsonProcessingException bad){throw new IllegalStateException("Invalid exposure history",bad);}
    return;
   }
   String now=Instant.now().toString();
   try {
    jdbc.update("INSERT INTO diagnostic_source_exposures VALUES(?,?,?,?,?,?,?)",
     exposureId,resource,"LOCAL_ADMIN_EXPLICIT_MAINTENANCE",now,json.writeValueAsString(ids),
     "UNMAPPED_SOURCE_COMPROMISE_ALL_ACTIVE","diagnostic-source-exposure-v1");
   } catch(com.fasterxml.jackson.core.JsonProcessingException bad){throw new IllegalStateException(bad);}
   for(var previous:active) {
    // Preserve all original scope/classification fields; append before any body or subprocess access.
    jdbc.update("INSERT INTO diagnostic_reservation_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
     UUID.nameUUIDFromBytes((exposureId+":"+previous.get("reservation_id")).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString(),
     previous.get("reservation_id"),previous.get("question_id"),previous.get("event_id"),"COMPROMISED",
     previous.get("protocol_id"),previous.get("purpose"),now,previous.get("classification_snapshot_json"),
     previous.get("novelty_status"),"UNMAPPED_MAINTENANCE_EXPOSURE:"+exposureId,"diagnostic-quarantine-v1");
   }
  });
 }
 public String beginRead(String resource) {
  if(resource==null||resource.length()>2048||!resource.startsWith("/api/v1/"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  String id=UUID.randomUUID().toString();
  try {
   jdbc.update("INSERT INTO diagnostic_source_read_events VALUES(?,?,?,?,?,?,?,?)",
    id,id,null,resource,"OPEN",Instant.now().toString(),"UNKNOWN_SOURCE_MEMBERSHIP","source-read-v1");
  } catch(org.springframework.dao.DataIntegrityViolationException race) {
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Read conflicts with protected reservation");
  }
  return id;
 }
 public String finishRead(String leaseId,String phase) {
  if(!Set.of("COMPLETED","ABORTED","UNCERTAIN_CLOSED").contains(phase))throw new IllegalArgumentException("Invalid read terminal state");
  return tx.execute(status->{
   var rows=jdbc.queryForList("SELECT * FROM diagnostic_source_read_events WHERE lease_id=? ORDER BY rowid",leaseId);
   if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
   if(rows.size()>1)return String.valueOf(rows.get(rows.size()-1).get("phase")); // first terminal state is immutable
   var root=rows.get(0);
   jdbc.update("INSERT INTO diagnostic_source_read_events VALUES(?,?,?,?,?,?,?,?)",
    UUID.randomUUID().toString(),leaseId,root.get("event_id"),root.get("resource_path"),phase,
    Instant.now().toString(),"UNKNOWN_SOURCE_MEMBERSHIP","source-read-v1");
   return phase;
  });
 }
 public List<Map<String,Object>> openReads(){return jdbc.queryForList("SELECT lease_id,resource_path,occurred_at FROM diagnostic_open_source_reads ORDER BY occurred_at");}
 public void finishReadConservatively(String id,String phase) {
  try{finishRead(id,phase);}
  catch(RuntimeException failed) {
   // Bytes may already have left. Never invent closure: the persisted OPEN row keeps the reservation barrier.
   org.slf4j.LoggerFactory.getLogger(getClass()).warn("Read closure not persisted; lease remains uncertain: {}",id);
  }
 }

}
