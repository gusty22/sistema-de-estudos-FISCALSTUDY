# RobinHood: escopo do concurso

Um concurso concreto sem tópicos cadastrados retorna um ciclo vazio, sem importar disciplinas de outros concursos. O retorno existente informa que é necessário cadastrar o edital; não há criação de tópicos ou alteração de dados históricos.

A seleção global de disciplinas permanece disponível para os valores legados null, vazio, espaços, undefined e NULL. Essa compatibilidade descreve a seleção de tópicos; não afirma normalização de todos os consumidores do identificador. Identificadores concretos são aparados na consulta de tópicos.

Regressões SQLite em memória cobrem concurso vazio com outro edital populado, isolamento entre editais, identificador com espaços e seleção global legada. Validação em cópia isolada com contratos de banco externos: test-compile e as suítes RobinHoodContestScopeRegressionTest, RobinHoodCycleEngineTest, RobinHoodCycleControllerTest e RobinHoodWeightsIntegrationTest: 13 testes, zero falhas, erros ou ignorados, BUILD SUCCESS em 35.990 segundos. Log local: C:/workspace/planning-robinhood-tests.log.

Esta alteração não valida a estimativa de domínio, o orçamento de tempo ou a eficácia pedagógica do ciclo. Essas limitações permanecem tarefas separadas. Não houve migração ou escrita em bancos originais.
