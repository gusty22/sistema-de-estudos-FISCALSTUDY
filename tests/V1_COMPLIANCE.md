# AUDITORIA DE CONFORMIDADE — V1

## 1. Tabela de Conformidade

| Requisito | Implementado? | Testado? | Evidência | Status |
|-----------|---------------|----------|-----------|--------|
| **QUESTION_PRESENTED no DB** | Sim | Sim | Código em `QuestionSelectionService.java:27` chama `appendEvent`. Testado via `Invoke-RestMethod` no `/api/v1/questions/next`, evento foi salvo no DB. (Nota: não havia sido executado antes pelo frontend real). | Parcialmente Cumprido |
| **ANSWER_SUBMITTED Append-Only** | Sim | Sim | Registro verificado via SQL no `db/fiscalstudy.db` contém as chaves exigidas. Código (`AttemptSubmissionService.java:36`) faz apenas inserção. | Cumprido |
| **activeTimeMs sem ser apenas elapsed time** | Não | Sim | `frontend/src/components/QuestionViewer.tsx:59` calcula `Date.now() - startTime`. Trata-se de tempo corrido, sem considerar abas ocultas. | Não Cumprido |
| **Gabarito não vaza** | Sim | Sim | Retorno de `GET /api/v1/questions/next` mapeado no `QuestionDTO` não inclui `correctOption`. | Cumprido |
| **Rejeitar confidenceLevel = 0/6** | Sim | Sim | Teste HTTP com payload enviando `confidenceLevel: 0` e `6` retornaram `400 Bad Request`. | Cumprido |
| **Rejeitar activeTimeMs < 0** | Sim | Sim | Teste HTTP com payload enviando `activeTimeMs: -100` retornou `400 Bad Request`. | Cumprido |
| **Rejeitar questionId inexistente** | Sim | Sim | Teste HTTP para `questionId: 99999` retornou `404 Not Found`. | Cumprido |
| **Rejeitar selectedOption inválida** | Não | Sim | Teste HTTP enviando `selectedOption: "INVALID"` retornou `{"isCorrect": false}` em vez de 400. | Não Cumprido |
| **Banco inicia do zero** | Não | Sim | O Git não rastreia diretórios vazios. Se não há `.gitkeep` em `db/`, Spring Boot falha ao tentar criar o arquivo dentro dele. | Não Cumprido |
| **OpenViking restrito à análise** | Sim | Sim | Buscas nos códigos confirmam ausência total. | Cumprido |
| **Sem complexidade inadvertida** | Sim | Sim | O frontend possui bibliotecas mínimas (React/Vite). Backend sem Kafka/Redis. | Cumprido |

## 2 a 13. Resumo Técnico
Ver documentação em `/tests/V1_AUDIT_REPORT.md`.
