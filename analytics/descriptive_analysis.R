# descriptive_analysis.R
# Script de Análise Estatística Descritiva e Calibração para o FiscalStudy (Fase 5)
# Executa exclusivamente com funções de R Base (sem dependências de pacotes externos)

args <- commandArgs(trailingOnly = TRUE)
csv_path <- if (length(args) > 0) args[1] else "analytics/sample_data.csv"

cat("=======================================================================\n")
cat(" FISCALSTUDY — CAMADA ANALÍTICA DETERMINÍSTICA (R BASE)\n")
cat("=======================================================================\n")
cat(sprintf("Arquivo analisado: %s\n", csv_path))

if (!file.exists(csv_path)) {
  cat(sprintf("[AVISO] Arquivo '%s' não encontrado.\n", csv_path))
  quit(status = 1)
}

df <- read.csv(csv_path, stringsAsFactors = FALSE, na.strings = c("NA", "", "null"))

n_total <- nrow(df)
cat(sprintf("Total de registros carregados: %d\n\n", n_total))

if (n_total == 0) {
  cat("[INFO] Dataset vazio. Nenhuma observação registrada.\n")
  quit(status = 0)
}

# 1. FILTRAGEM E PROTEÇÃO DE DADOS
# Questões com gabarito ausente, sob revisão ou com is_correct NA
df_evaluated <- df[!is.na(df$is_correct) & !(df$gabarito_status %in% c("AUSENTE", "SOB_REVISAO")), ]
n_evaluated <- nrow(df_evaluated)
n_excluded <- n_total - n_evaluated

cat("--- 1. ESTATÍSTICA DESCRITIVA GERAL ---\n")
cat(sprintf("Tentativas totais (Atividade):         %d\n", n_total))
cat(sprintf("Tentativas com gabarito verificado:    %d\n", n_evaluated))
cat(sprintf("Itens excluídos (sem gabarito/anul.):   %d\n", n_excluded))

if (n_evaluated == 0) {
  cat("[AVISO] Não há registros com gabarito avaliável para calcular acurácia.\n")
  quit(status = 0)
}

# Converter is_correct para booleano/numérico (1 = acerto, 0 = erro)
df_evaluated$correct_num <- ifelse(df_evaluated$is_correct == TRUE | df_evaluated$is_correct == "true", 1, 0)
accuracy_global <- mean(df_evaluated$correct_num) * 100
cat(sprintf("Acurácia Global:                       %.2f%%\n", accuracy_global))

# Tempo ativo
time_sec <- df_evaluated$active_time_ms / 1000.0
cat(sprintf("Tempo Ativo Médio por Item:            %.2f s (Desvio: %.2f s, Mediana: %.2f s)\n\n",
            mean(time_sec), sd(time_sec), median(time_sec)))

# 2. CALIBRAÇÃO E CONFIANÇA
cat("--- 2. CALIBRAÇÃO: CONFIANÇA vs. DESEMPENHO ---\n")
# Tabela de contingência: Confiança vs Acerto
cont_table <- table(df_evaluated$confidence_level, df_evaluated$correct_num)
colnames(cont_table) <- c("Erro (0)", "Acerto (1)")
cat("Tabela de Contingência (Nível de Confiança x Resultado):\n")
print(cont_table)
cat("\n")

# Acurácia por faixa de confiança
conf_acc <- aggregate(correct_num ~ confidence_level, data = df_evaluated, FUN = function(x) c(count = length(x), acc = mean(x) * 100))
conf_summary <- data.frame(
  Confianca = conf_acc$confidence_level,
  Tentativas = conf_acc$correct_num[, "count"],
  Acuracia_Pct = round(conf_acc$correct_num[, "acc"], 1)
)
cat("Acurácia Empírica por Nível de Confiança Informado:\n")
print(conf_summary, row.names = FALSE)
cat("\n")

# Brier Score Determinístico
# Escala confiança (1 a 5) para probabilidade subjetiva predita (0.2 a 1.0)
predicted_prob <- df_evaluated$confidence_level / 5.0
brier_score <- mean((predicted_prob - df_evaluated$correct_num)^2)
cat(sprintf("Brier Score (Calibração Subjetiva):     %.4f (referência: 0.00 = perfeita, 0.25 = aleatória)\n", brier_score))

# Detecção de Falsa Fluência (Overconfidence) e Hesitação (Underconfidence)
overconfidence <- sum(df_evaluated$confidence_level == 5 & df_evaluated$correct_num == 0)
underconfidence <- sum(df_evaluated$confidence_level <= 2 & df_evaluated$correct_num == 1)
cat(sprintf("Ocorrências de Overconfidence (Conf. 5 e Erro): %d\n", overconfidence))
cat(sprintf("Ocorrências de Underconfidence (Conf. <= 2 e Acerto): %d\n\n", underconfidence))

# 3. ESTRATIFICAÇÃO POR DISCIPLINA
cat("--- 3. ESTRATIFICAÇÃO POR DISCIPLINA ---\n")
disc_agg <- aggregate(cbind(correct_num, time_sec) ~ discipline, data = df_evaluated,
                      FUN = function(x) c(count = length(x), mean = mean(x)))

disc_summary <- data.frame(
  Disciplina = disc_agg$discipline,
  Itens = disc_agg$correct_num[, "count"],
  Acuracia_Pct = round(disc_agg$correct_num[, "mean"] * 100, 1),
  Tempo_Medio_s = round(disc_agg$time_sec[, "mean"], 1)
)
disc_summary <- disc_summary[order(disc_summary$Acuracia_Pct), ]
print(disc_summary, row.names = FALSE)
cat("\n")

# 4. DIAGNÓSTICO E ADVERTÊNCIAS AMOSTRAIS
cat("--- 4. DIAGNÓSTICO E LIMITES AMOSTRAIS ---\n")
if (n_evaluated < 30) {
  cat("[AVISO METODOLÓGICO] Amostra reduzida (N < 30). Os cálculos são puramente descritivos.\n")
  cat("Não devem ser tiradas conclusões definitivas ou treinados modelos psicométricos preditivos.\n")
} else {
  cat("[ESTABILIDADE] Amostra com volume descritivo preliminarmente adequado (N >= 30).\n")
}

if (overconfidence > 0) {
  cat(sprintf("[ALERTA COGNITIVO] Identificadas %d respostas com excesso de confiança e erro.\n", overconfidence))
  cat("Recomenda-se revisão direcionada desses conceitos antes de novos blocos.\n")
}

cat("=======================================================================\n")
cat(" FIM DO RELATÓRIO ANALÍTICO\n")
cat("=======================================================================\n")
