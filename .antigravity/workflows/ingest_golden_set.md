---
trigger: "user_message_contains: /ingest_golden_set"
---

# Workflow: Ingestão do Golden Set

Este é um workflow de automação do Antigravity. Quando o usuário digitar `/ingest_golden_set`, você (o agente) deve executar as seguintes etapas, na ordem descrita:

## Passo 1: Execução do Parser
- Lembre-se de verificar se o Spring Boot está rodando (via Maven em background) ANTES de executar o pipeline Python.
- Invoque a skill `golden_set_parser` (leia-a se necessário).
- Utilize a ferramenta de execução de comando no terminal (`run_command`) para executar o extrator (comando: `cd ingestion && venv\Scripts\python.exe -m src.parser.main && cd ..`).

## Passo 2: Leitura dos Dados Extraídos
- Após a conclusão do parser, leia o arquivo gerado em disco (`view_file` em `ingestion/output/import_payload.json`).

## Passo 3: Validação contra o Golden Set
- Leia também o arquivo de inspeção (`view_file` em `tests/golden-set/INSPECTION.md`) onde constam as métricas esperadas do Golden Set (Questões 1 a 8).
- Analise os dados extraídos no JSON:
  - Verifique se a extração encontrou a mesma quantidade de alternativas e opções.
  - Verifique se a **proveniência** (banca, cargo, ano e número de página) foi registrada corretamente.

## Passo 4: Relatório Quantitativo e Portão de Parada
- Imprima no chat um **relatório quantitativo**, formatado de maneira limpa (pode usar tabela markdown).
- Mostre:
  1. O total de questões extraídas (espera-se ~31).
  2. O resultado da validação das 8 primeiras questões em relação ao `INSPECTION.md` (Enunciado extraído vs esperado, alternativas de A a D presentes, campos de proveniência preenchidos).
- **Importante:** Finalize sua resposta solicitando a aprovação explícita do usuário: "Deseja que eu prossiga com a conexão deste JSON ao backend (Spring Boot)?"

Não execute o fluxo backend até receber essa aprovação explícita (Portão de Parada).
