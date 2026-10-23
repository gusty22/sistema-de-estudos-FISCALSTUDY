# tests/test_adapter.R
# Testes Unitários do Adaptador de Contratos Operacionais
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

source("R/adapter.R", local = FALSE)

# 1. Testes de Validação do Arquivo Operacional
val_null <- validate_operational_export(NULL)
assert_false(val_null$is_valid, "validate_operational_export rejeita NULL")
assert_equal(val_null$summary$blocking_errors, 1L, "NULL gera 1 erro bloqueante")

val_empty <- validate_operational_export(data.frame())
assert_false(val_empty$is_valid, "validate_operational_export rejeita dataframe vazio")

# Dataset sem colunas essenciais
bad_cols_df <- data.frame(outro_campo = 1:5)
val_bad_cols <- validate_operational_export(bad_cols_df)
assert_false(val_bad_cols$is_valid, "Rejeita dataset sem colunas obrigatorias da exportacao")
assert_equal(val_bad_cols$issues$rule_code[1], "MISSING_REQUIRED_COLUMNS", "Identificou MISSING_REQUIRED_COLUMNS")

# Dataset com confiança fora de [1, 5]
invalid_conf_df <- data.frame(
  question_id = "1",
  selected_option = "A",
  is_correct = TRUE,
  gabarito_status = "DEFINITIVO",
  confidence_level = 6, # Inválido
  active_time_ms = 15000,
  stringsAsFactors = FALSE
)
val_bad_conf <- validate_operational_export(invalid_conf_df)
assert_false(val_bad_conf$is_valid, "Rejeita confianca fora do dominio [1, 5]")
assert_true("INVALID_CONFIDENCE_RANGE" %in% val_bad_conf$issues$rule_code, "Identificou INVALID_CONFIDENCE_RANGE")

# Dataset com tempo ativo negativo
neg_time_df <- data.frame(
  question_id = "1",
  selected_option = "A",
  is_correct = TRUE,
  gabarito_status = "DEFINITIVO",
  confidence_level = 4,
  active_time_ms = -500, # Inválido
  stringsAsFactors = FALSE
)
val_neg_time <- validate_operational_export(neg_time_df)
assert_false(val_neg_time$is_valid, "Rejeita tempo ativo negativo")
assert_true("NEGATIVE_ACTIVE_TIME" %in% val_neg_time$issues$rule_code, "Identificou NEGATIVE_ACTIVE_TIME")

# 2. Testes de Adaptação sobre Exportação Operacional Real Copiada
op_file <- "data/raw/operational_export_v1.csv"
if (file.exists(op_file)) {
  op_raw <- utils::read.csv(op_file, stringsAsFactors = FALSE)
  val_real <- validate_operational_export(op_raw)
  assert_true(val_real$is_valid, "Exportacao operacional real e estruturalmente valida")
  assert_equal(val_real$summary$blocking_errors, 0L, "Zero erros bloqueantes na exportacao real")
  
  adapted <- adapt_operational_attempts(op_raw)
  assert_equal(adapted$metadata$total_attempts, 20L, "Processou exatamente 20 registros operacionais")
  assert_equal(adapted$metadata$evaluable_attempts, 19L, "Identificou 19 tentativas avaliaveis com gabarito")
  assert_equal(adapted$metadata$non_evaluable_attempts, 1L, "Segregou 1 tentativa nao-aveliavel (q14 gabarito ausente)")
  assert_equal(adapted$metadata$pedagogical_correct, 13L, "Contabilizou 13 acertos pedagogicos")
  assert_equal(adapted$metadata$concurso_official_score, 13L, "Pontuacao de concurso calculada corretamente")
  assert_false(adapted$metadata$temporal_data_present, "Reconhece ausencia de dados temporais sem injetar datas ficticias")
  
  # Verificar normalização de colunas
  att_df <- adapted$attempts_df
  assert_true("disciplina" %in% names(att_df), "Traduziu discipline para disciplina")
  assert_true("banca" %in% names(att_df), "Traduziu board para banca")
  assert_true("ano" %in% names(att_df), "Traduziu year para ano")
  assert_true(all(is.na(att_df$occurred_at)), "Preservou occurred_at como NA transparente")
  
  # Verificar catálogo extraído
  cat_df <- adapted$questions_df
  assert_equal(nrow(cat_df), 20L, "Extraiu catalogo com 20 questoes unicas")
  assert_true("question_id" %in% names(cat_df), "question_id presente no catalogo")
  assert_true("disciplina" %in% names(cat_df), "disciplina presente no catalogo")
}
