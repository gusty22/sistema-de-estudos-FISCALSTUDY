# R/recommendation_evaluation.R
# Módulo de Avaliação Analítica de Recomendações e Intervenções Pedagógicas
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Avalia a Eficácia Observada de Recomendações Pedagógicas (Pré -> Intervenção -> Pós)
#' @param interventions_df data.frame de intervenções
#' @param attempts_df data.frame de tentativas de resolução
#' @param questions_df data.frame do catálogo de questões (opcional)
#' @param min_eval_sample Tamanho amostral mínimo de avaliações posteriores para inferência (padrão 5)
#' @return Lista detalhada com métricas, comparações estratificadas e advertências metodológicas
evaluate_intervention_recommendations <- function(interventions_df, attempts_df = NULL,
                                                 questions_df = NULL, min_eval_sample = 5L) {
  # 1. Tratamento seguro de entrada nula ou vazia
  if (is.null(interventions_df) || nrow(interventions_df) == 0) {
    return(list(
      evaluation_status = "NO_DATA",
      total_interventions = 0L,
      completed_interventions = 0L,
      pending_evaluation_count = 0L,
      evaluated_count = 0L,
      activity_evaluation = data.frame(),
      method_evaluation = data.frame(),
      recovery_rate_by_type = list(
        same_question = list(n = 0L, k = 0L, rate = NA_real_, ci_lower = NA_real_, ci_upper = NA_real_),
        novel_question = list(n = 0L, k = 0L, rate = NA_real_, ci_lower = NA_real_, ci_upper = NA_real_)
      ),
      methodological_cautions = c("Nenhuma intervencao registrada no conjunto de dados.")
    ))
  }
  
  n_total <- nrow(interventions_df)
  pending_count <- sum(interventions_df$post_outcome == "PENDING_EVALUATION" | is.na(interventions_df$post_outcome))
  completed_count <- sum(interventions_df$immediate_outcome %in% c("CORRECT", "COMPLETED"))
  
  # Filtrar apenas intervenções que possuem desfecho posterior avaliado (CORRECT ou INCORRECT)
  evaluated_df <- interventions_df[interventions_df$post_outcome %in% c("CORRECT", "INCORRECT"), ]
  n_eval <- nrow(evaluated_df)
  
  # Salvaguarda científica fundamental: Amostra insuficiente
  if (n_eval < min_eval_sample) {
    # Retornar contagens descritivas acompanhadas explicitamente de INSUFFICIENT_EVIDENCE
    return(list(
      evaluation_status = "INSUFFICIENT_EVIDENCE",
      total_interventions = n_total,
      completed_interventions = completed_count,
      pending_evaluation_count = pending_count,
      evaluated_count = n_eval,
      min_sample_required = min_eval_sample,
      activity_evaluation = data.frame(),
      method_evaluation = data.frame(),
      recovery_rate_by_type = list(
        same_question = list(n = 0L, k = 0L, rate = NA_real_, ci_lower = NA_real_, ci_upper = NA_real_),
        novel_question = list(n = 0L, k = 0L, rate = NA_real_, ci_lower = NA_real_, ci_upper = NA_real_)
      ),
      methodological_cautions = c(
        sprintf("Evidencias quantitativas insuficientes para avaliar recomendacoes (N_avaliadas = %d < %d exigidas).",
                n_eval, min_eval_sample),
        "Nao e possivel declarar superioridade ou eficacia de qualquer estrategia pedagogica com base nesta amostra.",
        "Aguardar acumulacao longitudinal de mais avaliacoes posteriores."
      )
    ))
  }
  
  # 2. Avaliação por Atividade Recomendada
  activities <- sort(unique(as.character(evaluated_df$recommended_activity)))
  act_rows <- lapply(activities, function(act) {
    sub_act <- evaluated_df[evaluated_df$recommended_activity == act, ]
    n_a <- nrow(sub_act)
    k_a <- sum(sub_act$post_outcome == "CORRECT")
    acc_a <- k_a / n_a
    ci_a <- calculate_wilson_ci(k_a, n_a, 0.95)
    
    # Diferenciação entre mesma questão e questão nova do mesmo tópico
    sub_same <- sub_act[sub_act$post_assessment_type == "SAME_QUESTION", ]
    k_same <- sum(sub_same$post_outcome == "CORRECT")
    acc_same <- if (nrow(sub_same) > 0) round(k_same / nrow(sub_same), 4) else NA_real_
    
    sub_novel <- sub_act[sub_act$post_assessment_type %in% c("SAME_TOPIC_NEW_QUESTION", "TRANSFER_ITEM"), ]
    k_novel <- sum(sub_novel$post_outcome == "CORRECT")
    acc_novel <- if (nrow(sub_novel) > 0) round(k_novel / nrow(sub_novel), 4) else NA_real_
    
    mean_lag <- if ("post_assessment_lag_hours" %in% names(sub_act)) {
      mean(as.numeric(sub_act$post_assessment_lag_hours), na.rm = TRUE)
    } else {
      NA_real_
    }
    
    data.frame(
      recommended_activity = act,
      n_evaluated = n_a,
      n_correct = k_a,
      post_accuracy = round(acc_a, 4),
      ci_lower = ci_a["lower"],
      ci_upper = ci_a["upper"],
      same_question_accuracy = acc_same,
      same_question_n = nrow(sub_same),
      novel_question_accuracy = acc_novel,
      novel_question_n = nrow(sub_novel),
      mean_lag_hours = round(mean_lag, 2),
      denominator_text = sprintf("%d/%d (%.1f%%)", k_a, n_a, acc_a * 100),
      stringsAsFactors = FALSE
    )
  })
  act_df <- do.call(rbind, act_rows)
  
  # 3. Avaliação por Método Pedagógico
  methods <- sort(unique(as.character(evaluated_df$method_used)))
  method_rows <- lapply(methods, function(m) {
    sub_m <- evaluated_df[evaluated_df$method_used == m, ]
    n_m <- nrow(sub_m)
    k_m <- sum(sub_m$post_outcome == "CORRECT")
    acc_m <- k_m / n_m
    ci_m <- calculate_wilson_ci(k_m, n_m, 0.95)
    
    mean_time <- mean(as.numeric(sub_m$time_spent_ms), na.rm = TRUE) / 1000.0
    
    data.frame(
      method_used = m,
      n_evaluated = n_m,
      n_correct = k_m,
      post_accuracy = round(acc_m, 4),
      ci_lower = ci_m["lower"],
      ci_upper = ci_m["upper"],
      mean_time_spent_sec = round(mean_time, 1),
      denominator_text = sprintf("%d/%d (%.1f%%)", k_m, n_m, acc_m * 100),
      stringsAsFactors = FALSE
    )
  })
  method_df <- do.call(rbind, method_rows)
  
  # 4. Taxas de Recuperação Estratificadas por Tipo de Teste
  same_all <- evaluated_df[evaluated_df$post_assessment_type == "SAME_QUESTION", ]
  n_same_all <- nrow(same_all)
  k_same_all <- sum(same_all$post_outcome == "CORRECT")
  ci_same_all <- calculate_wilson_ci(k_same_all, n_same_all, 0.95)
  
  novel_all <- evaluated_df[evaluated_df$post_assessment_type %in% c("SAME_TOPIC_NEW_QUESTION", "TRANSFER_ITEM"), ]
  n_novel_all <- nrow(novel_all)
  k_novel_all <- sum(novel_all$post_outcome == "CORRECT")
  ci_novel_all <- calculate_wilson_ci(k_novel_all, n_novel_all, 0.95)
  
  # 5. Advertências e Salvaguardas Metodológicas
  cautions <- c(
    "1. Nao atribuicao automatica de causalidade: ganhos observados pos-intervencao podem refletir regressao a media ou facilidade dos itens testados.",
    "2. Nao declarar que uma estrategia funciona melhor para o usuario com base em uma unica sessao ou pequena amostra.",
    "3. Separacao metrologica estrita: acertos em SAME_QUESTION refletem memorizacao do item especifico; transferencia conceitual exige SAME_TOPIC_NEW_QUESTION.",
    "4. Estimativas acompanhadas de intervalos Wilson a 95% e denominadores estritos."
  )
  
  list(
    evaluation_status = "EVALUATION_COMPLETED",
    total_interventions = n_total,
    completed_interventions = completed_count,
    pending_evaluation_count = pending_count,
    evaluated_count = n_eval,
    min_sample_required = min_eval_sample,
    activity_evaluation = act_df,
    method_evaluation = method_df,
    recovery_rate_by_type = list(
      same_question = list(
        n = n_same_all,
        k = k_same_all,
        rate = if (n_same_all > 0) round(k_same_all / n_same_all, 4) else NA_real_,
        ci_lower = ci_same_all["lower"],
        ci_upper = ci_same_all["upper"],
        denominator_text = sprintf("%d/%d", k_same_all, n_same_all)
      ),
      novel_question = list(
        n = n_novel_all,
        k = k_novel_all,
        rate = if (n_novel_all > 0) round(k_novel_all / n_novel_all, 4) else NA_real_,
        ci_lower = ci_novel_all["lower"],
        ci_upper = ci_novel_all["upper"],
        denominator_text = sprintf("%d/%d", k_novel_all, n_novel_all)
      )
    ),
    methodological_cautions = cautions
  )
}
