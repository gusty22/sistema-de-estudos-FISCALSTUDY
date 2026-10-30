## ADDED Requirements

### Requirement: Host-authenticated observation only

O backend SHALL produzir inventário/evidências a partir de repositórios locais; o transporte MUST autenticar bytes de entrada e saída fora do JSON. Dados externos, flags e especialistas importados MUST NOT conferir autoridade. O recurso SHALL iniciar desativado, sem chave operacional criada.

#### Scenario: Authenticated host request
- **WHEN** Java captura um snapshot sintético de SQLite temporário e chama R
- **THEN** `orchestrate_learning()` executa especialistas, admissão e três políticas sobre a mesma admissão, retornando rastro validado com `OBSERVATION_ONLY`, `can_apply=false`, `can_schedule=false`.

#### Scenario: Invalid input or unavailable engine
- **WHEN** origem não autenticada, escopo/versão inválidos, cutoff violado, timeout ou saída incompleta/adulterada são encontrados
- **THEN** shadow falha de modo controlado ou abstém conforme o contrato, sem afetar estudo, FSRS, pesos, calendário ou eventos.

#### Scenario: Ordinary cold-start is not a synthetic installation
- **WHEN** o host operacional não tem respostas
- **THEN** o estado científico permanece pendente; somente a seam interna autenticada das fixtures pode produzir registro sintético de laboratório.

#### Scenario: Historical response cutoff and current inventory
- **WHEN** respostas são limitadas por cutoff histórico mas o inventário é lido agora
- **THEN** a autoridade curricular vale apenas no instante observado pelo produtor; escopo histórico ausente é omitido como desconhecido, sem preencher concurso/estudante pelo candidato atual.

### Requirement: Concrete curriculum and canonical memory

Cada candidato SHALL referenciar questão publicada e vínculo confirmado em tópico/edital/concurso explícitos. Revisão SHALL depender de estado FSRS compatível e temporalmente válido. Valores ausentes de frequência, duração prevista, pré-requisitos e ganho MUST permanecer desconhecidos. As regras originais de admissão MUST ser preservadas.

#### Scenario: Cold curriculum
- **WHEN** há inventário confirmado sem histórico pessoal
- **THEN** política inicial conservadora existente pode propor diagnóstico reversível, respeitando tempo, sem inferência pessoal.

#### Scenario: No inventory or insufficient evidence
- **WHEN** não há candidato admissível ou evidência contextual suficiente
- **THEN** a resposta contém abstenção e motivos reconstruíveis.

### Requirement: Reproducible pending evaluation

Mesma entrada SHALL produzir mesma decisão/identidade sem caminhos/horários acidentais, com canonização recursiva de mapas, fecho das fontes executadas e runtime registrados. O instante explícito de captura faz parte da entrada; uma captura posterior é outra entrada. O laboratório existente SHALL consumir e reexecutar registros sintéticos; execução/desfecho ausentes MUST permanecer pendentes, sem contrafactuais, propensões ou causalidade fabricados.

#### Scenario: Replay and operational preservation
- **WHEN** uma entrada estável é executada duas vezes
- **THEN** decisões coincidem e o banco operacional temporário permanece byte a byte idêntico; registro adulterado é rejeitado pelo replay.
