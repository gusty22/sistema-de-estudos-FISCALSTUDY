# Teste de verificação de procedência e integridade de contrato
source("C:/Users/washi/Downloads/fiscalstudy-analytics/R/provenance.R")
source("C:/Users/washi/Downloads/fiscalstudy-analytics/R/adapter.R")

csv_path <- "analytics/test_contract_export.csv"
df <- utils::read.csv(csv_path, stringsAsFactors = FALSE)

manifest <- create_operational_manifest(
  export_timestamp = "2026-10-13T00:00:00Z",
  database_source = "db/fiscalstudy.db:event_store",
  student_id = "default_user",
  is_production_environment = TRUE
)

# 1. Teste de Validação Estrutural
val_op <- validate_operational_export(df)
cat("Validação Estrutural:\n")
cat("  - Válido:", val_op$is_valid, "\n")
cat("  - Erros bloqueantes:", val_op$summary$blocking_errors, "\n")
cat("  - Total de linhas:", val_op$summary$total_rows, "\n\n")

# 2. Teste de Auditoria de Procedência como Amostra de Teste (caminho com test_)
audit_fixture <- verify_data_provenance(df, file_path = csv_path)
cat("Auditoria como Fixture Sintética:\n")
cat("  - Tipo de procedência:", audit_fixture$provenance_type, "\n")
cat("  - É dado de estudante real?:", audit_fixture$is_real_student_data, "\n")
cat("  - Veredito:", audit_fixture$audit_verdict, "\n\n")

# 3. Teste de Auditoria de Procedência com Pretensão Operacional e Manifesto
# Simulando caminho operacional de produção
audit_op <- verify_data_provenance(df, declared_provenance = "PROVEN_OPERATIONAL", file_path = "data/raw/fiscalstudy_attempts.csv", manifest = manifest)
cat("Auditoria com Manifesto Válido:\n")
cat("  - Tipo de procedência:", audit_op$provenance_type, "\n")
cat("  - Operacional comprovado?:", audit_op$is_proven_operational, "\n")
cat("  - É dado de estudante real?:", audit_op$is_real_student_data, "\n")
cat("  - Pode gerar perfil?:", audit_op$can_generate_student_profile, "\n")
cat("  - Veredito:", audit_op$audit_verdict, "\n")
