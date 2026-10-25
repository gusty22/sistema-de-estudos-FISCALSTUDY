# Classificação e proveniência de conteúdos

## Contrato implementado

API /api/v1/question-classification, uso pessoal/local. Uma questão pode ter vínculos com tópicos de diferentes editais. Cada decisão é um registro novo; o estado vigente de cada par questão/tópico é a última inserção (rowid SQLite), não uma alteração histórica. SUGGESTED não alimenta cobertura confirmada. CONFIRMED e REJECTED exigem origin HUMAN, reviewer e evidence. Confiança é informada pelo responsável, não uma medida validada de acurácia.

- GET /coverage?concursoId: total global de questões, questões com vínculos confirmados no escopo, não classificadas no escopo, vínculos sugeridos e confirmados. O denominador é o banco global; não equivale a percentual de cobertura do edital. qualityValidated=false até avaliação externa da curadoria.
- GET /topics?concursoId: tópicos existentes; sua existência não comprova classificação das questões.
- GET /questions?unclassified=true&limit=50&offset=0: fila paginada (limite máximo 100).
- GET /questions/{id}: histórico completo, inclusive sugestões/rejeições.
- POST /questions/{id}: {topicId,status,confidence,origin,reviewer,evidence}.
- GET /questions/{id}/family: SHA-256 do conteúdo literal enunciado, options_json e correct_option separados por U+001E; versão EXACT_CONTENT_V1. Não normaliza alternativas, não afirma equivalência conceitual. A curadoria registra essa identidade em question_families. Não há exclusão de ocorrências.

Não foi implementada classificação automática em massa. É necessário um conjunto humano rotulado e critérios de avaliação antes de estimar qualidade ou usar sugestões como verdade. Confirmações devem examinar questão completa, tópico e origem, não apenas palavras-chave.

## Resumos

A geração local disponível produz TEMPLATE ou USER_EXCERPT. Trecho fornecido é preservado literalmente, mas não certificado contra PDF. sourceVerified=false e sourceRetrieval=NOT_PERFORMED. Títulos/páginas não são evidência de leitura; páginas informadas permanecem identificadas como não verificadas. Templates não geram flashcards nem pegadinhas assertivas. Novas instalações não recebem demonstrações semeadas. Registros antigos são preservados e retornados como LEGACY_UNVERIFIED quando não possuem metadados novos.

Síntese ancorada em documentos continua pendente: exige recuperação de texto com localização verificável e revisão das afirmações. Não confundir este roteiro explícito com essa funcionalidade futura.

## Ingestão

Python e Java compartilham backend/src/main/resources/staging-schema.sql; FISCALSTUDY_STAGING_SCHEMA permite distribuição standalone explícita. Ausência do schema é erro. Conexões habilitam FK. Inventário repetido de arquivo com hash igual preserva IDs e conteúdo; arquivo alterado exige revisão/arquivamento explícito. Reprocessamento de questões modificadas manualmente, SOURCE_VERIFIED ou PUBLISHED é bloqueado. Caminho do arquivo deve permanecer no acervo configurado.

Os testes usam TemporaryDirectory e PDFs/fixtures locais. Não dependem do acervo Downloads nem do staging original.

### Seleção por vínculo confirmado
GET /api/v1/question-classification/questions?unclassified=false&topicId=<id>&limit=50&offset=0 retorna apenas ocorrências com último vínculo confirmado nesse tópico. Sugestões não são evidência confirmada. Rejeitar o vínculo preserva questão e histórico e retira a ocorrência da seleção do tópico. Não combinar topicId com unclassified=true.
