# R/baselines.R
# Módulo de Modelos de Referência Simples (Baselines) e Avaliação Comparativa
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Calcula Modelo de Referência 1: Média Histórica Global
#' @param attempts_df data.frame de tentativas com coluna is_correct
#' @return Lista com parâmetros do modelo, predição constante e incerteza
calculate_baseline_historical_mean <- function(attempts_df) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || !"is_correct" %in% names(attempts_df)) {
    return(list(
      model_name = "BASELINE_HISTORICAL_MEAN",
      n_observations = 0L,
      predicted_prob = NA_real_,
      ci_lower = NA_real_,
      ci_upper = NA_real_,
      standard_error = NA_real_,
      predict = function(newdata = NULL) rep(NA_real_, if (is.null(newdata)) 1 else nrow(newdata))
    ))
  }
  
  valid_sub <- attempts_df[!is.na(attempts_df$is_correct), , drop = FALSE]
  n <- if (is.data.frame(valid_sub)) nrow(valid_sub) else length(valid_sub)
  if (is.null(n) || is.na(n) || n == 0) {
    return(list(
      model_name = "BASELINE_HISTORICAL_MEAN",
      n_observations = 0L,
      predicted_prob = NA_real_,
      ci_lower = NA_real_,
      ci_upper = NA_real_,
      standard_error = NA_real_,
      predict = function(newdata = NULL) rep(NA_real_, if (is.null(newdata)) 1 else nrow(newdata))
    ))
  }
  
  k <- sum(valid_sub$is_correct == TRUE)
  p_hat <- k / n
  ci <- calculate_wilson_ci(k, n, 0.95)
  se <- sqrt(p_hat * (1 - p_hat) / n)
  
  pred_val <- round(p_hat, 4)
  
  list(
    model_name = "BASELINE_HISTORICAL_MEAN",
    n_observations = n,
    n_correct = k,
    predicted_prob = pred_val,
    ci_lower = ci["lower"],
    ci_upper = ci["upper"],
    standard_error = round(se, 4),
    predict = function(newdata = NULL) {
      count <- if (is.null(newdata)) 1 else nrow(newdata)
      rep(pred_val, count)
    }
  )
}

#' Calcula Modelo de Referência 2: Média Suavizada por Tópico (Empirical Bayes / Laplace)
#' @param attempts_df data.frame de tentativas com question_id e is_correct
#' @param questions_df data.frame de questões com question_id, disciplina e assunto
#' @param prior_weight Peso do prior na suavização (padrão 2.0)
#' @param uninformative_prior Prior uniforme caso a média global seja indefinida (padrão 0.50)
#' @return Lista contendo tabela de tópicos suavizados e função predict
calculate_baseline_topic_mean <- function(attempts_df, questions_df, prior_weight = 2.0, uninformative_prior = 0.50) {
  hist_model <- calculate_baseline_historical_mean(attempts_df)
  global_prior <- if (!is.na(hist_model$predicted_prob)) hist_model$predicted_prob else uninformative_prior
  
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || is.null(questions_df) || nrow(questions_df) == 0) {
    return(list(
      model_name = "BASELINE_SMOOTHED_TOPIC_MEAN",
      global_prior_used = global_prior,
      prior_weight = prior_weight,
      topic_table = data.frame(),
      predict = function(disciplina, assunto) rep(global_prior, length(disciplina))
    ))
  }
  
  # Cruzamento de tentativas com catálogo
  disc_col <- if ("disciplina" %in% names(questions_df)) "disciplina" else if ("discipline" %in% names(questions_df)) "discipline" else NA
  topic_col <- if ("assunto" %in% names(questions_df)) "assunto" else if ("topico" %in% names(questions_df)) "topico" else NA
  
  if (is.na(disc_col)) {
    return(list(
      model_name = "BASELINE_SMOOTHED_TOPIC_MEAN",
      global_prior_used = global_prior,
      prior_weight = prior_weight,
      topic_table = data.frame(),
      predict = function(disciplina, assunto) rep(global_prior, length(disciplina))
    ))
  }
  
  cols_to_merge <- c("question_id", disc_col, if (!is.na(topic_col)) topic_col else character(0))
  att_sub <- attempts_df[!is.na(attempts_df$is_correct), ]
  cols_to_drop <- intersect(names(att_sub), cols_to_merge[-1])
  if (length(cols_to_drop) > 0) {
    att_sub <- att_sub[, setdiff(names(att_sub), cols_to_drop), drop = FALSE]
  }
  
  merged <- merge(
    att_sub,
    questions_df[, cols_to_merge, drop = FALSE],
    by = "question_id",
    all.x = TRUE
  )
  
  merged$disc_clean <- as.character(merged[[disc_col]])
  merged$disc_clean[is.na(merged$disc_clean) | trimws(merged$disc_clean) == ""] <- "Não Especificada"
  
  merged$topic_clean <- if (!is.na(topic_col)) as.character(merged[[topic_col]]) else rep("Geral", nrow(merged))
  merged$topic_clean[is.na(merged$topic_clean) | trimws(merged$topic_clean) == ""] <- "Geral"
  
  unique_pairs <- unique(merged[, c("disc_clean", "topic_clean")])
  
  topic_rows <- lapply(seq_len(nrow(unique_pairs)), function(i) {
    d <- unique_pairs$disc_clean[i]
    t <- unique_pairs$topic_clean[i]
    sub <- merged[merged$disc_clean == d & merged$topic_clean == t, ]
    n_t <- nrow(sub)
    k_t <- sum(sub$is_correct == TRUE)
    
    # Suavização de Bayes / Laplace: (k + m * p_0) / (n + m)
    smoothed_prob <- (k_t + prior_weight * global_prior) / (n_t + prior_weight)
    
    data.frame(
      disciplina = d,
      assunto = t,
      n_attempts = n_t,
      n_correct = k_t,
      raw_accuracy = if (n_t > 0) round(k_t / n_t, 4) else NA_real_,
      smoothed_prob = round(smoothed_prob, 4),
      stringsAsFactors = FALSE
    )
  })
  
  topic_table <- do.call(rbind, topic_rows)
  
  predict_func <- function(disciplina_vec, assunto_vec = NULL) {
    res <- numeric(length(disciplina_vec))
    for (i in seq_along(disciplina_vec)) {
      d_req <- as.character(disciplina_vec[i])
      t_req <- if (!is.null(assunto_vec) && length(assunto_vec) >= i && !is.na(assunto_vec[i])) as.character(assunto_vec[i]) else "Geral"
      
      match_idx <- which(topic_table$disciplina == d_req & topic_table$assunto == t_req)
      if (length(match_idx) > 0) {
        res[i] <- topic_table$smoothed_prob[match_idx[1]]
      } else {
        # Fallback para disciplina geral ou prior global
        disc_sub <- topic_table[topic_table$disciplina == d_req, ]
        if (nrow(disc_sub) > 0) {
          k_d <- sum(disc_sub$n_correct)
          n_d <- sum(disc_sub$n_attempts)
          res[i] <- round((k_d + prior_weight * global_prior) / (n_d + prior_weight), 4)
        } else {
          res[i] <- round(global_prior, 4)
        }
      }
    }
    res
  }
  
  list(
    model_name = "BASELINE_SMOOTHED_TOPIC_MEAN",
    global_prior_used = global_prior,
    prior_weight = prior_weight,
    topic_table = topic_table,
    predict = predict_func
  )
}

#' Calcula Modelo de Referência 3: Média Móvel de Recência (Moving Average)
#' @param attempts_df data.frame de tentativas com occurred_at e is_correct
#' @param window_size Tamanho da janela móvel de observações (padrão 5)
#' @return Lista contendo histórico de média móvel e valor corrente
calculate_baseline_moving_average <- function(attempts_df, window_size = 5L) {
  if (is.null(attempts_df) || nrow(attempts_df) == 0 || !"is_correct" %in% names(attempts_df)) {
    return(list(
      model_name = "BASELINE_MOVING_AVERAGE",
      window_size = window_size,
      n_observations = 0L,
      current_estimate = NA_real_,
      rolling_series = numeric(0)
    ))
  }
  
  valid_sub <- attempts_df[!is.na(attempts_df$is_correct), , drop = FALSE]
  n <- if (is.data.frame(valid_sub)) nrow(valid_sub) else length(valid_sub)
  if (is.null(n) || is.na(n) || n == 0) {
    return(list(
      model_name = "BASELINE_MOVING_AVERAGE",
      window_size = window_size,
      n_observations = 0L,
      current_estimate = NA_real_,
      rolling_series = numeric(0)
    ))
  }
  
  corr_seq <- as.numeric(valid_sub$is_correct == TRUE)
  rolling_vals <- numeric(n)
  
  for (i in seq_len(n)) {
    start_idx <- max(1L, i - window_size + 1L)
    rolling_vals[i] <- mean(corr_seq[start_idx:i])
  }
  
  curr_est <- round(rolling_vals[n], 4)
  
  list(
    model_name = "BASELINE_MOVING_AVERAGE",
    window_size = window_size,
    n_observations = n,
    current_estimate = curr_est,
    rolling_series = round(rolling_vals, 4)
  )
}

#' Avalia Desempenho Preditivo de um Modelo Contra o Baseline
#' @param y_true Vetor de resultados observados (0 ou 1)
#' @param y_pred_model Vetor de probabilidades preditas pelo modelo avaliado
#' @param y_pred_baseline Vetor de probabilidades preditas pelo baseline de referência
#' @return Lista contendo Brier Scores, Brier Skill Score, Log Loss e salvaguarda amostral
evaluate_model_vs_baseline <- function(y_true, y_pred_model, y_pred_baseline) {
  n <- length(y_true)
  if (n == 0 || length(y_pred_model) != n || length(y_pred_baseline) != n) {
    return(list(
      status = "INVALID_INPUT",
      n_observations = n,
      brier_model = NA_real_,
      brier_baseline = NA_real_,
      brier_skill_score = NA_real_,
      is_superior_to_baseline = FALSE,
      methodological_caution = "Comprimentos vetoriais incompativeis ou vazios."
    ))
  }
  
  # Clipping para cálculo estável de log loss
  eps <- 1e-6
  clip_prob <- function(p) pmin(pmax(p, eps), 1 - eps)
  
  y_num <- as.numeric(y_true == 1 | y_true == TRUE)
  p_m <- clip_prob(as.numeric(y_pred_model))
  p_b <- clip_prob(as.numeric(y_pred_baseline))
  
  # Brier Score (MSE probabilístico)
  bs_model <- mean((p_m - y_num)^2)
  bs_base <- mean((p_b - y_num)^2)
  
  # Brier Skill Score: BSS = 1 - (BS_model / BS_baseline)
  # BSS > 0 indica superação do baseline de referência
  bss <- if (bs_base > 0) 1 - (bs_model / bs_base) else 0
  
  # Log Loss (Cross-Entropy)
  logloss_model <- -mean(y_num * log(p_m) + (1 - y_num) * log(1 - p_m))
  logloss_base  <- -mean(y_num * log(p_b) + (1 - y_num) * log(1 - p_b))
  
  cautions <- c(
    "1. Brier Skill Score (BSS > 0) quantifica o ganho relativo em relacao a probabilidade base historica.",
    "2. Este helper recebe vetores sem desenho de validacao; nao demonstra desempenho fora da amostra.",
    "3. Qualquer modelo complexo deve provar superacao temporal fora da amostra sobre baselines simples."
  )
  if (n < 20) {
    cautions <- c(cautions, sprintf("3. Amostra de avaliacao muito reduzida (N = %d < 20); BSS altamente instavel.", n))
  }
  
  list(
    status = "DESCRIPTIVE_SCORE_ONLY",
    sample_size_status = if (n >= 20) "DESCRIPTIVE_SAMPLE_SIZE_REACHED" else "SMALL_SAMPLE_CAUTION",
    is_out_of_sample = NA,
    can_apply = FALSE,
    n_observations = n,
    brier_model = round(bs_model, 4),
    brier_baseline = round(bs_base, 4),
    brier_skill_score = round(bss, 4),
    logloss_model = round(logloss_model, 4),
    logloss_baseline = round(logloss_base, 4),
    is_superior_to_baseline = (bss > 0),
    methodological_cautions = cautions
  )
}

#' Avalia Pré-Requisitos e Viabilidade Científica de Modelos Avançados (BKT, IRT, FSRS)
#' @param model_family Nome da família: "BKT", "IRT", ou "SPACED_RETENTION"
#' @param n_attempts Quantidade total de tentativas observadas
#' @param n_items Quantidade de itens no banco respondido
#' @param n_students Quantidade de estudantes respondentes (padrão 1, individual)
#' @param has_micro_topics Booleano indicando presença de taxonomia fina de habilidades
#' @param has_spaced_intervals Booleano indicando repetições em intervalos > 14 dias
#' @return Lista estruturada com veredito de viabilidade e barreiras metodológicas
assess_advanced_model_viability <- function(model_family, n_attempts, n_items, n_students = 1L,
                                            has_micro_topics = FALSE, has_spaced_intervals = FALSE) {
  model_fam <- toupper(trimws(as.character(model_family)))
  
  if (model_fam == "BKT") {
    # Bayesian Knowledge Tracing
    # Requisitos: taxonomia granular (KC), N >= 30 tentativas por KC, restrição P(G)+P(S) < 1
    barriers <- character(0)
    if (!has_micro_topics) barriers <- c(barriers, "Ausencia de mapeamento de micro-habilidades (Knowledge Components).")
    if (n_attempts < 30) barriers <- c(barriers, sprintf("Volume global insuficiente (N = %d < 30 exigido por habilidade).", n_attempts))
    barriers <- c(barriers, "Risco critico de degeneracao de parametros e nao-identificabilidade em amostras curtas.")
    
    is_viable <- (length(barriers) == 0)
    return(list(
      model_family = "BKT (Bayesian Knowledge Tracing)",
      is_viable = is_viable,
      verdict = if (is_viable) "VIABLE" else "NOT_VIABLE_USE_BASELINE",
      recommended_baseline = "Média Móvel Suavizada por Tópico (calculate_baseline_topic_mean)",
      barriers = barriers,
      scientific_rationale = "Sem micro-taxonomia e sequencias longas, BKT sofre de identifiability issue, gerando falsos dominios absolutos."
    ))
  }
  
  if (model_fam == "IRT") {
    # Teoria de Resposta ao Item
    barriers <- character(0)
    if (n_students < 200) {
      barriers <- c(barriers, sprintf("Apenas %d estudante(s) analisado(s). Calibrar theta e parametros do item simultaneamente e matematicamente impossivel.", n_students))
      barriers <- c(barriers, "Exige dados historicos externos da banca para fixar a dificuldade (b_i) a priori.")
    }
    
    is_viable <- (length(barriers) == 0)
    return(list(
      model_family = "IRT / TRI (Teoria de Resposta ao Item)",
      is_viable = is_viable,
      verdict = if (is_viable) "VIABLE" else "NOT_VIABLE_USE_BASELINE",
      recommended_baseline = "Acurácia Wilson por Disciplina com Denominador Estrito",
      barriers = barriers,
      scientific_rationale = "Para uso individual inicial, estimar proficiencia e parametros de item simultaneamente gera overfitting total e estimativas espurias."
    ))
  }
  
  if (model_fam == "SPACED_RETENTION") {
    barriers <- character(0)
    if (!has_spaced_intervals) barriers <- c(barriers, "Ausencia de repeticoes com espacamento temporal dilatado (> 14 dias).")
    if (n_attempts < 20) barriers <- c(barriers, sprintf("Poucas observacoes de repeticao (N = %d).", n_attempts))
    
    is_viable <- (length(barriers) == 0)
    return(list(
      model_family = "Modelos Paramétricos de Retenção (FSRS / Curvas de Ebbinghaus)",
      is_viable = is_viable,
      verdict = if (is_viable) "VIABLE" else "NOT_VIABLE_USE_BASELINE",
      recommended_baseline = "Taxas Empíricas por Faixa de Intervalo (calculate_retention_metrics)",
      barriers = barriers,
      scientific_rationale = "Ajustar curvas parametricas sobre memoria recente (< 24h) confunde familiaridade de item com retencao de longo prazo."
    ))
  }
  
  list(
    model_family = model_family,
    is_viable = FALSE,
    verdict = "UNKNOWN_MODEL_FAMILY",
    recommended_baseline = "Média Histórica Global",
    barriers = c("Familia de modelos nao catalogada."),
    scientific_rationale = "Adotar baselines simples ate especificacao formal."
  )
}


#' Avalia baselines por origem temporal expansiva sem vazamento do resultado futuro
#' @param attempts_df Tentativas com event_id unico, occurred_at UTC e is_correct
#' @param initial_training_observations Numero operacional de observacoes anteriores exigidas
#' @param prior_weight Forca de suavizacao topic-level; parametro operacional, nao psicologico
#' @return Backtest temporal descritivo, sempre nao validado e nao executavel
evaluate_baselines_temporally <- function(attempts_df,
                                          initial_training_observations = 10L,
                                          prior_weight = 2.0) {
  empty_predictions <- data.frame(
    event_id = character(0), question_id = character(0), occurred_at = character(0),
    model_name = character(0), predicted_probability = numeric(0),
    observed_correct = integer(0), training_observations = integer(0),
    topic_training_observations = integer(0), item_exposure = character(0),
    prediction_basis = character(0), stringsAsFactors = FALSE
  )
  empty_result <- function(status, input_count = 0L, evaluable_count = 0L, excluded_count = 0L,
                           duplicate_event_ids = 0L) {
    list(
      status = status,
      evaluation_version = "temporal_baseline_backtest_v1",
      evaluation_design = "EXPANDING_WINDOW_STRICTLY_EARLIER_TIMESTAMP_BATCHES",
      input_attempt_count = as.integer(input_count),
      evaluable_attempt_count = as.integer(evaluable_count),
      excluded_attempt_count = as.integer(excluded_count),
      duplicate_event_id_count = as.integer(duplicate_event_ids),
      prediction_count = 0L,
      predictions = empty_predictions,
      metrics = list(),
      is_validated = FALSE,
      is_out_of_sample = FALSE,
      can_apply = FALSE,
      methodological_cautions = c(
        "Backtest de baseline e evidencia descritiva; nao demonstra dominio conceitual, transferencia ou efeito causal.",
        "Tentativas do mesmo estudante/item sao dependentes; contagens nao equivalem a observacoes independentes.",
        "Rotulos curriculares devem ser os registrados no evento; classificacao historica nao e verificada por este helper.",
        "O resultado nunca altera FSRS, agenda de revisao ou plano de estudo."
      )
    )
  }

  if (is.null(attempts_df) || !is.data.frame(attempts_df) || nrow(attempts_df) == 0L) {
    return(empty_result("NO_DATA", if (is.data.frame(attempts_df)) nrow(attempts_df) else 0L))
  }
  if (length(initial_training_observations) != 1L ||
      is.na(initial_training_observations) || !is.finite(initial_training_observations) ||
      initial_training_observations < 1 || initial_training_observations != as.integer(initial_training_observations)) {
    stop("initial_training_observations must be a positive integer.")
  }
  if (length(prior_weight) != 1L || is.na(prior_weight) || !is.finite(prior_weight) || prior_weight < 0) {
    stop("prior_weight must be one finite non-negative value.")
  }

  required <- c("event_id", "occurred_at", "is_correct")
  missing <- setdiff(required, names(attempts_df))
  if (length(missing) > 0L) {
    result <- empty_result("REQUIRED_FIELDS_MISSING", nrow(attempts_df), excluded_count = nrow(attempts_df))
    result$missing_fields <- as.list(missing)
    return(result)
  }

  event_ids <- trimws(as.character(attempts_df$event_id))
  known_ids <- !is.na(event_ids) & nzchar(event_ids)
  duplicate_ids <- sum(known_ids & (duplicated(event_ids) | duplicated(event_ids, fromLast = TRUE)))
  if (duplicate_ids > 0L) {
    return(empty_result("DUPLICATE_EVENT_ID", nrow(attempts_df), duplicate_event_ids = duplicate_ids))
  }

  parse_time <- function(x) {
    if (inherits(x, "POSIXt")) return(as.POSIXct(x, tz = "UTC"))
    x <- as.character(x)
    parsed <- suppressWarnings(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
    needs_offset <- is.na(parsed)
    if (any(needs_offset)) {
      parsed[needs_offset] <- suppressWarnings(as.POSIXct(x[needs_offset],
        format = "%Y-%m-%dT%H:%M:%OS%z", tz = "UTC"))
    }
    needs_space <- is.na(parsed)
    if (any(needs_space)) {
      parsed[needs_space] <- suppressWarnings(as.POSIXct(x[needs_space],
        format = "%Y-%m-%d %H:%M:%OS", tz = "UTC"))
    }
    parsed
  }

  raw_outcome <- toupper(trimws(as.character(attempts_df$is_correct)))
  outcome <- rep(NA_integer_, nrow(attempts_df))
  outcome[raw_outcome %in% c("TRUE", "1")] <- 1L
  outcome[raw_outcome %in% c("FALSE", "0")] <- 0L
  evaluable <- !is.na(outcome) & known_ids

  blocked <- c("ANULADA", "AUSENTE", "SOB_REVISAO")
  for (column in intersect(c("gabarito_status", "correct_option"), names(attempts_df))) {
    evaluable <- evaluable & !toupper(trimws(as.character(attempts_df[[column]]))) %in% blocked
  }
  if ("is_annulled" %in% names(attempts_df)) {
    evaluable <- evaluable & !toupper(trimws(as.character(attempts_df$is_annulled))) %in% c("TRUE", "1")
  }
  event_time <- parse_time(attempts_df$occurred_at)
  evaluable <- evaluable & !is.na(event_time)

  rows <- which(evaluable)
  excluded_count <- nrow(attempts_df) - length(rows)
  if (length(rows) == 0L) {
    return(empty_result("NO_EVALUABLE_TEMPORAL_ATTEMPTS", nrow(attempts_df), 0L, excluded_count))
  }

  data <- attempts_df[rows, , drop = FALSE]
  data$.outcome <- outcome[rows]
  data$.time <- event_time[rows]
  data$.event_id <- event_ids[rows]
  question_col <- intersect(c("question_id", "item_id"), names(data))
  data$.question <- if (length(question_col) > 0L) trimws(as.character(data[[question_col[1]]])) else rep(NA_character_, nrow(data))
  data$.question[is.na(data$.question) | !nzchar(data$.question)] <- NA_character_

  discipline_col <- intersect(c("discipline_at_attempt", "disciplina", "discipline"), names(data))
  topic_col <- intersect(c("topic_at_attempt", "assunto", "topic"), names(data))
  has_topic_labels <- length(discipline_col) > 0L && length(topic_col) > 0L
  if (has_topic_labels) {
    discipline <- trimws(as.character(data[[discipline_col[1]]]))
    topic <- trimws(as.character(data[[topic_col[1]]]))
    topic_ok <- !is.na(discipline) & nzchar(discipline) & !is.na(topic) & nzchar(topic)
    data$.topic_key <- ifelse(topic_ok,
      paste0(nchar(discipline), ":", discipline, nchar(topic), ":", topic), NA_character_)
  } else {
    data$.topic_key <- NA_character_
  }

  order_idx <- order(as.numeric(data$.time), data$.event_id, method = "radix")
  data <- data[order_idx, , drop = FALSE]
  unique_times <- unique(as.numeric(data$.time))
  global_n <- 0L
  global_correct <- 0L
  topic_n <- integer(0)
  topic_correct <- integer(0)
  seen_questions <- character(0)
  prediction_rows <- list()

  for (time_value in unique_times) {
    batch_idx <- which(as.numeric(data$.time) == time_value)
    batch <- data[batch_idx, , drop = FALSE]

    if (global_n >= as.integer(initial_training_observations)) {
      global_probability <- global_correct / global_n
      batch_predictions <- vector("list", nrow(batch) * 2L)
      position <- 1L
      for (i in seq_len(nrow(batch))) {
        qid <- batch$.question[i]
        exposure <- if (is.na(qid)) "ITEM_IDENTITY_UNKNOWN" else if (qid %in% seen_questions) "REPEATED_ITEM" else "FIRST_SEEN_ITEM"

        batch_predictions[[position]] <- data.frame(
          event_id = batch$.event_id[i], question_id = qid,
          occurred_at = format(batch$.time[i], "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"),
          model_name = "GLOBAL_HISTORICAL_MEAN",
          predicted_probability = global_probability, observed_correct = batch$.outcome[i],
          training_observations = global_n, topic_training_observations = 0L,
          item_exposure = exposure, prediction_basis = "GLOBAL_HISTORY",
          stringsAsFactors = FALSE
        )
        position <- position + 1L

        key <- batch$.topic_key[i]
        topic_count <- if (!is.na(key) && key %in% names(topic_n)) unname(topic_n[key]) else 0L
        topic_success <- if (!is.na(key) && key %in% names(topic_correct)) unname(topic_correct[key]) else 0L
        if (!is.na(key) && topic_count > 0L) {
          topic_probability <- if (prior_weight == 0) topic_success / topic_count else
            (topic_success + prior_weight * global_probability) / (topic_count + prior_weight)
          prediction_basis <- "SMOOTHED_TOPIC_HISTORY"
        } else {
          topic_probability <- global_probability
          prediction_basis <- if (is.na(key)) "GLOBAL_FALLBACK_NO_EVENT_TIME_CLASSIFICATION" else "GLOBAL_FALLBACK_UNSEEN_TOPIC"
        }
        batch_predictions[[position]] <- data.frame(
          event_id = batch$.event_id[i], question_id = qid,
          occurred_at = format(batch$.time[i], "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"),
          model_name = "SMOOTHED_TOPIC_MEAN",
          predicted_probability = topic_probability, observed_correct = batch$.outcome[i],
          training_observations = global_n, topic_training_observations = topic_count,
          item_exposure = exposure, prediction_basis = prediction_basis,
          stringsAsFactors = FALSE
        )
        position <- position + 1L
      }
      prediction_rows[[length(prediction_rows) + 1L]] <- do.call(rbind, batch_predictions)
    }

    # Outcomes at the same timestamp enter training only after every prediction in that batch.
    for (i in seq_len(nrow(batch))) {
      global_n <- global_n + 1L
      global_correct <- global_correct + batch$.outcome[i]
      key <- batch$.topic_key[i]
      if (!is.na(key)) {
        if (!(key %in% names(topic_n))) {
          topic_n[key] <- 0L
          topic_correct[key] <- 0L
        }
        topic_n[key] <- topic_n[key] + 1L
        topic_correct[key] <- topic_correct[key] + batch$.outcome[i]
      }
      if (!is.na(batch$.question[i])) seen_questions <- c(seen_questions, batch$.question[i])
    }
  }

  if (length(prediction_rows) == 0L) {
    result <- empty_result("INSUFFICIENT_HISTORY", nrow(attempts_df), length(rows), excluded_count)
    result$training_observations_available <- as.integer(length(rows))
    result$initial_training_observations <- as.integer(initial_training_observations)
    result$classification_metadata_status <- if (has_topic_labels) "EVENT_TIME_COLUMNS_PRESENT_UNVERIFIED" else "MISSING_GLOBAL_ONLY_FALLBACK"
    return(result)
  }

  predictions <- do.call(rbind, prediction_rows)
  rownames(predictions) <- NULL
  score <- function(model_rows) {
    p <- as.numeric(model_rows$predicted_probability)
    y <- as.numeric(model_rows$observed_correct)
    valid <- is.finite(p) & p >= 0 & p <= 1 & !is.na(y)
    if (!any(valid)) return(list(n_observations = 0L, n_unique_questions = 0L, brier_score = NA_real_, log_loss = NA_real_))
    p <- p[valid]
    y <- y[valid]
    q <- model_rows$question_id[valid]
    clipped <- pmin(pmax(p, 1e-15), 1 - 1e-15)
    list(
      n_observations = as.integer(length(y)),
      n_unique_questions = as.integer(length(unique(q[!is.na(q)]))),
      brier_score = mean((p - y)^2),
      log_loss = mean(-(y * log(clipped) + (1 - y) * log1p(-clipped)))
    )
  }
  global_rows <- predictions[predictions$model_name == "GLOBAL_HISTORICAL_MEAN", , drop = FALSE]
  global_score <- score(global_rows)
  metrics <- lapply(unique(predictions$model_name), function(model) {
    model_rows <- predictions[predictions$model_name == model, , drop = FALSE]
    result <- score(model_rows)
    bss <- if (global_score$brier_score > 0 && is.finite(global_score$brier_score))
      1 - result$brier_score / global_score$brier_score else NA_real_
    c(result, list(
      brier_skill_vs_global_baseline = bss,
      comparison_status = "DESCRIPTIVE_ONLY",
      repeated_attempts_may_not_be_independent = TRUE
    ))
  })
  names(metrics) <- unique(predictions$model_name)

  list(
    status = "DESCRIPTIVE_TEMPORAL_BACKTEST",
    evaluation_version = "temporal_baseline_backtest_v1",
    evaluation_design = "EXPANDING_WINDOW_STRICTLY_EARLIER_TIMESTAMP_BATCHES",
    input_attempt_count = as.integer(nrow(attempts_df)),
    evaluable_attempt_count = as.integer(length(rows)),
    excluded_attempt_count = as.integer(excluded_count),
    duplicate_event_id_count = 0L,
    initial_training_observations = as.integer(initial_training_observations),
    training_window = "EXPANDING",
    prediction_count = as.integer(nrow(predictions)),
    unique_test_event_count = as.integer(length(unique(predictions$event_id))),
    unique_test_item_count = as.integer(length(unique(predictions$question_id[!is.na(predictions$question_id)]))),
    classification_metadata_status = if (has_topic_labels) "EVENT_TIME_COLUMNS_PRESENT_UNVERIFIED" else "MISSING_GLOBAL_ONLY_FALLBACK",
    metrics = metrics,
    predictions = predictions,
    is_validated = FALSE,
    is_out_of_sample = TRUE,
    can_apply = FALSE,
    methodological_cautions = c(
      "Predictions use only outcomes with timestamps strictly earlier than the predicted timestamp; equal-timestamp events are held out as one batch.",
      "The rolling-origin scores are descriptive for this history, not a proof of future calibration or learning efficacy.",
      "Repeated attempts from the same student/item are dependent; uncertainty intervals and significance claims are not produced.",
      "First-seen item means only unseen question_id in the recorded history; it is not evidence of conceptual transfer.",
      "Topic predictions use only the topic labels present on each attempt row; historical classification provenance is not validated here.",
      "Baseline prior_weight is a technical smoothing knob, not a psychological trait or latent mastery parameter.",
      "This output cannot schedule FSRS reviews or drive planner decisions."
    )
  )
}
