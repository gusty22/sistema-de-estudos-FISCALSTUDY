# RobinHood: escopo do concurso

Um concurso concreto sem tópicos cadastrados retorna um ciclo vazio, sem importar disciplinas de outros concursos. O retorno existente informa que é necessário cadastrar o edital; não há criação de tópicos ou alteração de dados históricos.

A seleção global de disciplinas permanece disponível para os valores legados null, vazio, espaços, undefined e NULL. Essa compatibilidade descreve a seleção de tópicos; não afirma normalização de todos os consumidores do identificador. Identificadores concretos são aparados na consulta de tópicos.

Regressões SQLite em memória cobrem concurso vazio com outro edital populado, isolamento entre editais, identificador com espaços e seleção global legada. Validação em cópia isolada com contratos de banco externos: test-compile e as suítes RobinHoodContestScopeRegressionTest, RobinHoodCycleEngineTest, RobinHoodCycleControllerTest e RobinHoodWeightsIntegrationTest: 13 testes, zero falhas, erros ou ignorados, BUILD SUCCESS em 35.990 segundos. Log local: C:/workspace/planning-robinhood-tests.log.

Esta alteração não valida a estimativa de domínio, o orçamento de tempo ou a eficácia pedagógica do ciclo. Essas limitações permanecem tarefas separadas. Não houve migração ou escrita em bancos originais.

## Contagem de ciclos: identificador como dado

A consulta de CYCLE_COMPLETED usa parâmetro SQL para aggregate_id. Identificadores com apóstrofo ou conteúdo semelhante a uma expressão SQL são tratados como valores literais, sem ampliar a seleção de eventos. A condição anterior permanece: somente identificador Java null solicita contagem global; vazio, espaços e sentinels textuais permanecem valores literais nessa consulta. A normalização desigual entre consumidores é uma limitação preexistente, não uma garantia de isolamento de todo o histórico analítico.

Três regressões adicionais verificam identificador com apóstrofo, tentativa de alterar o predicado por OR e contagem global explícita. Reprodução SQLite em memória: a query concatenada com identificador malformado contava três eventos, incluindo ANSWER_SUBMITTED; a versão parametrizada conta apenas o CYCLE_COMPLETED do identificador literal.

Validação centralizada em cópia descartável com as alterações Maestro de escopo: test-compile e 30 testes aprovados, zero falhas, erros ou ignorados, BUILD SUCCESS em 02:02 min. RobinHoodContestScopeRegressionTest contém sete casos aprovados. Evidência: C:/workspace/planning-combined-tests.log. As baterias se sobrepõem e não devem ser somadas. A suíte completa do sistema e a homologação visual não foram executadas nesta alteração.
