package com.fiscalstudy.backend.application;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class AnkiPrivacyPolicyTest {
 @Test void defaultOffMakesNoNetworkCalls()throws Exception{
  var count=new AtomicInteger();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",e->{count.incrementAndGet();e.sendResponseHeaders(200,0);e.close();});server.start();
  try{
   var jdbc=mock(JdbcTemplate.class);var service=new AnkiIntegrationService(jdbc,mock(EventStoreRepository.class),new ObjectMapper());service.setAnkiEndpoint("http://127.0.0.1:"+server.getAddress().getPort());
   assertFalse(service.checkConnection().isConnected());assertFalse(service.triggerAnkiWebSync());assertFalse(service.ensureDeckExists("test"));assertNull(service.sendNoteToAnkiConnect("test","BASIC","f","b",List.of()));service.runAutoSyncScheduled();assertEquals(0,count.get());
  }finally{server.stop(0);}
 }
 @Test void isolationHardGateOverridesPersistedConsent(){
  var jdbc=mock(JdbcTemplate.class);when(jdbc.queryForList("SELECT setting_value FROM system_settings WHERE setting_key = ?",String.class,"ankiIntegration")).thenReturn(List.of("{\"enabled\":true,\"autoSyncEnabled\":true,\"cloudSyncEnabled\":true}"));
  var service=new AnkiIntegrationService(jdbc,mock(EventStoreRepository.class),new ObjectMapper());ReflectionTestUtils.setField(service,"networkAllowed",false);
  assertFalse(service.checkConnection().isConnected());assertFalse(service.triggerAnkiWebSync());assertThrows(IllegalStateException.class,service::syncPendingQueue);
 }
 @Test void strictLocalPreventsCloudEvenWithExplicitCloudToggle(){
  var jdbc=mock(JdbcTemplate.class);when(jdbc.queryForList("SELECT setting_value FROM system_settings WHERE setting_key = ?",String.class,"ankiIntegration")).thenReturn(List.of("{\"enabled\":true,\"cloudSyncEnabled\":true}"));
  when(jdbc.queryForList("SELECT setting_value FROM system_settings WHERE setting_key=?",String.class,"privacidade")).thenReturn(List.of("{\"armazenamentoLocalEstrito\":true}"));
  var service=new AnkiIntegrationService(jdbc,mock(EventStoreRepository.class),new ObjectMapper());assertFalse(service.triggerAnkiWebSync());
 }
}
