# Problemas Conhecidos e Atenções Técnicas

Registro de casos especiais e cuidados contínuos no desenvolvimento do FiscalStudy:

### 1. Ingestão e OCR de Provas
- **Textos de Apoio Longos**: Provas de bancas como Fundatec, IDCAP e Cebraspe contêm crônicas ou textos de 10.000 caracteres antes de um bloco de 5 questões. É mandatório isolar previamente esses textos (`SUPPORT_PATTERNS`) antes da partição para evitar colisão com enunciados.
- **Gabaritos Multi-Cargo**: Provas em que os conhecimentos básicos são compartilhados entre os cargos (ex: Q1 a Q50) e os conhecimentos específicos começam na questão 51 exigem o mecanismo de fusão de gabarito para não gerar ausência de chaves de resposta.

### 2. Integridade de Banco Local
- **Writes Concorrentes no SQLite**: Manter sempre ativo o modo WAL (`PRAGMA journal_mode=WAL`).
- **Rotina de Backup**: Nunca copiar os arquivos `.db` crus durante operações ativas. Utilizar exclusivamente o endpoint seguro baseado em `VACUUM INTO`.

### 3. Evitar Bola de Neve nas Revisões
- Se o estudante ficar 5 dias sem estudar, o sistema **não** deve acumular 200 revisões de forma punitiva. As pendências são diluídas pedagogicamente pelo `RevisionCalendarService` com limite de carga diária configurável.

### 4. Idempotência e Replay de Tentativas no Backend
- **Replay com Evidência Divergente**: Submissões que repetem o mesmo `attemptId` com parâmetros divergentes (como indicação de ajuda ou causa de erro alterada) devem sempre responder `409 Conflict` para não mascarar falhas no cliente ou criar inconsistência na auditoria. Correções posteriores devem utilizar o endpoint de anotações com novos eventos dedicados.
- **Maven Wrapper em Ambientes Limpos**: Manter explicitamente versionado `.mvn/wrapper/maven-wrapper.properties` com hashes SHA-256 e SHA-512 do Apache Maven fixados para impedir falhas de bootstrap em containers ou worktrees limpos.
