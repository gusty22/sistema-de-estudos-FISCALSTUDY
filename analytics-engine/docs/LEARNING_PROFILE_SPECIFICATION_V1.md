# Especificação do Perfil Analítico de Aprendizagem (v1)
# FiscalStudy Analytics

> **Documento:** `docs/LEARNING_PROFILE_SPECIFICATION_V1.md`  
> **Versão do Contrato:** 1.0.0  
> **Natureza:** Modelo analítico multidimensional individualizado, fundamentado em evidências empíricas e metrologia educacional.

---

## 1. Princípios Científicos e Diretrizes Anti-Reducionistas

1. **Rejeição do Escore Único de Domínio:**
   - O estudante não possui "uma nota percentual geral" que sintetize sua competência.
   - O perfil é multidimensional, decomposto por disciplina, tópico, fluência temporal, calibração metacognitiva e capacidade de retenção.

2. **Diferenciação Estrita entre Ausência de Evidência e Incompetência:**
   - A ausência de tentativas em uma disciplina ou tópico ($N = 0$) é categorizada como `NO_DATA` ou `INSUFFICIENT_EVIDENCE`.
   - É terminantemente proibido atribuir 0% de acerto ou inferir deficiência pedagógica onde não existem dados observados.

3. **Rejeição Científica de "Estilos de Aprendizagem":**
   - Não se classificam estudantes em "estilos de aprendizagem fixos" (ex: visual, auditivo, cinestésico — hipótese VARK refutada na literatura de ciências cognitivas: Pashler et al., 2008).
   - A aprendizagem é avaliada pelo desempenho efetivo nas tarefas e pela demanda conceitual do conteúdo estudado.

4. **Separação entre Julgamento Subjetivo e Desempenho Observado:**
   - O nível de confiança declarado (1 a 5) reflete uma autoavaliação metacognitiva, não proficiência factual.
   - A interação entre confiança e acerto gera métricas de calibração (ECE, Brier Score, superconfiança e subconfiança).

5. **Incerteza Obrigatória (Wilson Score CI):**
   - Todas as proporções de acerto e retenção são acompanhadas de intervalos de confiança de 95% calculados pelo método de Wilson.
   - Pequenas amostras ($N < 10$) recebem flag explícita de baixa potência (`LOW_SAMPLE_FLAG`).

6. **Não Atribuição de Causalidade:**
   - Melhorias de desempenho entre sessões são variações observadas, não causas atribuíveis sem controle de dificuldade dos itens.

---

## 2. Dimensões do Perfil Multidimensional

O perfil de aprendizagem é estruturado em 7 dimensões analíticas ortogonais:

### Dimensão 1: Domínio Demonstrado por Disciplina e Tópico
- **Métricas:** Taxa de acertos observada ($k/n$), Intervalo de Wilson 95% $[L, U]$, Nível de Evidência (`HIGH` para $n \ge 30$, `MODERATE` para $10 \le n < 30$, `LOW` para $1 \le n < 10$, `NO_DATA` para $n = 0$).
- **Finalidade:** Identificar onde o estudante já acumulou evidências de proficiência e onde o catálogo ainda não foi explorado.

### Dimensão 2: Retenção e Memória Operacional
- **Métricas:** Acurácia em repetições da mesma questão por faixa de atraso temporal ($\Delta t < 1\text{h}$, $1\text{h}-24\text{h}$, $1-7\text{d}$, $> 7\text{d}$), Matriz de Transição de Estados (Erro $\to$ Acerto [recuperação], Acerto $\to$ Acerto [manutenção], Acerto $\to$ Erro [esquecimento], Erro $\to$ Erro [persistência]).
- **Finalidade:** Mapear a durabilidade da retenção sem assumir curvas teóricas a priori.

### Dimensão 3: Fluência e Gestão de Tempo de Resolução
- **Métricas:** Mediana do tempo ativo de resolução em segundos, Intervalo Interquartil (IQR), limites de Tukey ($1.5 \times \text{IQR}$), contagem de tempos anômalos sub-segundo ($< 1000\text{ ms}$) e de abandono ($> 1800\text{ s}$).
- **Finalidade:** Detectar impulsividade (chute rápido), fluência automatizada ou sobrecarga cognitiva/bloqueio.

### Dimensão 4: Metacognição e Calibração da Confiança
- **Métricas:** Brier Score (0 = calibração perfeita, 1 = erro total), ECE (Expected Calibration Error ponderado em 5 faixas), Taxa de Superconfiança Nível 5 (proporção de erros quando o estudante tinha certeza absoluta), Taxa de Subconfiança (acertos em níveis 1 e 2).
- **Finalidade:** Identificar pontos cegos (ilusão de competência) e insegurança infundada.

### Dimensão 5: Frequência e Recorrência de Erros
- **Métricas:** Proporção de erros persistentes (questões erradas consecutivamente), tópicos com maior concentração relativa de falhas, taxa de erro em repetições.
- **Finalidade:** Sinalizar conteúdos que necessitam de intervenção ou revisão dirigida.

### Dimensão 6: Transferência e Histórico de Exposição
- **Métricas:** Proporção de questões inéditas vs repetições, Acurácia em itens inéditos ($k_{\text{inédito}} / n_{\text{inédito}}$) comparada à acurácia em repetições ($k_{\text{repetido}} / n_{\text{repetido}}$).
- **Finalidade:** Diferenciar capacidade genuína de generalização conceitual de mera memorização mecânica de itens específicos.

### Dimensão 7: Integridade e Volume de Evidências
- **Métricas:** Total de tentativas válidas, total de sessões, consistência cronológica, presença de advertências de qualidade.
- **Finalidade:** Fornecer aos módulos a jusante a garantia de que as estimativas têm suporte estatístico suficiente.

---

## 3. Esquema Estruturado de Retorno em R

A função `build_learning_profile(attempts_df, questions_df, validation_result)` retorna uma lista nomeada com a seguinte assinatura canônica:

```r
profile <- list(
  profile_version = "1.0.0",
  generated_at = "2026-10-12T18:00:00Z",
  data_quality = list(
    is_valid = TRUE,
    total_events = 12L,
    valid_attempts = 12L,
    has_blocking_errors = FALSE,
    warnings_count = 0L,
    quality_flags = c("VALID_DATA", "NO_BLOCKING_ERRORS")
  ),
  period = list(
    start = "2026-10-10T10:00:00Z",
    end = "2026-10-12T15:00:00Z",
    total_sessions = 2L
  ),
  mastery_by_discipline = data.frame(...), # disciplina, n_attempts, n_correct, accuracy, ci_lower, ci_upper, evidence_level, denominator_text
  mastery_by_topic = data.frame(...),      # disciplina, assunto, n_attempts, n_correct, accuracy, ci_lower, ci_upper, evidence_level, denominator_text
  retention = list(
    retention_by_interval = data.frame(...),
    transition_matrix = matrix(...),
    repeat_accuracy = ...,
    initial_accuracy = ...,
    transfer_delta = ...
  ),
  fluency = list(
    overall_median_sec = ...,
    overall_iqr_sec = ...,
    sub_second_count = ...,
    tukey_outliers_count = ...
  ),
  metacognition = list(
    brier_score = ...,
    ece = ...,
    overconfidence_level5_rate = ...,
    underconfidence_low_rate = ...,
    accuracy_by_level = data.frame(...)
  ),
  error_patterns = list(
    total_errors = ...,
    recurrent_errors_count = ...,
    recurrent_error_rate = ...,
    persistent_error_questions = c(...)
  ),
  transfer_exposure = list(
    initial_attempts_count = ...,
    repeated_attempts_count = ...,
    novel_vs_repeat_ratio = ...,
    novel_accuracy = ...,
    repeat_accuracy = ...
  ),
  methodological_cautions = c(...)
)
```
