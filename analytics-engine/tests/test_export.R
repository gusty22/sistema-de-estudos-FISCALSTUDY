# tests/test_export.R
# Testes Unitários de Exportação e Contratos de Saída

# 1. Teste de Criação de Registro Individual
rec <- build_metric_record(
  metric_name = "test_metric",
  definition = "Métrica de teste",
  value = 0.85,
  ci_lower = 0.72,
  ci_upper = 0.93,
  n_observations = 50,
  period_start = "2026-10-10T00:00:00Z",
  period_end = "2026-10-10T23:59:59Z",
  limitations = c("Amostra controlada"),
  quality_flags = c("TEST_FLAG")
)

assert_equal(rec$metric_name, "test_metric", "Nome da metrica preservado")
assert_equal(rec$value, 0.85, "Valor da metrica preservado")
assert_equal(rec$n_observations, 50L, "Quantidade de observacoes preservada")

# 2. Teste de Consolidação Completa
evt_df <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
q_df <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
attempts_df <- evt_df[evt_df$event_type == "ANSWER_SUBMITTED", ]

val_res <- validate_events_dataset(evt_df, q_df)
perf_res <- calculate_performance_overall(attempts_df)
time_res <- calculate_time_metrics(attempts_df)
conf_res <- calculate_confidence_metrics(attempts_df)
classified <- classify_attempt_history(attempts_df, q_df)
ret_res <- calculate_retention_metrics(classified)

pkg <- consolidate_analytics_metrics(
  overall_res = perf_res,
  time_res = time_res,
  conf_res = conf_res,
  retention_res = ret_res,
  validation_res = val_res,
  period_start = "2026-10-10T10:00:00Z",
  period_end = "2026-10-11T14:08:00Z"
)

assert_equal(pkg$contract_version, "1.0.0", "Versao do contrato de saida e 1.0.0")
assert_true(pkg$metrics_count >= 6, "Pacote contem pelo menos 6 metricas consolidadas")

# 3. Teste de Exportação para Disco (JSON e CSV)
test_json <- "output/metrics/test_metrics_summary.json"
test_csv <- "output/metrics/test_metrics_summary.csv"

export_metrics_package(pkg, test_json, test_csv)

assert_true(file.exists(test_json), "Arquivo JSON de metricas gerado com sucesso")
assert_true(file.exists(test_csv), "Arquivo CSV de metricas gerado com sucesso")

# Verificar leitura do CSV gerado
read_csv <- utils::read.csv(test_csv, stringsAsFactors = FALSE)
assert_true(nrow(read_csv) >= 6, "CSV gerado contem todas as linhas de metricas")
assert_true("metric_name" %in% names(read_csv), "Coluna metric_name presente no CSV")
assert_true("overall_accuracy" %in% read_csv$metric_name, "overall_accuracy presente no CSV")

# Limpar artefatos temporários de teste
if (file.exists(test_json)) file.remove(test_json)
if (file.exists(test_csv)) file.remove(test_csv)


# Conditional rates carry their own observed denominator and mapping provenance.
conditional <- pkg$metrics[[which(vapply(pkg$metrics,function(m) identical(m$metric_name,"overconfidence_rate_level5"),logical(1)))]]
assert_equal(conditional$n_observations,conf_res$n_level5,"Conditional confidence export uses its subset denominator")
assert_true(conf_res$n_level5<conf_res$n_observations,"Fixture distinguishes subset from total observations")
assert_false(pkg$probability_mapping_validated,"Metric package does not claim subjective probability validation")
assert_equal(pkg$confidence_conversion_hypothesis$nature,"HIPOTESE_PARAMETRICA_ASSUMIDA","Assumed mapping provenance survives export")
brier_record <- pkg$metrics[[which(vapply(pkg$metrics,function(m) identical(m$metric_name,"calibration_brier_score"),logical(1)))]]
assert_true("ORDINAL_MAPPING_UNVALIDATED" %in% unlist(brier_record$quality_flags),"CSV/JSON record exposes unvalidated ordinal mapping")
