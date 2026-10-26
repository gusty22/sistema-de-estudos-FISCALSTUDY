# Contrato de evidência do pipeline R

Atualizado em 26/10/2026. O pipeline integra exports declarados, mas não autentica a identidade de quem os produziu. SHA-256 detecta alteração do arquivo em relação ao checksum fornecido; não prova autoria, assinatura, origem do banco, que o ambiente é de produção nem que os eventos pertencem a uma pessoa real. Os campos `database_source`, `is_production_environment` e `origin_type` são declarações recebidas. Devem ser tratados como requisitos do contrato, não como prova criptográfica.

## Caminho atual

- `adapt_operational_attempts()` preserva `event_id`, `session_id`, `occurred_at` e `origin_type` do CSV; campo ausente fica explícito, sem criar identificadores/datas.
- O pipeline mantém `raw_attempts_df` para auditoria de proveniência e cria `attempts_df` com `select_evaluable_attempts()`. O filtro comum remove resultados sem resposta avaliável e questões anuladas, ausentes ou sob revisão, considerando os dados do evento e do catálogo.
- Métricas, retenção, sinais e avaliações usam `attempts_df`; o perfil ainda examina o conjunto original para não permitir que filtragem oculte origens mistas.
- A validação do catálogo derivado das tentativas é operacional e parcial. Texto/gabarito fonte ausentes não são apresentados como catálogo integralmente verificado.
- Cada execução produz `run_id`, estado explícito e outputs de cold start; dados antigos de avaliação são substituídos quando não há novas observações.

## Proveniência e limite de confiança

O manifesto adjacente `export_manifest.json` ou o caminho configurado por `FISCALSTUDY_EXPORT_MANIFEST` pode declarar origem e checksum. Ausência de manifesto mantém a fonte não verificada; manifesto configurado mas ausente falha explicitamente; checksum inválido nunca autoriza perfil. Mesmo um manifesto íntegro com declarações de origem pessoal não autentica o autor nem comprova que houve aprendizagem. `is_real_student_data` é uma elegibilidade operacional derivada dessas declarações e salvaguardas, não uma medição biográfica/cognitiva nem confirmação independente de um estudante humano.

A fixture de integração é deliberadamente identificada como não produção e deve terminar como `UNVERIFIED_SOURCE`. Teste positivo com campos falsamente de produção não deve ser usado como evidência de que dados reais foram autenticados. A integração automática Java Bridge → manifesto continua pendente; exports reais sem sidecar permanecem inelegíveis para perfil pessoal.

## Estados adaptativos

O FSRS continua autoridade para memória e agenda. O ajuste empírico R é exploratório e não programa revisões. Resultados não avaliáveis não entram nos denominadores; resultado errado após intervalo longo, por si só, não diagnostica dificuldade conceitual. Saídas de pesos exploratórios são vazias e `can_apply=false`. O backend precisa continuar a usar edital, disponibilidade e regras próprias até validar formalmente uma integração.

Veja `LEARNER_MODEL_VALIDATION.md` para comandos e resultados da suíte e `LEARNER_MODEL_EXECUTION_PLAN.md` para pré-requisitos de evolução.
## Diagnóstico exploratório de discrepância FSRS × tentativa

O artefato `metrics/retrieval_surprise_v1.json` relata discrepâncias entre uma previsão de recuperação FSRS pré-atualização e o resultado observável da tentativa. Erro com baixa recuperação estimada não é automaticamente dificuldade conceitual; erro com alta recuperação estimada é uma pergunta de investigação, com causa não resolvida. O artefato é exploratório, não executável e não substitui o FSRS nem o planejador do backend. Entradas sem proveniência/versionamento temporal elegível permanecem não pontuadas.
