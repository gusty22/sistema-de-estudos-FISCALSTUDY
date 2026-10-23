# Matriz de Correspondência e Adaptação de Contratos de Integração
# FiscalStudy Analytics

> **Documento:** `docs/INTEGRATION_CONTRACT_MATRIX.md`  
> **Versão:** 1.0.0  
> **Sistemas Envolvidos:** FiscalStudy Operacional (Java 17 / Spring Boot / SQLite) e FiscalStudy Analytics (R 4.5.1 Base)

---

## 1. Contexto e Motivação

O FiscalStudy operacional e o FiscalStudy Analytics foram concebidos com isolamento arquitetural estrito:
1. O backend Java opera sobre SQLite transacional (`db/fiscalstudy.db`), registrando eventos em `event_store` com payloads JSON e catálogo em tabela `questions`.
2. Para consumo analítico independente, o endpoint oficial `GET /api/v1/analytics/export` disponibiliza o arquivo `fiscalstudy_attempts.csv` (formato plano desnormalizado por tentativa).
3. O laboratório analítico em R originalmente especificou em `docs/DATA_CONTRACT_V1.md` uma separação relacional em dois arquivos: `events_v1.csv` e `questions_v1.csv`.

Para garantir interoperabilidade determinística sem alterar silenciosamente nenhum dos sistemas nem introduzir dependências ou acoplamento em tempo de execução, esta matriz formaliza a correspondência entre os esquemas e fundamenta o adaptador `R/adapter.R`.

---

## 2. Matriz De-Para (Mapeamento de Campos)

| Campo Operacional (`fiscalstudy_attempts.csv`) | Tipo Java | Campo Canônico R (`events_v1.csv` / `questions_v1.csv`) | Tipo R | Status | Regra de Mapeamento e Tratamento |
|---|---|---|---|---|---|
| `question_id` | `String` | `question_id` | `character` | Idêntico | Preservado como identificador canônico da questão. |
| `selected_option` | `String` | `selected_option` | `character` | Idêntico | Preservado (`"A"`, `"B"`, `"C"`, `"D"`, `"E"`). |
| `is_correct` | `Boolean / NA` | `is_correct` | `logical` | Condicional | Se `true` -> `TRUE`; se `false` -> `FALSE`; se nulo/`NA` -> mantido estritamente como `NA`. Nunca preencher com falso ou chute fictício. |
| `gabarito_status` | `String` | `correct_option` / metadado | `character` | Especial | `"DEFINITIVO"`, `"PRELIMINAR"` -> avaliável. `"ANULADA"`, `"AUSENTE"`, `"SOB_REVISAO"` -> item não avaliável pedagogicamente. |
| `confidence_level` | `Integer (1..5)` | `confidence_level` | `integer` | Idêntico | Preservado na escala [1, 5]. Fora do intervalo gera `BLOCKING_ERROR`. |
| `active_time_ms` | `Long` | `active_time_ms` | `numeric` | Idêntico | Preservado em milissegundos ativos de tela. |
| `discipline` | `String` | `disciplina` | `character` | Tradução | Mapeamento direto: `discipline` -> `disciplina`. Vazio vira `"Não Especificada"`. |
| `board` | `String` | `banca` | `character` | Tradução | Mapeamento direto: `board` -> `banca`. Vazio vira `"Não Especificada"`. |
| `year` | `Integer` | `ano` | `integer` | Tradução | Mapeamento direto: `year` -> `ano`. |
| *(ausente no CSV)* | N/A | `occurred_at` | `character` | Lacuna | Preservado como `NA_character_`. É terminantemente proibido forjar datas artificiais. Rotinas temporais sinalizam `TEMPORAL_DATA_ABSENT`. |
| *(ausente no CSV)* | N/A | `session_id` | `character` | Lacuna | Mapeado como `"SESSION_DEFAULT"` ou `NA`. |
| *(ausente no CSV)* | N/A | `event_id` | `character` | Derivado | Gerado deterministicamente como `hash` ou índice sequencial `op-attempt-{i}`. |

---

## 3. Distinção Epistêmica: Acurácia Pedagógica vs Pontuação Oficial de Concurso

Uma das principais fontes de confusão em sistemas educacionais para concursos é a mistura entre **aprendizagem real** e **regras formais de pontuação de edital**:

### 3.1 Acurácia Pedagógica (Domínio e Calibração)
- **Denominador ($N_{\text{eval}}$):** Apenas questões com gabarito oficial definitivo ou preliminar verificado (`gabarito_status %in% c("DEFINITIVO", "PRELIMINAR")` e `is_correct != NA`).
- **Numerador ($K_{\text{correct}}$):** Apenas respostas efetivamente corretas segundo o gabarito.
- **Questões Anuladas / Ausentes:** Excluídas do denominador de acurácia, Brier Score e calibração ECE. Atribuir acerto pedagógico a uma questão anulada distorce a metrologia cognitiva do estudante.

### 3.2 Pontuação Oficial de Concurso (Edital)
- Conforme jurisprudência e normas de concursos públicos, questões anuladas pela banca examinadora têm seus pontos atribuídos a todos os candidatos.
- **Cálculo Oficial:** $\text{Pontuação} = K_{\text{corretas}} + N_{\text{anuladas}}$.
- O adaptador calcula ambos os indicadores separadamente, rotulando-os com transparência.

---

## 4. Diretrizes de Governança do Adaptador R

1. **Pureza e Não-Poluição de Dados:** O adaptador nunca cria dados sintéticos para preencher campos ausentes. Se `occurred_at` não está no arquivo de exportação, o perfil analítico registra a ausência e desativa módulos dependentes de séries temporais com a flag explicativa `TEMPORAL_DATA_ABSENT`.
2. **Segregação de Não-Avaliáveis:** Tentativas com gabarito ausente são catalogadas em `non_evaluable_attempts` para auditoria de volume, mas expurgadas dos cálculos de proficiência.
3. **Compatibilidade Bidirecional:** O adaptador permite que o pipeline analítico (`run_analytics.R`) processe tanto o par clássico `events_v1.csv` + `questions_v1.csv` quanto a exportação real unificada `fiscalstudy_attempts.csv`.
4. **Auditoria de Procedência:** Todo arquivo adaptado passa por `verify_data_provenance`. Se não contiver manifesto auditável, é catalogado como `DEMONSTRATION_SAMPLE`, bloqueando conclusões de aprendizagem real.

---

## 5. Auditoria de Procedência da Amostra Operacional V1

O arquivo `data/raw/operational_export_v1.csv` (derivado de `sample_data.csv`) foi auditado em `docs/DATA_PROVENANCE_AUDIT.md`:
- Classificação: **`DEMONSTRATION_SAMPLE`**
- Uso autorizado: Testes de robustez do adaptador e verificação de pipeline em Base R.
- Uso vedado: Afirmação de domínio ou perfil cognitivo do usuário.
- Status do Perfil Real: **`PENDING_AUTHENTICATED_OPERATIONAL_DATA`** (Bloqueado até fornecimento de exportação com carimbo de tempo, sessões e segregação de testes).

