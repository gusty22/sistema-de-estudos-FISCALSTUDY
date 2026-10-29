# Gate de integração contextual — 29/10/2026

Base: `origin/main = b13cefabe3d9fd3d4bc02515a04e7645dfe677ee`, merge da PR #42. O commit `0eb98d1108a0aca4965d567fe23b0e19548ad5f5` é ancestral da base. Trabalho na branch `fix/contextual-integration-gate`; nenhum merge automático.

## Execução integrada

`orchestrate_learning()` valida identidade, integridade temporal e procedência do snapshot; executa e valida os especialistas; aplica as regras originais de autoridade, alvo, escopo, conflito, edital, material, pré-requisitos, risco e tempo. Apenas o conjunto admitido segue para a vinculação das necessidades e para as três políticas. Nenhuma política amplia a admissão. As funções de política exigem o gate interno tipado do orquestrador: um objeto JSON com os mesmos campos não o substitui. Esse marcador protege a fronteira de transporte, sem autenticar código R de um chamador arbitrário. A exceção curricular de início sem histórico, que já existia, agora exige uma entrada de inventário autorizada pelo host e passa pelas mesmas restrições originais.

As necessidades contextuais são produzidas a partir dos vínculos confirmados, antes da escolha. Sem vínculo, a necessidade permanece `UNDETERMINED`; uma oportunidade curricular admissível continua podendo ser proposta sem alegar déficit pessoal. O resultado reúne `admissible_candidates`, `rejected_candidates`, `pedagogical_needs`, `policy_comparison`, `proposal`, `decision_trace`, `decision_inputs` e o ledger de avaliação. A proposta principal vem de `EVIDENCE_CONTEXTUAL_V1`. A política antiga permanece identificada como `admission_policy`.

As políticas `EVIDENCE_CONTEXTUAL_V1`, `SHORTEST_ADMISSIBLE_V1` e `CURRICULAR_CONSERVATIVE_V1` registram o mesmo `evaluated_candidates`. A contextual usa regras configuradas: memória vencida com risco confirmado; lacuna conceitual/erro de execução observado; necessidade de avaliar transferência; oportunidade curricular conservadora. Não há pesos aprendidos nem estimativa de ganho. Revisão/aplicação sem evidência contextual suficiente não recebe escolha contextual apenas por existir no inventário. Todos os resultados permanecem experimentais, com `can_apply=false` e `can_schedule=false`.

## Fronteira de confiança e evidência

`authority_registry` é configuração do chamador confiável do Motor R. Nunca deve ser preenchido com registros recebidos de candidatos, JSON, avaliações externas ou artefatos exportados. A CLI não importa `authority_registry`, `specialists`, `gate` ou `provenance` declarados no pedido. Não foi criado um importador operacional novo.

Os campos `evidence_verified`, `fsrs_due_verified`, `memory_risk_verified` e `inventory_verified` são declarações inertes. Sua ausência/NA não muda evidência confirmada nem produz ranks de comprimento zero; tipos diferentes de booleano são rejeitados. `evidence_need_type` externo também não determina a necessidade: ela vem do resultado validado do especialista. Booleanos de resultado (`due`, `memory_risk`) exigem valores lógicos escalares conhecidos quando presentes. `review_capacity_verified` não confere prioridade: sem um produtor autorizado de evidência de capacidade no fluxo atual, a capacidade permanece `NOT_ESTABLISHED`. Nenhum especialista novo foi criado para preencher essa lacuna.

Para uma condição contextual, cada referência deve existir no snapshot e apresentar:

- `event_id`, `source_id`, `scope_id`, `evidence_type`, `evidence_version`, `occurred_at` e `valid_until`;
- especialista autorizado pelo validador original, no mesmo `run_id`, escopo e alvo compatível;
- modelo/versão autorizados e fonte incluída no `source_ids` do especialista e da entrada confiável;
- entrada confiável com `scope_id`, `source_ids`, `evidence_types`, `evidence_versions`, `valid_from` e `valid_until` compatíveis;
- ocorrência anterior ao cutoff do especialista e validade até o cutoff da execução.

Versão de evidência e versão do modelo são verificadas separadamente. Para memória, o resultado autorizado precisa confirmar tanto `due` quanto `memory_risk`. Alterar flags no candidato não substitui uma dessas condições.

Para início sem histórico, a entrada confiável tem `target=CURRICULUM_INVENTORY`, `validation_status=CONFIGURED_POLICY`, `can_propose=TRUE`; identifica `inventory_id`, `inventory_version`, `curriculum_source_id`, escopo, concurso e validade. Atividade, disponibilidade, edital, pré-requisitos, custo e risco precisam corresponder ao registro confiável. A referência ao inventário é evidência curricular, nunca evidência de conhecimento pessoal.

A CLI usa `audit_learning_provenance()` sobre os eventos e os bytes do CSV através do auditor existente. O resultado recebe um vínculo em atributo R, recalculado contra os eventos da execução. Os três flags de procedência sem esse vínculo não ativam a política pessoal automática. Além disso, o host deve atestar custódia independente com o atributo R `trusted_source_authorized`; a auditoria de bytes não cria essa atestação. A CLI atual não tem um produtor confiável dessa autorização e não a recebe do JSON. Sem ela, inclusive os especialistas descritivos mantêm a elegibilidade pessoal desativada. O atributo é uma precondição do chamador R confiável, não uma assinatura nem um mecanismo para autenticar código R arbitrário. JSON não transporta esse atributo; sua importação exige nova auditoria na entrada confiável. O vínculo e os hashes verificam consistência dos dados, não autenticidade independente da autoria ou benefício pedagógico.

## Rastro e reprodução

`PEDAGOGICAL_DECISION_TRACE_V1` evolui aditivamente para schema `1.1.0`. `eligible_evidence` preserva o formato de vetor de referências, agora com IDs reais de eventos ou inventário. `evidence_references` contém os objetos completos correspondentes. `rejected_candidates` também preserva o vetor de IDs; os códigos ficam em `rejection_details`. Não se usam IDs de candidatos como se fossem evidências. O rastro registra admissão e rejeições com códigos, falhas de vinculação contextual, regras/ranks executados por candidato, critérios de desempate e evidências determinantes. As regras são emitidas na execução de cada política. O desempate usa rank, minutos e ordem radix do identificador.

O SHA-256 canônico identifica snapshot, contexto, todos os candidatos — inclusive rejeitados —, especialistas validados, estado de verificação da fonte e configuração de autoridade usada. A comparação e o rastro precisam coincidir com esses insumos. O rastro também reproduz as escolhas para rejeitar alterações na comparação. Há testes negativos para outro run, outro cutoff, outro conjunto de candidatos e escolha adulterada. Hash é identidade de insumos, não assinatura de autorização.

De `analytics-engine`, com R >= 4.5.1, `jsonlite` e provedor SHA-256 já exigidos pelo projeto:

```sh
Rscript tests/test_runner.R
LC_ALL=C Rscript tests/test_runner.R
Rscript run_learning_orchestrator.R tests/fixtures/orchestration/request.json /tmp/cli-result.json
Rscript tests/fixtures/contextual_gate/reproduce.R /tmp/memory-one.json memory
Rscript tests/fixtures/contextual_gate/reproduce.R /tmp/memory-two.json memory
cmp /tmp/memory-one.json /tmp/memory-two.json
```

As saídas devem ser arquivos novos; a escrita recusa sobrescrever artefatos. O exemplo aceita `cold`, `insufficient_inventory`, `memory`, `gap`, `transfer`, `execution`, `time` e `unknown`. Todos os dados/configurações simulados ficam em `tests/fixtures/contextual_gate/`, rotulados como fixtures sintéticas. O exemplo não é importado pela CLI de produção nem registrado como histórico pessoal. Seu registro de especialistas usa `CONFIGURED_POLICY`, sem alegar validação de modelo operacional.

O pedido CLI sintético existente se abstém, pois não tem autoridade pessoal. Os cenários positivos de memória/lacuna/transferência/execução atravessam a função real do orquestrador com configuração de host simulada e fontes identificadas. A CLI atual não possui um produtor operacional autorizado desses resultados; esta rodada não inventa esse produtor, nem promove os especialistas descritivos a autoridades de memória. A referência a catálogo também precisa vir do host, não do pedido JSON. Essa restrição é intencional e preserva desconhecidos quando o ambiente não oferece confirmação.

## Resultado e limites científicos

Resultados completos, versões, comandos, contagens e falhas herdadas: [registro de validação](validation/contextual-gate/results.txt).

As fixtures verificam correção do encadeamento, coerência das regras, rejeição de entradas indevidas, segregação de procedência e reprodução de software. A seleção esperada em um cenário construído não demonstra superioridade pedagógica. Não houve aplicação operacional, intervenção em estudante, acompanhamento independente ou medição causal. Ganho esperado e benefício observado permanecem não estabelecidos; o ledger conserva resultados futuros como pendentes.

Não foram alterados FSRS, SQLite operacional, calendário, frontend, Core App, agendadores, redes neurais ou geração de flashcards. O Graphify exigido pela orientação local não estava instalado; a localização foi feita por buscas seletivas nos arquivos indicados. O wrapper Maven do checkout não contém `.mvn/wrapper/maven-wrapper.properties`. A compilação equivalente `test-compile` passou usando Maven 3.9.11/JDK 21 isolados em `/tmp`, com target Java 17. Os oito testes existentes de `ProspectivePredictionIntegrationTest` passaram em SQLite `@TempDir`; as duas exportações JSON sintéticas geradas permitiram executar também `tests/test_prospective_ledger.R` na base e na branch, ambas com exit 0. Nenhum arquivo de backend, POM, wrapper ou banco operacional foi modificado.
