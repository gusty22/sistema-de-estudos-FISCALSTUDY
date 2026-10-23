# tests/test_retention.R
# Testes Unitários de Retenção e Recuperação Ativa

empty_ret <- calculate_retention_metrics(data.frame())
assert_equal(empty_ret$n_total_attempts, 0, "Retencao sobre dataframe vazio retorna 0 tentativas")

evt_df <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
q_df <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
attempts_df <- evt_df[evt_df$event_type == "ANSWER_SUBMITTED", ]

classified <- classify_attempt_history(attempts_df, q_df)

# Na fixture valid_events:
# Sessão 1 (2026-10-10): q001, q002, q003, q004, q005, q006, q007, q008 (8 iniciais)
# Sessão 2 (2026-10-11, 28h depois): q002 (rep 2), q005 (rep 2), q007 (rep 2), q010 (inicial)
# Total de tentativas: 12. Iniciais: 9. Repetidas: 3 (q002, q005, q007).
assert_equal(nrow(classified), 12, "Classificou todas as 12 tentativas")
assert_equal(sum(classified$is_initial_attempt == TRUE), 9, "Identificou 9 tentativas iniciais")
assert_equal(sum(classified$is_initial_attempt == FALSE), 3, "Identificou 3 repeticoes da mesma questao")

# Verificar cálculo de lag para repetidas
rep_rows <- classified[classified$is_initial_attempt == FALSE, ]
assert_true(all(rep_rows$lag_hours_since_prev_attempt > 20), "Intervalo de atraso (lag) calculado corretamente (~28 horas)")

# Verificar métricas de retenção
ret_res <- calculate_retention_metrics(classified)
assert_equal(ret_res$n_repeated_attempts, 3, "Total de 3 repeticoes processadas nas metricas")

# Verificar Matriz de Transição
# q002: Erro na sessao 1 -> Acerto na sessao 2 (Prev_Error -> Curr_Correct)
# q005: Erro na sessao 1 -> Acerto na sessao 2 (Prev_Error -> Curr_Correct)
# q007: Erro na sessao 1 -> Acerto na sessao 2 (Prev_Error -> Curr_Correct)
# Logo, transições observadas: Prev_Error -> Curr_Correct = 3
trans_mat <- ret_res$transition_matrix
assert_equal(trans_mat["Prev_Error", "Curr_Correct"], 3, "Matriz de transicao registrou 3 recuperacoes (Erro -> Acerto)")
assert_equal(trans_mat["Prev_Correct", "Curr_Error"], 0, "Zero esquecimentos observados na amostra (Acerto -> Erro)")

# Cuidados metodológicos explicitados
assert_true(length(ret_res$methodological_cautions) >= 3, "Preserva advertencias metodologicas explicitas")

# --- TESTES DO MODELO EMPÍRICO DE DECAIMENTO E PROJEÇÃO CRÍTICA (TÓPICO 4) ---

# 1. Ajuste em dataframe vazio retorna status de insuficiência
empty_decay <- fit_empirical_decay_model(data.frame())
assert_equal(empty_decay$status, "INSUFFICIENT_EVIDENCE", "Ajuste sobre vazio retorna INSUFFICIENT_EVIDENCE")
assert_equal(empty_decay$n_observations, 0, "Zero observacoes no modelo vazio")

# 2. Ajuste sobre tentativas classificadas
decay_model <- fit_empirical_decay_model(classified)
assert_true(!is.null(decay_model$coefficients$beta_0_intercept), "Coeficiente beta_0 presente")
assert_true(decay_model$coefficients$beta_1_decay < 0, "Taxa de decaimento beta_1 e negativa conforme teoria psicometrica")

# 3. Projeção de ponto crítico de intervenção com limite inferior de Wilson a 95%
# Cenário A: Amostra reduzida (N = 3, 3 acertos). Incerteza ampla força revisão rápida.
proj_small <- project_critical_intervention_point(
  decay_model = decay_model,
  discipline_name = "Auditoria",
  n_attempts = 3L,
  n_correct = 3L,
  current_lag_days = 1.0,
  target_retention = 0.85
)
assert_equal(proj_small$urgency_status, "INSUFFICIENT_EVIDENCE_EXPLORE", "Amostra N < 5 gera status exploratorio imediato")
assert_true(proj_small$critical_intervention_day <= 5, "Limite inferior de Wilson fura meta de 85% rapidamente com N pequeno")

# Cenário B: Matéria Hiper-consolidada (N = 50, 48 acertos, acurácia 96%)
proj_solid <- project_critical_intervention_point(
  decay_model = decay_model,
  discipline_name = "Direito Constitucional",
  n_attempts = 50L,
  n_correct = 48L,
  current_lag_days = 2.0,
  target_retention = 0.85
)
assert_true(proj_solid$critical_intervention_day >= 10, "Materia consolidada sustenta limite de Wilson > 85% por mais de 10 dias")
assert_equal(proj_solid$urgency_status, "STABLE_CONSOLIDATED", "Materia consolidada identificada como STABLE_CONSOLIDATED")

# 4. Cálculo de Pesos Robin Hood
val_res <- list(is_valid = TRUE, has_warnings = FALSE, summary = list(warnings = 0))
mock_profile <- build_learning_profile(attempts_df, q_df, val_res)
rh_weights <- calculate_robin_hood_weights(mock_profile, decay_model)

assert_equal(rh_weights$algorithm, "ROBIN_HOOD_ADAPTIVE_CYCLE_V1", "Algoritmo Robin Hood identificado no artefato")
assert_true(rh_weights$disciplines_count > 0, "Calculou pesos para as disciplinas existentes")
assert_true(!is.null(rh_weights$recommendations$summary_instruction), "Instrucao executiva sumarizada gerada")

# Verificar se a soma dos percentuais distribuídos é aproximadamente 100%
total_share <- sum(sapply(rh_weights$weights, function(x) x$cycle_time_share_percent))
assert_true(abs(total_share - 100) < 1.0, "Distribuicao de tempo do ciclo soma 100% (+- 1%)")

