# Auditoria de Procedência e Cadeia de Custódia dos Dados
# Projeto: FiscalStudy Analytics (R 4.5.1)

> **Documento:** `docs/DATA_PROVENANCE_AUDIT.md`  
> **Data da Auditoria:** 2026-10-12  
> **Status:** AUDITORIA CONCLUÍDA — SALVAGUARDA EPISTÊMICA ATIVADA  
> **Veredito:** `data/raw/operational_export_v1.csv` é classificado formalmente como `DEMONSTRATION_SAMPLE` (Amostra Demonstrativa de Contrato). Nenhum dado com procedência operacional real comprovada foi fornecido até o momento.

---

## 1. Motivação e Princípio Epistêmico Fundamental

Conforme o item 5 de `AGENTS.md`:
> *"Dados sintéticos são permitidos exclusivamente como fixtures de teste automatizado (armazenados em `tests/fixtures/`). É terminantemente proibido utilizar dados fictícios em análises ou relatórios apresentados como reais. Nunca invente evidências de aprendizagem ou progresso."*

A integridade do laboratório analítico exige que **nenhuma métrica estatística seja atribuída ao perfil real do estudante sem comprovação estrita da cadeia de custódia**. O nome do arquivo, a plausibilidade dos números ou a existência de um endpoint no backend principal não constituem prova de autenticidade empírica.

---

## 2. Investigação Técnica de `sample_data.csv` / `operational_export_v1.csv`

O arquivo `data/raw/operational_export_v1.csv` foi introduzido via cópia de `analytics/sample_data.csv` do repositório principal `sistema de estudos`. A auditoria técnica desse arquivo revelou as seguintes evidências objetivas:

| Elemento Inspecionado | Evidência Observada | Implicação Metrológica |
|---|---|---|
| **1. Nome Original do Arquivo** | `sample_data.csv` | Indica expressamente massa de dados ilustrativa ("amostra"), criada para exemplificar a estrutura tabular. |
| **2. Identificação de Usuário (`student_id` / `user_id`)** | Inexistente no dataset | Não há chave identificando a qual estudante ou conta pertencem os registros. |
| **3. Identificação de Sessão (`session_id`)** | Inexistente no dataset | Não há chave de agrupamento correlacionando as tentativas em uma sessão contínua. |
| **4. Timestamp Temporal (`occurred_at`)** | Inexistente no dataset | Ausência de carimbo de tempo ISO-8601 UTC de quando a resolução ocorreu. |
| **5. Valores de Tempo Ativo (`active_time_ms`)** | Múltiplos redondos de milhares (ex: 45000, 52000, 38000, 31000, 12000, 15000, 14000, 19000...) | Mais de 70% dos valores apresentam arredondamento artificial, característico de massa digitada manualmente para testes de schema. |
| **6. Sequenciamento de Questões** | Blocos didáticos contíguos (q1 a q4, q11 a q14, q16 a q19, etc.) | Padrão escolar de exemplo de prova (todas da banca IBGP, ano 2023). |
| **7. Manifesto ou Assinatura Criptográfica** | Ausente | Não há hash, log transacional ou vínculo rastreável com `db/fiscalstudy.db`. |

### Veredito da Auditoria
As 20 tentativas de `sample_data.csv` **NÃO derivam comprovadamente de eventos operacionais reais do estudante**. Trata-se de uma **amostra demonstrativa de contrato de schema**.

---

## 3. Tipologia Canônica de Procedência de Dados

O FiscalStudy Analytics implementa formalmente 4 níveis de procedência:

```
+-----------------------------------------------------------------------------------+
|                            TIPOS DE PROCEDÊNCIA DE DADOS                          |
+-----------------------------------------------------------------------------------+
| 1. PROVEN_OPERATIONAL   | Dados do banco de produção com manifesto e custódia.    |
|                         | -> ÚNICO que autoriza emissão de perfil real de aluno.  |
+-------------------------+---------------------------------------------------------+
| 2. DEMONSTRATION_SAMPLE | Amostras ilustrativas de formato (ex: sample_data.csv). |
|                         | -> Permitido para teste de schema; VEDADO uso real.     |
+-------------------------+---------------------------------------------------------+
| 3. SYNTHETIC_FIXTURE    | Fixtures controladas em tests/fixtures/.                |
|                         | -> Permitido estritamente para testes automatizados.    |
+-------------------------+---------------------------------------------------------+
| 4. UNVERIFIED_SOURCE    | Fontes sem manifesto auditável. Rebaixadas por padrão.  |
|                         | -> Tratadas com máxima desconfiança; perfil bloqueado.  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Retificação dos Relatórios Anteriores

1. **Acurácia de 68.42% (13/19 acertos):** Pertence exclusivamente à **amostra demonstrativa** (`sample_data.csv`), testando a integridade das funções em Base R. Não reflete proficiência humana.
2. **Superconfiança (3 erros com confiança 5):** Observada na amostra demonstrativa.
3. **Status do Perfil do Estudante:** Formalmente classificado como:
   $$\text{Status} = \mathbf{PENDING\_AUTHENTICATED\_OPERATIONAL\_DATA}$$
   Nenhuma inferência sobre capacidade cognitiva ou domínio de disciplinas foi autorizada.

---

## 5. Registro de Bloqueio da Integração Operacional

A integração com o FiscalStudy operacional permanece no seguinte estado:
- **Bloqueio Ativo:** O endpoint atual de exportação do sistema principal não exporta metadados suficientes (timestamps `occurred_at`, `session_id`, `student_id` e diferenciação formal entre sessões reais de estudo e execuções de teste de integração).
- **Proibição de Imputação:** O FiscalStudy Analytics recusa-se a inventar timestamps sintéticos ou assumir como real qualquer dado sem rastreabilidade.
- **Requisito para Desbloqueio:** O FiscalStudy principal deverá fornecer uma exportação auditada acompanhada de manifesto formal (conforme especificado em `create_operational_manifest`), segregando explicitamente eventos reais de testes.

---

## 6. Salvaguardas Implementadas em Código

- [R/provenance.R](file:///c:/Users/washi/Downloads/fiscalstudy-analytics/R/provenance.R): Função `verify_data_provenance` audita datasets e rebaixa compulsoriamente pretensões sem custódia para `UNVERIFIED_SOURCE` ou `DEMONSTRATION_SAMPLE`.
- [R/adapter.R](file:///c:/Users/washi/Downloads/fiscalstudy-analytics/R/adapter.R): Marca `is_real_student_data = FALSE` e emite alerta epistêmico em `quality_flags`.
- [R/learning_profile.R](file:///c:/Users/washi/Downloads/fiscalstudy-analytics/R/learning_profile.R): Impede que `is_real_student_profile` seja `TRUE` na ausência de procedência comprovada.
- [R/descriptive_analysis.R](file:///c:/Users/washi/Downloads/fiscalstudy-analytics/R/descriptive_analysis.R): Explicita que Brier Score e ECE derivam da hipótese paramétrica $\{1 \to 0.20 \dots 5 \to 0.95\}$ e não de probabilidade contínua observada diretamente.
- [tests/test_provenance.R](file:///c:/Users/washi/Downloads/fiscalstudy-analytics/tests/test_provenance.R): 38 asserções automatizadas garantindo que amostras e fixtures sejam barradas como dados reais.
