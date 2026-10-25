# tests/test_provenance.R
# Testes UnitÃ¡rios de Auditoria de ProcedÃªncia e Salvaguardas EpistÃªmicas
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

suppressPackageStartupMessages({
  source("R/provenance.R")
  source("R/validation.R")
  source("R/adapter.R")
  source("R/learning_profile.R")
  source("R/descriptive_analysis.R")
})

cat("\n--- Executando modulo: tests/test_provenance.R ---\n")

# 1. Auditoria de Entradas Nulas e Vazias
prov_null <- verify_data_provenance(NULL)
assert_equal(prov_null$provenance_type, "UNVERIFIED_SOURCE", "verify_data_provenance rejeita NULL com UNVERIFIED_SOURCE")
assert_false(prov_null$is_proven_operational, "NULL nao e operacional comprovado")
assert_false(prov_null$is_real_student_data, "NULL nao e dado de estudante real")
assert_false(prov_null$can_generate_student_profile, "NULL nao pode gerar perfil de estudante")

prov_empty <- verify_data_provenance(data.frame())
assert_equal(prov_empty$provenance_type, "UNVERIFIED_SOURCE", "verify_data_provenance rejeita dataframe vazio")
assert_false(prov_empty$is_real_student_data, "Dataframe vazio nao e dado real")

# 2. IdentificaÃ§Ã£o de Fixtures SintÃ©ticas
fixture_df <- data.frame(event_id = "evt-1", question_id = "q1", is_correct = TRUE, stringsAsFactors = FALSE)
prov_fix1 <- verify_data_provenance(fixture_df, file_path = "tests/fixtures/valid_events.csv")
assert_equal(prov_fix1$provenance_type, "SYNTHETIC_FIXTURE", "Caminho tests/fixtures/ classificado como SYNTHETIC_FIXTURE")
assert_false(prov_fix1$is_real_student_data, "Fixture sintetica nao e estudante real")
assert_false(prov_fix1$can_generate_student_profile, "Fixture sintetica nao pode gerar perfil real")

prov_fix2 <- verify_data_provenance(fixture_df, declared_provenance = "SYNTHETIC_FIXTURE")
assert_equal(prov_fix2$provenance_type, "SYNTHETIC_FIXTURE", "Declaracao SYNTHETIC_FIXTURE respeitada")

# 3. IdentificaÃ§Ã£o de Amostras Demonstrativas (sample_data.csv / sample_export_v1.csv)
prov_sample_path <- verify_data_provenance(fixture_df, file_path = "data/raw/sample_export_v1.csv")
assert_equal(prov_sample_path$provenance_type, "DEMONSTRATION_SAMPLE", "Arquivo com 'sample' no nome e DEMONSTRATION_SAMPLE")
assert_false(prov_sample_path$is_real_student_data, "Amostra sample nao e historico real")

# 4. Auditoria Estrita da Fixture de 20 QuestÃµes (operational_export_v1.csv / sample_data.csv)
if (file.exists("data/raw/operational_export_v1.csv")) {
  op_raw <- utils::read.csv("data/raw/operational_export_v1.csv", stringsAsFactors = FALSE)
  prov_op_sample <- verify_data_provenance(op_raw, file_path = "data/raw/operational_export_v1.csv")
  assert_equal(prov_op_sample$provenance_type, "DEMONSTRATION_SAMPLE", "operational_export_v1.csv classificado como DEMONSTRATION_SAMPLE")
  assert_false(prov_op_sample$is_real_student_data, "operational_export_v1.csv NAO e estudante real")
  assert_equal(prov_op_sample$audit_verdict, "AMOSTRA_DEMONSTRATIVA_DE_CONTRATO", "Veredito e AMOSTRA_DEMONSTRATIVA_DE_CONTRATO")
  assert_true(length(prov_op_sample$warnings) >= 2, "Avisos de bloqueio epistemico emitidos para a amostra")
}

# 5. Tentativa de Fraude/Erro: Declarar PROVEN_OPERATIONAL sem CustÃ³dia
fraud_df <- data.frame(
  question_id = c("1", "2"),
  selected_option = c("A", "B"),
  is_correct = c(TRUE, FALSE),
  stringsAsFactors = FALSE
)
prov_fraud <- verify_data_provenance(fraud_df, declared_provenance = "PROVEN_OPERATIONAL")
assert_equal(prov_fraud$provenance_type, "UNVERIFIED_SOURCE", "Declaracao operacional falsa e REBAIXADA para UNVERIFIED_SOURCE")
assert_false(prov_fraud$is_proven_operational, "Declaracao falsa nao e aceita como operacional")
assert_false(prov_fraud$is_real_student_data, "Declaracao falsa nao gera dado real de estudante")
assert_equal(prov_fraud$audit_verdict, "REJEITADO_FALTA_DE_CUSTODIA", "Veredito e REJEITADO_FALTA_DE_CUSTODIA")
assert_true(any(grepl("REJEICAO DE PROCEDENCIA", prov_fraud$warnings)), "Alerta explicito de rejeicao gerado")

# 6. Procedencia Operacional Autentica com Manifesto Valido e Verificacao Criptografica Real
legit_df <- data.frame(
  question_id = c("1", "2"),
  selected_option = c("A", "B"),
  is_correct = c(TRUE, FALSE),
  origin_type = c("REAL_STUDY", "REAL_STUDY"),
  session_id = c("sess-01", "sess-01"),
  occurred_at = c("2026-10-12T19:30:00Z", "2026-10-12T19:32:00Z"),
  stringsAsFactors = FALSE
)
tmp_legit_csv <- tempfile(fileext = ".csv")
utils::write.csv(legit_df, tmp_legit_csv, row.names = FALSE)
legit_hash <- tolower(digest::digest(tmp_legit_csv, algo = "sha256", file = TRUE))

manifest_ok <- create_operational_manifest(
  export_timestamp = "2026-10-12T20:00:00Z",
  database_source = "db/fiscalstudy.db:event_store",
  student_id = "user-uuid-1234",
  is_production_environment = TRUE,
  checksum = legit_hash
)
manifest_ok$total_records <- 2L
assert_equal(manifest_ok$manifest_version, "1.0.0", "Manifesto possui versao 1.0.0")
assert_true(manifest_ok$is_production_environment, "Manifesto confirma ambiente de producao")

prov_legit <- verify_data_provenance(legit_df, declared_provenance = "PROVEN_OPERATIONAL", file_path = tmp_legit_csv, manifest = manifest_ok)
assert_equal(prov_legit$provenance_type, "PROVEN_OPERATIONAL", "Dataset com manifesto integro e aprovado como PROVEN_OPERATIONAL")
assert_true(prov_legit$is_proven_operational, "Status e operacional comprovado")
assert_true(prov_legit$is_real_student_data, "Status e dado de estudante real")
assert_true(prov_legit$can_generate_student_profile, "Autorizado a gerar perfil real de estudante")
assert_equal(prov_legit$audit_verdict, "PROCEDENCIA_OPERACIONAL_COMPROVADA", "Veredito e PROCEDENCIA_OPERACIONAL_COMPROVADA")

# 7. Teste de AdaptaÃ§Ã£o com ProcedÃªncia
if (file.exists("data/raw/operational_export_v1.csv")) {
  adapted_test <- adapt_operational_attempts(op_raw, file_path = "data/raw/operational_export_v1.csv")
  assert_equal(adapted_test$metadata$data_provenance, "DEMONSTRATION_SAMPLE", "Adaptador preserva procedencia DEMONSTRATION_SAMPLE")
  assert_false(adapted_test$metadata$is_real_student_data, "Adaptador marca is_real_student_data = FALSE")
  assert_false(adapted_test$metadata$can_generate_student_profile, "Adaptador veda geracao de perfil de estudante")
  assert_true(any(grepl("ALERTA DE PROCEDENCIA", adapted_test$metadata$methodological_cautions)), "Cautela metodologica sobre procedencia incluida")
}

# 8. Teste de Perfil Multidimensional com Amostra Demonstrativa
if (file.exists("data/raw/operational_export_v1.csv")) {
  adapted_df <- adapted_test$evaluable_attempts_df
  profile_test <- build_learning_profile(adapted_df, adapted_test$questions_df)
  assert_equal(profile_test$data_provenance, "DEMONSTRATION_SAMPLE", "Perfil identifica data_provenance como DEMONSTRATION_SAMPLE")
  assert_false(profile_test$is_real_student_profile, "Perfil marca is_real_student_profile = FALSE")
  assert_true(any(grepl("BLOQUEIO EPISTEMICO", profile_test$methodological_cautions)), "Bloqueio epistemico presente nas advertencias do perfil")
}

# 9. Teste da HipÃ³tese ParamÃ©trica de CalibraÃ§Ã£o (Brier e ECE)
calib_test_df <- data.frame(
  is_correct = c(TRUE, FALSE, TRUE, TRUE, FALSE),
  confidence_level = c(5, 5, 4, 3, 2),
  stringsAsFactors = FALSE
)
conf_eval <- calculate_confidence_metrics(calib_test_df)
assert_true(!is.null(conf_eval$conversion_hypothesis), "calculate_confidence_metrics retorna conversion_hypothesis")
assert_equal(conf_eval$conversion_hypothesis$nature, "HIPOTESE_PARAMETRICA_ASSUMIDA", "Natureza da conversao explicitada como hipotese parametrica")
assert_true(any(grepl("HIPOTESE METODOLOGICA", conf_eval$methodological_cautions)), "Cautela sobre hipotese presente nas advertencias")


# 10. Teste de Rejeicao por Inconsistencia de Checksum SHA-256
manifest_mismatch_hash <- create_operational_manifest(
  export_timestamp = "2026-10-12T20:00:00Z",
  database_source = "db/fiscalstudy.db:event_store",
  student_id = "user-uuid-1234",
  is_production_environment = TRUE,
  checksum = "hash_completamente_errado_1234567890abcdef"
)
manifest_mismatch_hash$total_records <- 2L

{
  prov_mismatch_hash <- verify_data_provenance(
    legit_df,
    declared_provenance = "PROVEN_OPERATIONAL",
    file_path = tmp_legit_csv,
    manifest = manifest_mismatch_hash
  )
  assert_equal(prov_mismatch_hash$audit_verdict, "REJEITADO_INCONSISTENCIA_MANIFESTO", "Divergencia de SHA-256 e rejeitada como REJEITADO_INCONSISTENCIA_MANIFESTO")
  assert_false(prov_mismatch_hash$is_proven_operational, "Inconsistencia de hash nao e aceita como operacional")
  assert_false(prov_mismatch_hash$is_real_student_data, "Inconsistencia de hash nao e tratada como dado real")
  assert_true(any(grepl("CHECKSUM_MISMATCH", prov_mismatch_hash$reasons)), "Motivo explicita CHECKSUM_MISMATCH")
}

# 11. Teste de Rejeicao por Inconsistencia de Contagem de Registros
manifest_mismatch_count <- create_operational_manifest(
  export_timestamp = "2026-10-12T20:00:00Z",
  database_source = "db/fiscalstudy.db:event_store",
  student_id = "user-uuid-1234",
  is_production_environment = TRUE
)
manifest_mismatch_count$total_records <- 999L

prov_mismatch_count <- verify_data_provenance(
  legit_df,
  declared_provenance = "PROVEN_OPERATIONAL",
  manifest = manifest_mismatch_count
)
assert_equal(prov_mismatch_count$audit_verdict, "REJEITADO_INCONSISTENCIA_MANIFESTO", "Divergencia de contagem e rejeitada como REJEITADO_INCONSISTENCIA_MANIFESTO")
assert_false(prov_mismatch_count$is_proven_operational, "Inconsistencia de contagem nao e aceita como operacional")
assert_true(any(grepl("RECORD_COUNT_MISMATCH", prov_mismatch_count$reasons)), "Motivo explicita RECORD_COUNT_MISMATCH")

# 12. Teste de Rejeicao de Manifesto Sem Hash Criptografico (checksum ausente ou NA)
manifest_no_hash <- create_operational_manifest(
  export_timestamp = "2026-10-12T20:00:00Z",
  database_source = "db/fiscalstudy.db:event_store",
  student_id = "user-uuid-1234",
  is_production_environment = TRUE,
  checksum = NULL
)
prov_no_hash <- verify_data_provenance(legit_df, declared_provenance = "PROVEN_OPERATIONAL", file_path = tmp_legit_csv, manifest = manifest_no_hash)
assert_equal(prov_no_hash$audit_verdict, "REJEITADO_MANIFESTO_SEM_HASH", "Manifesto sem hash e rejeitado compulsoriamente como REJEITADO_MANIFESTO_SEM_HASH")
assert_false(prov_no_hash$is_proven_operational, "Manifesto sem hash nao e operacional comprovado")
assert_false(prov_no_hash$is_real_student_data, "Manifesto sem hash nao gera dados reais de estudante")

# 13. Teste de Rejeicao quando Nao e Possivel Executar Verificacao Criptografica (arquivo ausente/inacessivel)
prov_no_file <- verify_data_provenance(legit_df, declared_provenance = "PROVEN_OPERATIONAL", file_path = "caminho_inexistente_para_arquivo.csv", manifest = manifest_ok)
assert_equal(prov_no_file$audit_verdict, "REJEITADO_ARQUIVO_INACESSIVEL_PARA_HASH", "Arquivo ausente para hash e rejeitado como REJEITADO_ARQUIVO_INACESSIVEL_PARA_HASH")
assert_false(prov_no_file$is_proven_operational, "Impossibilidade de hash nao pode ser aprovada como operacional")
assert_false(prov_no_file$is_real_student_data, "Arquivo sem verificacao criptografica nao e dado real")

# 14. Teste de Rejeicao de Arquivo Modificado Apos a Geracao do Manifesto
tmp_mod_csv <- tempfile(fileext = ".csv")
utils::write.csv(legit_df, tmp_mod_csv, row.names = FALSE)
# Modificar o arquivo inserindo uma linha extra
cat("999,Z,FALSE,sess-fake,2026-10-12T23:59:59Z
", file = tmp_mod_csv, append = TRUE)
prov_tampered <- verify_data_provenance(legit_df, declared_provenance = "PROVEN_OPERATIONAL", file_path = tmp_mod_csv, manifest = manifest_ok)
assert_equal(prov_tampered$audit_verdict, "REJEITADO_INCONSISTENCIA_MANIFESTO", "Arquivo modificado e rejeitado como REJEITADO_INCONSISTENCIA_MANIFESTO")
assert_false(prov_tampered$is_proven_operational, "Arquivo adulterado nao e operacional")
assert_true(any(grepl("CHECKSUM_MISMATCH", prov_tampered$reasons)), "Arquivo adulterado gera motivo explicito CHECKSUM_MISMATCH")

# A valid checksum proves bytes, not that the answers belong to personal study.
for (origin in c("AUTOMATED_TEST", "DEMO", "UNKNOWN", "", NA_character_)) {
  rejected_df <- legit_df
  rejected_df$origin_type[2] <- origin
  path <- tempfile(fileext = ".csv")
  utils::write.csv(rejected_df, path, row.names = FALSE)
  manifest <- manifest_ok
  manifest$checksum <- digest::digest(path, algo = "sha256", file = TRUE)
  result <- verify_data_provenance(rejected_df, "PROVEN_OPERATIONAL", path, manifest)
  assert_false(result$is_real_student_data, paste("Nonpersonal origin rejected:", origin))
  assert_false(result$can_generate_student_profile, paste("No personal profile for:", origin))
  unlink(path)
}
missing_origin <- legit_df
missing_origin$origin_type <- NULL
path <- tempfile(fileext = ".csv")
utils::write.csv(missing_origin, path, row.names = FALSE)
manifest <- manifest_ok
manifest$checksum <- digest::digest(path, algo = "sha256", file = TRUE)
result <- verify_data_provenance(missing_origin, "PROVEN_OPERATIONAL", path, manifest)
assert_false(result$is_real_student_data, "Missing event origin remains unverified despite matching checksum")
unlink(path)
