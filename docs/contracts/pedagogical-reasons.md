# Justificativas pedagógicas de revisão

## Contrato

`scheduleAdaptiveRevision` descreve o resultado observado e identifica a causa, quando fornecida, como relato do estudante. Erro com confiança alta é um motivo operacional para investigar, sem estabelecer confusão conceitual, dificuldade intrínseca ou esquecimento. Confiança ausente não é apresentada como declaração do estudante. Um acerto não comprova domínio ou retenção duradoura. O indicador de fricção não é uma medição de esforço cognitivo.

Esta alteração preserva condições, estágios, prioridades, intervalos, SQL e a implementação FSRS. Os intervalos existentes são regras operacionais, não evidência de eficácia individual. A avaliação de memória e a investigação pedagógica continuam responsabilidades distintas.

## Validação em 25/10/2026

Diretório descartável: `C:/workspace/FiscalStudy-pedagogy-validation`. A cópia contém as dependências de banco e analytics já publicadas, sem incorporá-las à branch desta entrega. Nenhum banco original ou integração externa foi usado.

Executado `test-compile` e as suítes `PedagogicalReasonRegressionTest`, `ErrorTaxonomyRegressionTest` e `RevisionCalendarServiceTest`: **17 testes, zero falhas, erros ou ignorados**. Oito testes novos usam SQLite em memória e relógio fixo, verificando justificativas e preservação de estágio, tipo, intervalo, data e prioridade. A assertion antiga que exigia o diagnóstico literal de falsa fluência foi atualizada.

A primeira tentativa foi interrompida após falha de autoattach ByteBuddy em named pipe. A execução aprovada pré-carregou a mesma dependência já instalada via `-DargLine=-javaagent:C:/Users/washi/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar`, sem instalação ou alteração de dependências. Evidência local: `C:/workspace/pedagogy-tests-final.log`.

## Limitação e próximo contrato

A mudança textual original preservou o comportamento histórico de `isCorrect=null`. A correção independente subsequente passou a ignorar resultados não avaliáveis antes de qualquer consulta, gravação ou evento, seguindo a elegibilidade já aplicada em `AttemptSubmissionService` e `LearningEvidenceService`. A tentativa não avaliável continua válida e preservada pelo serviço de submissão; apenas não sustenta agendamento baseado em resultado. Não se declara homologação visual ou eficácia pedagógica com estes testes técnicos.

## Recuperação

Mudança sem migração: reverter o commit restaura as mensagens anteriores. Histórico de respostas e revisões persistidas não foi reescrito. Nenhum merge na main está autorizado nesta entrega.

## Regressão de resultados não avaliáveis

Após a guarda de resultado nulo, executados novamente 	est-compile e quatro suítes (UngradedRevisionRegressionTest, PedagogicalReasonRegressionTest, ErrorTaxonomyRegressionTest, RevisionCalendarServiceTest): **19 testes, zero falhas, erros ou ignorados**, em 46,834 s. Os dois cenários novos verificam agenda vazia e revisão existente integralmente preservada, com ausência de eventos, apesar de confiança alta, causa relatada, chute e fricção. Log local: C:/workspace/ungraded-revision-tests.log. Sem migração ou alterações de dados históricos.
