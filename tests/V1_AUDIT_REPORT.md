# V1 AUDIT REPORT

## A. Requisitos cumpridos
- **ANSWER_SUBMITTED e Event Store Append-Only**: Código no Spring Boot anexa perfeitamente os registros, a tabela do SQLite provou estar sem comandos modificadores (ex. UPDATES) na API.
- **Isolamento de Gabarito (Blindagem)**: A resposta do backend de fato blinda a questão mapeando num DTO específico (`QuestionDTO`) sem `correctOption`.
- **Validações de Domínio**: Limites para `confidenceLevel` (1-5), `activeTimeMs >= 0` e checagem de ID da questão inexistente funcionam, retornando os Status HTTP corretos.
- **Inexistência de Complexidade Indevida**: Stack mantém-se concisa com Java+Spring e Vite+React, sem libs não previstas. OpenViking restrito à documentação como especificado.

## B. Requisitos parcialmente cumpridos
- **QUESTION_PRESENTED**: Encontra-se logicamente codificado no Serviço e grava a resposta corretamente quando acessado. Entretanto, a tabela antes do teste direto na auditoria estava vazia para esse evento, apontando lacuna em testes locais pelo desenvolvedor (provavelmente usou endpoints diretos sem usar o next).

## C. Requisitos não comprovados
- **Testes E2E Completos via Frontend Web**: Como não havia ambiente online automatizado ou um framework tipo Playwright, a verificação ponta a ponta real dependeu do teste de API por linha de comando. A validação manual real necessitará que o usuário rode npm dev e mvnw local.

## D. Problemas encontrados
- **Validação de `selectedOption`**: O envio de uma alternativa como "Z" ou "INVALID" não quebra a aplicação nem retorna 400 Bad Request. Ao contrário, assume a tentativa, comparando se bate com a certa (falha) e registra como `isCorrect: false`.
- **Banco limpo no clone**: A pasta `db/` possui um `.gitignore` de `*.db`, mas não conta com `.gitkeep`. Ao clonar o projeto sem essa pasta, a inicialização falha pois o SQLite tenta criar um arquivo num subdiretório inexistente.
- **Cálculo de `activeTimeMs`**: Foi medido por tempo cronológico (Date.now() - startTime). Trata-se de "elapsed time" e não "active time", o que significa que o relógio não pausa se a aba for ofuscada.

## E. Divergências arquiteturais
Nenhuma violação macro arquitetural (event store foi seguido, sem uso do OpenViking, libs de acordo com especificado).

## F. Riscos técnicos
- **Schema Drift Oculto**: A tabela `questions` foi atualizada via `alter_db.py`. O arquivo `schema.sql` reflete as colunas corretas, mas difere na "ordem" da estrutura local do `fiscalstudy.db` do usuário. Isso pode gerar inconsistências em consultas indexadas posicionais futuramente se houverem.

## G. Dívidas técnicas
- Arquivos soltos e não trackeados em `ingestion/src/api/` (ex: `alter_db.py`, `check_db.py`, `test_flow.py`) e `payload_test.json`.
- Aprimorar o cálculo de `activeTimeMs` no Frontend usando Page Visibility API.

## H. Sugestões para próxima fase
- Adicionar `.gitkeep` em `db/`.
- Validar se `selectedOption` bate com as alternativas existentes no banco (`A, B, C, D, E`).
- Refatorar o Frontend para escutar `document.addEventListener("visibilitychange")` no cálculo do tempo ativo de estudo.
- Implementar E2E manual com validação visual de acordo com o instruído, ou utilizar lib de browser na próxima task.
