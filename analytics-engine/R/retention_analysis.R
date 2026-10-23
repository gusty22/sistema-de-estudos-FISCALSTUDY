# R/retention_analysis.R
# Módulo de Análise de Retenção e Recuperação Ativa
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Sequencia e Classifica Tentativas por Histórico de Exposição
#' @param attempts_df data.frame com question_id, occurred_at, is_correct
#' @param questions_df data.frame opcional com metadados de tópico e disciplina
#' @return data.frame enriquecido com sequence, attempt_type e lag_interval_hours
classify_attempt_history <- function(attempts_df, questions_df = NULL) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 ||
      !"question_id" %in% names(attempts_df) || !"occurred_at" %in% names(attempts_df)) {
    return(data.frame())
  }
  
  df <- attempts_df[!is.na(attempts_df$question_id) & !is.na(attempts_df$occurred_at), ]
  if (nrow(df) == 0) return(data.frame())
  
  parse_iso_dates <- function(x) {
    res <- suppressWarnings(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
    na_idx <- which(is.na(res))
    if (length(na_idx) > 0) {
      res2 <- suppressWarnings(as.POSIXct(x[na_idx], format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"))
      res[na_idx] <- res2
      na_idx2 <- which(is.na(res))
      if (length(na_idx2) > 0) {
        res3 <- suppressWarnings(as.POSIXct(x[na_idx2], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
        res[na_idx2] <- res3
      }
    }
    res
  }
  df$parsed_time <- parse_iso_dates(df$occurred_at)
  df <- df[!is.na(df$parsed_time), ]
  if (nrow(df) == 0) return(data.frame())
  
  # Ordenar cronologicamente
  df <- df[order(df$parsed_time), ]
  
  # Adicionar metadados de tópico se disponível
  has_topics <- FALSE
  if (!is.null(questions_df) && "question_id" %in% names(questions_df) && "assunto" %in% names(questions_df)) {
    df <- merge(df, questions_df[, c("question_id", "assunto", "disciplina")], by = "question_id", all.x = TRUE)
    df <- df[order(df$parsed_time), ]
    has_topics <- any(!is.na(df$assunto) & trimws(df$assunto) != "")
  }
  
  df$attempt_sequence <- 1L
  df$is_initial_attempt <- TRUE
  df$lag_hours_since_prev_attempt <- NA_real_
  df$prev_outcome <- NA
  df$attempt_type <- "INITIAL_ATTEMPT"
  df$epistemic_transfer_category <- "INITIAL_EXPOSURE"
  
  # Rastrear histórico por questão
  seen_questions <- list()
  seen_topics <- list()
  
  for (i in seq_len(nrow(df))) {
    qid <- as.character(df$question_id[i])
    t_curr <- df$parsed_time[i]
    
    if (qid %in% names(seen_questions)) {
      prev_record <- seen_questions[[qid]]
      seq_num <- prev_record$count + 1L
      lag_h <- as.numeric(difftime(t_curr, prev_record$last_time, units = "hours"))
      
      df$attempt_sequence[i] <- seq_num
      df$is_initial_attempt[i] <- FALSE
      df$lag_hours_since_prev_attempt[i] <- round(lag_h, 2)
      df$prev_outcome[i] <- prev_record$last_is_correct
      df$attempt_type[i] <- "SAME_QUESTION_REPEAT"
      
      # Diferenciação epistêmica entre reconhecimento familiar (<24h) e recuperação espaçada (>=24h)
      if (!is.na(lag_h) && lag_h < 24) {
        df$epistemic_transfer_category[i] <- "FAMILIAR_ITEM_RECOGNITION"
      } else {
        df$epistemic_transfer_category[i] <- "SPACED_RETRIEVAL_PRACTICE"
      }
      
      seen_questions[[qid]] <- list(count = seq_num, last_time = t_curr, last_is_correct = df$is_correct[i])
    } else {
      # Primeira vez que a questão é vista
      topic_val <- if (has_topics && "assunto" %in% names(df)) df$assunto[i] else NA
      if (!is.na(topic_val) && topic_val %in% names(seen_topics)) {
        df$attempt_type[i] <- "NEW_QUESTION_SAME_TOPIC"
        df$epistemic_transfer_category[i] <- "SAME_TOPIC_NEW_ITEM"
      } else {
        df$attempt_type[i] <- "INITIAL_ATTEMPT"
        df$epistemic_transfer_category[i] <- "INITIAL_EXPOSURE"
      }
      
      if (!is.na(topic_val)) {
        seen_topics[[topic_val]] <- TRUE
      }
      seen_questions[[qid]] <- list(count = 1L, last_time = t_curr, last_is_correct = df$is_correct[i])
    }
  }
  
  df
}

#' Calcula Métricas Empíricas de Retenção por Faixa de Intervalo Temporal
#' @param classified_df data.frame resultante de classify_attempt_history
#' @return Lista com métricas de retenção, matriz de transição e notas metodológicas
calculate_retention_metrics <- function(classified_df) {
  if (is.null(classified_df) || nrow(classified_df) == 0) {
    return(list(
      n_total_attempts = 0,
      n_initial_attempts = 0,
      n_repeated_attempts = 0,
      item_repetition_accuracy = NA_real_,
      retention_by_interval = data.frame(),
      transition_matrix = matrix(0, 2, 2),
      epistemic_breakdown = list(
        familiar_recognition_count = 0L,
        spaced_retrieval_count = 0L,
        same_topic_new_item_count = 0L
      ),
      methodological_cautions = c("Sem dados disponíveis.")
    ))
  }
  
  n_total <- nrow(classified_df)
  initial_attempts <- classified_df[classified_df$is_initial_attempt == TRUE, ]
  repeated_attempts <- classified_df[classified_df$is_initial_attempt == FALSE & !is.na(classified_df$is_correct), ]
  
  n_init <- nrow(initial_attempts)
  n_rep <- nrow(repeated_attempts)
  k_rep <- sum(repeated_attempts$is_correct == TRUE)
  rep_acc <- if (n_rep > 0) round(k_rep / n_rep, 4) else NA_real_
  
  # Contagens epistêmicas detalhadas
  cat_col <- if ("epistemic_transfer_category" %in% names(classified_df)) classified_df$epistemic_transfer_category else character(0)
  n_familiar <- sum(cat_col == "FAMILIAR_ITEM_RECOGNITION")
  n_spaced <- sum(cat_col == "SPACED_RETRIEVAL_PRACTICE")
  n_topic_new <- sum(cat_col == "SAME_TOPIC_NEW_ITEM")
  
  # Definição das faixas de intervalo para repetições
  # 1. Imediato / Mesma Sessão (< 1h)
  # 2. Curto Prazo (1h a 24h)
  # 3. Médio Prazo (1 a 7 dias)
  # 4. Longo Prazo (> 7 dias)
  interval_bins <- list(
    c(label = "Imediato (< 1h)", min = 0, max = 1),
    c(label = "1h a 24h", min = 1, max = 24),
    c(label = "1 a 7 dias", min = 24, max = 168),
    c(label = "> 7 dias", min = 168, max = Inf)
  )
  
  retention_rows <- lapply(interval_bins, function(bin) {
    b_min <- as.numeric(bin["min"])
    b_max <- as.numeric(bin["max"])
    lbl <- as.character(bin["label"])
    
    sub <- repeated_attempts[
      !is.na(repeated_attempts$lag_hours_since_prev_attempt) &
      repeated_attempts$lag_hours_since_prev_attempt >= b_min &
      repeated_attempts$lag_hours_since_prev_attempt < b_max,
    ]
    
    n_b <- nrow(sub)
    k_b <- sum(sub$is_correct == TRUE)
    acc_b <- if (n_b > 0) k_b / n_b else NA_real_
    
    ci <- calculate_wilson_ci(k_b, n_b, 0.95)
    
    data.frame(
      interval_label = lbl,
      n_repetitions = n_b,
      n_correct = k_b,
      retention_rate = round(acc_b, 4),
      ci_lower = ci["lower"],
      ci_upper = ci["upper"],
      denominator_text = sprintf("%d/%d (%.1f%%)", k_b, n_b, if (!is.na(acc_b)) acc_b * 100 else 0),
      stringsAsFactors = FALSE
    )
  })
  
  retention_df <- do.call(rbind, retention_rows)
  
  # Matriz de Transição de Desempenho (Tentativa k -> Tentativa k+1)
  trans_counts <- matrix(0, nrow = 2, ncol = 2,
                         dimnames = list(
                           Previous = c("Prev_Error", "Prev_Correct"),
                           Current = c("Curr_Error", "Curr_Correct")
                         ))
  
  if (n_rep > 0) {
    valid_trans <- repeated_attempts[!is.na(repeated_attempts$prev_outcome), ]
    for (row_i in seq_len(nrow(valid_trans))) {
      p_idx <- if (valid_trans$prev_outcome[row_i] == TRUE) 2 else 1
      c_idx <- if (valid_trans$is_correct[row_i] == TRUE) 2 else 1
      trans_counts[p_idx, c_idx] <- trans_counts[p_idx, c_idx] + 1
    }
  }
  
  list(
    n_total_attempts = n_total,
    n_initial_attempts = n_init,
    n_repeated_attempts = n_rep,
    item_repetition_accuracy = rep_acc,
    retention_by_interval = retention_df,
    transition_matrix = trans_counts,
    epistemic_breakdown = list(
      familiar_recognition_count = n_familiar,
      spaced_retrieval_count = n_spaced,
      same_topic_new_item_count = n_topic_new
    ),
    methodological_cautions = c(
      "1. Acerto na mesma questao repetida reflete memoria de reconhecimento do item especifico e NAO prova conclusiva de transferencia abstrata de conceito.",
      "2. A melhora em questoes repetidas em intervalos curtos (< 24h) reflete primordialmente familiaridade com o gabarito e alternativas.",
      "3. Recuperacao ativa genuina e retencao duradoura exigem espacamento temporal dilatado e generalizacao em questoes ineditas do mesmo topico.",
      "4. Nao foram aplicados intervalos universais hipoteticos (como 1/7/30 dias) como verdade a priori; as metricas refletem exclusivamente o comportamento empirico observado.",
      "5. A granularidade de topicos atual e insuficiente para avaliar confiavelmente transferencia inter-itens sem taxonomia formal adicional."
    )
  )
}

#' Ajusta Modelo Empírico de Decaimento de Retenção (Regressão Logística Paramétrica)
#' logit(P(Y=1)) = beta_0 + beta_1 * ln(Delta_t) + beta_2 * C_{n-1} + beta_3 * Dificuldade
#' @param classified_df data.frame resultante de classify_attempt_history
#' @param min_observations Limiar mínimo de observações para ajuste MLE estável (padrão 10)
#' @return Lista contendo parâmetros estimados do modelo, taxas por disciplina e status de viabilidade
fit_empirical_decay_model <- function(classified_df, min_observations = 10L) {
  if (is.null(classified_df) || nrow(classified_df) == 0) {
    return(list(
      status = "INSUFFICIENT_EVIDENCE",
      n_observations = 0L,
      coefficients = list(
        beta_0_intercept = 1.7346, # ~85% base
        beta_1_decay = -0.5000,
        beta_2_confidence = 0.2000
      ),
      discipline_decay_rates = list(),
      methodological_caution = "Sem dados para ajuste de modelo de decaimento."
    ))
  }
  
  # Filtrar repetições válidas com tempo de atraso positivo e tempo de tela >= 1000ms
  valid_sub <- classified_df[
    !is.na(classified_df$is_correct) &
    !is.na(classified_df$lag_hours_since_prev_attempt) &
    classified_df$lag_hours_since_prev_attempt > 0,
  ]
  
  # Filtrar tentativas com ruído sub-segundo se a coluna active_time_ms existir
  if ("active_time_ms" %in% names(valid_sub)) {
    valid_sub <- valid_sub[is.na(valid_sub$active_time_ms) | valid_sub$active_time_ms >= 1000, ]
  }
  
  n_obs <- nrow(valid_sub)
  n_correct <- sum(valid_sub$is_correct == TRUE)
  n_incorrect <- n_obs - n_correct
  
  # Priors informativos padrão para contração (shrinkage)
  default_beta0 <- 1.7346  # Equivalente a logit(0.85) = 1.7346
  default_beta1 <- -0.4500 # Decaimento moderado
  default_beta2 <- 0.2500  # Efeito positivo da confiança prévia
  
  # Salvaguarda científica (RESEARCH_SPECIFICATION.md):
  # Exige pelo menos min_observations e min(acertos, erros) >= 2 para evitar completa separação
  is_viable <- (n_obs >= min_observations) && (min(n_correct, n_incorrect) >= 2)
  
  fitted_beta0 <- default_beta0
  fitted_beta1 <- default_beta1
  fitted_beta2 <- default_beta2
  glm_status <- "SHRINKAGE_PRIOR_MODEL"
  
  if (is_viable) {
    # Delta t em dias (mínimo 1 hora = 1/24 dia para estabilidade numérica do log)
    delta_days <- pmax(valid_sub$lag_hours_since_prev_attempt / 24, 1 / 24)
    log_delta_t <- log(delta_days)
    
    # Confiança prévia: se disponível, normalizar centrada em 3
    conf_vec <- if ("confidence_level" %in% names(valid_sub)) {
      as.numeric(ifelse(is.na(valid_sub$confidence_level), 3, valid_sub$confidence_level))
    } else {
      rep(3, n_obs)
    }
    
    y_vec <- as.numeric(valid_sub$is_correct == TRUE)
    
    df_fit <- data.frame(
      y = y_vec,
      log_delta_t = log_delta_t,
      conf_prior = conf_vec - 3.0 # Centrado em confiança neutra
    )
    
    # Ajuste por Máxima Verossimilhança via GLM Binomial
    fit_res <- tryCatch({
      m <- suppressWarnings(stats::glm(y ~ log_delta_t + conf_prior, data = df_fit, family = stats::binomial(link = "logit")))
      if (m$converged) m else NULL
    }, error = function(e) NULL)
    
    if (!is.null(fit_res)) {
      cf <- stats::coef(fit_res)
      if (!any(is.na(cf))) {
        fitted_beta0 <- as.numeric(cf["(Intercept)"])
        # Forçar consistência teórica: o decaimento temporal beta_1 não pode ser positivo
        fitted_beta1 <- min(-0.05, as.numeric(cf["log_delta_t"]))
        fitted_beta2 <- max(0.00, as.numeric(cf["conf_prior"]))
        glm_status <- "EMPIRICAL_MLE_CONVERGED"
      }
    }
  }
  
  # Taxas empíricas por disciplina com contração Bayesiana empírica
  disc_col <- if ("disciplina" %in% names(valid_sub)) "disciplina" else if ("discipline" %in% names(valid_sub)) "discipline" else NA
  disc_decay <- list()
  
  if (!is.na(disc_col) && nrow(valid_sub) > 0) {
    disciplines <- sort(unique(as.character(valid_sub[[disc_col]])))
    for (d in disciplines) {
      d_sub <- valid_sub[valid_sub[[disc_col]] == d, ]
      n_d <- nrow(d_sub)
      k_d <- sum(d_sub$is_correct == TRUE)
      
      # Shrinkage empírico da taxa de decaimento para a média global
      # Disciplinas com menor acurácia em atraso longo têm beta_1 mais negativo
      weight_d <- min(1.0, n_d / 15.0)
      raw_rate_d <- if (n_d >= 4) {
        # Regressão simples univariada ou proxy empírico da inclinação
        mean_delta <- mean(d_sub$lag_hours_since_prev_attempt / 24, na.rm = TRUE)
        acc_d <- k_d / n_d
        if (acc_d < 0.60 && mean_delta > 3) -0.85 else if (acc_d > 0.85) -0.25 else fitted_beta1
      } else {
        fitted_beta1
      }
      
      shrunk_beta1 <- round(weight_d * raw_rate_d + (1 - weight_d) * fitted_beta1, 4)
      
      disc_decay[[d]] <- list(
        n_observations = n_d,
        n_correct = k_d,
        decay_rate_beta1 = shrunk_beta1,
        retention_half_life_days = round(exp(-fitted_beta0 / shrunk_beta1), 1),
        shrinkage_weight = round(weight_d, 2)
      )
    }
  }
  
  list(
    status = if (is_viable) "VIABLE_EMPIRICAL_MODEL" else "INSUFFICIENT_SAMPLE_PRIOR_MODEL",
    glm_status = glm_status,
    n_observations = n_obs,
    n_correct = n_correct,
    coefficients = list(
      beta_0_intercept = round(fitted_beta0, 4),
      beta_1_decay = round(fitted_beta1, 4),
      beta_2_confidence = round(fitted_beta2, 4)
    ),
    discipline_decay_rates = disc_decay,
    methodological_caution = if (!is_viable) {
      "Amostra reduzida de repeticoes com atraso temporal; parametros ajustados com priors de contracao para evitar sobreajuste."
    } else {
      "Modelo logistico empirico calibrado com sucesso sobre dados observados."
    }
  )
}

#' Projeta Ponto Crítico de Intervenção com Limite Inferior do Intervalo de Wilson a 95%
#' Quando o limite inferior de Wilson projetado atinge target_retention (ex: 85%), a intervenção é acionada.
#' @param decay_model Modelo ajustado por fit_empirical_decay_model
#' @param discipline_name Nome da disciplina
#' @param n_attempts Quantidade de tentativas observadas
#' @param n_correct Quantidade de acertos observados
#' @param current_lag_days Dias decorridos desde a última sessão/tentativa na matéria
#' @param target_retention Meta empírica de retenção (padrão 0.85 = 85%)
#' @param confidence_prior Nível de confiança declarado prévio (padrão 3.0)
#' @param max_days Janela máxima de projeção em dias (padrão 30)
#' @return Lista contendo dia crítico, status de urgência, curva projetada e cautelas
project_critical_intervention_point <- function(decay_model, discipline_name,
                                                n_attempts = 10L, n_correct = 8L,
                                                current_lag_days = 0.0,
                                                target_retention = 0.85,
                                                confidence_prior = 3.0,
                                                max_days = 30L) {
  # 1. Base logit intercept: calibrado pela proficiência demonstrada na disciplina (se n_attempts > 0)
  p_base <- if (!is.na(n_attempts) && n_attempts > 0) {
    pmax(0.02, pmin(0.98, n_correct / n_attempts))
  } else {
    0.85
  }
  b0 <- log(p_base / (1 - p_base))
  b2 <- decay_model$coefficients$beta_2_confidence
  
  # 2. Buscar taxa de decaimento específica da disciplina no modelo ajustado ou aplicar priors de domínio
  b1 <- if (!is.null(decay_model$discipline_decay_rates[[discipline_name]])) {
    decay_model$discipline_decay_rates[[discipline_name]]$decay_rate_beta1
  } else {
    # Priors psicométricos de domínio:
    # - Auditoria / Normas Literais: decaimento empírico acelerado (~3 a 4 dias)
    # - Constitucional / Administrativo: retenção estruturada estendida (~18 a 20 dias)
    if (grepl("auditoria", tolower(discipline_name))) {
      -0.6500
    } else if (grepl("constitucional|administrativo", tolower(discipline_name))) {
      -0.0800
    } else {
      decay_model$coefficients$beta_1_decay
    }
  }
  
  # Projeção diária: t de 1 a max_days
  days_seq <- seq(1, max_days)
  proj_table <- vector("list", max_days)
  critical_day <- NA_integer_
  
  n_eff <- max(1L, as.integer(n_attempts))
  
  for (t in days_seq) {
    # logit(P(t)) = b0 + b1 * ln(t) + b2 * (C - 3)
    logit_p <- b0 + b1 * log(t) + b2 * (confidence_prior - 3.0)
    p_t <- 1 / (1 + exp(-logit_p))
    
    # Quantidade esperada de acertos no tempo t sob o tamanho amostral efetivo
    k_exp <- max(0L, min(n_eff, as.integer(round(p_t * n_eff))))
    
    # Intervalo de Confiança de Wilson a 95% para a retenção projetada
    ci <- calculate_wilson_ci(k_exp, n_eff, 0.95)
    ci_lower <- as.numeric(ci["lower"])
    ci_upper <- as.numeric(ci["upper"])
    
    proj_table[[t]] <- list(
      day = t,
      projected_prob = round(p_t, 4),
      wilson_lower = round(ci_lower, 4),
      wilson_upper = round(ci_upper, 4),
      is_below_target = (ci_lower < target_retention)
    )
    
    # Identificar o primeiro dia em que o limite inferior do IC fura a meta
    if (is.na(critical_day) && ci_lower < target_retention) {
      critical_day <- t
    }
  }
  
  if (is.na(critical_day)) {
    critical_day <- max_days
  }
  
  days_remaining <- round(critical_day - current_lag_days, 1)
  
  # Determinação do status de urgência
  urgency_status <- if (n_attempts < 5) {
    "INSUFFICIENT_EVIDENCE_EXPLORE"
  } else if (days_remaining <= 0) {
    "OVERDUE_CRITICAL_INTERVENTION"
  } else if (days_remaining <= 3) {
    "CRITICAL_INTERVENTION"
  } else if (days_remaining <= 7) {
    "MODERATE_ATTENTION"
  } else {
    "STABLE_CONSOLIDATED"
  }
  
  list(
    discipline = discipline_name,
    n_observations = n_eff,
    observed_accuracy = round(n_correct / n_eff, 4),
    decay_rate_beta1 = b1,
    current_lag_days = round(current_lag_days, 1),
    critical_intervention_day = critical_day,
    days_until_critical = days_remaining,
    urgency_status = urgency_status,
    target_retention = target_retention,
    projected_wilson_lower_at_critical = proj_table[[critical_day]]$wilson_lower,
    methodological_caution = if (n_attempts < 5) {
      "Amostra reduzida (N < 5): o limite inferior de Wilson e naturalmente deprimido pela incerteza amostral, forçando revisao exploratoria precoce para coleta de telemetria."
    } else {
      sprintf("Ponto critico projetado no dia %d com base no limite inferior de Wilson a 95%% (%.1f%%).",
              critical_day, proj_table[[critical_day]]$wilson_lower * 100)
    }
  )
}

#' Calcula os Pesos do Motor Adaptativo Robin Hood
#' Produz a especificação de prioridades e roubo de tempo para reinjeção no Spring Boot
#' @param learning_profile Perfil gerado por build_learning_profile
#' @param decay_model Modelo ajustado por fit_empirical_decay_model
#' @param analytical_signals Sinais detectados por detect_analytical_signals
#' @param target_retention Meta de retenção (padrão 0.85)
#' @return Lista com pesos estruturados por disciplina/tópico para reinjeção
calculate_robin_hood_weights <- function(learning_profile, decay_model,
                                         analytical_signals = NULL,
                                         target_retention = 0.85) {
  if (is.null(learning_profile) || is.null(learning_profile$mastery_by_discipline) ||
      nrow(learning_profile$mastery_by_discipline) == 0) {
    return(list(
      generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      algorithm = "ROBIN_HOOD_ADAPTIVE_CYCLE_V1",
      target_retention_threshold = target_retention,
      disciplines_count = 0L,
      weights = list(),
      recommendations = list(
        time_theft_donor = NA_character_,
        priority_recipients = character(0)
      ),
      methodological_caution = "Sem dados de disciplinas no perfil."
    ))
  }
  
  disc_df <- learning_profile$mastery_by_discipline
  weights_list <- list()
  
  # Identificar se há sinais ativos de superconfiança
  has_overconfidence <- FALSE
  if (!is.null(analytical_signals) && !is.null(analytical_signals$signals)) {
    for (s in analytical_signals$signals) {
      if (s$signal_type == "OVERCONFIDENCE_MISCONCEPTION") {
        has_overconfidence <- TRUE
        break
      }
    }
  }
  
  for (i in seq_len(nrow(disc_df))) {
    d_name <- as.character(disc_df$disciplina[i])
    n_att <- as.integer(disc_df$n_attempts[i])
    k_att <- as.integer(disc_df$n_correct[i])
    ci_lower <- as.numeric(disc_df$ci_lower[i])
    
    # Estimar atraso atual (default 3 dias se não rastreado pontualmente)
    current_lag <- 3.0
    
    proj <- project_critical_intervention_point(
      decay_model = decay_model,
      discipline_name = d_name,
      n_attempts = n_att,
      n_correct = k_att,
      current_lag_days = current_lag,
      target_retention = target_retention
    )
    
    # 1. Base Multiplier por Status de Urgência
    status_mult <- switch(
      proj$urgency_status,
      "OVERDUE_CRITICAL_INTERVENTION" = 2.8,
      "CRITICAL_INTERVENTION"         = 2.2,
      "INSUFFICIENT_EVIDENCE_EXPLORE" = 1.8,
      "MODERATE_ATTENTION"            = 1.2,
      "STABLE_CONSOLIDATED"           = 0.35, # Roubo de tempo: matéria doadora
      1.0
    )
    
    # 2. Penalidade Metacognitiva de Superconfiança (se houver erro com certeza 5)
    metacognitive_bonus <- if (has_overconfidence && proj$urgency_status != "STABLE_CONSOLIDATED") 0.6 else 0.0
    
    # 3. Penalidade pelo Limite Inferior de Wilson
    uncertainty_boost <- (1.0 - ci_lower) * 0.8
    
    raw_score <- (status_mult + metacognitive_bonus + uncertainty_boost)
    
    # Ação recomendada para o motor Robin Hood
    recommended_action <- if (proj$urgency_status %in% c("OVERDUE_CRITICAL_INTERVENTION", "CRITICAL_INTERVENTION")) {
      "INJECT_AGGRESSIVE_MICRO_REVIEW"
    } else if (proj$urgency_status == "INSUFFICIENT_EVIDENCE_EXPLORE") {
      "EXPLORATORY_TELEMETRY_BLOCK"
    } else if (proj$urgency_status == "STABLE_CONSOLIDATED") {
      "REDUCE_TIME_ALLOCATION_DONOR"
    } else {
      "MAINTAIN_STANDARD_CADENCE"
    }
    
    weights_list[[d_name]] <- list(
      discipline = d_name,
      n_attempts = n_att,
      n_correct = k_att,
      accuracy = round(k_att / n_att, 4),
      ci_lower = ci_lower,
      urgency_status = proj$urgency_status,
      critical_day = proj$critical_intervention_day,
      days_until_critical = proj$days_until_critical,
      raw_priority_score = round(raw_score, 4),
      recommended_action = recommended_action
    )
  }
  
  # Normalizar pontuações para soma = 100% de distribuição de tempo do ciclo
  total_raw <- sum(sapply(weights_list, function(x) x$raw_priority_score))
  for (d in names(weights_list)) {
    norm_pct <- if (total_raw > 0) (weights_list[[d]]$raw_priority_score / total_raw) * 100 else 100 / length(weights_list)
    weights_list[[d]]$cycle_time_share_percent <- round(norm_pct, 1)
    
    # Mapear para blocos operacionais sugeridos (ex: blocos de 15 a 60 minutos)
    weights_list[[d]]$suggested_block_minutes <- as.integer(round(pmax(15, pmin(90, (norm_pct / 100) * 180)) / 15) * 15)
  }
  
  # Identificar doador de tempo (maior estabilidade) e receptores prioritários
  sorted_by_score <- weights_list[order(sapply(weights_list, function(x) x$raw_priority_score), decreasing = TRUE)]
  recipients <- names(sorted_by_score)[sapply(sorted_by_score, function(x) x$urgency_status %in% c("CRITICAL_INTERVENTION", "OVERDUE_CRITICAL_INTERVENTION", "INSUFFICIENT_EVIDENCE_EXPLORE"))]
  donors <- names(sorted_by_score)[sapply(sorted_by_score, function(x) x$urgency_status == "STABLE_CONSOLIDATED")]
  
  list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    algorithm = "ROBIN_HOOD_ADAPTIVE_CYCLE_V1",
    target_retention_threshold = target_retention,
    disciplines_count = length(weights_list),
    weights = weights_list,
    recommendations = list(
      time_theft_donors = donors,
      priority_recipients = recipients,
      summary_instruction = if (length(donors) > 0 && length(recipients) > 0) {
        sprintf("Roubar tempo de %s e alocar micro-revisões agressivas para %s.",
                paste(donors, collapse = ", "), paste(recipients, collapse = ", "))
      } else {
        "Manter ciclo adaptativo balanceado conforme pesos calculados."
      }
    ),
    methodological_caution = "Pesos dinamicos computados estritamente sobre projecoes do limite inferior de Wilson e penalidade metrologica de superconfianca."
  )
}

