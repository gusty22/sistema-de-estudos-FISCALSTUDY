package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.*;

/** Optional local custody adapter. No key is generated, loaded, or published by default.
 * Trust in the installation/key must be established outside the exported JSON.
 * A signature attests the server snapshot, not honest study or an external timestamp.
 */
@Component
public class ProspectiveExportAttestor {
    private final String keyFile, sourceId;
    public ProspectiveExportAttestor(
            @Value("${fiscalstudy.prospective.signing-key-file:}") String keyFile,
            @Value("${fiscalstudy.prospective.source-id:}") String sourceId) {
        this.keyFile=keyFile; this.sourceId=sourceId;
    }
    public Map<String,Object> attest(Map<String,Object> envelope, String sourceKind) {
        if(keyFile.isBlank()) return envelope;
        if(sourceId.isBlank()) throw new IllegalStateException("Prospective signing requires a source identity");
        try {
            var key=KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Files.readAllBytes(Path.of(keyFile))));
            var statement=new LinkedHashMap<String,Object>();
            statement.put("version","prospective-custody-v1");
            statement.put("sourceId",sourceId); statement.put("sourceKind",sourceKind);
            statement.put("studentId","LOCAL_SINGLE_USER");
            statement.put("inputSha256",envelope.get("inputSha256"));
            statement.put("snapshotRowid",envelope.get("snapshotRowid"));
            statement.put("exportedAt",Instant.now().toString());
            String text=new ObjectMapper().writeValueAsString(statement);
            var signature=Signature.getInstance("SHA256withRSA"); signature.initSign(key);
            signature.update(text.getBytes(StandardCharsets.UTF_8));
            var result=new LinkedHashMap<>(envelope);
            result.put("attestationJson",text);
            result.put("signatureBase64",Base64.getEncoder().encodeToString(signature.sign()));
            return result;
        } catch(Exception failed) {
            throw new IllegalStateException("Prospective custody signing failed",failed);
        }
    }
}
