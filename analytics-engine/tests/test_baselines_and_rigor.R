# tests/test_baselines_and_rigor.R
# Testes Unitários de Confiabilidade Matemática, Baselines e Auditoria de Modelos
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

source("R/descriptive_analysis.R", local = FALSE)
source("R/baselines.R", local = FALSE)

# 1. Verificações Matemáticas Independentes de Fórmulas Estatísticas
# 1.1 Wilson Score CI para casos limite
ci_k0_n1 <- calculate_wilson_ci(0, 1, 0.95)
assert_equal(ci_k0_n1["lower"], 0.0, "Wilson CI k=0 n=1: limite inferior e exatamente 0.0")
assert_true(ci_k0_n1["upper"] > 0.70 && ci_k0_n1["upper"] < 0.85, "Wilson CI k=0 n=1: limite superior matematicamente consistente (~0.7935)")

ci_k1_n1 <- calculate_wilson_ci(1, 1, 0.95)
assert_equal(ci_k1_n1["upper"], 1.0, "Wilson CI k=1 n=1: limite superior e exatamente 1.0")
assert_true(ci_k1_n1["lower"] > 0.15 && ci_k1_n1["lower"] < 0.30, "Wilson CI k=1 n=1: limite inferior matematicamente consistente (~0.2065)")

ci_symm <- calculate_wilson_ci(5, 10, 0.95)
assert_true(abs((0.5 - ci_symm["lower"]) - (ci_symm["upper"] - 0.5)) < 1e-4, "Wilson CI k=5 n=10 e perfeitamente simetrico em torno de 0.5")

# 1.2 Brier Score Verificado por Cálculo Manual
# y = c(1, 1, 0, 0), p = c(0.8, 0.9, 0.2, 0.1)
# (0.8-1)^2 = 0.04; (0.9-1)^2 = 0.01; (0.2-0)^2 = 0.04; (0.1-0)^2 = 0.01 -> media = 0.025
test_eval_bs <- evaluate_model_vs_baseline(
  y_true = c(1, 1, 0, 0),
  y_pred_model = c(0.8, 0.9, 0.2, 0.1),
  y_pred_baseline = c(0.5, 0.5, 0.5, 0.5)
)
assert_equal(test_eval_bs$brier_model, 0.0250, "Brier score coincide exatamente com calculo analitico (0.0250)")
assert_equal(test_eval_bs$brier_baseline, 0.2500, "Brier score de baseline coincide com calculo analitico (0.2500)")
# BSS = 1 - (0.025 / 0.250) = 1 - 0.1 = 0.90
assert_equal(test_eval_bs$brier_skill_score, 0.9000, "Brier Skill Score coincide com resolucao exata (0.9000)")
assert_true(test_eval_bs$is_superior_to_baseline, "Identificou superacao do baseline")

# 2. Testes de Modelos de Referência Simples (Baselines)
# 2.1 Baseline Média Histórica
dummy_attempts <- data.frame(
  is_correct = c(TRUE, TRUE, TRUE, FALSE), # 3/4 = 0.75
  stringsAsFactors = FALSE
)
hist_m <- calculate_baseline_historical_mean(dummy_attempts)
assert_equal(hist_m$n_observations, 4L, "Identificou 4 observacoes no baseline historico")
assert_equal(hist_m$n_correct, 3L, "Identificou 3 acertos")
assert_equal(hist_m$predicted_prob, 0.75, "Probabilidade predita e exatamente a media historica 0.75")
assert_equal(hist_m$predict(data.frame(x = 1:3)), c(0.75, 0.75, 0.75), "Funcao predict aplica probabilidade constante")

# 2.2 Baseline Média Suavizada por Tópico (Bayes / Laplace)
dummy_att_disc <- data.frame(
  question_id = c("q1", "q2", "q3"),
  is_correct = c(TRUE, FALSE, TRUE),
  stringsAsFactors = FALSE
)
dummy_quest_disc <- data.frame(
  question_id = c("q1", "q2", "q3"),
  disciplina = c("Direito Tributário", "Direito Tributário", "Língua Portuguesa"),
  assunto = c("IPTU", "IPTU", "Crase"),
  stringsAsFactors = FALSE
)
# Direito Tributário / IPTU: k=1, n=2. Global: 2/3 ≈ 0.6667. Prior weight m=2.
# smoothed = (1 + 2 * 0.6667) / (2 + 2) = (1 + 1.3334) / 4 = 2.3334 / 4 ≈ 0.5834
topic_m <- calculate_baseline_topic_mean(dummy_att_disc, dummy_quest_disc, prior_weight = 2.0)
assert_equal(nrow(topic_m$topic_table), 2L, "Tabela de topicos possui 2 topicos catalogados")
preds_topic <- topic_m$predict(c("Direito Tributário", "Língua Portuguesa"), c("IPTU", "Crase"))
assert_true(preds_topic[1] > 0.50 && preds_topic[1] < 0.65, "Predicao suavizada calculada corretamente")

# 2.3 Baseline Média Móvel (Recency)
dummy_seq <- data.frame(
  is_correct = c(FALSE, FALSE, TRUE, TRUE, TRUE, TRUE), # janela 3
  stringsAsFactors = FALSE
)
ma_m <- calculate_baseline_moving_average(dummy_seq, window_size = 3L)
assert_equal(ma_m$current_estimate, 1.0, "Ultimos 3 itens todos certos -> media movel 1.0")
assert_equal(ma_m$rolling_series[2], 0.0, "Primeiros 2 itens errados -> media movel 0.0")

# 3. Testes de Auditoria de Viabilidade de Modelos Avançados
# 3.1 BKT com amostra pequena deve ser rejeitado com barreira explícita
audit_bkt_small <- assess_advanced_model_viability("BKT", n_attempts = 15, n_items = 10, n_students = 1L)
assert_false(audit_bkt_small$is_viable, "BKT rejeitado com amostra pequena")
assert_equal(audit_bkt_small$verdict, "NOT_VIABLE_USE_BASELINE", "Veredito e NOT_VIABLE_USE_BASELINE")
assert_true(length(audit_bkt_small$barriers) >= 2, "Identificou multiplas barreiras metodologicas no BKT")

# 3.2 IRT com 1 único estudante deve ser categoricamente rejeitado
audit_irt_single <- assess_advanced_model_viability("IRT", n_attempts = 100, n_items = 50, n_students = 1L)
assert_false(audit_irt_single$is_viable, "IRT com 1 estudante rejeitado como matematicamente impossivel")
assert_equal(audit_irt_single$verdict, "NOT_VIABLE_USE_BASELINE", "Veredito de IRT individual e NOT_VIABLE_USE_BASELINE")

# 3.3 Retenção Paramétrica sem intervalos longos deve ser rejeitada
audit_ret_short <- assess_advanced_model_viability("SPACED_RETENTION", n_attempts = 15, n_items = 15, has_spaced_intervals = FALSE)
assert_false(audit_ret_short$is_viable, "Retencao parametrica sem espacamento > 14 dias rejeitada")

# 4. Resiliência a Dados Extremos e Ausentes
assert_equal(calculate_baseline_historical_mean(NULL)$n_observations, 0L, "Baseline historico com NULL retorna 0 observacoes")
assert_equal(calculate_baseline_topic_mean(NULL, NULL)$topic_table, data.frame(), "Baseline topicos com NULL retorna dataframe vazio")
assert_equal(calculate_baseline_moving_average(NULL)$n_observations, 0L, "Media movel com NULL retorna 0 observacoes")


# 5. Backtest temporal prequential: previsão estritamente anterior ao desfecho
assert_equal(test_eval_bs$status, "DESCRIPTIVE_SCORE_ONLY",
             "Comparacao de vetores sem desenho temporal nao se apresenta como validação")
assert_false(test_eval_bs$can_apply,
             "Comparacao descritiva nao pode dirigir o planejador")

temporal_fixture <- data.frame(
  event_id = paste0("evt-", 1:7),
  question_id = c("q-a", "q-b", "q-c", "q-d", "q-e", "q-a", "q-z"),
  occurred_at = c(
    "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", "2026-01-01T12:00:00Z",
    "2026-01-01T13:00:00Z", "2026-01-01T13:00:00Z", "2026-01-01T14:00:00Z",
    "2026-01-01T15:00:00Z"
  ),
  is_correct = c(TRUE, FALSE, TRUE, FALSE, TRUE, FALSE, TRUE),
  gabarito_status = c(rep("DEFINITIVO", 6), "ANULADA"),
  disciplina = rep("Direito Tributario", 7),
  assunto = rep("Topico A", 7),
  stringsAsFactors = FALSE
)
temporal_result <- evaluate_baselines_temporally(
  temporal_fixture, initial_training_observations = 3L, prior_weight = 2
)
assert_equal(temporal_result$status, "DESCRIPTIVE_TEMPORAL_BACKTEST",
             "Backtest temporal gera status descritivo explicitamente nao validado")
assert_true(temporal_result$is_out_of_sample,
            "Cada previsao usa somente eventos anteriores ao seu timestamp")
assert_false(temporal_result$is_validated,
             "Backtest individual nao se autodeclara empiricamente validado")
assert_false(temporal_result$can_apply,
             "Backtest nao comanda revisao FSRS nem plano")
assert_equal(temporal_result$evaluable_attempt_count, 6L,
             "Item anulado e excluido do backtest")
assert_equal(temporal_result$excluded_attempt_count, 1L,
             "Backtest informa tentativa excluida")
pred_e4_global <- temporal_result$predictions[
  temporal_result$predictions$event_id == "evt-4" &
    temporal_result$predictions$model_name == "GLOBAL_HISTORICAL_MEAN", ]
pred_e5_global <- temporal_result$predictions[
  temporal_result$predictions$event_id == "evt-5" &
    temporal_result$predictions$model_name == "GLOBAL_HISTORICAL_MEAN", ]
assert_equal(pred_e4_global$predicted_probability, 2 / 3,
             "Primeira previsao usa somente os tres resultados anteriores")
assert_equal(pred_e5_global$predicted_probability, 2 / 3,
             "Eventos no mesmo timestamp nao vazam resultado entre si")
assert_equal(pred_e4_global$training_observations, 3L,
             "Tamanho do historico preditivo e rastreado")
pred_e6 <- temporal_result$predictions[
  temporal_result$predictions$event_id == "evt-6" &
    temporal_result$predictions$model_name == "GLOBAL_HISTORICAL_MEAN", ]
assert_equal(pred_e6$item_exposure, "REPEATED_ITEM",
             "Questao previamente vista e separada de primeira exposicao")

shuffled_result <- evaluate_baselines_temporally(
  temporal_fixture[rev(seq_len(nrow(temporal_fixture))), ],
  initial_training_observations = 3L, prior_weight = 2
)
key_temporal <- function(x) x[order(x$event_id, x$model_name), c("event_id", "model_name", "predicted_probability")]
assert_equal(key_temporal(shuffled_result$predictions), key_temporal(temporal_result$predictions),
             "Backtest temporal e invariante a ordem de entrada")
future_changed <- temporal_fixture
future_changed$is_correct[4:6] <- c(TRUE, FALSE, TRUE)
future_result <- evaluate_baselines_temporally(
  future_changed, initial_training_observations = 3L, prior_weight = 2
)
future_pred_e4 <- future_result$predictions[
  future_result$predictions$event_id == "evt-4" &
    future_result$predictions$model_name == "GLOBAL_HISTORICAL_MEAN", ]
assert_equal(future_pred_e4$predicted_probability, pred_e4_global$predicted_probability,
             "Resultados futuros nao alteram a previsao ja feita")

duplicate_fixture <- temporal_fixture
duplicate_fixture$event_id[2] <- duplicate_fixture$event_id[1]
duplicate_result <- evaluate_baselines_temporally(duplicate_fixture, initial_training_observations = 3L)
assert_equal(duplicate_result$status, "DUPLICATE_EVENT_ID",
             "Identidade duplicada bloqueia avaliacao temporal")
assert_equal(duplicate_result$prediction_count, 0L,
             "Identidade duplicada nao produz previsoes")
small_temporal <- evaluate_baselines_temporally(temporal_fixture, initial_training_observations = 10L)
assert_equal(small_temporal$status, "INSUFFICIENT_HISTORY",
             "Historico menor que a janela inicial produz estado insuficiente explicito")
