# tests/test_visualization.R
# Testes Unitários de Geração Gráfica em Base R
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

test_fig_dir <- "output/figures/test"
dir.create(test_fig_dir, showWarnings = FALSE, recursive = TRUE)

evt_df <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
q_df <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
attempts_df <- evt_df[evt_df$event_type == "ANSWER_SUBMITTED", ]

perf_disc <- calculate_performance_by_discipline(attempts_df, q_df)
conf_metrics <- calculate_confidence_metrics(attempts_df)
temp_evolution <- calculate_temporal_evolution(attempts_df)

# 1. plot_accuracy_evolution
assert_equal(plot_accuracy_evolution(NULL), NULL, "plot_accuracy_evolution com NULL retorna NULL")
assert_equal(plot_accuracy_evolution(data.frame()), NULL, "plot_accuracy_evolution com vazio retorna NULL")

fig1 <- file.path(test_fig_dir, "test_acc.png")
plot_accuracy_evolution(temp_evolution, output_path = fig1)
assert_true(file.exists(fig1) && file.info(fig1)$size > 1000, "plot_accuracy_evolution gera arquivo PNG valido")

# 2. plot_response_time_distribution
assert_equal(plot_response_time_distribution(NULL), NULL, "plot_response_time_distribution com NULL retorna NULL")
assert_equal(plot_response_time_distribution(data.frame()), NULL, "plot_response_time_distribution com vazio retorna NULL")

fig2 <- file.path(test_fig_dir, "test_time.png")
plot_response_time_distribution(attempts_df, output_path = fig2)
assert_true(file.exists(fig2) && file.info(fig2)$size > 1000, "plot_response_time_distribution gera arquivo PNG valido")

# 3. plot_calibration_curve
assert_equal(plot_calibration_curve(NULL), NULL, "plot_calibration_curve com NULL retorna NULL")
empty_conf <- list(n_observations = 0, accuracy_by_level = data.frame())
assert_equal(plot_calibration_curve(empty_conf), NULL, "plot_calibration_curve com n_observations=0 retorna NULL")

fig3 <- file.path(test_fig_dir, "test_calib.png")
plot_calibration_curve(conf_metrics, output_path = fig3)
assert_true(file.exists(fig3) && file.info(fig3)$size > 1000, "plot_calibration_curve gera arquivo PNG valido")

# 4. plot_discipline_comparison
assert_equal(plot_discipline_comparison(NULL), NULL, "plot_discipline_comparison com NULL retorna NULL")
assert_equal(plot_discipline_comparison(data.frame()), NULL, "plot_discipline_comparison com vazio retorna NULL")

fig4 <- file.path(test_fig_dir, "test_disc.png")
plot_discipline_comparison(perf_disc, output_path = fig4)
assert_true(file.exists(fig4) && file.info(fig4)$size > 1000, "plot_discipline_comparison gera arquivo PNG valido")

# 5. plot_evidence_volume
assert_equal(plot_evidence_volume(NULL), NULL, "plot_evidence_volume com NULL retorna NULL")
assert_equal(plot_evidence_volume(data.frame()), NULL, "plot_evidence_volume com vazio retorna NULL")

fig5 <- file.path(test_fig_dir, "test_evidence.png")
plot_evidence_volume(perf_disc, output_path = fig5)
assert_true(file.exists(fig5) && file.info(fig5)$size > 1000, "plot_evidence_volume gera arquivo PNG valido")


# Single/constant observations must not make nclass.FD abort the whole pipeline.
singleton_png <- file.path(test_fig_dir, "singleton.png")
plot_response_time_distribution(data.frame(active_time_ms = 12345), singleton_png)
assert_true(file.exists(singleton_png) && file.info(singleton_png)$size > 1000,
            "One attempt produces a valid descriptive time figure")
constant_png <- file.path(test_fig_dir, "constant.png")
plot_response_time_distribution(data.frame(active_time_ms = rep(10000, 3)), constant_png)
assert_true(file.exists(constant_png) && file.info(constant_png)$size > 1000,
            "Constant response times do not trigger an undefined histogram rule")
nonfinite_png <- file.path(test_fig_dir, "nonfinite.png")
assert_equal(plot_response_time_distribution(data.frame(active_time_ms = c(Inf, NA)), nonfinite_png),
             NULL, "Nonfinite times do not form a fabricated distribution")
assert_false(file.exists(nonfinite_png), "No valid times means no figure is manufactured")

# Limpeza de arquivos de teste
unlink(test_fig_dir, recursive = TRUE)
